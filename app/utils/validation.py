"""
Validation utilities
"""

import re
from typing import Optional, Union
import ipaddress


def is_valid_hostname(hostname: str) -> bool:
    """
    Validate hostname according to RFC standards
    """
    if not hostname or len(hostname) > 255:
        return False

    # Remove trailing dot
    if hostname.endswith('.'):
        hostname = hostname[:-1]

    # Check for valid IP address
    if is_valid_ip_address(hostname):
        return True

    # Check hostname format
    allowed = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$')
    return all(allowed.match(label) for label in hostname.split('.'))


def is_valid_ip_address(ip: str) -> bool:
    """
    Validate IP address (IPv4 or IPv6)
    """
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def is_valid_port(port: Union[int, str]) -> bool:
    """
    Validate port number
    """
    try:
        port_int = int(port)
        return 1 <= port_int <= 65535
    except (ValueError, TypeError):
        return False


def is_valid_username(username: str) -> bool:
    """
    Validate username format
    """
    if not username or len(username) > 32:
        return False

    # Allow alphanumeric, dash, underscore, and dot
    allowed_pattern = re.compile(r'^[a-zA-Z0-9._-]+$')
    return bool(allowed_pattern.match(username))


def is_valid_encoding(encoding: str) -> bool:
    """
    Validate character encoding
    """
    try:
        # 确保encoding是字符串类型
        if not isinstance(encoding, str) or not encoding:
            return False
        'test'.encode(encoding)
        'test'.decode('ascii').encode(encoding)
        return True
    except (LookupError, ValueError, TypeError):
        return False


def sanitize_terminal_input(data: str) -> str:
    """
    Sanitize terminal input to prevent injection attacks
    """
    # Remove null bytes and other control characters except allowed ones
    allowed_control_chars = ['\t', '\n', '\r', '\x1b']  # tab, newline, carriage return, escape
    sanitized = ''.join(
        char for char in data
        if ord(char) >= 32 or char in allowed_control_chars
    )

    return sanitized


def validate_private_key(key_data: str) -> bool:
    """
    Basic validation for SSH private key format
    """
    if not key_data:
        return False

    # Check for PEM format headers
    pem_headers = [
        '-----BEGIN RSA PRIVATE KEY-----',
        '-----BEGIN DSA PRIVATE KEY-----',
        '-----BEGIN EC PRIVATE KEY-----',
        '-----BEGIN OPENSSH PRIVATE KEY-----',
        '-----BEGIN PRIVATE KEY-----'
    ]

    return any(header in key_data for header in pem_headers)


def validate_session_name(name: str) -> bool:
    """
    Validate session name
    """
    if not name or len(name) > 100:
        return False

    # Allow alphanumeric, space, dash, underscore, dot, parentheses
    allowed_pattern = re.compile(r'^[a-zA-Z0-9 ._()-]+$')
    return bool(allowed_pattern.match(name))


def validate_group_name(name: Optional[str]) -> bool:
    """
    Validate group name
    """
    if not name:
        return True  # Optional field

    if len(name) > 50:
        return False

    # Allow alphanumeric, space, dash, underscore, dot
    allowed_pattern = re.compile(r'^[a-zA-Z0-9 ._-]+$')
    return bool(allowed_pattern.match(name))