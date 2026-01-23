"""
Session configuration models (Pydantic only, no SQLAlchemy)
"""

from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime
import enum


class ConnectionType(str, enum.Enum):
    """Supported connection types"""
    SSH = "ssh"
    TELNET = "telnet"
    USBSERIAL = "usbserial"


# Pydantic models for API

class SessionConfigBase(BaseModel):
    """Base session configuration schema"""
    name: str
    connection_type: ConnectionType
    hostname: str = "localhost"
    port: int = 22
    username: str = ""
    password: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None
    ssh_key_id: Optional[str] = None  # SSH密钥ID引用
    group_name: Optional[str] = None
    encoding: str = "auto"  # 服务器编码（自动检测）
    device: Optional[str] = "ttyUSB0"  # Serial device name
    baud_rate: Optional[int] = 115200   # Serial baud rate
    metadata: Optional[Dict[str, str]] = {}


class SessionConfigCreate(SessionConfigBase):
    """Schema for creating session configuration"""
    pass


class SessionConfigUpdate(BaseModel):
    """Schema for updating session configuration"""
    name: Optional[str] = None
    connection_type: Optional[ConnectionType] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None
    ssh_key_id: Optional[str] = None
    group_name: Optional[str] = None
    encoding: Optional[str] = None
    device: Optional[str] = None
    baud_rate: Optional[int] = None
    metadata: Optional[Dict[str, str]] = None


class SessionConfigResponse(BaseModel):
    """Schema for session configuration response"""
    id: str
    name: str
    connection_type: ConnectionType
    hostname: str = "localhost"
    port: int = 22
    username: str = ""
    ssh_key_id: Optional[str] = None
    group_name: Optional[str] = None
    encoding: str = "utf-8"
    device: Optional[str] = None
    baud_rate: Optional[int] = None
    created_at: str  # ISO format datetime string
    last_used: Optional[str] = None  # ISO format datetime string
    metadata: Dict[str, str] = {}

    # Exclude sensitive data from response
    password: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None


class SessionConfigWithSecrets(SessionConfigResponse):
    """Schema for session configuration with decrypted secrets"""
    password: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None


class ConnectionRequest(BaseModel):
    """Schema for connection request"""
    session_id: Optional[str] = None
    hostname: str = "localhost"
    port: int = 22
    username: str = ""
    password: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None
    ssh_key_id: Optional[str] = None  # SSH密钥ID引用
    connection_type: ConnectionType = ConnectionType.SSH
    terminal_type: str = "xterm-256color"
    encoding: str = "utf-8"
    device: Optional[str] = "ttyUSB0"      # Serial device name
    baud_rate: Optional[int] = 115200       # Serial baud rate