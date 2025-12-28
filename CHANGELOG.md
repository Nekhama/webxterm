# webXTerm 变更日志

## 2025-12-28

#### 更新优化

- 使用 ScopedDOM 避免 ID 冲突
- 更新 requirements.txt

#### 主题同步

- 新增 dark/light 主题切换
- 支持光标颜色切换

## 2025-12-22

### 性能优化

#### API 缓存控制
- 添加 HTTP 中间件为 `/api/` 路径设置缓存控制头
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- `Pragma: no-cache`
- 防止浏览器缓存导致 API 延迟

## 2025-12-21

### 性能优化

#### 自动连接模式优化
- 当 URL 参数包含 `autoconnect=true` 时先处理 URL 参数在后台加载资源
  - 延迟加载会话列表 (`/api/sessions/`)，不阻塞连接
  - 延迟加载 SSH 密钥 (`/api/ssh-keys`)，不阻塞连接
  - 会话列表和 SSH 密钥在后台异步加载
  - 立即开始 SSH 连接，显著减少等待时间

## 2025-12-19

### 新增功能

#### URL 参数支持
- 支持通过 URL 参数预填充连接信息
- 支持参数：
  - `host` - 目标主机地址
  - `port` - SSH 端口
  - `user` - 用户名
  - `pwd` - Base64 编码的密码
  - `autoconnect` - 自动连接（true/false）
  - `fullscreen` - 连接后进入全屏模式（true/false）
  - `title` - 自定义窗口标题

#### 自动连接
- 当提供密码和 `autoconnect=true` 时，自动建立 SSH 连接
- 无密码时聚焦密码输入框，支持回车快捷连接

#### 全屏模式
- 新增 `enterFullscreen()` 方法
- 连接成功后根据 URL 参数自动进入全屏

#### 窗口标题
- 支持通过 `title` 参数自定义窗口标题
- 默认格式：`SSH - hostname:port`

### 修复

#### SSH 主机密钥验证
- 新增 `IgnoreHostKeyPolicy` 类，完全忽略主机密钥验证
- 清空已知主机缓存，解决主机密钥不匹配的问题
- 等效于 `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`

### 适配修改

#### 模块导入
- 修改 `app/core/database.py` 使用相对导入
- 前端 JS 模块支持 `window.WEBXTERM_API_BASE` 全局变量
