#!/bin/sh
#
# webXTerm Docker Entrypoint Script
# 提供灵活的容器启动方式
#

set -e

# 默认配置
DEFAULT_HOST="${HOST:-0.0.0.0}"
DEFAULT_PORT="${PORT:-8080}"
DEFAULT_LOG_LEVEL="${LOG_LEVEL:-info}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[webXTerm]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 显示 banner
show_banner() {
    cat << 'EOF'
                _     __  ________                    
 _      _____  / |   / / /_  __/__  _________ ___ 
| | /| / / _ \/ __ \/ |/_/ / / / _ \/ ___/ __ `__ \
| |/ |/ /  __/ /_/ />  <  / / /  __/ /  / / / / / /
|__/|__/\___/_.___/_/|_| /_/  \___/_/  /_/ /_/ /_/ 
                                                    
            webXTerm - Modern Web Terminal
            https://github.com/Nekhama/webxterm
EOF
    echo ""
}

# 初始化数据目录
init_data_dir() {
    if [ ! -d "/app/data" ]; then
        print_info "Creating data directory..."
        mkdir -p /app/data
    fi
    
    # 确保权限正确
    chmod 755 /app/data 2>/dev/null || true
}

# 信号处理（优雅关闭）
handle_signal() {
    print_warning "Received shutdown signal, stopping gracefully..."
    # 发送 SIGTERM 到 uvicorn 进程
    if [ -n "$UVICORN_PID" ]; then
        kill -TERM "$UVICORN_PID" 2>/dev/null || true
        wait "$UVICORN_PID"
    fi
    print_info "Shutdown complete"
    exit 0
}

# 注册信号处理器
trap 'handle_signal' SIGTERM SIGINT

# 显示启动信息
show_startup_info() {
    print_info "Starting webXTerm..."
    echo ""
    print_info "Configuration:"
    echo "  Host: ${DEFAULT_HOST}"
    echo "  Port: ${DEFAULT_PORT}"
    echo "  Log Level: ${DEFAULT_LOG_LEVEL}"
    echo ""
    print_info "Access URLs:"
    echo "  WebXTerm: http://localhost:${DEFAULT_PORT}"
    echo "  API Docs: http://localhost:${DEFAULT_PORT}/docs"
    echo "  Health: http://localhost:${DEFAULT_PORT}/health"
    echo ""
}

# 主函数
main() {
    show_banner
    init_data_dir
    show_startup_info
    
    # 如果没有传入参数，使用默认启动方式
    if [ $# -eq 0 ]; then
        print_info "Starting uvicorn server..."
        # 使用 exec 替换当前 shell，使信号能正确传递
        # --no-use-colors 禁用 ANSI 颜色代码，让 Docker 日志更清晰
        exec python3 -m uvicorn app.main:app \
            --host "${DEFAULT_HOST}" \
            --port "${DEFAULT_PORT}" \
            --log-level "${DEFAULT_LOG_LEVEL}" \
            --no-use-colors
    else
        # 如果传入了参数，执行传入的命令
        print_info "Executing custom command: $*"
        exec "$@"
    fi
}

# 执行主函数
main "$@"

