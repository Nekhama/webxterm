"""
USB-Serial Connection Protocol Implementation
"""

import asyncio
import logging
import threading
from typing import Optional

from .base import ConnectionProtocol

logger = logging.getLogger(__name__)


class SerialProtocol(ConnectionProtocol):
    """
    USB-Serial connection protocol implementation using pyserial-asyncio
    """

    def __init__(self, config):
        super().__init__(config)
        self._reader = None
        self._writer = None
        self._read_task = None
        self._event_loop = None

        # Serial configuration
        self.device = getattr(config, 'device', 'ttyUSB0')
        self.baud_rate = getattr(config, 'baud_rate', 115200)
        self.device_path = f'/dev/{self.device}'

    async def connect(self) -> bool:
        """Establish serial connection"""
        try:
            import serial_asyncio

            self._event_loop = asyncio.get_event_loop()

            logger.info(f"Opening serial port {self.device_path} at {self.baud_rate} baud")

            self._reader, self._writer = await serial_asyncio.open_serial_connection(
                url=self.device_path,
                baudrate=self.baud_rate,
                bytesize=8,
                parity='N',
                stopbits=1,
                xonxoff=False,
                rtscts=False
            )

            self.connected = True

            # Start reading output in background
            self._read_task = asyncio.ensure_future(self._read_output())

            logger.info(f"Serial connection established: {self.device_path} @ {self.baud_rate}")

            # Send an initial carriage return to prompt output
            await asyncio.sleep(0.5)
            try:
                await self.send_data('\r')
            except Exception as e:
                logger.debug(f"Initial CR send failed (non-fatal): {str(e)}")

            return True

        except ImportError:
            logger.error("pyserial-asyncio is not installed. Install with: pip install pyserial-asyncio")
            raise ValueError("pyserial-asyncio is not installed")
        except Exception as e:
            logger.error(f"Serial connection failed: {str(e)}")
            raise ValueError(f"Failed to open serial port {self.device_path}: {str(e)}")

    async def _read_output(self):
        """Background task to read from serial port"""
        try:
            while self.connected and self._reader and not self.closed:
                try:
                    data = await asyncio.wait_for(
                        self._reader.read(4096),
                        timeout=1.0
                    )
                    if data:
                        decoded = data.decode('utf-8', errors='replace')
                        await self._queue_output(decoded)
                    else:
                        # Empty read may indicate port closed
                        if self._reader.at_eof():
                            logger.info("Serial port EOF detected")
                            break
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    if not self.closed:
                        logger.error(f"Error reading serial port: {str(e)}")
                    break
        finally:
            logger.info("Serial read task ended")
            self.closed = True

    async def send_data(self, data: str) -> None:
        """Send data to serial port"""
        if not self.connected or not self._writer:
            raise ValueError("Serial connection not established")

        try:
            data_bytes = data.encode('utf-8')
            self._writer.write(data_bytes)
            await self._writer.drain()
        except Exception as e:
            logger.error(f"Error sending data to serial port: {str(e)}")
            self.connected = False
            self.closed = True
            raise ValueError(f"Serial send failed: {str(e)}")

    async def send_raw_data(self, data: bytes) -> None:
        """Send raw binary data to serial port"""
        if not self.connected or not self._writer:
            raise ValueError("Serial connection not established")

        try:
            self._writer.write(data)
            await self._writer.drain()
        except Exception as e:
            logger.error(f"Error sending raw data to serial port: {str(e)}")
            self.connected = False
            self.closed = True
            raise ValueError(f"Serial send failed: {str(e)}")

    async def resize_terminal(self, cols: int, rows: int) -> None:
        """No-op for serial connections (no PTY)"""
        pass

    async def close(self) -> None:
        """Close serial connection"""
        if self.closed:
            return

        logger.info(f"Closing serial connection: {self.device_path}")
        self.closed = True
        self.connected = False

        # Cancel read task
        if self._read_task and not self._read_task.done():
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass

        # Close writer (which closes the serial port)
        if self._writer:
            try:
                self._writer.close()
            except Exception as e:
                logger.debug(f"Error closing serial writer: {str(e)}")

        logger.info("Serial connection closed")
