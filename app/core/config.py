"""
Configuration settings for webXTerm
JSON-based configuration with environment variable override
"""

import json
import os
from typing import List, Any, Dict


class Settings:
    """Application settings loaded from JSON config and environment variables"""

    def __init__(self):
        # Default configuration
        self._defaults = {
            # Server settings
            "HOST": "0.0.0.0",
            "PORT": 8080,
            "DEBUG": False,

            # Security settings
            "SECRET_KEY": "your-secret-key-change-in-production",
            "ALLOWED_ORIGINS": ["*"],

            # Database settings
            "DATABASE_URL": "sqlite:///./data/webxterm.db",

            # Connection settings
            "SSH_TIMEOUT": 10,
            "TELNET_TIMEOUT": 10,
            "MAX_CONNECTIONS_PER_CLIENT": 10,

            # Session settings
            "SESSION_EXPIRE_SECONDS": 3600,

            # Security settings for connections
            "ALLOW_SYSTEM_HOST_KEYS": True,
            "VERIFY_HOST_KEYS": False,  # 允许连接到未知主机，适合Web终端使用

            # Encoding settings
            "DEFAULT_ENCODING": "utf-8"
        }

        # Load configuration
        self._config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file with fallback to defaults"""
        config = self._defaults.copy()

        # Try to load from config.json
        config_paths = [
            "config.json",
            "app/config.json",
            "../config.json"
        ]

        for config_path in config_paths:
            try:
                if os.path.exists(config_path):
                    with open(config_path, 'r', encoding='utf-8') as f:
                        json_config = json.load(f)
                        config.update(json_config)
                        print(f"Configuration loaded from: {config_path}")
                        break
            except (json.JSONDecodeError, IOError) as e:
                print(f"Failed to load config from {config_path}: {e}")
                continue

        # Override with environment variables
        for key in config.keys():
            env_value = os.getenv(key)
            if env_value is not None:
                config[key] = self._parse_env_value(env_value, type(config[key]))

        # Handle special environment variable
        environment = os.getenv("ENVIRONMENT", "development")
        if environment == "production":
            config["DEBUG"] = False
            config["ALLOWED_ORIGINS"] = [
                "http://localhost:8080",
                "https://yourdomain.com"
            ]
        elif environment == "development":
            config["DEBUG"] = True

        return config

    def _parse_env_value(self, value: str, expected_type: type) -> Any:
        """Parse environment variable value to expected type"""
        if expected_type == bool:
            return value.lower() in ('true', '1', 'yes', 'on')
        elif expected_type == int:
            try:
                return int(value)
            except ValueError:
                return 0
        elif expected_type == float:
            try:
                return float(value)
            except ValueError:
                return 0.0
        elif expected_type == list:
            # Parse comma-separated values
            if value.startswith('[') and value.endswith(']'):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            return [item.strip() for item in value.split(',') if item.strip()]
        else:
            return value

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value"""
        return self._config.get(key, default)

    def __getattr__(self, name: str) -> Any:
        """Allow attribute-style access to configuration"""
        if name.startswith('_'):
            raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")
        return self._config.get(name, self._defaults.get(name))

    def update(self, updates: Dict[str, Any]) -> None:
        """Update configuration at runtime"""
        self._config.update(updates)

    def to_dict(self) -> Dict[str, Any]:
        """Return configuration as dictionary"""
        return self._config.copy()

    @property
    def HOST(self) -> str:
        return self._config["HOST"]

    @property
    def PORT(self) -> int:
        return self._config["PORT"]

    @property
    def DEBUG(self) -> bool:
        return self._config["DEBUG"]

    @property
    def SECRET_KEY(self) -> str:
        return self._config["SECRET_KEY"]

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        return self._config["ALLOWED_ORIGINS"]

    @property
    def DATABASE_URL(self) -> str:
        return self._config["DATABASE_URL"]

    @property
    def SSH_TIMEOUT(self) -> int:
        return self._config["SSH_TIMEOUT"]

    @property
    def TELNET_TIMEOUT(self) -> int:
        return self._config["TELNET_TIMEOUT"]

    @property
    def MAX_CONNECTIONS_PER_CLIENT(self) -> int:
        return self._config["MAX_CONNECTIONS_PER_CLIENT"]

    @property
    def SESSION_EXPIRE_SECONDS(self) -> int:
        return self._config["SESSION_EXPIRE_SECONDS"]

    @property
    def ALLOW_SYSTEM_HOST_KEYS(self) -> bool:
        return self._config["ALLOW_SYSTEM_HOST_KEYS"]

    @property
    def VERIFY_HOST_KEYS(self) -> bool:
        return self._config["VERIFY_HOST_KEYS"]

    @property
    def DEFAULT_ENCODING(self) -> str:
        return self._config["DEFAULT_ENCODING"]


# Global settings instance
settings = Settings()
