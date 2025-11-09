"""
SSH Keys API endpoints
"""

from fastapi import APIRouter, HTTPException, status
from typing import List

from ..models.ssh_key import (
    SSHKeyCreate,
    SSHKeyUpdate,
    SSHKeyResponse,
    SSHKeyWithSecret
)
from ..services.ssh_key_manager import SSHKeyManager

router = APIRouter()
key_manager = SSHKeyManager()


@router.post("", response_model=SSHKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_ssh_key(key_data: SSHKeyCreate):
    """Create a new SSH key"""
    try:
        return await key_manager.create_key(key_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create SSH key: {str(e)}"
        )


@router.get("", response_model=List[SSHKeyResponse])
async def get_all_ssh_keys():
    """Get all SSH keys (without private keys)"""
    try:
        return await key_manager.get_all_keys()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve SSH keys: {str(e)}"
        )


@router.get("/{key_id}", response_model=SSHKeyResponse)
async def get_ssh_key(key_id: str):
    """Get SSH key by ID (without private key)"""
    try:
        key = await key_manager.get_key_response(key_id)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SSH key not found: {key_id}"
            )
        return key
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve SSH key: {str(e)}"
        )


@router.get("/{key_id}/secret", response_model=SSHKeyWithSecret)
async def get_ssh_key_with_secret(key_id: str):
    """Get SSH key with private key (for connection use)"""
    try:
        key = await key_manager.get_key_by_id(key_id)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SSH key not found: {key_id}"
            )

        # Update last used timestamp
        await key_manager.update_last_used(key_id)

        return key
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve SSH key: {str(e)}"
        )


@router.put("/{key_id}", response_model=SSHKeyResponse)
async def update_ssh_key(key_id: str, key_data: SSHKeyUpdate):
    """Update SSH key"""
    try:
        key = await key_manager.update_key(key_id, key_data)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SSH key not found: {key_id}"
            )
        return key
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update SSH key: {str(e)}"
        )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ssh_key(key_id: str):
    """Delete SSH key"""
    try:
        success = await key_manager.delete_key(key_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SSH key not found: {key_id}"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete SSH key: {str(e)}"
        )
