"""
SSH Connection Protocol Implementation
"""

import asyncio
import logging
import paramiko
import socket
import threading
from typing import Optional
import io
import sys
import os
from contextlib import redirect_stderr

from .base import ConnectionProtocol
from ..core.config import settings

logger = logging.getLogger(__name__)

# 配置paramiko日志级别以抑制内部异常日志
paramiko_logger = logging.getLogger('paramiko')
paramiko_logger.setLevel(logging.CRITICAL)  # 只显示严重错误，抑制连接异常

# 配置paramiko.transport日志级别
transport_logger = logging.getLogger('paramiko.transport')
transport_logger.setLevel(logging.CRITICAL)

class ConnectionResetFilter(logging.Filter):
    """过滤器：抑制连接重置相关的日志消息"""
    def filter(self, record):
        message = record.getMessage()
        # 过滤掉包含连接重置错误的日志消息
        if any(phrase in message for phrase in [
            "Connection reset by peer",
            "Errno 54",
            "Error reading SSH protocol banner"
        ]):
            return False
        return True


class IgnoreHostKeyPolicy(paramiko.MissingHostKeyPolicy):
    """完全忽略主机密钥验证的策略
    
    对于 Web 终端应用，用户可能需要连接到各种主机，
    包括密钥已更改的主机（如 VM 重启后）。
    此策略接受所有主机密钥，不进行任何验证。
    """
    def missing_host_key(self, client, hostname, key):
        # 完全忽略，不做任何操作
        logger.debug(f"接受主机 {hostname} 的密钥: {key.get_name()}")

class FilteredStderr:
    """过滤特定错误信息的stderr替代"""
    def __init__(self, original_stderr):
        self.original_stderr = original_stderr
        self.buffer = ""

    def write(self, text):
        # 过滤包含连接重置错误的输出
        if any(phrase in text for phrase in [
            "Connection reset by peer",
            "Errno 54",
            "Error reading SSH protocol banner",
            "paramiko.ssh_exception.SSHException"
        ]):
            return  # 丢弃这些错误输出
        # 其他错误正常输出
        self.original_stderr.write(text)

    def flush(self):
        self.original_stderr.flush()

class SuppressParamikoLogs:
    """上下文管理器，临时抑制paramiko的连接重置相关日志输出"""
    def __init__(self):
        self.loggers = [
            logging.getLogger('paramiko'),
            logging.getLogger('paramiko.transport'),
            logging.getLogger('paramiko.client'),
            logging.getLogger('paramiko.channel')
        ]
        self.original_levels = []
        self.filter = ConnectionResetFilter()
        self.filtered_stderr = None

    def __enter__(self):
        # 抑制日志
        for logger in self.loggers:
            self.original_levels.append(logger.level)
            logger.addFilter(self.filter)
            logger.setLevel(logging.CRITICAL)

        # 使用过滤的stderr替代原始stderr
        self.original_stderr = sys.stderr
        self.filtered_stderr = FilteredStderr(self.original_stderr)
        sys.stderr = self.filtered_stderr

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # 恢复stderr
        if self.filtered_stderr:
            sys.stderr = self.original_stderr

        # 恢复日志设置
        for logger, original_level in zip(self.loggers, self.original_levels):
            logger.removeFilter(self.filter)
            logger.setLevel(original_level)

# 给paramiko loggers添加连接重置过滤器
connection_reset_filter = ConnectionResetFilter()
for logger_name in ['paramiko', 'paramiko.transport', 'paramiko.client', 'paramiko.channel']:
    logger_obj = logging.getLogger(logger_name)
    logger_obj.addFilter(connection_reset_filter)


class SSHProtocol(ConnectionProtocol):
    """
    SSH connection protocol implementation using paramiko
    """

    def __init__(self, config):
        super().__init__(config)
        self.ssh_client = None
        self.channel = None
        self._read_thread = None
        self._stop_reading = False
        self._event_loop = None
        self._last_error = None  # 保存原始错误信息

        # 设置服务器端编码，支持中文编码转换
        self.server_encoding = getattr(config, 'encoding', 'utf-8')
        if self.server_encoding.lower() in ['gbk', 'gb2312']:
            self.server_encoding = 'gbk'  # 统一使用gbk处理中文编码

    def _is_utf8_bytes(self, data: bytes) -> bool:
        """检测字节数据是否为有效的UTF-8编码"""
        try:
            data.decode('utf-8', errors='strict')
            return True
        except UnicodeDecodeError:
            return False

    def _convert_server_output(self, data: bytes) -> str:
        """将服务器输出从服务器编码转换为UTF-8供前端使用，自动探测编码"""
        # 如果数据是空的，直接返回
        if not data:
            return ""

        # 自动探测编码
        try:
            # 首先检测是否为UTF-8
            if self._is_utf8_bytes(data):
                # 如果是UTF-8，直接解码
                return data.decode('utf-8')
            else:
                # 如果不是UTF-8，假设是GBK
                try:
                    return data.decode('gbk', errors='replace')
                except UnicodeDecodeError:
                    # 回退到UTF-8
                    return data.decode('utf-8', errors='replace')

        except (UnicodeDecodeError, UnicodeEncodeError):
            return data.decode('utf-8', errors='replace')

    async def connect(self) -> bool:
        """Establish SSH connection"""
        try:
            # Store the current event loop
            self._event_loop = asyncio.get_event_loop()
            
            self.ssh_client = paramiko.SSHClient()

            # 使用完全忽略主机密钥的策略
            # 这对 Web 终端应用是必要的，因为：
            # 1. 用户需要能够连接到新的主机
            # 2. VM 重启后主机密钥会变化
            # 3. 多个 VM 可能使用相同的端口（端口转发）
            
            # 清空已知主机缓存，确保不会因为密钥不匹配而报错
            # 这相当于 ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null
            self.ssh_client._host_keys = paramiko.HostKeys()
            self.ssh_client._host_keys_filename = None
            self.ssh_client.set_missing_host_key_policy(IgnoreHostKeyPolicy())
            logger.debug("SSH主机密钥策略已设置为IgnoreHostKeyPolicy（完全忽略验证）")

            # 配置兼容的加密算法，类似 SSH 命令行选项
            # 相当于 -oKexAlgorithms=+diffie-hellman-group1-sha1 等选项
            # 这样可以连接到使用老旧算法的设备
            transport_config = {
                'kex': [
                    'diffie-hellman-group16-sha512',
                    'diffie-hellman-group14-sha256',
                    'diffie-hellman-group14-sha1',
                    'diffie-hellman-group1-sha1',  # 老旧设备支持
                    'ecdh-sha2-nistp256',
                    'ecdh-sha2-nistp384',
                    'ecdh-sha2-nistp521'
                ],
                'server_host_key_algorithms': [
                    'rsa-sha2-512',
                    'rsa-sha2-256',
                    'ssh-rsa',
                    'ecdsa-sha2-nistp256',
                    'ecdsa-sha2-nistp384',
                    'ecdsa-sha2-nistp521',
                    'ssh-ed25519'
                ],
                'ciphers': [
                    'aes128-ctr',
                    'aes192-ctr',
                    'aes256-ctr',
                    'aes128-cbc',  # 老旧设备支持
                    'aes192-cbc',
                    'aes256-cbc',
                    '3des-cbc'     # 最大兼容性
                ]
            }

            # Prepare connection parameters with compatibility options
            connect_kwargs = {
                'hostname': self.config.hostname,
                'port': self.config.port,
                'username': self.config.username,
                'timeout': settings.SSH_TIMEOUT,
                'look_for_keys': False,
                'allow_agent': False,
                # 添加兼容性和安全选项
                'banner_timeout': 30,  # 等待SSH横幅的超时时间
                'auth_timeout': 30,    # 认证超时时间
                'gss_auth': False,     # 禁用GSSAPI认证
                'gss_kex': False,      # 禁用GSSAPI密钥交换
                'disabled_algorithms': {
                    # 可根据需要禁用特定算法，这里保持空以最大兼容性
                }
            }

            # Handle authentication
            if hasattr(self.config, 'private_key') and self.config.private_key:
                # Private key authentication
                try:
                    private_key = self._parse_private_key(
                        self.config.private_key,
                        self.config.passphrase
                    )
                    connect_kwargs['pkey'] = private_key
                except Exception as e:
                    logger.error(f"Failed to parse private key: {str(e)}")
                    raise ValueError(f"Invalid private key: {str(e)}")
            elif hasattr(self.config, 'password') and self.config.password:
                # Password authentication
                connect_kwargs['password'] = self.config.password
            else:
                raise ValueError("No authentication method provided")

            # Connect to SSH server with suppressed paramiko logging
            def connect_ssh():
                with SuppressParamikoLogs():
                    try:
                        result = self.ssh_client.connect(**connect_kwargs)
                        return result
                    except paramiko.SSHException as e:
                        # 如果是主机密钥问题，记录详细错误但仍然尝试连接
                        if "not found in known_hosts" in str(e):
                            logger.warning(f"主机密钥验证被跳过: {str(e)}")
                        # 重新抛出异常让上层处理
                        raise e

            await asyncio.get_event_loop().run_in_executor(
                None, connect_ssh
            )

            # Create interactive shell
            self.channel = self.ssh_client.invoke_shell(
                term=getattr(self.config, 'terminal_type', 'xterm-256color'),
                width=80,
                height=24
            )
            self.channel.setblocking(False)

            # 移除旧的编码检测逻辑，使用实时自动检测
            # Remove old encoding detection logic, use real-time auto-detection

            self.connected = True

            # Start reading output in background thread
            self._start_reading()

            logger.info(f"SSH connection established to {self.config.hostname}:{self.config.port}，服务器编码: {self.server_encoding}")

            # 延迟更长时间确保终端完全初始化，然后发送初始回车
            # Wait longer to ensure terminal is fully initialized, then send initial enter
            await asyncio.sleep(1.5)
            try:
                # 发送两个命令：先发送一个空格+退格来"唤醒"终端，然后发送回车
                # Send two commands: first a space+backspace to "wake up" the terminal, then enter
                await self.send_data(' \b\r')
                logger.debug("已发送SSH终端初始化序列")
            except Exception as e:
                logger.debug(f"发送SSH初始化序列失败，但连接仍然有效: {str(e)}")

            return True

        except ConnectionResetError as e:
            logger.warning(f"SSH连接被对端重置: {str(e)}")
            self._last_error = f"SSH连接被对端重置: {str(e)}"
            self.connected = False
            self.closed = True
            raise ValueError(f"SSH连接被对端重置: {str(e)}")
        except socket.error as e:
            # 检查是否是连接重置错误
            if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                logger.warning(f"SSH连接被对端重置: {str(e)}")
                self._last_error = f"SSH连接被对端重置: {str(e)}"
                self.connected = False
                self.closed = True
                raise ValueError(f"SSH连接被对端重置: {str(e)}")
            else:
                logger.error(f"SSH socket错误: {str(e)}")
                self._last_error = f"SSH socket错误: {str(e)}"
                raise ValueError(f"无法连接到 {self.config.hostname}:{self.config.port}: {str(e)}")
        except paramiko.AuthenticationException as e:
            error_details = f"SSH认证失败: {str(e)}"
            logger.error(error_details)

            # 提供更详细的错误诊断信息
            if "transport shut down" in str(e) or "saw EOF" in str(e):
                error_details += " (可能原因: 1.用户名或密码错误 2.SSH服务器拒绝连接 3.网络连接问题)"
                suggested_msg = "请检查用户名和密码是否正确，以及SSH服务器是否允许密码认证"
            else:
                suggested_msg = "认证失败，请检查凭据"

            self._last_error = error_details
            logger.info(f"SSH认证建议: {suggested_msg}")
            raise ValueError(f"认证失败: {str(e)} - {suggested_msg}")
        except paramiko.SSHException as e:
            # 检查是否是连接重置相关的SSH异常
            error_str = str(e)
            if "Connection reset by peer" in error_str or "Errno 54" in error_str:
                logger.warning(f"SSH协议错误（连接被重置）: {error_str}")
                self._last_error = f"SSH协议错误（连接被重置）: {error_str}"
                self.connected = False
                self.closed = True
                raise ValueError(f"SSH连接被对端重置: {error_str}")
            else:
                logger.error(f"SSH协议错误: {error_str}")
                self._last_error = f"SSH协议错误: {error_str}"
                raise ValueError(f"SSH连接失败: {error_str}")
        except Exception as e:
            logger.error(f"SSH连接发生未知错误: {str(e)}")
            self._last_error = f"SSH连接发生未知错误: {str(e)}"
            raise ValueError(f"连接失败: {str(e)}")

    def _parse_private_key(self, key_data: str, passphrase: Optional[str] = None):
        """Parse private key from string data"""
        key_file = io.StringIO(key_data)

        # Try different key types (DSSKey removed in paramiko 3.0+)
        key_types = [
            paramiko.RSAKey,
            paramiko.ECDSAKey,
            paramiko.Ed25519Key,
        ]

        # Add DSSKey only if available (paramiko < 3.0)
        if hasattr(paramiko, 'DSSKey'):
            key_types.append(paramiko.DSSKey)

        for key_type in key_types:
            key_file.seek(0)
            try:
                return key_type.from_private_key(key_file, password=passphrase)
            except paramiko.SSHException:
                continue
            except Exception:
                continue

        raise ValueError("Unable to parse private key")

    async def _detect_encoding(self) -> Optional[str]:
        """Detect server encoding by running locale command"""
        try:
            # Try to detect encoding using locale
            stdin, stdout, stderr = self.ssh_client.exec_command(
                'locale charmap 2>/dev/null || echo "UTF-8"',
                timeout=3
            )
            encoding_output = stdout.read().decode('ascii', errors='ignore').strip()

            if encoding_output and encoding_output != 'UTF-8':
                logger.info(f"Detected encoding: {encoding_output}")
                return encoding_output.lower()

        except Exception as e:
            logger.debug(f"Encoding detection failed: {str(e)}")

        return None

    def _start_reading(self):
        """Start reading output in background thread"""
        self._stop_reading = False
        self._read_thread = threading.Thread(target=self._read_output_thread)
        self._read_thread.daemon = True
        self._read_thread.start()

    def _read_output_thread(self):
        """后台线程读取SSH通道输出"""
        while not self._stop_reading and self.channel and not self.channel.closed:
            try:
                if self.channel.recv_ready():
                    data = self.channel.recv(4096)
                    if data:
                        try:
                            # 使用编码转换方法处理服务器输出
                            decoded_data = self._convert_server_output(data)
                            # 将数据排队到WebSocket - 使用线程安全方法
                            if self._event_loop and not self._event_loop.is_closed():
                                asyncio.run_coroutine_threadsafe(
                                    self._queue_output(decoded_data),
                                    self._event_loop
                                )
                        except Exception as e:
                            logger.error(f"解码SSH输出时发生错误: {str(e)}")
                    else:
                        # recv()返回空数据，可能表示通道关闭
                        if self.channel.closed or self.channel.eof_received:
                            logger.info("SSH通道已关闭或接收到EOF")
                            break
                else:
                    # 检查通道是否关闭或有退出状态
                    if self.channel.closed or self.channel.eof_received:
                        logger.info("等待期间SSH通道已关闭")
                        break
                    if self.channel.exit_status_ready():
                        logger.info("SSH会话退出状态就绪")
                        break

                    # 短暂睡眠以防止忙等待
                    threading.Event().wait(0.01)

            except ConnectionResetError as e:
                logger.warning(f"读取SSH输出时连接被重置: {str(e)}")
                self._last_error = f"读取SSH输出时连接被重置: {str(e)}"
                self.connected = False
                break
            except (OSError, socket.error) as e:
                if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                    logger.warning(f"读取SSH输出时连接被对端重置: {str(e)}")
                    self._last_error = f"读取SSH输出时连接被对端重置: {str(e)}"
                    self.connected = False
                    break
                else:
                    logger.error(f"读取SSH输出时发生错误: {str(e)}")
                    break
            except Exception as e:
                logger.error(f"读取SSH输出时发生未知错误: {str(e)}")
                break

        # 会话结束 - 关闭连接
        logger.info("SSH会话结束，标记为已关闭")
        self.closed = True

    async def _send_data_chunked(self, data_bytes: bytes) -> None:
        """内部方法：分片发送字节数据"""
        chunk_size = 4096  # 4KB分片，避免SSH缓冲区溢出
        total_size = len(data_bytes)
        sent_size = 0
        
        logger.debug(f"开始分片发送数据: {total_size} 字节，分片大小: {chunk_size}")
        
        while sent_size < total_size:
            current_chunk_size = min(chunk_size, total_size - sent_size)
            chunk = data_bytes[sent_size:sent_size + current_chunk_size]
            
            # 在线程池中发送，避免阻塞事件循环
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self.channel.send, chunk)
            
            sent_size += current_chunk_size
            
            # 小延迟让事件循环处理其他任务
            if sent_size < total_size:
                await asyncio.sleep(0.001)  # 1ms延迟
                
            logger.debug(f"已发送: {sent_size}/{total_size} 字节 ({sent_size*100//total_size}%)")
        
        logger.debug(f"分片发送完成: {total_size} 字节")

    async def send_data(self, data: str) -> None:
        """发送数据到SSH通道"""
        if not self.connected or not self.channel:
            raise ValueError("SSH连接未建立")

        try:
            # 确保data是字符串类型
            if data is None:
                raise ValueError("发送数据不能为None")
            if not isinstance(data, str):
                data = str(data)

            # 对于大数据，使用异步分片发送
            data_bytes = data.encode('utf-8')
            if len(data_bytes) > 4096:  # 超过4KB使用分片发送
                await self._send_data_chunked(data_bytes)
            else:
                # 小数据直接发送
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.channel.send, data)
        except ConnectionResetError as e:
            logger.warning(f"发送数据到SSH时连接被重置: {str(e)}")
            self._last_error = f"发送数据到SSH时连接被重置: {str(e)}"
            self.connected = False
            self.closed = True
            raise ValueError(f"SSH连接被对端重置: {str(e)}")
        except (OSError, socket.error) as e:
            if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                logger.warning(f"发送数据到SSH时连接被对端重置: {str(e)}")
                self._last_error = f"发送数据到SSH时连接被对端重置: {str(e)}"
                self.connected = False
                self.closed = True
                raise ValueError(f"SSH连接被对端重置: {str(e)}")
            else:
                logger.error(f"发送数据到SSH时发生错误: {str(e)}")
                self._last_error = f"发送数据到SSH时发生错误: {str(e)}"
                raise ValueError(f"发送数据失败: {str(e)}")
        except Exception as e:
            logger.error(f"发送数据到SSH时发生未知错误: {str(e)}")
            self._last_error = f"发送数据到SSH时发生未知错误: {str(e)}"
            raise ValueError(f"发送数据失败: {str(e)}")

    async def send_raw_data(self, data: bytes) -> None:
        """发送原始二进制数据到SSH通道（异步分片发送）"""
        if not self.connected or not self.channel:
            raise ValueError("SSH连接未建立")

        try:
            # 使用统一的分片发送方法
            logger.debug(f"开始异步分片发送原始数据: {len(data)} 字节")
            await self._send_data_chunked(data)
        except ConnectionResetError as e:
            logger.warning(f"发送原始数据到SSH时连接被重置: {str(e)}")
            self._last_error = f"发送原始数据到SSH时连接被重置: {str(e)}"
            self.connected = False
            self.closed = True
            raise ValueError(f"SSH连接被对端重置: {str(e)}")
        except (OSError, socket.error) as e:
            if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                logger.warning(f"发送原始数据到SSH时连接被对端重置: {str(e)}")
                self._last_error = f"发送原始数据到SSH时连接被对端重置: {str(e)}"
                self.connected = False
                self.closed = True
                raise ValueError(f"SSH连接被对端重置: {str(e)}")
            else:
                logger.error(f"发送原始数据到SSH时发生错误: {str(e)}")
                self._last_error = f"发送原始数据到SSH时发生错误: {str(e)}"
                raise ValueError(f"发送原始数据失败: {str(e)}")
        except Exception as e:
            logger.error(f"发送原始数据到SSH时发生未知错误: {str(e)}")
            self._last_error = f"发送原始数据到SSH时发生未知错误: {str(e)}"
            raise ValueError(f"发送原始数据失败: {str(e)}")

    async def resize_terminal(self, cols: int, rows: int) -> None:
        """调整SSH终端大小"""
        if not self.connected or not self.channel:
            return

        try:
            self.channel.resize_pty(width=cols, height=rows)
        except ConnectionResetError as e:
            logger.warning(f"调整SSH终端大小时连接被重置: {str(e)}")
            self._last_error = f"调整SSH终端大小时连接被重置: {str(e)}"
            self.connected = False
            self.closed = True
        except (OSError, socket.error) as e:
            if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                logger.warning(f"调整SSH终端大小时连接被对端重置: {str(e)}")
                self._last_error = f"调整SSH终端大小时连接被对端重置: {str(e)}"
                self.connected = False
                self.closed = True
            else:
                logger.error(f"调整SSH终端大小时发生错误: {str(e)}")
        except Exception as e:
            logger.error(f"调整SSH终端大小时发生未知错误: {str(e)}")

    async def close(self) -> None:
        """Close SSH connection"""
        if self.closed:
            logger.debug("[SSH_CLOSE] Connection already closed, skipping")
            return

        logger.info(f"[SSH_CLOSE] Starting SSH connection close process")
        logger.debug(f"[SSH_CLOSE] Initial state - connected: {self.connected}, channel: {bool(self.channel)}, ssh_client: {bool(self.ssh_client)}")

        self.closed = True
        self._stop_reading = True

        try:
            # Stop read thread
            if self._read_thread and self._read_thread.is_alive():
                logger.debug("[SSH_CLOSE] Step 1: Stopping read thread")
                self._read_thread.join(timeout=1.0)
                if self._read_thread.is_alive():
                    logger.warning("[SSH_CLOSE] Step 1: Read thread did not stop in time")
                else:
                    logger.debug("[SSH_CLOSE] Step 1: Read thread stopped successfully")
            else:
                logger.debug("[SSH_CLOSE] Step 1: No read thread to stop")

            # Close SSH channel
            if self.channel:
                logger.debug("[SSH_CLOSE] Step 2: Closing SSH channel")
                try:
                    self.channel.close()
                    logger.debug("[SSH_CLOSE] Step 2: SSH channel closed successfully")
                except Exception as e:
                    logger.debug(f"[SSH_CLOSE] Step 2: ERROR closing SSH channel: {str(e)}")
            else:
                logger.debug("[SSH_CLOSE] Step 2: No SSH channel to close")

            # Close SSH client
            if self.ssh_client:
                logger.debug("[SSH_CLOSE] Step 3: Closing SSH client")
                try:
                    self.ssh_client.close()
                    logger.debug("[SSH_CLOSE] Step 3: SSH client closed successfully")
                except Exception as e:
                    logger.debug(f"[SSH_CLOSE] Step 3: ERROR closing SSH client: {str(e)}")
            else:
                logger.debug("[SSH_CLOSE] Step 3: No SSH client to close")

            # Clean connection state
            logger.debug("[SSH_CLOSE] Step 4: Cleaning up connection state")
            self.connected = False
            logger.debug("[SSH_CLOSE] Step 4: Connection state cleaned")

            logger.info("[SSH_CLOSE] SSH connection close process completed successfully")

        except Exception as e:
            logger.error(f"[SSH_CLOSE] ERROR during SSH connection close: {str(e)}")
