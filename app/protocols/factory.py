"""
Connection Factory for creating protocol instances
"""

from ..models.session import ConnectionType
from .ssh import SSHProtocol
from .telnet import TelnetProtocol
from .serial import SerialProtocol


class ConnectionFactory:
    """Factory for creating connection protocol instances"""

    @staticmethod
    async def create_connection(connection_type: ConnectionType, config):
        """
        Create and initialize a connection based on type

        Args:
            connection_type: The type of connection (SSH or Telnet)
            config: Connection configuration object

        Returns:
            Initialized connection protocol instance

        Raises:
            ValueError: If connection type is unsupported or connection fails
        """

        if connection_type == ConnectionType.SSH:
            protocol = SSHProtocol(config)
        elif connection_type == ConnectionType.TELNET:
            protocol = TelnetProtocol(config)
        elif connection_type == ConnectionType.USBSERIAL:
            protocol = SerialProtocol(config)
        else:
            raise ValueError(f"Unsupported connection type: {connection_type}")

        # Establish connection
        success = await protocol.connect()
        if not success:
            raise ValueError(f"Failed to establish {connection_type} connection")

        return protocol

    @staticmethod
    def get_supported_types():
        """Get list of supported connection types"""
        return [ConnectionType.SSH, ConnectionType.TELNET, ConnectionType.USBSERIAL]

    @staticmethod
    def get_default_port(connection_type: ConnectionType) -> int:
        """Get default port for connection type"""
        defaults = {
            ConnectionType.SSH: 22,
            ConnectionType.TELNET: 23,
            ConnectionType.USBSERIAL: 0
        }
        return defaults.get(connection_type, 22)