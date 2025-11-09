"""
Telnet连接协议实现
"""

import asyncio
import logging
import telnetlib3
import re
from typing import Optional

from .base import ConnectionProtocol
from ..core.config import settings

logger = logging.getLogger(__name__)


class TelnetProtocol(ConnectionProtocol):
    """
    使用telnetlib3的Telnet连接协议实现
    """

    # 登录提示和错误检测的正则表达式模式
    CONNECTION_ERROR_PATTERNS = [
        r'telnet:.*: (Connection refused|No route to host|Connection timed out)',
        r'connection refused by remote host',
    ]

    USERNAME_PATTERNS = [
        r'(User name|User Name|username|Username|login|Login):?\s*$',
        r'>>?\s*User\s+name:?\s*$',
        r'Please\s+enter\s+(username|login):?\s*$',
    ]

    PASSWORD_PATTERNS = [
        r'(password|Password):?\s*$',
        r'>>?\s*User\s+password:?\s*$',
        r'Please\s+enter\s+password:?\s*$',
    ]

    LOGIN_ERROR_PATTERNS = [
        r'(Username or password invalid|Login incorrect)',
        r'(has been locked|Account locked)',
        r'Reenter times have reached the upper limit',
        r'Authentication failed',
        r'Invalid (username|password)',
        r'Login failed',
    ]

    def __init__(self, config):
        super().__init__(config)
        self.reader = None
        self.writer = None
        self._read_task = None
        self._authentication_failed = False  # 标记认证是否失败
        self._last_error = None  # 保存最后的原始错误信息
        self._login_in_progress = False  # 登录进行中标志，用于控制认证错误检测
        self._shared_buffer = ''  # 共享缓冲区，供登录检测和后台读取使用

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

    def _decode_bytes_with_auto_detection(self, data: bytes) -> str:
        """从原始字节数据自动探测编码并转换为UTF-8"""
        # 如果数据是空的，直接返回
        if not data:
            return ""

        # 检测是否为UTF-8编码
        if self._is_utf8_bytes(data):
            # 如果是UTF-8，直接解码并返回
            return data.decode('utf-8')
        else:
            # 如果不是UTF-8，假设是GBK并转换为UTF-8
            try:
                return data.decode('gbk', errors='replace')
            except UnicodeDecodeError:
                # 最后回退到Latin-1解码
                return data.decode('latin-1', errors='replace')

    def _recover_gbk_from_corrupted_string(self, data: str) -> str:
        """尝试从包含替换字符的字符串中恢复GBK内容

        telnetlib3 使用UTF-8解码GBK字节时会产生替换字符，
        我们需要尝试其他方法来恢复原始内容
        """
        # 策略1: 直接保持替换字符，但提供更好的显示
        # 替换字符 � 在终端中可能显示不正确，尝试替换为更明显的占位符
        if '�' in data:
            # 保持原始替换字符，让终端自己处理
            return data

        # 策略2: 如果没有替换字符，直接返回
        return data

    def _convert_server_output(self, data: str) -> str:
        """将服务器输出从服务器编码转换为UTF-8供前端使用，自动探测编码"""
        # 确保data是字符串类型
        if data is None:
            return ""
        if not isinstance(data, str):
            data = str(data)

        if not data:
            return data

        # 检查是否包含Unicode替换字符，这是telnetlib3错误解码GBK的标志
        if '�' in data:
            return self._recover_gbk_from_corrupted_string(data)

        # 如果数据全部是ASCII字符（包括控制字符），不需要转换
        try:
            data.encode('ascii')
            return data  # 纯ASCII数据，直接返回
        except UnicodeEncodeError:
            pass  # 包含非ASCII字符，需要转换

        # 自动探测和转换编码
        try:
            # 检查数据是否所有字符都小于256（latin-1编码的特征）
            if all(ord(char) < 256 for char in data):
                # 将latin-1字符串转换回原始bytes
                bytes_data = data.encode('latin-1')

                # 首先检测是否为UTF-8
                if self._is_utf8_bytes(bytes_data):
                    # 如果是UTF-8，直接解码
                    return bytes_data.decode('utf-8')
                else:
                    # 如果不是UTF-8，假设是GBK
                    try:
                        return bytes_data.decode('gbk', errors='replace')
                    except UnicodeDecodeError:
                        # 回退到原始数据
                        return data
            else:
                return data

        except (UnicodeDecodeError, UnicodeEncodeError):
            return data

    async def connect(self) -> bool:
        """建立Telnet连接"""
        try:
            # 连接到Telnet服务器
            # 设置终端类型以支持Tab补全等功能
            terminal_type = getattr(self.config, 'terminal_type', 'xterm-256color')

            # 使用force_binary=True获取原始字节数据，然后手动处理编码转换
            self.reader, self.writer = await asyncio.wait_for(
                telnetlib3.open_connection(
                    host=self.config.hostname,
                    port=self.config.port,
                    force_binary=True,  # 强制二进制模式，返回原始字节
                    encoding='latin-1',  # 设置默认编码，但force_binary会覆盖
                    connect_maxwait=settings.TELNET_TIMEOUT,
                    term=terminal_type,
                    cols=120,
                    rows=26
                ),
                timeout=settings.TELNET_TIMEOUT
            )
            # print(f"[TELNET DEBUG] Successfully connected with force_binary=True")

            logger.info(f"Telnet连接已建立，终端类型: {terminal_type}，服务器编码: {self.server_encoding}")

            self.connected = True

            # 开始读取输出
            self._read_task = asyncio.create_task(self._read_output_async())

            logger.info(f"Telnet connection established to {self.config.hostname}:{self.config.port}")

            # 如果提供了凭据则处理登录
            if hasattr(self.config, 'username') and self.config.username:
                await self._handle_login()

            return True

        except asyncio.TimeoutError:
            logger.error(f"Telnet connection timeout to {self.config.hostname}:{self.config.port}")
            raise ValueError(f"Connection timeout to {self.config.hostname}:{self.config.port}")
        except OSError as e:
            logger.error(f"Telnet connection error: {str(e)}")
            raise ValueError(f"Unable to connect to {self.config.hostname}:{self.config.port}: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected Telnet error: {str(e)}")
            raise ValueError(f"Connection failed: {str(e)}")

    async def _handle_login(self):
        """使用正则表达式模式处理Telnet登录过程"""
        try:
            # 设置登录进行中标志，暂停后台认证错误检测
            self._login_in_progress = True

            # 暂停后台读取任务以避免数据竞争
            if self._read_task and not self._read_task.done():
                self._read_task.cancel()
                try:
                    await self._read_task
                except asyncio.CancelledError:
                    pass
                logger.debug("暂停后台读取任务进行登录")

            # 等待用户名提示
            username_match = await self._wait_for_regex_patterns(
                patterns=self.USERNAME_PATTERNS,
                timeout=15,
                description="username prompt"
            )

            # 检查是否因为连接问题或认证失败而无法获取用户名提示
            if self._authentication_failed or self.closed:
                error_message = "连接已断开或认证失败，停止登录过程"
                if self._last_error:
                    error_message += f" ({self._last_error})"
                raise ValueError(error_message)

            if username_match:
                logger.info(f"Found username prompt: {username_match}")

                # 发送用户名
                if hasattr(self.config, 'username') and self.config.username:
                    await self.send_data(self.config.username + '\r\n')
                    logger.debug(f"Sent username: {self.config.username}")

                    # 等待密码提示
                    password_match = await self._wait_for_regex_patterns(
                        patterns=self.PASSWORD_PATTERNS,
                        timeout=10,
                        description="password prompt"
                    )

                    # 检查是否因为连接问题或认证失败而无法获取密码提示
                    if self._authentication_failed or self.closed:
                        error_message = "连接已断开或认证失败，停止登录过程"
                        if self._last_error:
                            error_message += f" ({self._last_error})"
                        raise ValueError(error_message)

                    if password_match:
                        logger.info(f"Found password prompt: {password_match}")

                        # 发送密码
                        if hasattr(self.config, 'password') and self.config.password:
                            await self.send_data(self.config.password + '\r\n')
                            logger.debug("Sent password")

                            # 重新启用认证错误检测并重启后台读取任务
                            self._login_in_progress = False
                            if not self.closed and self.reader:
                                self._read_task = asyncio.create_task(self._read_output_async())
                                logger.debug("密码发送后重启后台读取任务")

                            # 等待片刻并检查登录错误
                            await asyncio.sleep(3)
                            await self._check_login_errors()

                            # 检查是否在检查过程中发现认证失败
                            if self._authentication_failed:
                                error_message = "检测到认证失败，停止登录过程"
                                if self._last_error:
                                    error_message += f" ({self._last_error})"
                                raise ValueError(error_message)

            logger.info("Telnet login sequence completed")

        except Exception as e:
            logger.warning(f"Telnet login handling failed: {str(e)}")
            # 如果是认证失败或连接问题，重新抛出异常停止连接
            if self._authentication_failed or self.closed or "连接已断开" in str(e) or "认证失败" in str(e):
                # 如果有保存的原始错误信息且当前异常消息中不包含，则添加原始错误信息
                if self._last_error and self._last_error not in str(e):
                    raise ValueError(f"{str(e)} ({self._last_error})")
                raise e
            # 其他错误继续执行，让用户手动处理登录
        finally:
            # 清除登录进行中标志，恢复后台认证错误检测
            self._login_in_progress = False

            # 恢复后台读取任务(如果还没有启动的话)
            if not self.closed and self.reader and (not self._read_task or self._read_task.done()):
                self._read_task = asyncio.create_task(self._read_output_async())
                logger.debug("恢复后台读取任务")

    async def _wait_for_prompt(self, prompts: list, timeout: int = 5):
        """等待输出中的特定提示"""
        start_time = asyncio.get_event_loop().time()
        buffer = ''

        # 将字节提示转换为字符串提示以适配telnetlib3
        string_prompts = []
        for prompt in prompts:
            if isinstance(prompt, bytes):
                string_prompts.append(prompt.decode(self.encoding, errors='replace'))
            else:
                string_prompts.append(prompt)

        logger.debug(f"Waiting for prompts: {string_prompts}")

        while (asyncio.get_event_loop().time() - start_time) < timeout:
            try:
                data = await asyncio.wait_for(self.reader.read(1024), timeout=1.0)
                if not data:
                    break

                # telnetlib3返回字符串数据
                if isinstance(data, str):
                    buffer += data
                else:
                    buffer += data.decode(self.encoding, errors='replace')

                logger.debug(f"Received data: {repr(data)}")
                logger.debug(f"Current buffer: {repr(buffer)}")

                # Check if any prompt is found (case insensitive)
                buffer_lower = buffer.lower()
                for prompt in string_prompts:
                    prompt_lower = prompt.lower()
                    if prompt_lower in buffer_lower:
                        logger.debug(f"Found prompt: '{prompt}' in buffer")
                        return

            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.debug(f"Error waiting for prompt: {str(e)}")
                break

        logger.warning(f"Expected prompt not found. Buffer contents: {repr(buffer)}")
        raise ValueError("Expected prompt not found")

    async def _wait_for_regex_patterns(self, patterns: list, timeout: int = 10, description: str = "pattern"):
        """等待匹配给定正则表达式模式中任意一个的文本"""
        start_time = asyncio.get_event_loop().time()
        buffer = ''

        # 编译正则表达式模式以提高性能
        compiled_patterns = []
        for pattern in patterns:
            try:
                compiled_patterns.append(re.compile(pattern, re.IGNORECASE | re.MULTILINE))
            except re.error as e:
                logger.warning(f"Invalid regex pattern '{pattern}': {e}")

        logger.debug(f"Waiting for {description} using {len(compiled_patterns)} patterns")

        while (asyncio.get_event_loop().time() - start_time) < timeout:
            try:
                data = await asyncio.wait_for(self.reader.read(1024), timeout=1.0)
                if not data:
                    break

                # telnetlib3返回字符串数据，需要进行编码转换
                if isinstance(data, str):
                    converted_data = self._convert_server_output(data)
                    buffer += converted_data
                else:
                    decoded_data = data.decode(self.server_encoding, errors='replace')
                    buffer += decoded_data

                logger.debug(f"Received data for {description}: {repr(data)}")

                # Check if any pattern matches
                for pattern in compiled_patterns:
                    match = pattern.search(buffer)
                    if match:
                        logger.debug(f"Found {description} match: '{match.group(0)}' using pattern: {pattern.pattern}")
                        return match.group(0)

            except asyncio.TimeoutError:
                continue
            except ConnectionResetError as e:
                logger.warning(f"等待{description}时连接被重置: {str(e)}")
                # 保存原始错误信息
                self._last_error = f"等待{description}时连接被重置: {str(e)}"
                # 连接已重置，标记为已断开并停止等待
                self.connected = False
                self.closed = True
                return None
            except (OSError, ConnectionError) as e:
                if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                    logger.warning(f"等待{description}时连接被对端重置: {str(e)}")
                    # 保存原始错误信息
                    self._last_error = f"等待{description}时连接被对端重置: {str(e)}"
                    self.connected = False
                    self.closed = True
                    return None
                else:
                    logger.debug(f"等待{description}时发生错误: {str(e)}")
                    break
            except Exception as e:
                logger.debug(f"等待{description}时发生未知错误: {str(e)}")
                break

        logger.warning(f"No {description} found in {timeout}s. Buffer contents: {repr(buffer[-200:])}")
        return None

    async def _check_login_errors(self):
        """检查登录错误消息"""
        try:
            # 读取任何待处理的数据
            buffer = ''
            for _ in range(5):  # 检查5秒
                try:
                    data = await asyncio.wait_for(self.reader.read(1024), timeout=1.0)
                    if data:
                        if isinstance(data, str):
                            converted_data = self._convert_server_output(data)
                            buffer += converted_data
                        else:
                            decoded_data = data.decode(self.server_encoding, errors='replace')
                            buffer += decoded_data
                except asyncio.TimeoutError:
                    continue
                except ConnectionResetError as e:
                    logger.warning(f"检查登录错误时连接被重置: {str(e)}")
                    # 连接已重置，标记为已断开并停止检查
                    self.connected = False
                    self.closed = True
                    return
                except (OSError, ConnectionError) as e:
                    if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                        logger.warning(f"检查登录错误时连接被对端重置: {str(e)}")
                        self.connected = False
                        self.closed = True
                        return
                    else:
                        logger.debug(f"检查登录错误时发生错误: {str(e)}")
                        break
                except Exception as e:
                    logger.debug(f"检查登录错误时发生未知错误: {str(e)}")
                    break

            # Check for error patterns
            for pattern_str in self.LOGIN_ERROR_PATTERNS:
                try:
                    pattern = re.compile(pattern_str, re.IGNORECASE | re.MULTILINE)
                    match = pattern.search(buffer)
                    if match:
                        error_msg = f"检测到登录错误: {match.group(0)}"
                        logger.error(error_msg)
                        # 标记认证失败，停止重试
                        self._authentication_failed = True
                        self.connected = False
                        self.closed = True
                        raise ValueError(error_msg)
                except re.error as e:
                    logger.warning(f"Invalid error regex pattern '{pattern_str}': {e}")

            logger.debug("No login errors detected")

        except Exception as e:
            logger.warning(f"Error checking login errors: {str(e)}")

    async def _check_data_for_auth_errors(self, data: str):
        """检查数据中是否包含认证错误信息"""
        if self._authentication_failed or self._login_in_progress:
            return  # 已经标记为认证失败或登录进行中，无需检查

        try:
            # 检查是否包含认证错误模式
            for pattern_str in self.LOGIN_ERROR_PATTERNS:
                try:
                    pattern = re.compile(pattern_str, re.IGNORECASE | re.MULTILINE)
                    match = pattern.search(data)
                    if match:
                        error_msg = f"实时检测到认证错误: {match.group(0)}"
                        logger.error(error_msg)
                        # 标记认证失败，停止所有操作
                        self._authentication_failed = True
                        self.connected = False
                        self.closed = True
                        return
                except re.error as e:
                    logger.warning(f"Invalid error regex pattern '{pattern_str}': {e}")

            # 同时检查连接错误模式
            for pattern_str in self.CONNECTION_ERROR_PATTERNS:
                try:
                    pattern = re.compile(pattern_str, re.IGNORECASE | re.MULTILINE)
                    match = pattern.search(data)
                    if match:
                        error_msg = f"实时检测到连接错误: {match.group(0)}"
                        logger.error(error_msg)
                        # 标记连接失败，停止所有操作
                        self._authentication_failed = True
                        self.connected = False
                        self.closed = True
                        return
                except re.error as e:
                    logger.warning(f"Invalid connection error regex pattern '{pattern_str}': {e}")

        except Exception as e:
            logger.debug(f"Error checking data for auth errors: {str(e)}")

    async def _read_output_async(self):
        """异步读取Telnet输出"""
        try:
            while not self.closed and self.reader:
                try:
                    data = await asyncio.wait_for(self.reader.read(4096), timeout=1.0)
                    if not data:
                        # EOF received - server closed connection
                        logger.info("Telnet连接收到EOF，服务器已关闭连接")
                        self.connected = False
                        self.closed = True
                        break

                    # print(f"[TELNET DEBUG] _read_output_async received data type: {type(data)}, first 50 chars: {repr(data[:50] if data else '')}")

                    if isinstance(data, bytes):
                        # force_binary=True时，telnetlib3返回原始字节数据
                        # With force_binary=True, telnetlib3 returns raw bytes data
                        decoded_data = self._decode_bytes_with_auto_detection(data)
                    else:
                        # 如果意外收到字符串数据，转换回字节然后处理
                        # If we unexpectedly receive string data, convert back to bytes then process
                        logger.debug(f"Received string data when expecting bytes with force_binary=True")
                        try:
                            if isinstance(data, str):
                                bytes_data = data.encode('latin-1')
                                decoded_data = self._decode_bytes_with_auto_detection(bytes_data)
                            else:
                                decoded_data = self._convert_server_output(data)
                        except UnicodeEncodeError:
                            # 如果编码失败，直接使用字符串数据
                            decoded_data = self._convert_server_output(data)

                    # 检查是否包含认证错误信息
                    await self._check_data_for_auth_errors(decoded_data)

                    # 如果认证失败，停止读取
                    if self._authentication_failed:
                        logger.warning("检测到认证失败，停止读取数据")
                        break

                    # 将数据排队传送到WebSocket
                    await self._queue_output(decoded_data)

                except asyncio.TimeoutError:
                    continue
                except ConnectionResetError as e:
                    logger.warning(f"读取Telnet输出时连接被重置: {str(e)}")
                    # 连接已重置，标记为已断开并停止读取
                    self.connected = False
                    self.closed = True
                    break
                except (OSError, ConnectionError) as e:
                    if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                        logger.warning(f"读取Telnet输出时连接被对端重置: {str(e)}")
                        self.connected = False
                        self.closed = True
                        break
                    else:
                        logger.error(f"读取Telnet输出时发生错误: {str(e)}")
                        break
                except Exception as e:
                    logger.error(f"读取Telnet输出时发生未知错误: {str(e)}")
                    break

        except Exception as e:
            logger.error(f"Telnet read task error: {str(e)}")
        finally:
            # Ensure connection is marked as closed when read task ends
            if not self.closed:
                logger.info("Telnet read task ended unexpectedly, marking connection as closed")
                self.connected = False
                self.closed = True
            logger.debug("Telnet read task ended")

    async def send_data(self, data: str) -> None:
        """向Telnet连接发送数据"""
        if not self.connected or not self.writer:
            raise ValueError("Telnet连接未建立")

        try:
            # 调试信息：记录传入的数据类型和内容
            logger.debug(f"send_data called with: type={type(data)}, data={repr(data) if data is not None else 'None'}")

            # 确保data是字符串类型
            if data is None:
                raise ValueError("发送数据不能为None")
            if not isinstance(data, str):
                logger.debug(f"Converting non-string data to string: {type(data)} -> str")
                data = str(data)

            # 移除了quit命令检测逻辑，因为已经去掉自动重连机制

            # 直接发送字符串数据（恢复原来的逻辑）
            # Send string data directly (restore original logic)
            self.writer.write(data)
            await self.writer.drain()
            logger.debug(f"已发送Telnet数据: {repr(data[:50])}")  # 记录前50个字符
        except ConnectionResetError as e:
            logger.warning(f"发送数据到Telnet时连接被重置: {str(e)}")
            # 连接已重置，标记为已断开
            self.connected = False
            self.closed = True
            raise ValueError(f"连接已断开: {str(e)}")
        except (OSError, ConnectionError) as e:
            if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                logger.warning(f"发送数据到Telnet时连接被对端重置: {str(e)}")
                self.connected = False
                self.closed = True
                raise ValueError(f"连接被对端重置: {str(e)}")
            else:
                logger.error(f"发送数据到Telnet时发生错误: {str(e)}")
                raise ValueError(f"发送数据失败: {str(e)}")
        except Exception as e:
            logger.error(f"发送数据到Telnet时发生未知错误: {str(e)}")
            raise ValueError(f"发送数据失败: {str(e)}")

    async def send_raw_data(self, data: bytes) -> None:
        """发送原始二进制数据到Telnet连接"""
        if not self.connected or not self.writer:
            raise ValueError("Telnet连接未建立")

        try:
            self.writer.write(data)
            await self.writer.drain()
        except ConnectionResetError as e:
            logger.warning(f"发送原始数据到Telnet时连接被重置: {str(e)}")
            self.connected = False
            self.closed = True
            raise ValueError(f"Telnet连接被对端重置: {str(e)}")
        except Exception as e:
            logger.error(f"发送原始数据到Telnet时发生未知错误: {str(e)}")
            raise ValueError(f"发送原始数据失败: {str(e)}")

    async def resize_terminal(self, cols: int, rows: int) -> None:
        """调整Telnet终端大小 (禁用NAWS避免发送特殊字符)"""
        if not self.connected or not self.writer:
            return

        try:
            # 暂时禁用NAWS命令发送，因为会产生意外的特殊字符导致"Unknown command"错误
            # 大多数Telnet设备不需要显式的窗口大小协商，终端会自动适应
            logger.debug(f"Telnet终端大小调整请求: {cols}x{rows} (NAWS已禁用以避免特殊字符)")

            # 如果将来需要重新启用NAWS，请确保正确的二进制编码：
            # naws_command = (
            #     b'\xff\xfa\x1f'  # IAC SB NAWS
            #     + cols.to_bytes(2, 'big')  # 宽度
            #     + rows.to_bytes(2, 'big')  # 高度
            #     + b'\xff\xf0'  # IAC SE
            # )
            # 重要：直接发送字节数据而不要decode为字符串
            # self.writer.write(naws_command)

        except ConnectionResetError as e:
            logger.warning(f"调整Telnet终端大小时连接被重置: {str(e)}")
            # 连接已重置，标记为已断开
            self.connected = False
            self.closed = True
        except (OSError, ConnectionError) as e:
            if "Connection reset by peer" in str(e) or "Errno 54" in str(e):
                logger.warning(f"调整Telnet终端大小时连接被对端重置: {str(e)}")
                self.connected = False
                self.closed = True
            else:
                logger.error(f"调整Telnet终端大小时发生错误: {str(e)}")
        except Exception as e:
            logger.error(f"调整Telnet终端大小时发生未知错误: {str(e)}")


    async def close(self) -> None:
        """关闭Telnet连接"""
        if self.closed:
            logger.debug("[TELNET_CLOSE] Connection already closed, skipping")
            return

        logger.info(f"[TELNET_CLOSE] Starting Telnet connection close process")
        logger.debug(f"[TELNET_CLOSE] Initial state - connected: {self.connected}, writer: {bool(self.writer)}, reader: {bool(self.reader)}")

        self.closed = True
        self.connected = False

        try:
            # 发送logout命令尝试正常退出会话
            if self.writer and not self.writer.is_closing():
                try:
                    logger.debug("[TELNET_CLOSE] Step 1: Sending logout commands to server")
                    # 发送常见的退出命令
                    logout_commands = ['logout\r\n', 'exit\r\n', 'quit\r\n']
                    for i, cmd in enumerate(logout_commands):
                        try:
                            logger.debug(f"[TELNET_CLOSE] Step 1.{i+1}: Sending '{cmd.strip()}'")
                            self.writer.write(cmd.encode())
                            await self.writer.drain()
                            await asyncio.sleep(0.1)  # 短暂等待命令处理
                            logger.debug(f"[TELNET_CLOSE] Step 1.{i+1}: Command sent successfully")
                        except Exception as e:
                            logger.debug(f"[TELNET_CLOSE] Step 1.{i+1}: Command failed: {str(e)}")
                            break  # 如果任何命令失败，停止尝试
                    logger.debug("[TELNET_CLOSE] Step 1: All logout commands sent")
                except Exception as e:
                    logger.debug(f"[TELNET_CLOSE] Step 1: ERROR sending logout commands: {str(e)}")

            # 取消读取任务
            if self._read_task and not self._read_task.done():
                logger.debug("[TELNET_CLOSE] Step 2: Cancelling read task")
                self._read_task.cancel()
                try:
                    await asyncio.wait_for(self._read_task, timeout=1.0)
                    logger.debug("[TELNET_CLOSE] Step 2: Read task cancelled successfully")
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    logger.debug("[TELNET_CLOSE] Step 2: Read task cancellation timeout (expected)")
                    pass
            else:
                logger.debug("[TELNET_CLOSE] Step 2: No read task to cancel")

            # 强制关闭写入器
            if self.writer:
                try:
                    logger.debug("[TELNET_CLOSE] Step 3: Closing writer")
                    if not self.writer.is_closing():
                        logger.debug("[TELNET_CLOSE] Step 3: Calling writer.close()")
                        self.writer.close()

                    logger.debug("[TELNET_CLOSE] Step 3: Waiting for writer to close")
                    await asyncio.wait_for(self.writer.wait_closed(), timeout=2.0)
                    logger.debug("[TELNET_CLOSE] Step 3: Writer closed successfully")
                except asyncio.TimeoutError:
                    logger.warning("[TELNET_CLOSE] Step 3: Writer close timeout, forcing termination")
                except Exception as e:
                    logger.debug(f"[TELNET_CLOSE] Step 3: ERROR closing writer: {str(e)}")
            else:
                logger.debug("[TELNET_CLOSE] Step 3: No writer to close")

            # 清理连接状态
            logger.debug("[TELNET_CLOSE] Step 4: Cleaning up connection state")
            self.writer = None
            self.reader = None
            self._read_task = None
            logger.debug("[TELNET_CLOSE] Step 4: Connection state cleaned")

            logger.info("[TELNET_CLOSE] Telnet connection close process completed successfully")

        except Exception as e:
            logger.error(f"关闭Telnet连接时发生错误: {str(e)}")
            # 即使出错也要确保状态被清理
            self.writer = None
            self.reader = None
            self._read_task = None

    def get_connection_info(self) -> dict:
        """获取Telnet连接信息"""
        info = super().get_connection_info()
        info.update({
            "protocol_features": {
                "login_automation": bool(hasattr(self.config, 'username') and self.config.username),
                "window_size_negotiation": True,
                "encoding_support": True
            },
            "security_warning": "Telnet transmits data in plain text. Use with caution."
        })
        return info
