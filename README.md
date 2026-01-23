# webXTerm - 现代化网页终端

一个基于浏览器的 SSH/Telnet/USB Serial 远程终端管理工具，提供简洁高效的服务器远程登录和管理体验。

<img alt="image" src="./webxterm.png" />

## 核心特性

- 🔐 **SSH/Telnet/Serial 支持** - 完整的 SSH、Telnet 和 USB Serial 协议实现
- 💾 **会话管理** - 保存常用连接配置，支持分组和快速搜索
- 🔑 **SSH 密钥管理** - 集中管理 SSH 密钥，支持上传和粘贴
- 🔤 **智能编码检测** - 自动识别 UTF-8/GBK 编码，完美显示中文
- 🎨 **专业界面** - 深色主题，护眼舒适
- 🌍 **多语言支持** - 简体中文、繁体中文、English
- 📱 **响应式设计** - 完美支持桌面和移动设备
- ⚡ **高性能** - 基于 FastAPI 和 XTerm.js 构建

## 主要功能

### 1. 快速连接

- 填写服务器信息即可快速连接
- 支持 SSH 密码认证和密钥认证
- 支持 Telnet 明文连接
- 支持 USB Serial 串口连接（可配置设备名和波特率）
- 自动检测服务器编码

### 2. 会话管理

- **保存配置**：保存常用服务器连接配置
- **分组管理**：按项目或环境分组
- **快速搜索**：实时搜索过滤会话
- **便捷操作**：
  - 单击会话 → 填充连接表单
  - 双击会话 → 直接连接
  - 右键菜单 → 编辑/复制/删除

### 3. SSH 密钥管理

- 集中管理所有 SSH 私钥
- 支持文件上传或直接粘贴
- 显示密钥指纹便于识别
- 连接时下拉选择密钥
- 加密存储确保安全

### 4. 智能编码

自动检测并适配服务器字符编码：

- **UTF-8**：现代 Linux/Unix 系统
- **GBK/GB2312**：老旧中文系统
- **自动检测**：智能识别无需配置

### 5. 连接管理

- 自动切换：新连接自动断开旧会话
- 状态显示：实时显示连接状态和信息
- 会话摘要：断开时显示连接时长和原因
- 快速重连：一键重新连接断开的会话

## 技术架构

### 后端

- **FastAPI** - 现代 Python Web 框架
- **paramiko** - SSH 协议实现
- **telnetlib3** - Telnet 协议实现
- **pyserial-asyncio** - USB Serial 串口通信
- **SQLite** - 数据存储
- **uvicorn** - ASGI 服务器

### 前端

- **XTerm.js 5.5.0** - 终端模拟器
- **原生 JavaScript (ES6+)** - 无框架依赖
- **CSS Grid/Flexbox** - 响应式布局

### 数据流

```
浏览器 <--WebSocket--> FastAPI <--SSH/Telnet/Serial--> 远程服务器/串口设备
  |                        |
XTerm.js              paramiko/telnetlib3/pyserial
```

## 项目结构

```
webxterm/
├── app/                    # 后端应用
│   ├── api/               # API 路由
│   ├── core/              # 核心配置
│   ├── models/            # 数据模型
│   ├── protocols/         # SSH/Telnet/Serial 实现
│   └── services/          # 业务逻辑
├── frontend/              # 前端资源
│   ├── static/
│   │   ├── css/          # 样式文件
│   │   ├── js/           # JavaScript 模块
│   │   └── assets/       # 静态资源
│   └── templates/         # HTML 模板
├── data/                  # 运行时数据
│   ├── webxterm.db       # SQLite 数据库
│   └── webxterm.log      # 应用日志
├── start.py              # 启动脚本
└── requirements.txt      # Python 依赖
```

## 配置说明

### 默认配置

- **监听地址**：0.0.0.0（所有网卡）
- **监听端口**：8080
- **数据目录**：./data/
- **日志级别**：WARNING

### 自定义配置

可通过 `config.json` 自定义配置（可选）：

```json
{
  "host": "127.0.0.1",
  "port": 8080,
  "data_dir": "./data",
  "log_level": "INFO"
}
```

## 生产部署

### Docker 部署（推荐）

#### 基础部署

```bash
# 方法 1：使用 Docker Compose（推荐）
docker-compose up -d

# 方法 2：使用官方镜像
docker pull nekhama/webxterm:latest
docker run -d \
  --name webxterm \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  nekhama/webxterm:latest
```

#### 数据持久化

数据目录 `./data` 已通过 volume 挂载，包含：
- `webxterm.db` - SQLite 数据库
- SSH 密钥等敏感数据

定期备份该目录即可：

```bash
# 备份数据
tar -czf webxterm-backup-$(date +%Y%m%d).tar.gz data/

# 恢复数据
tar -xzf webxterm-backup-20240101.tar.gz
```

#### 可用镜像

```bash
# 最新版本（Alpine，117MB）
nekhama/webxterm:latest

# 指定版本
nekhama/webxterm:1.1.0

# Docker Hub: https://hub.docker.com/r/nekhama/webxterm
```

### 传统守护进程模式

```bash
# 启动服务
python start.py --daemon --port 8080

# 查看日志
tail -f data/webxterm.log

# 停止服务
python start.py --stop
```

### 反向代理

推荐使用 Nginx 或 Apache 作为反向代理：

```nginx
# Nginx 配置示例
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 构建自定义镜像

如果您想修改代码并构建自己的镜像：

```bash
# 使用 Alpine 版本（推荐，117MB）
docker build -f Dockerfile.alpine -t myname/webxterm:latest .

# 使用标准版本（247MB）
docker build -f Dockerfile -t myname/webxterm:latest .

# 运行自定义镜像
docker run -d -p 8080:8080 -v $(pwd)/data:/app/data myname/webxterm:latest
```

### 安全建议

- ✅ 配置 HTTPS（强烈推荐）
- ✅ 设置防火墙规则
- ✅ 定期备份数据库
- ✅ 使用强密码
- ✅ 启用访问日志
- ✅ 限制来源 IP（可选）

## 常见问题

### 连接失败？

1. 检查目标服务器网络是否可达
2. 确认 SSH/Telnet 端口正确
3. 验证用户名密码或密钥
4. 查看服务器防火墙设置

### 中文乱码？

- 使用"自动检测"编码选项
- 或手动选择 UTF-8 或 GBK

### 连接断开？

- 检查网络稳定性
- 查看服务器是否有超时设置
- 使用重连功能快速恢复

## 依赖库

### Python 依赖

```
fastapi >= 0.104.0
uvicorn >= 0.24.0
paramiko >= 3.3.0
telnetlib3 >= 2.0.0
pyserial-asyncio >= 0.6
python-multipart >= 0.0.6
cryptography >= 41.0.0
```

### 前端依赖

所有前端库已本地化，无需 CDN：

- XTerm.js 5.5.0
- xterm-addon-fit
- @xterm/addon-web-links

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [XTerm.js](https://xtermjs.org/) - 强大的终端组件
- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Web 框架
- [paramiko](https://www.paramiko.org/) - Python SSH 库
