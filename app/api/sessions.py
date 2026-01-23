"""
Session management API endpoints (updated for native SQLite)
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid
from datetime import datetime

from ..core.database import get_db
from ..models.session import (
    SessionConfigCreate,
    SessionConfigUpdate,
    SessionConfigResponse,
    SessionConfigWithSecrets
)
from ..services.crypto import encrypt_data, decrypt_data

router = APIRouter()


@router.post("/", response_model=SessionConfigResponse)
async def create_session(
    session_data: SessionConfigCreate,
    db=Depends(get_db)
):
    """
    Create a new session configuration
    """
    try:
        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Prepare session data for database
        db_session_data = {
            "id": session_id,
            "name": session_data.name,
            "connection_type": session_data.connection_type,
            "hostname": session_data.hostname,
            "port": session_data.port,
            "username": session_data.username,
            "password": encrypt_data(session_data.password) if session_data.password else None,
            "private_key": encrypt_data(session_data.private_key) if session_data.private_key else None,
            "passphrase": encrypt_data(session_data.passphrase) if session_data.passphrase else None,
            "ssh_key_id": session_data.ssh_key_id,
            "group_name": session_data.group_name,
            "encoding": session_data.encoding,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": session_data.metadata or {}
        }

        # Create session in database
        created_session = db.create(db_session_data)

        # Convert to response model (exclude sensitive data)
        return SessionConfigResponse(
            id=created_session["id"],
            name=created_session["name"],
            connection_type=created_session["connection_type"],
            hostname=created_session["hostname"],
            port=created_session["port"],
            username=created_session["username"],
            ssh_key_id=created_session.get("ssh_key_id"),
            group_name=created_session["group_name"],
            encoding=created_session["encoding"],
            created_at=created_session["created_at"],
            last_used=created_session["last_used"],
            metadata=created_session["metadata"]
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[SessionConfigResponse])
async def list_sessions(
    group_name: Optional[str] = None,
    connection_type: Optional[str] = None,
    db=Depends(get_db)
):
    """
    List all session configurations
    """
    sessions = db.get_all(group_name=group_name, connection_type=connection_type)

    # 容错处理：过滤无效的会话配置
    valid_sessions = []
    for session in sessions:
        try:
            valid_sessions.append(
                SessionConfigResponse(
                    id=session["id"],
                    name=session["name"],
                    connection_type=session["connection_type"],
                    hostname=session["hostname"],
                    port=session["port"],
                    username=session["username"],
                    ssh_key_id=session.get("ssh_key_id"),
                    group_name=session["group_name"],
                    encoding=session.get("encoding", "utf-8"),
                    created_at=session["created_at"],
                    last_used=session["last_used"],
                    metadata=session["metadata"]
                )
            )
        except Exception as e:
            # 记录警告但不中断
            print(f"⚠️ 跳过无效会话配置 [{session.get('id', 'unknown')}]: {e}")
            continue
    
    return valid_sessions


@router.get("/{session_id}", response_model=SessionConfigResponse)
async def get_session(
    session_id: str,
    db=Depends(get_db)
):
    """
    Get a specific session configuration
    """
    session = db.get_by_id(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 容错处理：如果数据无效，返回错误而不是崩溃
    try:
        return SessionConfigResponse(
            id=session["id"],
            name=session["name"],
            connection_type=session["connection_type"],
            hostname=session["hostname"],
            port=session["port"],
            username=session["username"],
            ssh_key_id=session.get("ssh_key_id"),
            group_name=session["group_name"],
            encoding=session["encoding"],
            created_at=session["created_at"],
            last_used=session["last_used"],
            metadata=session["metadata"]
        )
    except Exception as e:
        print(f"⚠️ 会话配置数据无效 [{session_id}]: {e}")
        raise HTTPException(status_code=500, detail=f"会话配置数据无效: {e}")


@router.put("/{session_id}", response_model=SessionConfigResponse)
async def update_session(
    session_id: str,
    session_update: SessionConfigUpdate,
    db=Depends(get_db)
):
    """
    Update a session configuration
    """
    session = db.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        # Prepare update data
        update_data = {}

        # Only include fields that were provided in the update
        update_dict = session_update.dict(exclude_unset=True)

        for key, value in update_dict.items():
            if key in ["password", "private_key", "passphrase"] and value:
                # Encrypt sensitive data
                update_data[key] = encrypt_data(value)
            else:
                update_data[key] = value

        # Update session
        updated_session = db.update(session_id, update_data)

        if not updated_session:
            raise HTTPException(status_code=404, detail="Session not found")

        return SessionConfigResponse(
            id=updated_session["id"],
            name=updated_session["name"],
            connection_type=updated_session["connection_type"],
            hostname=updated_session["hostname"],
            port=updated_session["port"],
            username=updated_session["username"],
            ssh_key_id=updated_session.get("ssh_key_id"),
            group_name=updated_session["group_name"],
            encoding=updated_session.get("encoding", "utf-8"),
            created_at=updated_session["created_at"],
            last_used=updated_session["last_used"],
            metadata=updated_session["metadata"]
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    db=Depends(get_db)
):
    """
    Delete a session configuration
    """
    success = db.delete(session_id)

    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"message": "Session deleted successfully"}


@router.post("/{session_id}/use", response_model=SessionConfigWithSecrets)
async def use_session(
    session_id: str,
    db=Depends(get_db)
):
    """
    Mark session as used and return decrypted connection data
    """
    session = db.get_by_id(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        # Update last_used timestamp
        db.update_last_used(session_id)

        # Return decrypted connection data
        return SessionConfigWithSecrets(
            id=session["id"],
            name=session["name"],
            connection_type=session["connection_type"],
            hostname=session["hostname"],
            port=session["port"],
            username=session["username"],
            password=decrypt_data(session["password"]) if session["password"] else None,
            private_key=decrypt_data(session["private_key"]) if session["private_key"] else None,
            passphrase=decrypt_data(session["passphrase"]) if session["passphrase"] else None,
            ssh_key_id=session.get("ssh_key_id"),
            group_name=session["group_name"],
            encoding=session.get("encoding", "utf-8"),
            created_at=session["created_at"],
            last_used=session["last_used"],
            metadata=session["metadata"]
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/groups/list")
async def list_groups(db=Depends(get_db)):
    """
    List all available groups
    """
    groups = db.get_groups()
    return {"groups": groups}


@router.post("/export")
async def export_sessions(
    group_name: Optional[str] = None,
    db=Depends(get_db)
):
    """
    Export sessions (without sensitive data) for backup
    """
    sessions = db.get_all(group_name=group_name)

    export_data = []
    for session in sessions:
        export_data.append({
            "name": session["name"],
            "connection_type": session["connection_type"],
            "hostname": session["hostname"],
            "port": session["port"],
            "username": session["username"],
            "group_name": session["group_name"],
            "metadata": session["metadata"]
        })

    return {
        "sessions": export_data,
        "exported_at": datetime.utcnow().isoformat()
    }