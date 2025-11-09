"""
SSH Key management models
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SSHKeyBase(BaseModel):
    """Base SSH key schema"""
    name: str
    private_key: str
    passphrase: Optional[str] = None
    description: Optional[str] = None


class SSHKeyCreate(SSHKeyBase):
    """Schema for creating SSH key"""
    pass


class SSHKeyUpdate(BaseModel):
    """Schema for updating SSH key"""
    name: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None
    description: Optional[str] = None


class SSHKeyResponse(BaseModel):
    """Schema for SSH key response (without private key)"""
    id: str
    name: str
    description: Optional[str] = None
    fingerprint: str  # SSH key fingerprint for identification
    created_at: str  # ISO format datetime string
    last_used: Optional[str] = None  # ISO format datetime string


class SSHKeyWithSecret(SSHKeyResponse):
    """Schema for SSH key with private key (for connection use)"""
    private_key: str
    passphrase: Optional[str] = None
