/**
 * webXTerm Main Application
 * Modern ES6+ implementation with xterm.js 5.5.0
 */

import { TerminalManager } from './terminal.js';
import { SessionManager } from './sessions.js';
import { UIManager } from './ui.js';
import { ConnectionManager } from './connection.js';
import { I18nManager, i18n } from './i18n/i18n.js';  // 🆕 导入 I18nManager 类
import { SessionSummaryUtil } from './session-summary.js';
import { SSHKeyUI } from './ssh-key-ui.js';

class webXTermApp {
    constructor(i18nInstance = null, dom = null, container = null) {
        // Configuration
        this.config = {
            debug: window.DEBUG || false
        };

        // 🆕 存储容器和 ScopedDOM（解决多实例冲突）
        this.dom = dom;
        this.container = container;

        // Core managers
        this.terminalManager = new TerminalManager(null, dom, container);  // 🆕 传递 dom 和 container
        this.sessionManager = new SessionManager();
        this.uiManager = new UIManager(dom, container);  // 🆕 传递 dom 和 container

        // Single session connection state
        this.currentConnection = null;
        this.currentSession = null;
        this.isConnecting = false;
        this.connectedAt = null;
        this.lastConnectionConfig = null;

        // Internationalization manager
        this.i18n = i18nInstance || i18n;  // 🆕 使用传入的实例或全局实例

        // SSH Key UI
        this.sshKeyUI = null;

        this.init();
    }

    async init() {
        try {
            this.log('Initializing webXTerm (Single Session Mode)...');

            // 检查是否有 autoconnect 参数，如果有则跳过同步加载会话列表
            const urlParams = new URLSearchParams(window.location.search);
            const isAutoConnect = urlParams.get('autoconnect') === 'true' && urlParams.get('host');

            // Initialize components (会调用 sessionManager.init())
            // 如果是自动连接模式，不等待会话列表加载
            if (isAutoConnect) {
                this.log('Auto-connect mode detected, using fast initialization...');
                this.initializeComponentsForAutoConnect();
            } else {
                await this.initializeComponents();
            }

            // Initialize terminal
            this.initializeSingleSessionTerminal();

            // Set up event listeners
            this.setupEventListeners();

            // 检查 URL 参数，支持从主应用传入连接参数
            // 如果是自动连接模式，先处理 URL 参数（开始连接）
            if (isAutoConnect) {
                this.checkUrlParams();
                // 延迟 1 秒后再后台加载会话列表和SSH密钥，确保连接优先
                setTimeout(() => {
                    this.loadSessions().catch(err => {
                        console.warn('Background session loading failed:', err);
                    });
                    if (this.sshKeyUI) {
                        this.sshKeyUI.loadKeysDeferred();
                    }
                }, 1000);
            } else {
                // Load saved sessions (同步加载)
                await this.loadSessions();
                this.checkUrlParams();
            }

            this.log('webXTerm initialized successfully');

        } catch (error) {
            console.error('Failed to initialize webXTerm:', error);
            this.uiManager.showError('Failed to initialize application');
        }
    }
    
    /**
     * 自动连接模式的初始化（不等待会话列表和SSH密钥加载）
     */
    initializeComponentsForAutoConnect() {
        // Make app available globally for UI components
        window.app = this;

        // Initialize language system
        this.initializeLanguage();

        // Initialize UI manager
        this.uiManager.init();

        // 不调用 sessionManager.init()，延迟加载会话列表

        // Initialize SSH Key UI (延迟加载SSH密钥)
        // 🆕 传递 dom 和 container（解决多实例冲突）
        this.sshKeyUI = new SSHKeyUI(this.i18n, { deferLoading: true, dom: this.dom, container: this.container });

        // Set up component communication
        this.setupComponentCommunication();
    }
    
    /**
     * 检查 URL 参数并自动填充连接表单
     * 支持参数: host, port, user, pwd (base64), autoconnect, fullscreen
     */
    checkUrlParams() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const host = urlParams.get('host');
            const port = urlParams.get('port');
            const user = urlParams.get('user');
            const pwdBase64 = urlParams.get('pwd');  // Base64 编码的密码
            const proto = urlParams.get('proto') || urlParams.get('protocol') || 'ssh';  // 协议参数，默认ssh
            const autoconnect = urlParams.get('autoconnect') === 'true';
            const fullscreen = urlParams.get('fullscreen') === 'true';
            const title = urlParams.get('title');
            
            // 保存全屏设置，连接成功后使用
            this.pendingFullscreen = fullscreen;
            
            // 设置窗口标题
            if (title) {
                document.title = title;
            }

            if (!host) return;
            
            // 解码密码
            let password = '';
            if (pwdBase64) {
                try {
                    password = atob(pwdBase64);
                } catch (e) {
                    console.warn('密码解码失败:', e);
                }
            }
            
            this.log('URL 参数检测到连接信息:', { host, port, user, proto, hasPassword: !!password, autoconnect });
            
            // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
            const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
            
            // 填充表单字段
            const hostnameInput = byId('hostname');
            const portInput = byId('port');
            const usernameInput = byId('username');
            const passwordInput = byId('password');
            const connectionTypeInput = byId('connection-type');
            
            if (hostnameInput && host) {
                hostnameInput.value = host;
            }
            if (portInput && port) {
                portInput.value = port;
            }
            if (usernameInput && user) {
                usernameInput.value = user;
            }
            if (passwordInput && password) {
                passwordInput.value = password;
            }
            if (connectionTypeInput && proto) {
                connectionTypeInput.value = proto.toLowerCase();
                // 触发 change 事件，更新相关UI（如SSH选项的显示/隐藏）
                connectionTypeInput.dispatchEvent(new Event('change'));
            }
            
            // 清除 URL 参数（防止密码泄露和刷新后重复操作）
            if (window.history.replaceState) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
            
            // 如果有密码且设置了自动连接，直接连接
            if (autoconnect && password) {
                this.uiManager.showInfo(`正在自动连接: ${user || 'root'}@${host}:${port || 22}`);
                // 使用 requestAnimationFrame 确保 DOM 更新后立即连接
                requestAnimationFrame(() => {
                    const connectBtn = byId('connect-btn');
                    if (connectBtn) {
                        connectBtn.click();
                    }
                });
            } else if (autoconnect) {
                // 没有密码，聚焦密码输入框
                this.uiManager.showInfo(`已填充连接信息: ${user || 'root'}@${host}:${port || 22}`);
                if (passwordInput) {
                    passwordInput.focus();
                    this.uiManager.showInfo('请输入密码后按回车连接');
                    
                    // 添加回车键监听，按回车自动连接
                    const handleEnter = (e) => {
                        if (e.key === 'Enter' && passwordInput.value) {
                            e.preventDefault();
                            passwordInput.removeEventListener('keydown', handleEnter);
                            const connectBtn = byId('connect-btn');
                            if (connectBtn) {
                                connectBtn.click();
                            }
                        }
                    };
                    passwordInput.addEventListener('keydown', handleEnter);
                }
            } else {
                // 只填充表单，不自动连接
                this.uiManager.showInfo(`已填充连接信息: ${user || 'root'}@${host}:${port || 22}`);
            }
            
        } catch (error) {
            console.error('Error parsing URL params:', error);
        }
    }

    initializeSingleSessionTerminal() {
        // Initialize terminal for single session
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const terminalElement = byId('terminal');
        if (terminalElement) {
            this.terminalManager.init(terminalElement);
            this.log('Single session terminal initialized');
        } else {
            console.warn('⚠️ Terminal element not found!');
        }
    }

    async initializeComponents() {
        // Make app available globally for UI components
        window.app = this;

        // Initialize language system
        this.initializeLanguage();

        // Initialize UI manager
        this.uiManager.init();

        // Initialize session manager
        await this.sessionManager.init();

        // Initialize SSH Key UI
        // 🆕 传递 dom 和 container（解决多实例冲突）
        this.sshKeyUI = new SSHKeyUI(this.i18n, { dom: this.dom, container: this.container });

        // Set up component communication
        this.setupComponentCommunication();
    }

    setupComponentCommunication() {
        // Session events
        this.sessionManager.on('sessionSelected', (session) => {
            this.connectToSession(session);
        });

        this.sessionManager.on('sessionsLoaded', (sessions) => {
            this.uiManager.updateSessionsList(sessions);
        });

        // UI events
        this.uiManager.on('quickConnect', (formData) => {
            this.quickConnect(formData);
        });

        this.uiManager.on('saveSession', (sessionData) => {
            this.saveSession(sessionData);
        });

        this.uiManager.on('updateSession', (sessionId, sessionData) => {
            this.updateSession(sessionId, sessionData);
        });

        this.uiManager.on('disconnect', () => {
            this.disconnect();
        });

        this.uiManager.on('themeToggle', () => {
            this.toggleTheme();
        });

        this.uiManager.on('fullscreenToggle', () => {
            this.toggleFullscreen();
        });

        this.uiManager.on('sessionConnect', (session) => {
            this.connectToSession(session);
        });

        this.uiManager.on('deleteSession', (session) => {
            this.deleteSession(session);
        });

        this.uiManager.on('duplicateSession', (session) => {
            this.duplicateSession(session);
        });
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('resize', () => {
            if (this.terminalManager) {
                this.terminalManager.fit();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Mobile sidebar toggle
        this.setupMobileSidebarToggle();

        // Language selector - 集成模式下跳过，使用主应用的语言选择器
        if (!window.__WEBXTERM_INTEGRATED_MODE__) {
            // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
            const byIdLang = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
            const $Lang = this.dom ? (sel) => this.dom.$(sel) : (sel) => document.querySelector(sel);
            const langToggle = byIdLang('lang-toggle');
            const langDropdown = byIdLang('lang-dropdown');
            const langSelector = $Lang('.language-selector');

            if (langToggle && langDropdown) {
                // Toggle dropdown
                langToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleLanguageDropdown();
                });

                // Select language option
                langDropdown.addEventListener('click', (e) => {
                    const langOption = e.target.closest('.lang-option');
                    if (langOption) {
                        const selectedLang = langOption.dataset.lang;
                        this.setLanguage(selectedLang);
                        this.hideLanguageDropdown();
                    }
                });

                // Close dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    if (langSelector && !langSelector.contains(e.target)) {
                        this.hideLanguageDropdown();
                    }
                });
            }
        }

        // Disconnect current session button
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const disconnectCurrentBtn = byId('disconnect-current-session');
        if (disconnectCurrentBtn) {
            disconnectCurrentBtn.addEventListener('click', () => {
                this.disconnectCurrentSession();
            });
        }
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Shift + F: Toggle fullscreen
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyF') {
            e.preventDefault();
            this.toggleFullscreen();
        }

        // Escape: Exit fullscreen
        if (e.code === 'Escape' && this.uiManager.isFullscreen) {
            this.toggleFullscreen();
        }

        // Ctrl/Cmd + Shift + D: Disconnect
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyD') {
            e.preventDefault();
            this.disconnect();
        }

        // Ctrl/Cmd + Shift + N: New connection
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyN') {
            e.preventDefault();
            this.uiManager.focusQuickConnect();
        }
    }

    async loadSessions() {
        try {
            this.log('Loading sessions...');
            const sessions = await this.sessionManager.loadSessions();
            this.log('Sessions loaded:', sessions.length, 'sessions');

            if (sessions.length === 0) {
                this.log('No sessions found');
            } else {
                this.log('Session names:', sessions.map(s => s.name));
            }

            // updateSessionsList is called via 'sessionsLoaded' event listener
            // No need to call it directly here to avoid duplicate updates
            this.log('Sessions list will be updated via event listener');
        } catch (error) {
            console.error('Failed to load sessions:', error);
            this.uiManager.showError('Failed to load saved sessions');
        }
    }

    async quickConnect(formData) {
        if (this.isConnecting) {
            this.log('Connection already in progress');
            return;
        }

        // Clear any existing session summary overlays before starting new connection
        // 🆕 使用 ScopedDOM 获取容器（解决多实例冲突）
        const $quick = this.dom ? (sel) => this.dom.$(sel) : (sel) => document.querySelector(sel);
        const terminalContainer = $quick('.terminal-container');
        if (terminalContainer) {
            const existingOverlay = terminalContainer.querySelector('.session-summary-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
                this.log('Removed existing session summary overlay before new connection');
            }
        }

        // Auto-disconnect existing connection if any
        if (this.currentConnection && this.currentConnection.isConnected) {
            this.log('Auto-disconnecting existing session before new connection');
            // Set flag to prevent showing summary when auto-disconnecting for new connection
            this.isReplacingConnection = true;
            await this.currentConnection.disconnect();
            // Wait a bit for clean disconnect
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        try {
            this.isConnecting = true;
            this.log('Starting connection...');

            // Show connecting overlay
            this.uiManager.showOverlay(this.i18n.t('status.connecting'), true);

            // Save config for reconnection
            this.lastConnectionConfig = {...formData};

            // Create connection
            const connectionManager = new ConnectionManager();
            this.currentConnection = connectionManager;

            // Set up connection event handlers
            this.setupConnectionEvents(connectionManager, formData);

            // Connect
            await connectionManager.connect(formData);

        } catch (error) {
            console.error('Connection failed:', error);
            this.uiManager.showError(`Connection failed: ${error.message}`);
            this.uiManager.hideOverlay();
            this.isConnecting = false;
        }
    }

    async connectToSession(session) {
        try {
            // Load full session data including password
            const fullSession = await this.sessionManager.useSession(session.id);

            // Prepare connection config
            const config = {
                hostname: fullSession.hostname,
                port: fullSession.port || 22,
                username: fullSession.username,
                password: fullSession.password,
                private_key: fullSession.private_key,
                passphrase: fullSession.passphrase,
                ssh_key_id: fullSession.ssh_key_id,
                connection_type: fullSession.connection_type || 'ssh',
                terminal_type: 'xterm-256color',
                encoding: fullSession.encoding || 'auto',
                device: fullSession.device,
                baud_rate: fullSession.baud_rate,
                sessionInfo: {
                    id: fullSession.id,
                    name: fullSession.name,
                    group_name: fullSession.group_name,
                    hostname: fullSession.hostname,
                    port: fullSession.port,
                    username: fullSession.username,
                    connection_type: fullSession.connection_type,
                    device: fullSession.device,
                    baud_rate: fullSession.baud_rate
                }
            };

            // Connect using quick connect
            await this.quickConnect(config);

        } catch (error) {
            console.error('Failed to connect to session:', error);
            this.uiManager.showError(`Failed to connect: ${error.message}`);
        }
    }

    setupConnectionEvents(connectionManager, config) {
        // 🆕 创建 ScopedDOM 辅助函数引用（供事件回调使用）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        
        // Connected event
        connectionManager.on('connected', () => {
            this.log('Connection established');
            this.isConnecting = false;
            this.connectedAt = new Date();

            // Set connection type for character mapping (DEL -> Ctrl-H conversion)
            const connectionType = config.connection_type || 'ssh';
            if (typeof this.terminalManager.setConnectionType === 'function') {
                this.terminalManager.setConnectionType(connectionType);
                this.log(`Connection type set to: ${connectionType}`);
            }

            // Update UI
            this.uiManager.setConnectionStatus('connected');
            this.uiManager.updateConnectionInfo(config);
            this.uiManager.hideOverlay();

            // Show disconnect button
            // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
            const disconnectBtn = byId('disconnect-current-session');
            if (disconnectBtn) {
                disconnectBtn.style.display = '';
            }

            // Focus terminal for input
            this.terminalManager.focus();
            
            // 集成模式下，连接成功后同步主题
            if (window.__WEBXTERM_INTEGRATED_MODE__) {
                const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                console.log('🎨 [Integrated] Connection established, syncing theme:', currentTheme);
                // 延迟一点确保终端完全初始化
                setTimeout(() => {
                    this.terminalManager.setTheme(currentTheme);
                }, 100);
            }
            
            // 如果设置了全屏模式，连接成功后进入全屏
            if (this.pendingFullscreen) {
                this.pendingFullscreen = false;
                setTimeout(() => {
                    this.enterFullscreen();
                }, 300);
            }
        });

        // Data event
        connectionManager.on('data', (data) => {
            this.terminalManager.write(data);
        });

        // Disconnected event
        connectionManager.on('disconnected', (reason) => {
            this.log('Connection closed:', reason);
            this.isConnecting = false;

            // Show session summary only if not replacing connection for a new one
            if (this.connectedAt && !this.isConnecting && !this.isReplacingConnection) {
                this.showConnectionSummary(reason, config);
            }

            // Clear replacing flag after handling disconnect
            if (this.isReplacingConnection) {
                this.isReplacingConnection = false;
            }

            // Update UI - 检查 uiManager 是否存在（应用销毁时可能为 null）
            if (this.uiManager) {
                this.uiManager.setConnectionStatus('disconnected');
            }

            // Hide disconnect button
            // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
            const disconnectBtn = byId('disconnect-current-session');
            if (disconnectBtn) {
                disconnectBtn.style.display = 'none';
            }

            this.currentConnection = null;
            this.connectedAt = null;
        });

        // Error event
        connectionManager.on('error', (error) => {
            console.error('Connection error:', error);
            // 检查 uiManager 是否存在（应用销毁时可能为 null）
            if (this.uiManager) {
                this.uiManager.showError(`Connection error: ${error.message}`);
            }
        });

        // Setup terminal input
        // 检查 terminalManager 是否存在（应用销毁时可能为 null）
        if (this.terminalManager) {
            this.terminalManager.onData((data) => {
                if (connectionManager && connectionManager.isConnected) {
                    connectionManager.sendData(data);
                }
            });
        }
    }

    showConnectionSummary(reason, config) {
        const duration = Date.now() - this.connectedAt.getTime();
        // 🆕 使用 ScopedDOM 获取容器（解决多实例冲突）
        const $ = this.dom ? (sel) => this.dom.$(sel) : (sel) => document.querySelector(sel);
        const container = $('.terminal-container');

        SessionSummaryUtil.showSessionSummary({
            container,
            reason,
            connectedAt: this.connectedAt,
            sessionInfo: config.sessionInfo || {
                hostname: config.hostname,
                port: config.port,
                username: config.username,
                connection_type: config.connection_type
            },
            onReconnect: () => {
                this.quickConnect(this.lastConnectionConfig);
            },
            i18n: this.i18n
        });
    }

    async saveSession(sessionData) {
        try {
            // Use the data from the modal form directly
            // sessionData already contains all the fields from the modal
            const sessionConfig = {
                name: sessionData.name,
                hostname: sessionData.hostname,
                port: parseInt(sessionData.port) || 22,
                username: sessionData.username,
                password: sessionData.password || null,
                private_key: sessionData.private_key || null,
                passphrase: sessionData.passphrase || null,
                ssh_key_id: sessionData.ssh_key_id || null,
                connection_type: sessionData.connection_type || 'ssh',
                encoding: sessionData.encoding || 'auto',
                group_name: sessionData.group_name || null,
                device: sessionData.device || null,
                baud_rate: sessionData.baud_rate || null,
                terminal_type: 'xterm-256color'
            };

            const savedSession = await this.sessionManager.saveSession(sessionConfig);

            this.log('Session saved:', savedSession);
            this.uiManager.showSuccess('Session saved successfully');

            // Refresh sessions list
            await this.loadSessions();

        } catch (error) {
            console.error('Save session failed:', error);
            this.uiManager.showError(`Failed to save session: ${error.message}`);
        }
    }

    async disconnect() {
        if (!this.currentConnection || !this.currentConnection.isConnected) {
            this.uiManager.showInfo(this.i18n.t('sessions.noActiveSessionToDisconnect'));
            return;
        }
        this.log('Disconnecting current session');
        this.currentConnection.disconnect();
    }

    disconnectCurrentSession() {
        this.disconnect();
    }

    async updateSession(sessionId, sessionData) {
        try {
            this.log('Updating session:', sessionId, sessionData);

            const updatedSession = await this.sessionManager.updateSession(sessionId, sessionData);

            this.log('Session updated successfully:', updatedSession);
            this.uiManager.showSuccess(`Session "${sessionData.name}" updated successfully`);

            // Refresh sessions list
            await this.loadSessions();

        } catch (error) {
            console.error('Update session failed:', error);
            this.uiManager.showError(`Failed to update session: ${error.message}`);
        }
    }

    async deleteSession(session) {
        try {
            this.log('Deleting session:', session);

            await this.sessionManager.deleteSession(session.id);

            this.log('Session deleted successfully');
            this.uiManager.showSuccess(`Session "${session.name}" deleted successfully`);

            // Refresh sessions list
            await this.loadSessions();

        } catch (error) {
            console.error('Delete session failed:', error);
            this.uiManager.showError(`Failed to delete session: ${error.message}`);
        }
    }

    async duplicateSession(session) {
        try {
            this.log('Duplicating session:', session);

            // Get complete session data including passwords via the use endpoint
            const completeSessionData = await this.sessionManager.useSession(session.id);

            // Create a copy of the session with a new name
            const duplicatedData = {
                name: `${session.name} (Copy)`,
                hostname: completeSessionData.hostname,
                port: completeSessionData.port,
                username: completeSessionData.username,
                password: completeSessionData.password || null,
                private_key: completeSessionData.private_key || null,
                passphrase: completeSessionData.passphrase || null,
                connection_type: completeSessionData.connection_type,
                terminal_type: completeSessionData.terminal_type || 'xterm-256color',
                group_name: session.group_name || null
            };

            const duplicatedSession = await this.sessionManager.saveSession(duplicatedData);

            this.log('Session duplicated successfully:', duplicatedSession);
            this.uiManager.showSuccess(`Session "${session.name}" duplicated successfully`);

            // Refresh sessions list
            await this.loadSessions();

        } catch (error) {
            console.error('Duplicate session failed:', error);
            this.uiManager.showError(`Failed to duplicate session: ${error.message}`);
        }
    }

    toggleTheme() {
        // 集成模式下，主题由父应用（xdesktop）管理，不应该修改 body
        if (window.__WEBXTERM_INTEGRATED_MODE__) {
            this.log('⚠️ Integrated mode: theme toggle should be handled by parent app');
            return;
        }

        // 独立模式：可以修改 body 的 data-theme
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('webxterm-theme', newTheme);

        // Update terminal theme
        if (this.terminalManager) {
            this.terminalManager.setTheme(newTheme);
        }

        // Update theme toggle icon
        this.updateThemeIcon(newTheme);

        this.log('Theme changed to:', newTheme);
    }

    updateThemeIcon(theme) {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const themeToggle = byId('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? '🌓' : '☀️';
            }
        }
    }

    toggleFullscreen() {
        this.uiManager.toggleFullscreen();

        // Fit terminal after fullscreen toggle
        setTimeout(() => {
            if (this.terminalManager) {
                this.terminalManager.fit();
            }
        }, 100);
    }
    
    /**
     * 进入全屏模式（如果尚未处于全屏状态）
     */
    enterFullscreen() {
        if (!this.uiManager.isFullscreen) {
            this.toggleFullscreen();
        }
    }

    // Language management
    initializeLanguage() {
        // Supported languages
        this.supportedLanguages = ['en', 'zh_CN', 'zh_TW'];

        // 在集成模式下，优先使用主应用的语言设置 (key: 'language')
        // 独立模式下，使用 webxterm 自己的语言设置 (key: 'webxterm-language')
        let savedLang = null;
        if (window.__WEBXTERM_INTEGRATED_MODE__) {
            savedLang = localStorage.getItem('language');
        }
        if (!savedLang) {
            savedLang = localStorage.getItem('webxterm-language');
        }
        let currentLang = savedLang;

        if (!currentLang) {
            // Auto-detect from browser locale
            const browserLang = navigator.language || navigator.languages[0] || 'en';

            // Map browser locale to supported languages
            if (browserLang.startsWith('zh')) {
                if (browserLang.includes('TW') || browserLang.includes('HK')) {
                    currentLang = 'zh_TW';
                } else {
                    currentLang = 'zh_CN';
                }
            } else {
                currentLang = 'en';
            }
        }

        // Validate language
        if (!this.supportedLanguages.includes(currentLang)) {
            currentLang = 'en';
        }

        this.setLanguage(currentLang);

        // Initial i18n update
        this.i18n.updateAllTexts();
    }

    setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn('Unsupported language:', lang);
            return;
        }

        this.currentLanguage = lang;
        document.documentElement.setAttribute('data-lang', lang);
        
        // 同时保存到两个键，保持兼容性
        localStorage.setItem('webxterm-language', lang);
        // 在集成模式下，不设置主应用的 'language' 键，让主应用自己管理
        // 这样避免 webxterm 覆盖主应用的语言设置

        // Update i18n system
        this.i18n.setLanguage(lang);

        // Update language toggle button display
        this.updateLanguageDisplay();

        console.log('Language set to:', lang);
    }

    toggleLanguageDropdown() {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const $ = this.dom ? (sel) => this.dom.$(sel) : (sel) => document.querySelector(sel);
        const langDropdown = byId('lang-dropdown');
        const langSelector = $('.language-selector');

        if (!langDropdown || !langSelector) return;

        const isOpen = langDropdown.style.display === 'block';

        if (isOpen) {
            this.hideLanguageDropdown();
        } else {
            this.showLanguageDropdown();
        }
    }

    showLanguageDropdown() {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const $ = this.dom ? (sel) => this.dom.$(sel) : (sel) => document.querySelector(sel);
        const langDropdown = byId('lang-dropdown');
        const langSelector = $('.language-selector');

        if (!langDropdown || !langSelector) return;

        langDropdown.style.display = 'block';
        langSelector.classList.add('open');

        // Update active option
        this.updateActiveLanguageOption();
    }

    hideLanguageDropdown() {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const $ = this.dom ? (sel) => this.dom.$(sel) : (sel) => document.querySelector(sel);
        const langDropdown = byId('lang-dropdown');
        const langSelector = $('.language-selector');

        if (!langDropdown || !langSelector) return;

        langDropdown.style.display = 'none';
        langSelector.classList.remove('open');
    }

    updateActiveLanguageOption() {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const $$ = this.dom ? (sel) => this.dom.$$(sel) : (sel) => document.querySelectorAll(sel);
        const langOptions = $$('.lang-option');

        langOptions.forEach(option => {
            const lang = option.dataset.lang;
            if (lang === this.currentLanguage) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    updateLanguageDisplay() {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const langButton = byId('lang-toggle');
        if (!langButton) return;

        // Language display mapping
        const langDisplay = {
            'en': 'EN',
            'zh_CN': '中',
            'zh_TW': '繁'
        };

        const langText = langButton.querySelector('.lang-text');
        if (langText) {
            langText.textContent = langDisplay[this.currentLanguage] || 'EN';
        }

        // Update tooltip
        const tooltips = {
            'en': 'Switch language',
            'zh_CN': '切换语言',
            'zh_TW': '切換語言'
        };

        langButton.title = tooltips[this.currentLanguage] || 'Switch language';

        // Update active option in dropdown
        this.updateActiveLanguageOption();
    }

    log(...args) {
        if (this.config.debug) {
            console.log('[webXTerm]', ...args);
        }
    }

    /**
     * 销毁应用，清理所有资源
     */
    destroy() {
        console.log('🧹 webXTerm 应用销毁，清理资源');

        // 断开连接
        if (this.currentConnection && this.currentConnection.isConnected) {
            try {
                this.currentConnection.disconnect();
            } catch (error) {
                console.warn('⚠️ 断开连接失败:', error);
            }
        }

        // 清理 terminalManager
        if (this.terminalManager) {
            try {
                this.terminalManager.dispose();
            } catch (error) {
                console.warn('⚠️ terminalManager dispose 失败:', error);
            }
            this.terminalManager = null;
        }

        // 清理其他管理器
        this.sessionManager = null;
        this.uiManager = null;
        this.currentConnection = null;
        this.currentSession = null;
        this.sshKeyUI = null;

        console.log('✅ webXTerm 资源清理完成');
    }

    /**
     * 设置移动端侧边栏切换功能
     */
    setupMobileSidebarToggle() {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        const $ = this.dom ? (sel) => this.dom.$(sel) : (sel) => document.querySelector(sel);
        
        const sidebar = $('.session-sidebar');
        const hamburgerBtn = byId('mobile-sidebar-toggle');

        if (!hamburgerBtn || !sidebar) {
            console.warn('Mobile sidebar toggle: button or sidebar not found', { hamburgerBtn, sidebar });
            return;
        }

        console.log('Mobile sidebar toggle initialized');
        console.log('Sidebar element:', sidebar);
        console.log('Sidebar computed style - display:', window.getComputedStyle(sidebar).display);
        console.log('Sidebar computed style - position:', window.getComputedStyle(sidebar).position);
        console.log('Sidebar computed style - left:', window.getComputedStyle(sidebar).left);

        // Create global toggle function
        window.toggleMobileSidebar = () => {
            console.log('Toggle function called, current state:', sidebar.classList.contains('open'));
            sidebar.classList.toggle('open');
            console.log('New state:', sidebar.classList.contains('open'));
            console.log('Sidebar classes:', sidebar.className);
            console.log('Sidebar transform:', window.getComputedStyle(sidebar).transform);
        };

        // Toggle sidebar on hamburger button click
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Hamburger clicked via event listener');
            window.toggleMobileSidebar();
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            // Only handle on mobile devices (when hamburger is visible)
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                const isClickInsideSidebar = sidebar.contains(e.target);
                const isClickOnHamburger = hamburgerBtn.contains(e.target);

                if (!isClickInsideSidebar && !isClickOnHamburger) {
                    sidebar.classList.remove('open');
                    console.log('Sidebar closed by clicking outside');
                }
            }
        });

        // Close sidebar when window is resized above mobile breakpoint
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                // Remove inline transform style to let CSS handle desktop layout
                sidebar.style.transform = '';
            }
        });

        // Close sidebar when a session is clicked (connect to a session)
        sidebar.addEventListener('click', (e) => {
            const sessionItem = e.target.closest('.session-item');
            if (sessionItem && window.innerWidth <= 768) {
                // Delay closing to allow connection to be established
                setTimeout(() => {
                    sidebar.classList.remove('open');
                }, 300);
            }
        });

        // Close sidebar when quick connect button is clicked
        const connectBtn = byId('connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        sidebar.classList.remove('open');
                    }, 100);
                }
            });
        }
    }
}

/**
 * 初始化 webXTerm 应用（供集成模式和独立模式共用）
 * @param {Object} options 初始化选项
 * @param {boolean} options.skipTheme 是否跳过主题初始化（集成模式通常为 true）
 * @param {Object} options.dom ScopedDOM 实例（集成模式传递）
 * @param {HTMLElement} options.container 容器元素（集成模式传递）
 * @returns {webXTermApp} 应用实例
 */
function initWebXTermApplication(options = {}) {
    const { skipTheme = false, dom = null, container = null } = options;

    console.log('🚀 webXTerm: 开始初始化...');
    console.log('   - skipTheme:', skipTheme);
    console.log('   - dom:', dom ? '✅ ScopedDOM 已提供' : '⚠️  使用全局 DOM');
    console.log('   - container:', container ? '✅ 已提供' : '⚠️  无容器');

    // Load saved theme (独立模式)
    if (!skipTheme) {
        const savedTheme = localStorage.getItem('webxterm-theme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);

        // Update theme toggle icon
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        const byId = dom ? (id) => dom.byId(id) : (id) => document.getElementById(id);
        const themeToggle = byId('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = savedTheme === 'dark' ? '🌓' : '☀️';
            }
        }
    }

    // 🆕 Initialize quick connect toggle (传递 ScopedDOM)
    initQuickConnectToggle(dom);

    // 🆕 如果传入了容器，创建独立的 i18n 实例（解决多实例冲突）
    let appI18n = i18n;  // 默认使用全局 i18n
    if (container) {
        console.log('🌐 创建独立的 i18n 实例（容器模式）');
        appI18n = new I18nManager(container);
        // 同步全局 i18n 的当前语言
        const currentLang = localStorage.getItem('language') || i18n.currentLanguage;
        appI18n.setLanguage(currentLang);
    }

    // Create application instance
    const app = new webXTermApp(appI18n, dom, container);

    // 🆕 根据模式设置全局引用
    if (container) {
        // 集成模式：使用命名空间避免冲突
        if (!window.webxtermInstances) {
            window.webxtermInstances = {};
        }
        // 使用容器的唯一标识作为 key
        const instanceKey = `instance_${Date.now()}`;
        window.webxtermInstances[instanceKey] = app;
        console.log(`✅ WebXTerm 实例已注册: window.webxtermInstances.${instanceKey}`);
    } else {
        // 独立模式：使用传统的全局变量
        window.webxterm = app;
    }
    
    console.log('✅ webXTerm: 初始化完成');
    return app;
}

// Initialize application when DOM is loaded (独立模式)
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否在集成模式下运行（由主应用设置）
    if (window.__WEBXTERM_INTEGRATED_MODE__) {
        console.log('📦 webXTerm: 集成模式，跳过自动初始化（等待主应用调用 initWebXTermApplication）');
        return;
    }
    
    // 独立模式自动初始化
    initWebXTermApplication({ skipTheme: false });
});

// Quick Connect Toggle functionality
function initQuickConnectToggle(dom = null) {
    // 🆕 使用作用域 DOM 或全局 DOM（自动适配集成模式和独立模式）
    const $ = dom ? (selector) => dom.$(selector) : (selector) => document.querySelector(selector);
    const byId = dom ? (id) => dom.byId(id) : (id) => document.getElementById(id);

    const toggleBtn = byId('quick-connect-toggle');
    const quickConnectSection = $('.quick-connect-section');

    if (!toggleBtn || !quickConnectSection) {
        console.warn('⚠️ Quick connect toggle 或 section 未找到');
        return;
    }

    // Load saved state
    const isCollapsed = localStorage.getItem('webxterm-quick-connect-collapsed') === 'true';
    if (isCollapsed) {
        quickConnectSection.classList.add('collapsed');
    }

    // Toggle functionality
    toggleBtn.addEventListener('click', () => {
        const collapsed = quickConnectSection.classList.toggle('collapsed');
        localStorage.setItem('webxterm-quick-connect-collapsed', collapsed.toString());
        console.log('✅ Quick connect toggled, collapsed:', collapsed);
    });

    console.log('✅ Quick connect toggle 已初始化');
}

// Export for debugging and integration
export { webXTermApp, initQuickConnectToggle, initWebXTermApplication };
