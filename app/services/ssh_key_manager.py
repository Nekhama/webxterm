"""
SSH Key Manager Service
"""

import uuid
import hashlib
import base64
from datetime import datetime
from typing import List, Optional
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from ..core.database import DatabaseManager
from ..models.ssh_key import SSHKeyCreate, SSHKeyUpdate, SSHKeyResponse, SSHKeyWithSecret


class SSHKeyManager:
    """Manage SSH keys"""

    def __init__(self):
        self.db = DatabaseManager()
        self._init_table()

    def _init_table(self):
        """Initialize SSH keys table"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ssh_keys (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    private_key TEXT NOT NULL,
                    passphrase TEXT,
                    description TEXT,
                    fingerprint TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    last_used TEXT
                )
            ''')
            conn.commit()

    def _calculate_fingerprint(self, private_key: str) -> str:
        """Calculate SSH key fingerprint"""
        try:
            # Try to load the key to validate it and extract public key
            key_bytes = private_key.encode('utf-8')

            # Try different key formats
            try:
                # Try OpenSSH format
                private_key_obj = serialization.load_ssh_private_key(
                    key_bytes,
                    password=None,
                    backend=default_backend()
                )
            except:
                # Try PEM format
                try:
                    private_key_obj = serialization.load_pem_private_key(
                        key_bytes,
                        password=None,
                        backend=default_backend()
                    )
                except:
                    # If all fail, use a hash of the key content
                    return hashlib.md5(key_bytes).hexdigest()

            # Get public key
            public_key = private_key_obj.public_key()

            # Serialize public key in OpenSSH format
            public_key_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.OpenSSH,
                format=serialization.PublicFormat.OpenSSH
            )

            # Calculate MD5 fingerprint
            key_data = base64.b64decode(public_key_bytes.split()[1])
            fingerprint = hashlib.md5(key_data).hexdigest()

            # Format as xx:xx:xx:...
            return ':'.join(fingerprint[i:i+2] for i in range(0, len(fingerprint), 2))

        except Exception as e:
            # Fallback: use hash of private key
            return hashlib.md5(private_key.encode('utf-8')).hexdigest()

    async def create_key(self, key_data: SSHKeyCreate) -> SSHKeyResponse:
        """Create a new SSH key"""
        key_id = str(uuid.uuid4())
        fingerprint = self._calculate_fingerprint(key_data.private_key)
        now = datetime.utcnow().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Check if name already exists
            cursor.execute('SELECT id FROM ssh_keys WHERE name = ?', (key_data.name,))
            if cursor.fetchone():
                raise ValueError(f"SSH key with name '{key_data.name}' already exists")

            cursor.execute('''
                INSERT INTO ssh_keys (id, name, private_key, passphrase, description, fingerprint, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                key_id,
                key_data.name,
                key_data.private_key,
                key_data.passphrase,
                key_data.description,
                fingerprint,
                now
            ))
            conn.commit()

        return SSHKeyResponse(
            id=key_id,
            name=key_data.name,
            description=key_data.description,
            fingerprint=fingerprint,
            created_at=now,
            last_used=None
        )

    async def get_all_keys(self) -> List[SSHKeyResponse]:
        """Get all SSH keys (without private keys)"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, name, description, fingerprint, created_at, last_used
                FROM ssh_keys
                ORDER BY created_at DESC
            ''')

            keys = []
            for row in cursor.fetchall():
                keys.append(SSHKeyResponse(
                    id=row[0],
                    name=row[1],
                    description=row[2],
                    fingerprint=row[3],
                    created_at=row[4],
                    last_used=row[5]
                ))

            return keys

    async def get_key_by_id(self, key_id: str) -> Optional[SSHKeyWithSecret]:
        """Get SSH key by ID (with private key)"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, name, private_key, passphrase, description, fingerprint, created_at, last_used
                FROM ssh_keys
                WHERE id = ?
            ''', (key_id,))

            row = cursor.fetchone()
            if not row:
                return None

            return SSHKeyWithSecret(
                id=row[0],
                name=row[1],
                private_key=row[2],
                passphrase=row[3],
                description=row[4],
                fingerprint=row[5],
                created_at=row[6],
                last_used=row[7]
            )

    async def update_key(self, key_id: str, key_data: SSHKeyUpdate) -> Optional[SSHKeyResponse]:
        """Update SSH key"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Check if key exists
            cursor.execute('SELECT id FROM ssh_keys WHERE id = ?', (key_id,))
            if not cursor.fetchone():
                return None

            # Build update query
            update_fields = []
            params = []

            if key_data.name is not None:
                # Check if new name already exists
                cursor.execute('SELECT id FROM ssh_keys WHERE name = ? AND id != ?',
                             (key_data.name, key_id))
                if cursor.fetchone():
                    raise ValueError(f"SSH key with name '{key_data.name}' already exists")
                update_fields.append('name = ?')
                params.append(key_data.name)

            if key_data.private_key is not None:
                update_fields.append('private_key = ?')
                params.append(key_data.private_key)
                # Recalculate fingerprint if key changed
                fingerprint = self._calculate_fingerprint(key_data.private_key)
                update_fields.append('fingerprint = ?')
                params.append(fingerprint)

            if key_data.passphrase is not None:
                update_fields.append('passphrase = ?')
                params.append(key_data.passphrase)

            if key_data.description is not None:
                update_fields.append('description = ?')
                params.append(key_data.description)

            if not update_fields:
                # No fields to update, just return current data
                return await self.get_key_response(key_id)

            params.append(key_id)
            query = f'UPDATE ssh_keys SET {", ".join(update_fields)} WHERE id = ?'
            cursor.execute(query, params)
            conn.commit()

            return await self.get_key_response(key_id)

    async def get_key_response(self, key_id: str) -> Optional[SSHKeyResponse]:
        """Get SSH key response (without private key)"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, name, description, fingerprint, created_at, last_used
                FROM ssh_keys
                WHERE id = ?
            ''', (key_id,))

            row = cursor.fetchone()
            if not row:
                return None

            return SSHKeyResponse(
                id=row[0],
                name=row[1],
                description=row[2],
                fingerprint=row[3],
                created_at=row[4],
                last_used=row[5]
            )

    async def delete_key(self, key_id: str) -> bool:
        """Delete SSH key"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM ssh_keys WHERE id = ?', (key_id,))
            conn.commit()
            return cursor.rowcount > 0

    async def update_last_used(self, key_id: str):
        """Update last used timestamp"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE ssh_keys
                SET last_used = ?
                WHERE id = ?
            ''', (datetime.utcnow().isoformat(), key_id))
            conn.commit()
