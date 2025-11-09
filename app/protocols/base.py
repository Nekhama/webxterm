"""
Base connection protocol interface
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionProtocol(ABC):
    """
    Abstract base class for all connection protocols
    """

    def __init__(self, config):
        self.config = config
        self.websocket = None
        self.encoding = getattr(config, 'encoding', 'utf-8')
        self.connected = False
        self.closed = False
        self._output_queue = asyncio.Queue()

    @abstractmethod
    async def connect(self) -> bool:
        """
        Establish connection to remote host
        Returns True if successful, False otherwise
        """
        pass

    @abstractmethod
    async def send_data(self, data: str) -> None:
        """
        Send data to remote host
        """
        pass

    async def send_raw_data(self, data: bytes) -> None:
        """
        Send raw binary data to remote host
        Default implementation converts to string and calls send_data
        """
        # Default implementation for protocols that don't support raw binary
        text_data = data.decode('utf-8', errors='replace')
        await self.send_data(text_data)

    @abstractmethod
    async def close(self) -> None:
        """
        Close the connection
        """
        pass

    @abstractmethod
    async def resize_terminal(self, cols: int, rows: int) -> None:
        """
        Resize the terminal
        """
        pass

    def set_websocket(self, websocket):
        """Set the WebSocket connection for this protocol"""
        self.websocket = websocket

    async def read_output(self) -> AsyncGenerator[str, None]:
        """
        Generator that yields output from the connection
        """
        while not self.closed:
            try:
                # Wait for data with timeout
                data = await asyncio.wait_for(
                    self._output_queue.get(),
                    timeout=1.0
                )
                yield data
            except asyncio.TimeoutError:
                # Continue waiting for data
                continue
            except Exception as e:
                logger.error(f"Error reading output: {str(e)}")
                break

    async def _queue_output(self, data: str):
        """Queue output data for sending to WebSocket"""
        if not self.closed:
            await self._output_queue.put(data)

    def get_connection_info(self) -> dict:
        """Get connection information"""
        return {
            "hostname": getattr(self.config, 'hostname', 'unknown'),
            "port": getattr(self.config, 'port', 0),
            "username": getattr(self.config, 'username', 'unknown'),
            "connection_type": self.__class__.__name__.replace('Protocol', '').lower(),
            "connected": self.connected,
            "encoding": self.encoding
        }