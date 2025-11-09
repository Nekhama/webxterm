"""
Connection Manager
Handles active terminal connections and their lifecycle
"""

import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active terminal connections
    """

    def __init__(self):
        self.connections: Dict[str, any] = {}
        self.connection_stats = {
            "total_connections": 0,
            "active_connections": 0
        }

    async def add_connection(self, connection_id: str, connection):
        """Add a new connection"""
        self.connections[connection_id] = {
            "connection": connection,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        self.connection_stats["total_connections"] += 1
        self.connection_stats["active_connections"] += 1

        logger.info(f"Connection {connection_id} added. Active: {self.connection_stats['active_connections']}")

    async def get_connection(self, connection_id: str):
        """Get a connection by ID"""
        if connection_id in self.connections:
            self.connections[connection_id]["last_activity"] = datetime.utcnow()
            return self.connections[connection_id]["connection"]
        return None

    async def remove_connection(self, connection_id: str):
        """Remove and clean up a connection"""
        logger.debug(f"[CONN_MGR] Starting removal of connection {connection_id}")

        if connection_id in self.connections:
            connection_info = self.connections[connection_id]
            connection = connection_info["connection"]

            logger.debug(f"[CONN_MGR] Connection found - Type: {type(connection).__name__}")
            logger.debug(f"[CONN_MGR] Connection details: {connection_info}")

            try:
                logger.debug(f"[CONN_MGR] Step 1: Calling close() on {type(connection).__name__} connection")
                # Close the underlying protocol connection (Telnet/SSH)
                await connection.close()
                logger.debug(f"[CONN_MGR] Step 1: Protocol connection closed successfully")
            except Exception as e:
                logger.error(f"[CONN_MGR] Step 1: ERROR closing protocol connection {connection_id}: {str(e)}")

            # Remove from active connections
            logger.debug(f"[CONN_MGR] Step 2: Removing from active connections dictionary")
            del self.connections[connection_id]
            self.connection_stats["active_connections"] -= 1
            logger.debug(f"[CONN_MGR] Step 2: Removed successfully. Active connections: {self.connection_stats['active_connections']}")

            logger.info(f"[CONN_MGR] Connection {connection_id} removal completed. Active connections: {self.connection_stats['active_connections']}")
        else:
            logger.warning(f"[CONN_MGR] Attempted to remove non-existent connection: {connection_id}")
            logger.debug(f"[CONN_MGR] Available connections: {list(self.connections.keys())}")
            logger.warning(f"尝试移除不存在的连接: {connection_id}")

    async def get_stats(self):
        """Get connection statistics"""
        return {
            "active_connections": self.connection_stats["active_connections"],
            "total_connections": self.connection_stats["total_connections"],
            "connections": [
                {
                    "id": conn_id,
                    "created_at": info["created_at"],
                    "last_activity": info["last_activity"]
                }
                for conn_id, info in self.connections.items()
            ]
        }

    async def cleanup_inactive_connections(self, max_idle_minutes: int = 60):
        """Clean up connections that have been inactive for too long"""
        current_time = datetime.utcnow()
        inactive_connections = []

        for conn_id, info in self.connections.items():
            idle_time = (current_time - info["last_activity"]).total_seconds() / 60
            if idle_time > max_idle_minutes:
                inactive_connections.append(conn_id)

        for conn_id in inactive_connections:
            logger.info(f"Cleaning up inactive connection {conn_id}")
            await self.remove_connection(conn_id)

        return len(inactive_connections)

    async def get_active_connection_count(self):
        """Get the number of active connections"""
        return len(self.connections)