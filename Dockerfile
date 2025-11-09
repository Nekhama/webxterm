# webXTerm Dockerfile - 优化版本
# 使用多阶段构建减小镜像大小

# 阶段 1: 构建阶段
FROM python:3.12-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Copy requirements
COPY requirements.txt /tmp/requirements.txt

# Install Python dependencies
# 大多数包都有预编译的 wheel，不需要 gcc
# 如果遇到需要编译的包，pip 会自动下载 wheel 版本
RUN pip install --no-cache-dir --prefix=/usr/local -r /tmp/requirements.txt || \
    (apt-get update && \
     apt-get install -y --no-install-recommends gcc && \
     pip install --no-cache-dir --prefix=/usr/local -r /tmp/requirements.txt && \
     apt-get purge -y gcc && \
     apt-get autoremove -y && \
     rm -rf /var/lib/apt/lists/*)

# 阶段 2: 运行阶段
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy Python dependencies from builder
COPY --from=builder /usr/local /usr/local

# Copy application code
COPY app/ ./app/
COPY frontend/ ./frontend/
COPY start.py .
COPY docker-entrypoint.sh /usr/local/bin/

# Create data directory and clean up in one layer
RUN mkdir -p /app/data && \
    chmod -R 755 /app && \
    chmod +x /usr/local/bin/docker-entrypoint.sh && \
    find /usr/local -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local -type f -name '*.pyc' -delete 2>/dev/null || true && \
    find /usr/local -type f -name '*.pyo' -delete 2>/dev/null || true && \
    find /usr/local -type f -name '*.c' -delete 2>/dev/null || true && \
    find /usr/local -type f -name '*.h' -delete 2>/dev/null || true && \
    rm -rf /root/.cache 2>/dev/null || true

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Environment variables
# 可通过环境变量控制日志级别: debug, info, warning, error, critical
ENV LOG_LEVEL=info \
    HOST=0.0.0.0 \
    PORT=8080

# Use entrypoint for flexible startup
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command (can be overridden)
CMD []
