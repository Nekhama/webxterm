"""
Local terminal protocol
Uses /usr/bin/login for local user authentication
"""

import asyncio
import logging
import os
import pty
import struct
import termios
import fcntl
from typing import Optional

from .base import ConnectionProtocol

logger = logging.getLogger(__name__)


class LocalProtocol(ConnectionProtocol):
    """
    本地终端协议
    通过 pty + /usr/bin/login 实现本地用户登录
    """

    def __init__(self, config):
        super().__init__(config)
        self.master_fd = None
        self.slave_fd = None
        self.pid = None
        self.reader_task = None
        self.encoding = 'utf-8'

        # 终端尺寸
        self.cols = getattr(config, 'cols', 80)
        self.rows = getattr(config, 'rows', 24)

        # 自动登录凭据
        self.auto_login_username = getattr(config, 'username', '')
        self.auto_login_password = getattr(config, 'password', '')
        self.auto_login_state = 'waiting_login' if self.auto_login_username else 'done'
        self.output_buffer = ''  # 用于检测登录提示

    async def connect(self) -> bool:
        """
        启动本地终端会话
        """
        try:
            logger.info("启动本地终端会话")

            # 创建伪终端
            self.master_fd, self.slave_fd = pty.openpty()

            # 设置终端尺寸
            self._set_terminal_size(self.slave_fd, self.rows, self.cols)

            # 设置 master_fd 为非阻塞模式
            flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
            fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

            # Fork 进程
            self.pid = os.fork()

            if self.pid == 0:
                # 子进程
                self._setup_child_process()
            else:
                # 父进程
                os.close(self.slave_fd)
                self.slave_fd = None

                self.connected = True

                # 启动读取任务
                self.reader_task = asyncio.create_task(self._read_from_pty())

                logger.info(f"本地终端会话已启动，PID: {self.pid}")
                return True

        except Exception as e:
            logger.error(f"启动本地终端失败: {str(e)}")
            await self.close()
            raise

    def _setup_child_process(self):
        """
        设置子进程环境
        """
        try:
            # 关闭 master_fd
            os.close(self.master_fd)

            # 创建新会话
            os.setsid()

            # 设置控制终端
            fcntl.ioctl(self.slave_fd, termios.TIOCSCTTY, 0)

            # 重定向标准输入输出错误到 slave
            os.dup2(self.slave_fd, 0)  # stdin
            os.dup2(self.slave_fd, 1)  # stdout
            os.dup2(self.slave_fd, 2)  # stderr

            # 关闭原始 slave_fd
            if self.slave_fd > 2:
                os.close(self.slave_fd)

            # 设置环境变量
            env = os.environ.copy()
            env['TERM'] = 'xterm-256color'
            env['HOME'] = os.path.expanduser('~')
            env['SHELL'] = os.environ.get('SHELL', '/bin/bash')

            # 执行 login 程序
            # 注意：/usr/bin/login 在某些系统上可能需要 root 权限
            # 如果 login 不可用，则报错退出而不是降级到 shell
            login_path = '/usr/bin/login'

            if os.path.exists(login_path) and os.access(login_path, os.X_OK):
                # 使用 login 进行本地用户认证
                os.execve(login_path, [login_path], env)
            else:
                # login 不可用，报错退出
                logger.error(f"本地终端登录被禁用: {login_path} 不存在或不可执行")
                os._exit(1)

        except Exception as e:
            logger.error(f"子进程设置失败: {str(e)}")
            os._exit(1)

    async def _read_from_pty(self):
        """
        从 PTY 读取数据并发送到 WebSocket
        """
        logger.debug("开始从 PTY 读取数据")

        while not self.closed and self.connected:
            try:
                # 使用 asyncio 的方式异步读取
                await asyncio.sleep(0.01)  # 小延迟避免 CPU 占用过高

                try:
                    data = os.read(self.master_fd, 4096)
                    if data:
                        # 解码数据
                        try:
                            text = data.decode(self.encoding, errors='replace')
                        except UnicodeDecodeError:
                            text = data.decode('utf-8', errors='replace')

                        # 处理自动登录
                        await self._handle_auto_login(text)

                        # 队列输出
                        await self._queue_output(text)

                except BlockingIOError:
                    # 非阻塞模式下没有数据
                    continue
                except OSError as e:
                    if e.errno == 5:  # EIO - 终端已关闭
                        logger.info("PTY 已关闭")
                        break
                    else:
                        logger.error(f"读取 PTY 错误: {e}")
                        break

            except Exception as e:
                logger.error(f"读取 PTY 数据异常: {str(e)}")
                break

        logger.debug("PTY 读取循环结束")
        await self.close()

    async def send_data(self, data: str) -> None:
        """
        发送数据到本地终端
        """
        if not self.connected or self.master_fd is None:
            logger.warning("终端未连接，无法发送数据")
            return

        try:
            # 编码并写入 PTY
            encoded_data = data.encode(self.encoding, errors='replace')
            os.write(self.master_fd, encoded_data)

        except Exception as e:
            logger.error(f"发送数据到 PTY 失败: {str(e)}")
            await self.close()

    async def send_raw_data(self, data: bytes) -> None:
        """
        发送原始数据到本地终端
        """
        if not self.connected or self.master_fd is None:
            return

        try:
            os.write(self.master_fd, data)
        except Exception as e:
            logger.error(f"发送原始数据失败: {str(e)}")
            await self.close()

    async def resize_terminal(self, cols: int, rows: int) -> None:
        """
        调整终端尺寸
        """
        try:
            if self.master_fd is not None:
                self.cols = cols
                self.rows = rows
                self._set_terminal_size(self.master_fd, rows, cols)
                logger.debug(f"终端尺寸已调整为: {cols}x{rows}")
        except Exception as e:
            logger.error(f"调整终端尺寸失败: {str(e)}")

    def _set_terminal_size(self, fd: int, rows: int, cols: int):
        """
        设置终端窗口尺寸
        """
        try:
            # TIOCSWINSZ 结构: rows, cols, xpixel, ypixel
            size = struct.pack('HHHH', rows, cols, 0, 0)
            fcntl.ioctl(fd, termios.TIOCSWINSZ, size)
        except Exception as e:
            logger.error(f"设置终端尺寸失败: {str(e)}")

    async def _handle_auto_login(self, text: str):
        """
        处理自动登录逻辑
        检测 login: 和 Password: 提示（不区分大小写）并自动输入
        """
        if self.auto_login_state == 'done':
            return

        # 将文本添加到缓冲区
        self.output_buffer += text
        # 只保留最后 500 个字符，避免缓冲区过大
        if len(self.output_buffer) > 500:
            self.output_buffer = self.output_buffer[-500:]

        # 转换为小写以便不区分大小写匹配
        buffer_lower = self.output_buffer.lower()

        try:
            if self.auto_login_state == 'waiting_login':
                # 检测登录提示：login:、username:、user: 等
                if any(prompt in buffer_lower for prompt in ['login:', 'username:', 'user:']):
                    logger.info(f"检测到登录提示，自动输入用户名: {self.auto_login_username}")
                    # 输入用户名并回车
                    await asyncio.sleep(0.1)  # 小延迟确保提示完整显示
                    os.write(self.master_fd, (self.auto_login_username + '\n').encode(self.encoding))
                    self.auto_login_state = 'waiting_password'
                    self.output_buffer = ''  # 清空缓冲区

            elif self.auto_login_state == 'waiting_password':
                # 检测密码提示：password:、passwd: 等
                if 'password:' in buffer_lower or 'passwd:' in buffer_lower:
                    logger.info("检测到密码提示，自动输入密码")
                    # 输入密码并回车
                    await asyncio.sleep(0.1)
                    os.write(self.master_fd, (self.auto_login_password + '\n').encode(self.encoding))
                    self.auto_login_state = 'done'
                    self.output_buffer = ''  # 清空缓冲区
                    logger.info("自动登录完成")

        except Exception as e:
            logger.error(f"自动登录处理失败: {str(e)}")
            self.auto_login_state = 'done'  # 出错后停止自动登录

    async def close(self) -> None:
        """
        关闭本地终端会话
        """
        if self.closed:
            return

        logger.info("关闭本地终端会话")
        self.closed = True
        self.connected = False

        # 取消读取任务
        if self.reader_task and not self.reader_task.done():
            self.reader_task.cancel()
            try:
                await self.reader_task
            except asyncio.CancelledError:
                pass

        # 关闭文件描述符
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            self.master_fd = None

        if self.slave_fd is not None:
            try:
                os.close(self.slave_fd)
            except OSError:
                pass
            self.slave_fd = None

        # 终止子进程
        if self.pid is not None:
            try:
                os.kill(self.pid, 15)  # SIGTERM
                # 等待子进程结束
                try:
                    os.waitpid(self.pid, os.WNOHANG)
                except ChildProcessError:
                    pass
            except ProcessLookupError:
                # 进程已不存在
                pass
            except Exception as e:
                logger.error(f"终止子进程失败: {str(e)}")
            self.pid = None

        logger.info("本地终端会话已关闭")

    def get_connection_info(self) -> dict:
        """获取连接信息"""
        return {
            "hostname": "localhost",
            "port": 0,
            "username": os.getenv('USER', 'unknown'),
            "connection_type": "local",
            "connected": self.connected,
            "encoding": self.encoding,
            "pid": self.pid
        }
