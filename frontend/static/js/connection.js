/**
 * Connection Manager
 * Handles WebSocket connections to backend
 */

export class ConnectionManager {
    constructor() {
        this.websocket = null;
        this.connectionId = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.eventListeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 1000;
    }

    init() {
        // Set up connection state tracking
        this.setupConnectionTracking();
    }

    setupConnectionTracking() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.websocket) {
                // Page is hidden, connection might be suspended
                this.emit('visibility', 'hidden');
            } else if (!document.hidden && this.websocket) {
                // Page is visible again
                this.emit('visibility', 'visible');
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            this.emit('networkStatus', 'online');
            if (!this.isConnected && this.connectionId) {
                this.reconnect();
            }
        });

        window.addEventListener('offline', () => {
            this.emit('networkStatus', 'offline');
        });
    }

    async connect(config) {
        if (this.isConnecting) {
            throw new Error('Connection already in progress');
        }

        if (this.isConnected) {
            await this.disconnect();
        }

        this.isConnecting = true;

        try {
            // Step 1: Initiate connection with backend
            const i18n = window.app?.i18n;
            this.emit('connectionProgress', { step: 'initiating', message: i18n ? i18n.t('connection.initiating') : 'Initiating connection...' });

            // 支持子应用挂载：优先使用全局配置的 API 基础路径
            const apiBase = window.WEBXTERM_API_BASE || '/api';
            const response = await fetch(`${apiBase}/connections/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Connection failed');
            }

            const connectionData = await response.json();
            this.connectionId = connectionData.connection_id;

            // Step 2: Establish WebSocket connection
            this.emit('connectionProgress', { step: 'websocket', message: i18n ? i18n.t('connection.establishing') : 'Establishing secure connection...' });
            await this.connectWebSocket();

            this.emit('connectionProgress', { step: 'authentication', message: i18n ? i18n.t('connection.authenticating') : 'Authenticating...' });

            // Small delay to show authentication step
            await new Promise(resolve => setTimeout(resolve, 500));

            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;

            // Store connection info
            this.connectionInfo = {
                id: this.connectionId,
                hostname: config.hostname,
                port: config.port,
                username: config.username,
                type: config.connection_type,
                encoding: connectionData.encoding
            };

            // Store original config for reconnection (including auth credentials)
            this.originalConfig = { ...config };

            this.emit('connectionProgress', { step: 'connected', message: i18n ? i18n.t('connection.connected') : 'Connection established' });
            this.emit('connected', this.connectionInfo);
            return this;

        } catch (error) {
            this.isConnecting = false;
            this.connectionId = null;
            this.emit('connectionProgress', { step: 'error', message: `Connection failed: ${error.message}` });
            console.error('Connection failed:', error);
            throw error;
        }
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // 支持子应用挂载：优先使用全局配置的 API 基础路径
            const apiBase = window.WEBXTERM_API_BASE || '/api';
            const wsUrl = `${protocol}//${window.location.host}${apiBase}/connections/ws/${this.connectionId}`;

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.setupWebSocketHandlers();
                resolve();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(new Error('WebSocket connection failed'));
            };

            this.websocket.onclose = (event) => {
                if (!this.isConnected) {
                    // Connection failed during initial connection
                    reject(new Error(`WebSocket closed during connection: ${event.reason}`));
                }
            };

            // Timeout for connection
            setTimeout(() => {
                if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
                    this.websocket.close();
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });
    }

    setupWebSocketHandlers() {
        this.websocket.onmessage = (event) => {
            try {
                // Handle binary data (terminal output)
                if (event.data instanceof Blob) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const data = reader.result;
                        this.processReceivedData(data);
                    };
                    reader.readAsText(event.data);
                } else {
                    // Handle text data
                    this.processReceivedData(event.data);
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        this.websocket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);

            // For now, treat all closes as potentially recoverable unless explicitly marked as user disconnect
            this.handleDisconnection(event.reason || 'connection_closed', event.code);
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', new Error('WebSocket error'));
        };
    }

    sendData(data) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send data: WebSocket not connected');
            return;
        }

        try {
            const message = JSON.stringify({ data });
            this.websocket.send(message);
        } catch (error) {
            console.error('Error sending data:', error);
            this.emit('error', error);
        }
    }

    resize(cols, rows) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const message = JSON.stringify({ resize: [cols, rows] });
            this.websocket.send(message);
        } catch (error) {
            console.error('Error sending resize:', error);
        }
    }

    async disconnect() {
        if (!this.isConnected && !this.isConnecting) {
            return;
        }

        console.debug('Disconnecting connection...');
        this.isConnected = false;
        this.isConnecting = false;

        if (this.websocket) {
            try {
                // Send close frame with proper code and reason
                this.websocket.close(1000, 'user_disconnect');
                console.debug('WebSocket close frame sent');

                // Wait a bit for graceful close
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.debug('Error during WebSocket close:', error);
            }
            this.websocket = null;
        }

        // Clear connection state but preserve originalConfig for reconnection
        this.connectionId = null;
        this.connectionInfo = null;
        this.reconnectAttempts = 0;
        // Note: originalConfig is preserved for reconnection purposes

        console.debug('Connection disconnected and cleaned up');
        this.emit('disconnected', 'user_disconnect');
    }

    async reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit('error', new Error('Max reconnection attempts reached'));
            return;
        }

        if (!this.connectionInfo || !this.originalConfig) {
            console.error('No connection info or original config available for reconnection');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        try {
            await this.delay(this.reconnectDelay * this.reconnectAttempts);

            // Use original configuration with all authentication details
            console.log('Reconnecting with original config:', {
                hostname: this.originalConfig.hostname,
                port: this.originalConfig.port,
                username: this.originalConfig.username,
                connection_type: this.originalConfig.connection_type,
                hasPassword: !!this.originalConfig.password,
                hasPrivateKey: !!this.originalConfig.private_key
            });

            await this.connect(this.originalConfig);

        } catch (error) {
            console.error('Reconnection failed:', error);

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnect();
            } else {
                this.emit('error', new Error('Reconnection failed'));
            }
        }
    }

    handleDisconnection(reason, closeCode = null) {
        this.isConnected = false;
        this.websocket = null;

        console.log('Connection disconnected with reason:', reason, 'close code:', closeCode);

        // Always emit disconnection event (let the UI decide how to handle it)
        this.emit('disconnected', reason);

        // 不再自动重连，让用户完全控制连接状态
        // Auto-reconnect mechanism removed - users have full control over connection state
        console.log('Connection closed - no auto-reconnect, user can manually reconnect if needed');
    }

    getConnectionInfo() {
        return this.connectionInfo;
    }

    getConnectionState() {
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            connectionId: this.connectionId,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    // Utility method
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Event system
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, ...args) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error('Error in connection event listener:', error);
                }
            });
        }
    }

    dispose() {
        this.disconnect();
        this.eventListeners.clear();
    }

    processReceivedData(data) {
        this.emit('data', data);
    }

}
