"""
Connection API endpoints
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.responses import JSONResponse
import json
import asyncio
import logging
import uuid
from typing import Dict

from ..core.database import get_db, SessionRepository
from ..models.session import ConnectionRequest
from ..services.connection_manager import ConnectionManager
from ..services.ssh_key_manager import SSHKeyManager
from ..protocols.factory import ConnectionFactory

router = APIRouter()

# Global connection manager
connection_manager = ConnectionManager()

logger = logging.getLogger(__name__)


@router.post("/connect")
async def initiate_connection(
    connection_request: ConnectionRequest,
    db: SessionRepository = Depends(get_db)
):
    """
    Initiate a new terminal connection
    """
    try:
        # Generate unique connection ID
        connection_id = str(uuid.uuid4())

        # If ssh_key_id is provided, fetch the SSH key and use it
        if connection_request.ssh_key_id:
            try:
                ssh_key_manager = SSHKeyManager()
                ssh_key = await ssh_key_manager.get_key_by_id(connection_request.ssh_key_id)
                if ssh_key:
                    # Override private_key and passphrase with the stored SSH key
                    connection_request.private_key = ssh_key.private_key
                    connection_request.passphrase = ssh_key.passphrase
                    logger.info(f"Using SSH key: {ssh_key.name} for connection")
                else:
                    logger.warning(f"SSH key {connection_request.ssh_key_id} not found, proceeding without it")
            except Exception as key_error:
                logger.error(f"Failed to load SSH key: {str(key_error)}")
                # Continue with connection even if key loading fails

        # Create connection based on type
        connection = await ConnectionFactory.create_connection(
            connection_request.connection_type,
            connection_request
        )

        # Store connection in manager
        await connection_manager.add_connection(connection_id, connection)

        # Update session last_used if session_id provided
        if connection_request.session_id:
            # TODO: Update session last_used timestamp
            pass

        return {
            "connection_id": connection_id,
            "status": "success",
            "encoding": connection.encoding or "utf-8"
        }

    except Exception as e:
        logger.error(f"Connection failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.websocket("/ws/{connection_id}")
async def websocket_endpoint(websocket: WebSocket, connection_id: str):
    """
    WebSocket endpoint for terminal communication
    """
    await websocket.accept()
    logger.debug(f"[WEBSOCKET] WebSocket连接开始 {connection_id}")

    try:
        # Get connection from manager
        connection = await connection_manager.get_connection(connection_id)
        if not connection:
            await websocket.close(code=4000, reason="Connection not found")
            return

        # Set WebSocket for this connection
        connection.set_websocket(websocket)

        # Send initial data if connection is already established
        # This helps catch any data that was generated before WebSocket connection
        logger.debug(f"[WEBSOCKET] WebSocket established for connection {connection_id}")

        # Start connection tasks
        async def handle_input():
            """Handle input from WebSocket"""
            logger.debug(f"[WEBSOCKET] handle_input开始 {connection_id}")
            try:
                while True:
                    message_type = await websocket.receive()

                    if message_type["type"] == "websocket.receive":
                        if "text" in message_type:
                            # Handle text messages (JSON)
                            data = message_type["text"]
                            message = json.loads(data)

                            if "data" in message:
                                await connection.send_data(message["data"])
                            elif "resize" in message:
                                cols, rows = message["resize"]
                                await connection.resize_terminal(cols, rows)
                        else:
                            logger.warning("Received unknown message type")
                    elif message_type["type"] == "websocket.disconnect":
                        # WebSocket disconnect received, break out of loop
                        logger.debug(f"[WEBSOCKET] WebSocket disconnect received for connection {connection_id}")
                        break
                    else:
                        logger.warning(f"Unexpected message type: {message_type['type']}")
                        break

            except WebSocketDisconnect:
                logger.debug(f"[WEBSOCKET] handle_input WebSocketDisconnect {connection_id}")
            except Exception as e:
                logger.error(f"WebSocket input error: {str(e)}")
            finally:
                logger.debug(f"[WEBSOCKET] handle_input finished for {connection_id}")

        async def handle_output():
            """Handle output from connection"""
            logger.debug(f"[WEBSOCKET] handle_output开始 {connection_id}")
            try:
                async for data in connection.read_output():
                    # 检查WebSocket状态，如果已断开则立即退出
                    if websocket.client_state.name != "CONNECTED":
                        logger.warning("WebSocket not connected, breaking output loop")
                        break

                    try:
                        # Support both text and binary data output
                        if isinstance(data, bytes):
                            await websocket.send_bytes(data)
                        else:
                            await websocket.send_text(data)
                    except Exception as send_error:
                        logger.warning(f"Failed to send data to WebSocket: {send_error}")
                        break

            except Exception as e:
                logger.error(f"WebSocket output error: {str(e)}")
            finally:
                logger.debug(f"[WEBSOCKET] handle_output finished for {connection_id}")

        # Run both tasks concurrently
        logger.debug(f"[WEBSOCKET] 开始创建任务 {connection_id}")
        input_task = asyncio.create_task(handle_input())
        output_task = asyncio.create_task(handle_output())

        logger.debug(f"[WEBSOCKET] 开始等待任务完成 {connection_id}")
        done, pending = await asyncio.wait(
            [input_task, output_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        logger.debug(f"[WEBSOCKET] 有任务完成，取消剩余任务 {connection_id}")
        # Cancel any remaining tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        logger.debug(f"[WEBSOCKET] 所有任务已完成 {connection_id}")

    except WebSocketDisconnect:
        logger.debug(f"[WEBSOCKET] WebSocketDisconnect exception at top level for {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        # Clean up connection - this will properly close the underlying Telnet/SSH connection
        logger.debug(f"[WEBSOCKET] 进入finally块 {connection_id}")
        logger.debug(f"[CLEANUP] 开始清理连接 {connection_id}")
        logger.debug(f"[CLEANUP] WebSocket状态: {websocket.client_state.name}")

        try:
            logger.debug(f"[CLEANUP] Step 1: Removing connection from connection manager")
            await connection_manager.remove_connection(connection_id)
            logger.debug(f"[CLEANUP] Step 1: Connection removed successfully")
        except Exception as e:
            logger.error(f"[CLEANUP] ERROR in Step 1: {str(e)}")

        # Gracefully close WebSocket if still connected
        try:
            if websocket.client_state.name == "CONNECTED":
                logger.debug(f"[CLEANUP] Step 2: Closing WebSocket (state: CONNECTED)")
                await websocket.close()
                logger.debug(f"[CLEANUP] Step 2: WebSocket closed successfully")
            else:
                logger.debug(f"[CLEANUP] Step 2: WebSocket already closed (state: {websocket.client_state.name})")
        except Exception as e:
            # WebSocket might already be closed, ignore the error
            logger.debug(f"[CLEANUP] Step 2: WebSocket close error (expected if already closed): {str(e)}")

        logger.debug(f"[CLEANUP] 连接 {connection_id} 清理完成")


@router.get("/status")
async def connection_status():
    """
    Get connection status and statistics
    """
    stats = await connection_manager.get_stats()
    return {
        "active_connections": stats["active_connections"],
        "total_connections": stats["total_connections"],
        "status": "healthy"
    }
