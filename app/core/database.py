"""
Native SQLite database management
"""

import sqlite3
import json
import os
import asyncio
import threading
from typing import Optional, Dict, List, Any
from datetime import datetime
from contextlib import contextmanager

from .config import settings


class DatabaseManager:
    """Simple SQLite database manager using built-in sqlite3"""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(DatabaseManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        # Extract database path from URL
        if settings.DATABASE_URL.startswith('sqlite:///'):
            self.db_path = settings.DATABASE_URL[10:]  # Remove 'sqlite:///'
        else:
            self.db_path = "data/webxterm.db"

        self._initialized = True
        self._ensure_directory()

    def _ensure_directory(self):
        """Ensure database directory exists"""
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)

    @contextmanager
    def get_connection(self):
        """Get database connection with automatic cleanup"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable dict-like access
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()

    def init_database(self):
        """Initialize database tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Create session_configs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS session_configs (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    connection_type TEXT NOT NULL,
                    hostname TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT,
                    private_key TEXT,
                    passphrase TEXT,
                    ssh_key_id TEXT,
                    group_name TEXT,
                    encoding TEXT DEFAULT 'utf-8',
                    created_at TEXT NOT NULL,
                    last_used TEXT,
                    metadata TEXT
                )
            """)

            # Create indexes for better performance
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_session_name
                ON session_configs(name)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_session_group
                ON session_configs(group_name)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_session_last_used
                ON session_configs(last_used)
            """)

            # Migration: Add ssh_key_id column if it doesn't exist
            cursor.execute("PRAGMA table_info(session_configs)")
            columns = [row[1] for row in cursor.fetchall()]

            if 'ssh_key_id' not in columns:
                cursor.execute("ALTER TABLE session_configs ADD COLUMN ssh_key_id TEXT")

            if 'encoding' not in columns:
                cursor.execute("ALTER TABLE session_configs ADD COLUMN encoding TEXT DEFAULT 'utf-8'")

            conn.commit()


# Database operations
class SessionRepository:
    """Repository for session CRUD operations"""

    def __init__(self):
        self.db = DatabaseManager()

    def create(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new session"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Convert metadata to JSON string if present
            metadata_json = None
            if session_data.get('metadata'):
                metadata_json = json.dumps(session_data['metadata'])

            cursor.execute("""
                INSERT INTO session_configs
                (id, name, connection_type, hostname, port, username,
                 password, private_key, passphrase, ssh_key_id, group_name,
                 created_at, last_used, metadata, encoding)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session_data['id'],
                session_data['name'],
                session_data['connection_type'],
                session_data['hostname'],
                session_data['port'],
                session_data['username'],
                session_data.get('password'),
                session_data.get('private_key'),
                session_data.get('passphrase'),
                session_data.get('ssh_key_id'),
                session_data.get('group_name'),
                session_data['created_at'],
                session_data.get('last_used'),
                metadata_json,
                session_data.get('encoding', 'utf-8')
            ))

            conn.commit()
            return self.get_by_id(session_data['id'])

    def get_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM session_configs WHERE id = ?", (session_id,))
            row = cursor.fetchone()

            if row:
                return self._row_to_dict(row)
            return None

    def get_all(self, group_name: Optional[str] = None,
                connection_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all sessions with optional filtering"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM session_configs"
            params = []
            conditions = []

            if group_name is not None:
                conditions.append("group_name = ?")
                params.append(group_name)

            if connection_type:
                conditions.append("connection_type = ?")
                params.append(connection_type)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY last_used DESC, created_at DESC"

            cursor.execute(query, params)
            rows = cursor.fetchall()

            return [self._row_to_dict(row) for row in rows]

    def update(self, session_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update session"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Build dynamic update query
            set_clauses = []
            params = []

            for key, value in update_data.items():
                if key == 'metadata' and value is not None:
                    value = json.dumps(value)
                set_clauses.append(f"{key} = ?")
                params.append(value)

            if not set_clauses:
                return self.get_by_id(session_id)

            params.append(session_id)

            cursor.execute(
                f"UPDATE session_configs SET {', '.join(set_clauses)} WHERE id = ?",
                params
            )

            conn.commit()

            if cursor.rowcount > 0:
                return self.get_by_id(session_id)
            return None

    def delete(self, session_id: str) -> bool:
        """Delete session"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM session_configs WHERE id = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0

    def update_last_used(self, session_id: str) -> bool:
        """Update last_used timestamp"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE session_configs SET last_used = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), session_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_groups(self) -> List[str]:
        """Get all unique group names"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT DISTINCT group_name FROM session_configs "
                "WHERE group_name IS NOT NULL AND group_name != '' "
                "ORDER BY group_name"
            )
            rows = cursor.fetchall()
            return [row[0] for row in rows]

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert SQLite row to dictionary"""
        result = dict(row)

        # Parse metadata JSON
        if result.get('metadata'):
            try:
                result['metadata'] = json.loads(result['metadata'])
            except json.JSONDecodeError:
                result['metadata'] = {}
        else:
            result['metadata'] = {}

        # Ensure encoding field has a default value
        if 'encoding' not in result or result['encoding'] is None:
            result['encoding'] = 'utf-8'

        return result


# Global instances
db_manager = DatabaseManager()
session_repository = SessionRepository()


# Async wrapper functions for FastAPI compatibility
async def init_db():
    """Initialize database (async wrapper)"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, db_manager.init_database)


def get_db():
    """Dependency function that returns the session repository"""
    return session_repository