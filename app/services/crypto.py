"""
Cryptographic utilities for encrypting sensitive data
"""

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
from typing import Optional

from ..core.config import settings


class CryptoService:
    """Service for encrypting and decrypting sensitive data"""

    def __init__(self):
        self._fernet = None
        self._initialize_crypto()

    def _initialize_crypto(self):
        """Initialize encryption key"""
        # Use secret key to derive encryption key
        password = settings.SECRET_KEY.encode()
        salt = b'webxterm_salt_2024'  # In production, use a random salt per installation

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        self._fernet = Fernet(key)

    def encrypt(self, data: str) -> str:
        """Encrypt a string"""
        if not data:
            return ""

        try:
            encrypted_data = self._fernet.encrypt(data.encode('utf-8'))
            return base64.urlsafe_b64encode(encrypted_data).decode('utf-8')
        except Exception as e:
            raise ValueError(f"Encryption failed: {str(e)}")

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt a string"""
        if not encrypted_data:
            return ""

        try:
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode('utf-8'))
            decrypted_data = self._fernet.decrypt(decoded_data)
            return decrypted_data.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")


# Global crypto service instance
_crypto_service = CryptoService()


def encrypt_data(data: Optional[str]) -> Optional[str]:
    """Encrypt sensitive data"""
    if not data:
        return None
    return _crypto_service.encrypt(data)


def decrypt_data(encrypted_data: Optional[str]) -> Optional[str]:
    """Decrypt sensitive data"""
    if not encrypted_data:
        return None
    return _crypto_service.decrypt(encrypted_data)