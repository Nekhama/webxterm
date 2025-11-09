/**
 * UI Manager
 * Handles all UI interactions and state management
 */

export class UIManager {
    constructor() {
        this.elements = {};
        this.eventListeners = new Map();
        this.isFullscreen = false;
        this.isSidebarOpen = false;

        // Toast notification system
        this.toastContainer = null;
        this.toastCount = 0;
    }

    init() {
        this.initializeElements();
        this.setupEventListeners();
        this.createToastContainer();
        this.handleResponsiveLayout();
        this.initializeMoreOptionsState();
        this.initializeModalStates();
    }

    initializeElements() {
        // Core elements
        this.elements = {
            // Sidebar
            sidebar: document.getElementById('sidebar'),

            // Quick connect form
            quickConnectForm: document.getElementById('quick-connect-form'),
            quickConnectSection: document.querySelector('.quick-connect-section'),
            hostname: document.getElementById('hostname'),
            port: document.getElementById('port'),
            connectionType: document.getElementById('connection-type'),
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            privateKey: document.getElementById('private-key'),
            passphrase: document.getElementById('passphrase'),
            encoding: document.getElementById('encoding'),
            connectBtn: document.getElementById('connect-btn'),
            disconnectBtn: document.getElementById('disconnect-btn'),
            saveSessionBtn: document.getElementById('save-session-btn'),
            sshOptions: document.getElementById('ssh-options'),
            moreOptionsBtn: document.getElementById('more-options-btn'),

            // Sessions
            sessionsList: document.getElementById('sessions-list'),
            sessionSearch: document.getElementById('session-search'),
            addSession: document.getElementById('add-session'),

            // Main content
            statusBar: document.getElementById('status-bar'),
            connectionStatus: document.getElementById('connection-status'),
            connectionInfo: document.getElementById('connection-info'),
            terminalSize: document.getElementById('terminal-size'),
            fullscreenToggle: document.getElementById('fullscreen-toggle'),

            // Terminal
            terminalContainer: document.getElementById('terminal-container'),
            terminal: document.getElementById('terminal'),
            terminalOverlay: document.getElementById('terminal-overlay'),
            overlayMessage: document.getElementById('overlay-message'),

            // Modal
            modalOverlay: document.getElementById('modal-overlay'),
            sessionModal: document.getElementById('session-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalClose: document.getElementById('modal-close'),
            sessionForm: document.getElementById('session-form'),
            sessionName: document.getElementById('session-name'),
            sessionHostname: document.getElementById('session-hostname'),
            sessionConnectionType: document.getElementById('session-connection-type'),
            sessionPort: document.getElementById('session-port'),
            sessionUsername: document.getElementById('session-username'),
            sessionPassword: document.getElementById('session-password'),
            sessionPrivateKey: document.getElementById('session-private-key'),
            sessionPassphrase: document.getElementById('session-passphrase'),
            sessionGroup: document.getElementById('session-group'),
            sessionEncoding: document.getElementById('session-encoding'),
            sessionSave: document.getElementById('session-save'),
            sessionCancel: document.getElementById('session-cancel'),
            sessionMoreOptionsBtn: document.getElementById('session-more-options-btn'),
            sessionSshOptions: document.getElementById('session-ssh-options'),

            // Delete modal
            deleteModal: document.getElementById('delete-modal'),
            deleteModalTitle: document.getElementById('delete-modal-title'),
            deleteModalMessage: document.getElementById('delete-modal-message'),
            deleteModalClose: document.getElementById('delete-modal-close'),
            deleteConfirm: document.getElementById('delete-confirm'),
            deleteCancel: document.getElementById('delete-cancel'),

            // Group selector
            groupDropdownBtn: document.getElementById('group-dropdown-btn'),
            groupDropdown: document.getElementById('group-dropdown'),

            // About modal
            appTitle: document.getElementById('app-title'),
            aboutModal: document.getElementById('about-modal'),
            aboutModalClose: document.getElementById('about-modal-close'),
            aboutModalOk: document.getElementById('about-modal-ok')
        };

        // Validate elements
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.warn('Missing UI elements:', missingElements);
        }
    }

    setupEventListeners() {
        // Theme toggle removed - dark theme only

        // Connection type change
        this.elements.connectionType?.addEventListener('change', (e) => {
            const isSSH = e.target.value === 'ssh';
            this.updateMoreOptionsVisibility(isSSH);

            // Update default port
            if (isSSH && this.elements.port.value === '23') {
                this.elements.port.value = '22';
            } else if (!isSSH && this.elements.port.value === '22') {
                this.elements.port.value = '23';
            }
        });

        // Quick connect form
        this.elements.quickConnectForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = this.getQuickConnectFormData();
            this.emit('quickConnect', formData);
        });

        // Clear filled session name when hostname or username is modified
        // This ensures that the session modal shows the correct suggested name
        const clearFilledSessionName = () => {
            const quickConnectForm = document.getElementById('quick-connect-form');
            if (quickConnectForm && quickConnectForm.hasAttribute('data-filled-session-name')) {
                quickConnectForm.removeAttribute('data-filled-session-name');
            }
        };
        
        this.elements.hostname?.addEventListener('input', clearFilledSessionName);
        this.elements.username?.addEventListener('input', clearFilledSessionName);

        // Save session button
        this.elements.saveSessionBtn?.addEventListener('click', () => {
            this.showSessionModal();
        });

        // Disconnect button
        this.elements.disconnectBtn?.addEventListener('click', () => {
            this.emit('disconnect');
        });

        // More options toggle
        this.elements.moreOptionsBtn?.addEventListener('click', () => {
            this.toggleMoreOptions();
        });

        // Session search with debounce
        this.searchDebounceTimer = null;
        this.elements.sessionSearch?.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase().trim();

            // Clear previous timer
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }

            // If search is empty, show immediately without debounce
            if (searchTerm === '') {
                this.filterSessions('');
                return;
            }

            // Set new timer with 300ms debounce for non-empty searches
            this.searchDebounceTimer = setTimeout(() => {
                this.filterSessions(searchTerm);
            }, 300);
        });

        // Clear search on Escape key
        this.elements.sessionSearch?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.target.value = '';
                this.filterSessions('');
            }
        });

        this.elements.addSession?.addEventListener('click', () => {
            this.showSessionModal();
        });

        // SSH key label click to open SSH key management
        const sshKeyLabel = document.getElementById('ssh-key-label');
        if (sshKeyLabel) {
            sshKeyLabel.addEventListener('click', (e) => {
                e.preventDefault();
                // Trigger SSH key management modal
                const manageKeysBtn = document.getElementById('manage-keys-btn');
                if (manageKeysBtn) {
                    manageKeysBtn.click();
                }
            });
        }

        // Fullscreen toggle
        this.elements.fullscreenToggle?.addEventListener('click', () => {
            this.emit('fullscreenToggle');
        });

        // Modal events
        this.elements.modalClose?.addEventListener('click', () => {
            this.hideModal();
        });

        this.elements.sessionCancel?.addEventListener('click', () => {
            this.hideModal();
        });

        this.elements.sessionSave?.addEventListener('click', () => {
            this.handleSessionSave();
        });

        this.elements.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.hideModal();
            }
        });

        // Delete modal events
        this.elements.deleteModalClose?.addEventListener('click', () => {
            this.hideDeleteModal();
        });

        this.elements.deleteCancel?.addEventListener('click', () => {
            this.hideDeleteModal();
        });

        this.elements.deleteConfirm?.addEventListener('click', () => {
            this.handleSessionDelete();
        });

        // Group selector events
        this.elements.groupDropdownBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleGroupDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.group-selector')) {
                this.hideGroupDropdown();
            }
        });

        // Session modal SSH options toggle
        this.elements.sessionMoreOptionsBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleSessionSSHOptions();
        });

        // Session modal connection type change
        this.elements.sessionConnectionType?.addEventListener('change', (e) => {
            this.updateSessionSSHOptionsVisibility(e.target.value === 'ssh');
            // Update default port
            if (e.target.value === 'ssh' && this.elements.sessionPort.value === '23') {
                this.elements.sessionPort.value = '22';
            } else if (e.target.value === 'telnet' && this.elements.sessionPort.value === '22') {
                this.elements.sessionPort.value = '23';
            }
        });

        // About modal events
        this.elements.appTitle?.addEventListener('click', () => {
            this.showAboutModal();
        });

        this.elements.aboutModalClose?.addEventListener('click', () => {
            this.hideAboutModal();
        });

        this.elements.aboutModalOk?.addEventListener('click', () => {
            this.hideAboutModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.handleResponsiveLayout();
        });
    }

    handleKeyboardShortcuts(e) {
        // Escape key
        if (e.code === 'Escape') {
            if (!this.elements.modalOverlay.classList.contains('hidden')) {
                // Check which modal is open
                if (this.elements.deleteModal && this.elements.deleteModal.style.display !== 'none') {
                    this.hideDeleteModal();
                } else if (this.elements.aboutModal && this.elements.aboutModal.style.display !== 'none') {
                    this.hideAboutModal();
                } else {
                    this.hideModal();
                }
            } else {
                // Close group dropdown if open
                if (this.elements.groupDropdown && !this.elements.groupDropdown.classList.contains('hidden')) {
                    this.hideGroupDropdown();
                } else {
                    // Close any open context menus
                    this.clearAllContextMenus();
                }
            }
        }

        // Ctrl/Cmd + Enter in modal form
        if ((e.ctrlKey || e.metaKey) && e.code === 'Enter') {
            if (!this.elements.modalOverlay.classList.contains('hidden')) {
                e.preventDefault();
                this.handleSessionSave();
            }
        }
    }

    handleResponsiveLayout() {
        const isMobile = window.innerWidth <= 768;

        // Mobile menu toggle is now in HTML template, no need to create dynamically
        // Removed old mobile-menu-toggle creation logic
        
        if (!isMobile) {
            // Ensure sidebar is visible on desktop
            if (this.elements.sidebar) {
                this.elements.sidebar.classList.remove('open');
                // Clear inline transform style on desktop
                this.elements.sidebar.style.transform = '';
            }
        }
    }

    addMobileMenuToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'mobile-menu-toggle';
        toggle.innerHTML = '☰';
        toggle.style.cssText = `
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            font-size: 18px;
            color: var(--text-primary);
            cursor: pointer;
            z-index: 10;
        `;

        toggle.addEventListener('click', () => {
            this.toggleSidebar();
        });

        this.elements.statusBar?.appendChild(toggle);
    }

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
        this.elements.sidebar?.classList.toggle('open', this.isSidebarOpen);
    }

    toggleSSHOptions(show) {
        if (this.elements.sshOptions) {
            this.elements.sshOptions.classList.toggle('hidden', !show);
        }
    }

    updateMoreOptionsVisibility(isSSH) {
        const moreOptionsToggle = document.querySelector('.more-options-toggle');

        if (!moreOptionsToggle) return;

        if (isSSH) {
            // Show more options toggle for SSH
            moreOptionsToggle.style.display = 'block';

            // SSH options are hidden by default
            if (this.elements.sshOptions) {
                this.elements.sshOptions.classList.add('hidden');
            }

            // Reset toggle button state
            const toggleIcon = this.elements.moreOptionsBtn?.querySelector('.toggle-icon');
            if (toggleIcon) {
                toggleIcon.classList.remove('expanded');
            }
            const toggleText = this.elements.moreOptionsBtn?.querySelector('.toggle-text');
            if (toggleText && window.app?.i18n) {
                toggleText.textContent = window.app.i18n.t('form.moreOptions');
            }
        } else {
            // Hide more options toggle for Telnet
            moreOptionsToggle.style.display = 'none';

            // Also hide SSH options
            if (this.elements.sshOptions) {
                this.elements.sshOptions.classList.add('hidden');
            }
        }
    }

    initializeMoreOptionsState() {
        // Initialize the more options based on current connection type
        const currentType = this.elements.connectionType?.value || 'ssh';
        this.updateMoreOptionsVisibility(currentType === 'ssh');
    }

    initializeModalStates() {
        // Ensure proper initial states for modals
        if (this.elements.deleteModal) {
            this.elements.deleteModal.style.display = 'none';
        }
        if (this.elements.sessionModal) {
            this.elements.sessionModal.style.display = 'block';
        }
        if (this.elements.aboutModal) {
            this.elements.aboutModal.style.display = 'none';
        }
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.classList.add('hidden');
        }
    }

    toggleMoreOptions() {
        if (!this.elements.sshOptions || !this.elements.moreOptionsBtn) return;

        const isHidden = this.elements.sshOptions.classList.contains('hidden');
        const toggleIcon = this.elements.moreOptionsBtn.querySelector('.toggle-icon');

        // Toggle SSH options visibility
        this.elements.sshOptions.classList.toggle('hidden', !isHidden);

        // Update toggle icon rotation
        if (toggleIcon) {
            toggleIcon.classList.toggle('expanded', !isHidden);
        }

        // Update button text
        const toggleText = this.elements.moreOptionsBtn.querySelector('.toggle-text');
        if (toggleText && window.app?.i18n) {
            toggleText.textContent = isHidden
                ? window.app.i18n.t('form.hideSshOptions')
                : window.app.i18n.t('form.moreOptions');
        }
    }

    getQuickConnectFormData() {
        const sshKeySelect = document.getElementById('ssh-key-select');
        return {
            hostname: this.elements.hostname?.value || '',
            port: this.elements.port?.value || '22',
            connection_type: this.elements.connectionType?.value || 'ssh',
            username: this.elements.username?.value || '',
            password: this.elements.password?.value || '',
            private_key: this.elements.privateKey?.value || '',
            passphrase: this.elements.passphrase?.value || '',
            ssh_key_id: sshKeySelect?.value || null,
            encoding: this.elements.encoding?.value || 'auto'
        };
    }

    setConnectionStatus(status) {
        if (!this.elements.connectionStatus) return;

        // Remove all status classes
        this.elements.connectionStatus.classList.remove('connected', 'connecting', 'disconnected');

        // Add current status class
        this.elements.connectionStatus.classList.add(status);

        // Update status text
        const statusText = {
            connected: window.app?.i18n?.t('status.connected') || 'Connected',
            connecting: window.app?.i18n?.t('status.connecting') || 'Connecting...',
            disconnected: window.app?.i18n?.t('status.disconnected') || 'Disconnected'
        };

        this.elements.connectionStatus.textContent = statusText[status] || status;

        // Update UI based on connection status
        this.updateConnectionUI(status);
    }

    updateConnectionUI(status) {
        // Update quick connect section styling
        if (this.elements.quickConnectSection) {
            this.elements.quickConnectSection.classList.remove('connected', 'connecting', 'disconnected');
            this.elements.quickConnectSection.classList.add(status);
        }

        // Update button states
        switch (status) {
            case 'connected':
                this.showDisconnectButton();
                this.disableForm(false); // Enable form for potential new connections
                break;
            case 'connecting':
                this.showConnectButton();
                this.disableForm(true);
                break;
            case 'disconnected':
            default:
                this.showConnectButton();
                this.disableForm(false);
                break;
        }
    }

    showConnectButton() {
        if (this.elements.connectBtn) {
            this.elements.connectBtn.classList.remove('hidden');
            this.elements.connectBtn.disabled = false;
        }
        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.classList.add('hidden');
        }
    }

    showDisconnectButton() {
        if (this.elements.connectBtn) {
            this.elements.connectBtn.classList.add('hidden');
        }
        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.classList.remove('hidden');
            this.elements.disconnectBtn.disabled = false;
        }
    }

    disableForm(disabled) {
        const formElements = [
            this.elements.hostname,
            this.elements.port,
            this.elements.connectionType,
            this.elements.username,
            this.elements.password,
            this.elements.privateKey,
            this.elements.passphrase
        ];

        formElements.forEach(element => {
            if (element) {
                element.disabled = disabled;
            }
        });

        // Save session button logic:
        // - Disabled when connecting
        // - Enabled when disconnected (if form has data) or when connected
        if (this.elements.saveSessionBtn) {
            if (disabled) {
                // Connecting state - disable save button
                this.elements.saveSessionBtn.disabled = true;
            } else {
                // Connected or disconnected - enable save button
                this.elements.saveSessionBtn.disabled = false;
            }
        }
    }

    updateConnectionInfo(info) {
        if (!this.elements.connectionInfo) return;

        if (info) {
            // Get connection type - handle both 'type' and 'connection_type' properties
            const type = info.type || info.connection_type || 'ssh';
            const connectionType = type.toUpperCase();
            const typeLabel = `<span class="session-type ${type}">${connectionType}</span>`;

            let connectionText = `${typeLabel} ${info.username}@${info.hostname}:${info.port}`;

            // Add session name if available
            if (info.sessionName || info.name) {
                connectionText = `[${info.sessionName || info.name}] ${connectionText}`;
            }

            // Add group info if available
            if (info.groupName || info.group_name) {
                connectionText = `${connectionText} (${info.groupName || info.group_name})`;
            }

            this.elements.connectionInfo.innerHTML = connectionText;
        } else {
            this.elements.connectionInfo.textContent = '';
        }
    }

    updateTerminalSize(cols, rows) {
        if (this.elements.terminalSize) {
            this.elements.terminalSize.textContent = `${cols}×${rows}`;
        }
    }

    showOverlay(message, showSpinner = false) {
        if (!this.elements.terminalOverlay) return;

        this.elements.overlayMessage.textContent = message;

        if (showSpinner) {
            this.elements.overlayMessage.innerHTML = `
                <div class="loading-spinner"></div>
                ${message}
            `;
        }

        this.elements.terminalOverlay.classList.remove('hidden');
    }

    hideOverlay() {
        if (this.elements.terminalOverlay) {
            this.elements.terminalOverlay.classList.add('hidden');
        }
    }

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;

        if (this.elements.terminalContainer) {
            this.elements.terminalContainer.classList.toggle('fullscreen', this.isFullscreen);
        }

        document.body.classList.toggle('terminal-fullscreen', this.isFullscreen);

        // Update fullscreen button icon
        if (this.elements.fullscreenToggle) {
            this.elements.fullscreenToggle.innerHTML =
                `<span>${this.isFullscreen ? '🗗' : '⛶'}</span>`;
        }
    }

    focusQuickConnect() {
        // 如果处于全屏模式，先退出全屏
        if (this.isFullscreen) {
            this.toggleFullscreen();
        }

        // 移动端下显示左侧栏（使用与 mobile-sidebar-toggle 一样的方式）
        if (window.innerWidth <= 768 && window.toggleMobileSidebar) {
            window.toggleMobileSidebar();
        }

        // 检查快速连接表单是否折叠，如果折叠则展开
        const quickConnectSection = document.querySelector('.quick-connect-section');
        if (quickConnectSection && quickConnectSection.classList.contains('collapsed')) {
            quickConnectSection.classList.remove('collapsed');
            // 更新 localStorage 状态
            localStorage.setItem('webxterm-quick-connect-collapsed', 'false');
        }

        // 聚焦到主机名输入框
        if (this.elements.hostname) {
            this.elements.hostname.focus();
        }
    }

    updateSessionsList(sessions, isFiltered = false) {
        console.log('UI: updateSessionsList called with', sessions.length, 'sessions', isFiltered ? '(filtered)' : '(original)');

        if (!this.elements.sessionsList) {
            console.error('UI: sessionsList element not found!');
            return;
        }

        // Only store original sessions data, not filtered results
        if (!isFiltered) {
            this.sessions = sessions;
        }

        if (sessions.length === 0) {
            console.log('UI: No sessions, showing empty message');
            this.elements.sessionsList.innerHTML = `
                <div class="loading">No saved sessions</div>
            `;
            return;
        }

        const grouped = this.groupSessions(sessions);
        let html = '';

        Object.entries(grouped).forEach(([groupName, groupSessions]) => {
            if (groupName !== 'ungrouped') {
                const sessionCountText = groupSessions.length === 1 ? '1 个会话' : `${groupSessions.length} 个会话`;
                html += `
                    <div class="group-header">
                        <span class="group-name">${groupName} - ${sessionCountText}</span>
                    </div>
                `;
            }

            groupSessions.forEach(session => {
                const lastUsed = session.last_used
                    ? new Date(session.last_used).toLocaleDateString()
                    : 'Never';

                html += `
                    <div class="session-item ${session.connection_type}" data-session-id="${session.id}">
                        <div class="session-content">
                            <div class="session-header">
                                <div class="session-name-wrapper">
                                    <div class="session-name">${this.escapeHtml(session.name)}</div>
                                    <button class="session-edit-btn" title="编辑会话" data-session-id="${session.id}">
                                        <span class="edit-icon">✏️</span>
                                    </button>
                                    <button class="session-delete-btn" title="删除会话" data-session-id="${session.id}">
                                        <span class="delete-icon">🗑️</span>
                                    </button>
                                </div>
                                <div class="session-last-used">${window.app?.i18n?.t('sessions.last') || 'Last'}: ${lastUsed}</div>
                            </div>
                            <div class="session-details">
                                <span class="session-type ${session.connection_type}">${session.connection_type.toUpperCase()}</span>
                                <span>${this.escapeHtml(session.username)}@${this.escapeHtml(session.hostname)}:${session.port}</span>
                            </div>
                        </div>
                        <div class="session-actions">
                            <button class="session-connect-btn" title="快速连接" data-session-id="${session.id}">
                                <span class="connect-icon">⚡</span>
                            </button>
                        </div>
                    </div>
                `;
            });
        });

        this.elements.sessionsList.innerHTML = html;

        // Add click listeners to session items
        this.elements.sessionsList.querySelectorAll('.session-item').forEach(item => {
            const sessionContent = item.querySelector('.session-content');
            const connectBtn = item.querySelector('.session-connect-btn');
            
            // Handle single click - use a data attribute to track if this is part of a double click
            sessionContent.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Check if this element is already processing a click event
                if (sessionContent.hasAttribute('data-clicking')) {
                    return;
                }

                // Mark as processing
                sessionContent.setAttribute('data-clicking', 'true');

                // Wait to see if a double click follows
                setTimeout(async () => {
                    // Check if this was followed by a double click
                    if (!sessionContent.hasAttribute('data-double-clicked')) {
                        // Single click action
                        const sessionId = item.dataset.sessionId;
                        const session = sessions.find(s => s.id === sessionId);
                        if (session) {
                            this.selectSession(session);
                            await this.fillFormFromSession(session);
                        }
                    }
                    // Clean up flags
                    sessionContent.removeAttribute('data-clicking');
                    sessionContent.removeAttribute('data-double-clicked');
                }, 300);
            });

            // Handle double click
            sessionContent.addEventListener('dblclick', (e) => {
                e.stopPropagation();

                // Mark as double clicked to prevent single click action
                sessionContent.setAttribute('data-double-clicked', 'true');

                const sessionId = item.dataset.sessionId;
                const session = sessions.find(s => s.id === sessionId);
                if (session) {
                    // Double click should connect directly without form fill message
                    this.emit('sessionConnect', session);
                    
                    // Auto-hide sidebar on mobile after double-click connect
                    if (window.innerWidth <= 768) {
                        const sidebar = document.querySelector('.session-sidebar');
                        if (sidebar) {
                            console.log('[Mobile] Hiding sidebar after session double-click');
                            setTimeout(() => {
                                // Remove open class first, then set transform
                                sidebar.classList.remove('open');
                                sidebar.style.transform = 'translateX(-100%)';
                                console.log('[Mobile] Sidebar hidden, transform:', sidebar.style.transform);
                            }, 100);
                        } else {
                            console.warn('[Mobile] Sidebar element not found');
                        }
                    }
                }
            });

            // Click on connect button to connect directly
            connectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = connectBtn.dataset.sessionId;
                const session = sessions.find(s => s.id === sessionId);
                if (session) {
                    this.emit('sessionConnect', session);
                    
                    // Auto-hide sidebar on mobile after clicking connect
                    if (window.innerWidth <= 768) {
                        const sidebar = document.querySelector('.session-sidebar');
                        if (sidebar) {
                            console.log('[Mobile] Hiding sidebar after session connect button click');
                            setTimeout(() => {
                                // Remove open class first, then set transform
                                sidebar.classList.remove('open');
                                sidebar.style.transform = 'translateX(-100%)';
                                console.log('[Mobile] Sidebar hidden, transform:', sidebar.style.transform);
                            }, 100);
                        } else {
                            console.warn('[Mobile] Sidebar element not found');
                        }
                    }
                }
            });

            // Click on edit button to edit session
            const editBtn = item.querySelector('.session-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sessionId = editBtn.dataset.sessionId;
                    const session = sessions.find(s => s.id === sessionId);
                    if (session) {
                        this.showSessionModal(session);
                    }
                });
            }
            // Click on delete button to delete session
            const deleteBtn = item.querySelector('.session-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sessionId = deleteBtn.dataset.sessionId;
                    const session = sessions.find(s => s.id === sessionId);
                    if (session) {
                        this.showDeleteModal(session);
                    }
                });
            }

            // Add context menu for session management
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const sessionId = item.dataset.sessionId;
                const session = sessions.find(s => s.id === sessionId);
                if (session) {
                    this.showSessionContextMenu(e, session);
                }
            });
        });
    }

    groupSessions(sessions) {
        const grouped = { ungrouped: [] };

        sessions.forEach(session => {
            const group = session.group_name || 'ungrouped';
            if (!grouped[group]) {
                grouped[group] = [];
            }
            grouped[group].push(session);
        });

        // Sort sessions within each group
        Object.keys(grouped).forEach(group => {
            grouped[group].sort((a, b) => {
                if (a.last_used && b.last_used) {
                    return new Date(b.last_used) - new Date(a.last_used);
                }
                if (a.last_used && !b.last_used) return -1;
                if (!a.last_used && b.last_used) return 1;
                return a.name.localeCompare(b.name);
            });
        });

        return grouped;
    }

    filterSessions(searchTerm) {
        if (!this.sessions) {
            console.warn('No sessions data available for filtering');
            return;
        }

        console.log('Filtering sessions with term:', `"${searchTerm}"`);
        console.log('Total sessions available:', this.sessions.length);

        // If search term is empty, show all sessions
        if (!searchTerm) {
            console.log('Empty search term, showing all sessions');
            this.updateSessionsList(this.sessions, false);
            return;
        }

        // Filter sessions based on search term
        const filteredSessions = this.sessions.filter(session => {
            const searchIn = [
                session.name,
                session.hostname,
                session.username,
                session.group_name,
                session.connection_type
            ].filter(Boolean).join(' ').toLowerCase();

            const matches = searchIn.includes(searchTerm);
            console.log(`Session "${session.name}" - searchIn: "${searchIn}" - matches: ${matches}`);

            return matches;
        });

        console.log('Filtered sessions count:', filteredSessions.length);

        // Use the existing updateSessionsList method with filtered data
        this.updateSessionsList(filteredSessions, true);
    }

    showSessionModal(session = null) {
        if (!this.elements.modalOverlay) return;

        // Store the session being edited
        this.editingSession = session;

        // Ensure only session modal is shown - close all other modals
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(modal => {
            if (modal.id !== 'session-modal') {
                modal.style.display = 'none';
            }
        });

        if (this.elements.sessionModal) {
            this.elements.sessionModal.style.display = 'block';
        }

        this.elements.modalTitle.textContent = session ?
            (window.app?.i18n?.t('modals.editSession.title') || 'Edit Session') :
            (window.app?.i18n?.t('modals.saveSession.title') || 'Save Session');

        if (session) {
            // For editing, fill all form fields from session data
            this.fillSessionForm(session);

            // If we need complete data with passwords, we'll need to call the API
            if (session.id) {
                this.loadCompleteSessionData(session.id);
            }
        } else {
            // For new sessions, auto-populate from quick connect form
            this.elements.sessionForm.reset();
            const formData = this.getQuickConnectFormData();
            this.fillSessionForm(formData, true);
        }

        // Initialize SSH options visibility based on connection type
        const connectionType = this.elements.sessionConnectionType?.value || 'ssh';
        this.updateSessionSSHOptionsVisibility(connectionType === 'ssh');

        this.elements.modalOverlay.classList.remove('hidden');
        this.elements.sessionName.focus();

        // Select the text if it was auto-populated
        if (this.elements.sessionName.value) {
            this.elements.sessionName.select();
        }
    }

    hideModal() {
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.classList.add('hidden');
        }
        // Clear editing session state
        this.editingSession = null;
        // Clear filled session name from quick connect form
        const quickConnectForm = document.getElementById('quick-connect-form');
        if (quickConnectForm) {
            quickConnectForm.removeAttribute('data-filled-session-name');
        }
    }

    showDeleteModal(session) {
        if (!this.elements.modalOverlay || !this.elements.deleteModal) return;

        // Store session for deletion
        this.sessionToDelete = session;

        // Update modal content
        this.elements.deleteModalMessage.innerHTML =
            `Are you sure you want to delete the session <strong>"${this.escapeHtml(session.name)}"</strong>?`;

        // Ensure only delete modal is shown - close all other modals
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(modal => {
            if (modal.id !== 'delete-modal') {
                modal.style.display = 'none';
            }
        });

        this.elements.deleteModal.style.display = 'block';
        this.elements.modalOverlay.classList.remove('hidden');

        // Focus delete button for accessibility
        this.elements.deleteConfirm.focus();
    }

    hideDeleteModal() {
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.classList.add('hidden');
        }
        if (this.elements.deleteModal) {
            this.elements.deleteModal.style.display = 'none';
        }
        // Don't automatically show session modal when hiding delete modal
        // Only hide the overlay completely
        this.sessionToDelete = null;
    }

    handleSessionDelete() {
        if (this.sessionToDelete) {
            this.emit('deleteSession', this.sessionToDelete);
            this.hideDeleteModal();
        }
    }

    handleSessionSave() {
        // Collect all form data
        const sessionSshKeySelect = document.getElementById('session-ssh-key-select');
        const sessionData = {
            name: this.elements.sessionName?.value?.trim(),
            hostname: this.elements.sessionHostname?.value?.trim(),
            connection_type: this.elements.sessionConnectionType?.value,
            port: parseInt(this.elements.sessionPort?.value) || 22,
            username: this.elements.sessionUsername?.value?.trim(),
            password: this.elements.sessionPassword?.value || '',
            private_key: this.elements.sessionPrivateKey?.value || '',
            passphrase: this.elements.sessionPassphrase?.value || '',
            ssh_key_id: sessionSshKeySelect?.value || null,
            encoding: this.elements.sessionEncoding?.value || 'auto',
            group_name: this.elements.sessionGroup?.value?.trim()
        };

        // Validate required fields
        if (!sessionData.name) {
            this.showError('Session name is required');
            return;
        }

        if (!sessionData.hostname) {
            this.showError('Hostname is required');
            return;
        }

        if (!sessionData.username) {
            this.showError('Username is required');
            return;
        }

        // Validate port range
        if (sessionData.port < 1 || sessionData.port > 65535) {
            this.showError('Port must be between 1 and 65535');
            return;
        }

        if (this.editingSession) {
            // We're editing an existing session
            this.emit('updateSession', this.editingSession.id, sessionData);
        } else {
            // We're creating a new session
            this.emit('saveSession', sessionData);
        }

        this.hideModal();
    }

    showSessionContextMenu(event, session) {
        // Clear any existing context menus first
        this.clearAllContextMenus();

        // Create context menu for session management
        const menu = document.createElement('div');
        menu.className = 'context-menu';

        // Get i18n instance from global app
        const i18n = window.app ? window.app.i18n : null;

        menu.innerHTML = `
            <div class="context-menu-item" data-action="connect">
                <span class="menu-icon">⚡</span>
                ${i18n ? i18n.t('contextMenu.session.connect') : 'Connect'}
            </div>
            <div class="context-menu-item" data-action="edit">
                <span class="menu-icon">✏️</span>
                ${i18n ? i18n.t('contextMenu.session.edit') : 'Edit'}
            </div>
            <div class="context-menu-item" data-action="duplicate">
                <span class="menu-icon">📄</span>
                ${i18n ? i18n.t('contextMenu.session.duplicate') : 'Duplicate'}
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item danger" data-action="delete">
                <span class="menu-icon">🗑️</span>
                ${i18n ? i18n.t('contextMenu.session.delete') : 'Delete'}
            </div>
        `;

        menu.style.position = 'absolute';
        menu.style.zIndex = '9999';

        document.body.appendChild(menu);

        // Calculate optimal position to avoid going off-screen
        this.positionContextMenu(menu, event.pageX, event.pageY);

        menu.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action) {
                this.handleSessionContextAction(action, session);
            }
            this.hideContextMenu(menu);
        });

        // Hide menu on outside click
        const hideHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.clearAllContextMenus();
                document.removeEventListener('click', hideHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', hideHandler), 0);
    }

    positionContextMenu(menu, x, y) {
        // Get menu dimensions
        const menuRect = menu.getBoundingClientRect();
        const menuWidth = menuRect.width;
        const menuHeight = menuRect.height;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate position
        let left = x;
        let top = y;

        // Adjust horizontal position if menu would go off right edge
        if (left + menuWidth > viewportWidth) {
            left = x - menuWidth;
            // Ensure it doesn't go off left edge
            if (left < 0) {
                left = viewportWidth - menuWidth - 10; // 10px margin
            }
        }

        // Adjust vertical position if menu would go off bottom edge
        if (top + menuHeight > viewportHeight) {
            top = y - menuHeight;
            // Ensure it doesn't go off top edge
            if (top < 0) {
                top = viewportHeight - menuHeight - 10; // 10px margin
            }
        }

        // Apply calculated position
        menu.style.left = `${Math.max(0, left)}px`;
        menu.style.top = `${Math.max(0, top)}px`;
    }

    clearAllContextMenus() {
        // Remove all existing context menus
        const existingMenus = document.querySelectorAll('.context-menu');
        existingMenus.forEach(menu => {
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        });
    }

    hideContextMenu(menu) {
        if (menu && menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
    }

    toggleGroupDropdown() {
        if (!this.elements.groupDropdown) return;

        const isHidden = this.elements.groupDropdown.classList.contains('hidden');

        if (isHidden) {
            this.showGroupDropdown();
        } else {
            this.hideGroupDropdown();
        }
    }

    showGroupDropdown() {
        if (!this.elements.groupDropdown || !this.elements.groupDropdownBtn) return;

        // Update dropdown options before showing
        this.updateGroupDropdownOptions();

        this.elements.groupDropdown.classList.remove('hidden');
        this.elements.groupDropdownBtn.classList.add('open');
    }

    hideGroupDropdown() {
        if (!this.elements.groupDropdown || !this.elements.groupDropdownBtn) return;

        this.elements.groupDropdown.classList.add('hidden');
        this.elements.groupDropdownBtn.classList.remove('open');
    }

    updateGroupDropdownOptions() {
        if (!this.elements.groupDropdown) return;

        // Get available groups from sessions (assuming we have access to them)
        const groups = this.getAvailableGroups();

        // Clear existing options except "No Group"
        const existingItems = this.elements.groupDropdown.querySelectorAll('.dropdown-item:not([data-value=""])');
        existingItems.forEach(item => item.remove());

        // Add event listener to "No Group" option if not already added
        const noGroupOption = this.elements.groupDropdown.querySelector('[data-value=""]');
        if (noGroupOption && !noGroupOption.hasAttribute('data-listener')) {
            noGroupOption.addEventListener('click', () => {
                this.selectGroup('');
            });
            noGroupOption.setAttribute('data-listener', 'true');
        }

        // Add group options
        groups.forEach(group => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.setAttribute('data-value', group);
            item.textContent = group;

            item.addEventListener('click', () => {
                this.selectGroup(group);
            });

            this.elements.groupDropdown.appendChild(item);
        });
    }

    getAvailableGroups() {
        // Get groups from stored sessions data
        if (this.sessions && Array.isArray(this.sessions)) {
            const groupSet = new Set();
            this.sessions.forEach(session => {
                if (session.group_name) {
                    groupSet.add(session.group_name);
                }
            });
            return Array.from(groupSet).sort();
        }
        return [];
    }

    selectGroup(groupName) {
        if (this.elements.sessionGroup) {
            this.elements.sessionGroup.value = groupName;
        }
        this.hideGroupDropdown();
    }

    toggleSessionSSHOptions() {
        if (!this.elements.sessionSshOptions || !this.elements.sessionMoreOptionsBtn) return;

        const isHidden = this.elements.sessionSshOptions.classList.contains('hidden');
        const toggleIcon = this.elements.sessionMoreOptionsBtn.querySelector('.toggle-icon');
        const toggleText = this.elements.sessionMoreOptionsBtn.querySelector('.toggle-text');

        // Toggle SSH options visibility
        this.elements.sessionSshOptions.classList.toggle('hidden', !isHidden);

        // Update toggle icon rotation
        if (toggleIcon) {
            toggleIcon.classList.toggle('expanded', !isHidden);
        }

        // Update button text
        if (toggleText) {
            toggleText.textContent = isHidden ?
                (window.app?.i18n?.t('form.hideSshOptions') || 'Hide SSH Options') :
                (window.app?.i18n?.t('form.sshOptions') || 'SSH Options');
        }
    }

    updateSessionSSHOptionsVisibility(isSSH) {
        const sshOptionsToggle = document.querySelector('.ssh-options-toggle');

        if (!sshOptionsToggle) return;

        if (isSSH) {
            // Show SSH options toggle
            sshOptionsToggle.style.display = 'block';
        } else {
            // Hide SSH options toggle and options
            sshOptionsToggle.style.display = 'none';
            if (this.elements.sessionSshOptions) {
                this.elements.sessionSshOptions.classList.add('hidden');
            }

            // Reset toggle button state
            const toggleIcon = this.elements.sessionMoreOptionsBtn?.querySelector('.toggle-icon');
            if (toggleIcon) {
                toggleIcon.classList.remove('expanded');
            }
            const toggleText = this.elements.sessionMoreOptionsBtn?.querySelector('.toggle-text');
            if (toggleText) {
                toggleText.textContent = window.app?.i18n?.t('form.sshOptions') || 'SSH Options';
            }
        }
    }

    async loadCompleteSessionData(sessionId) {
        try {
            // Access the main app's session manager to get complete session data
            if (window.app && window.app.sessionManager) {
                const sessionData = await window.app.sessionManager.useSession(sessionId);
                this.fillSessionForm(sessionData);
            }
        } catch (error) {
            console.error('Error loading complete session data:', error);
            // Don't show error to user as basic data is already loaded
        }
    }

    fillSessionForm(data, isNewSession = false) {
        if (!data) return;

        if (this.elements.sessionName) {
            if (isNewSession) {
                // Check if quick connect form has a filled session name
                const quickConnectForm = document.getElementById('quick-connect-form');
                const filledSessionName = quickConnectForm?.getAttribute('data-filled-session-name');

                if (filledSessionName) {
                    this.elements.sessionName.value = filledSessionName;
                } else if (data.hostname && data.username) {
                    const suggestedName = `${data.username}@${data.hostname}`;
                    this.elements.sessionName.value = suggestedName;
                }
            } else {
                this.elements.sessionName.value = data.name || '';
            }
        }

        if (this.elements.sessionHostname) {
            this.elements.sessionHostname.value = data.hostname || '';
        }

        if (this.elements.sessionConnectionType) {
            this.elements.sessionConnectionType.value = data.connection_type || 'ssh';
        }

        if (this.elements.sessionPort) {
            this.elements.sessionPort.value = data.port || (data.connection_type === 'telnet' ? 23 : 22);
        }

        if (this.elements.sessionUsername) {
            this.elements.sessionUsername.value = data.username || '';
        }

        if (this.elements.sessionPassword) {
            this.elements.sessionPassword.value = data.password || '';
        }

        if (this.elements.sessionPrivateKey) {
            this.elements.sessionPrivateKey.value = data.private_key || '';
        }

        if (this.elements.sessionPassphrase) {
            this.elements.sessionPassphrase.value = data.passphrase || '';
        }

        // Fill SSH key selector
        const sessionSshKeySelect = document.getElementById('session-ssh-key-select');
        if (sessionSshKeySelect) {
            sessionSshKeySelect.value = data.ssh_key_id || '';
        }

        if (this.elements.sessionGroup) {
            this.elements.sessionGroup.value = data.group_name || '';
        }

        if (this.elements.sessionEncoding) {
            this.elements.sessionEncoding.value = data.encoding || 'auto';
        }
    }

    handleSessionContextAction(action, session) {
        switch (action) {
            case 'connect':
                this.emit('sessionConnect', session);
                break;
            case 'edit':
                this.showSessionModal(session);
                break;
            case 'duplicate':
                this.emit('duplicateSession', session);
                break;
            case 'delete':
                this.showDeleteModal(session);
                break;
        }
    }

    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        this.toastContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        document.body.appendChild(this.toastContainer);
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: var(--secondary-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 12px 16px;
            color: var(--text-primary);
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            position: relative;
        `;

        // Add type-specific styling
        if (type === 'success') {
            toast.style.borderLeftColor = 'var(--accent-green)';
            toast.style.borderLeftWidth = '4px';
        } else if (type === 'error') {
            toast.style.borderLeftColor = 'var(--accent-red)';
            toast.style.borderLeftWidth = '4px';
        } else if (type === 'warning') {
            toast.style.borderLeftColor = 'var(--accent-orange)';
            toast.style.borderLeftWidth = '4px';
        }

        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove
        setTimeout(() => {
            this.removeToast(toast);
        }, duration);

        // Click to dismiss
        toast.addEventListener('click', () => {
            this.removeToast(toast);
        });

        return toast;
    }

    removeToast(toast) {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    clearAllToasts() {
        if (this.toastContainer) {
            const toasts = this.toastContainer.querySelectorAll('.toast');
            toasts.forEach(toast => this.removeToast(toast));
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error', 5000);
    }

    showWarning(message) {
        this.showToast(message, 'warning');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    selectSession(session) {
        // Remove selected class from all sessions
        this.elements.sessionsList.querySelectorAll('.session-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selected class to current session
        const sessionItem = this.elements.sessionsList.querySelector(`[data-session-id="${session.id}"]`);
        if (sessionItem) {
            sessionItem.classList.add('selected');
        }

        // Store selected session
        this.selectedSession = session;
    }

    async fillFormFromSession(session, showMessage = true) {
        // Fill the quick connect form with basic session data first
        if (this.elements.hostname) {
            this.elements.hostname.value = session.hostname || '';
        }
        if (this.elements.port) {
            this.elements.port.value = session.port || '22';
        }
        if (this.elements.connectionType) {
            this.elements.connectionType.value = session.connection_type || 'ssh';
            // Trigger change event to update SSH options visibility
            this.elements.connectionType.dispatchEvent(new Event('change'));
        }
        if (this.elements.username) {
            this.elements.username.value = session.username || '';
        }
        if (this.elements.encoding) {
            this.elements.encoding.value = session.encoding || 'auto';
        }

        // Fill SSH key selector if available
        const sshKeySelect = document.getElementById('ssh-key-select');
        if (sshKeySelect && session.ssh_key_id) {
            sshKeySelect.value = session.ssh_key_id;
        } else if (sshKeySelect) {
            sshKeySelect.value = '';  // Clear if no SSH key
        }

        // Load complete session data including passwords
        try {
            if (session.id && window.app && window.app.sessionManager) {
                const completeSessionData = await window.app.sessionManager.useSession(session.id);

                // Fill password and key fields from complete data
                if (this.elements.password) {
                    this.elements.password.value = completeSessionData.password || '';
                }
                if (this.elements.privateKey) {
                    this.elements.privateKey.value = completeSessionData.private_key || '';
                }
                if (this.elements.passphrase) {
                    this.elements.passphrase.value = completeSessionData.passphrase || '';
                }

                // Update SSH key selector from complete data
                if (sshKeySelect && completeSessionData.ssh_key_id) {
                    sshKeySelect.value = completeSessionData.ssh_key_id;
                }
            } else {
                // Fallback to basic data (likely empty for sensitive fields)
                if (this.elements.password) {
                    this.elements.password.value = session.password || '';
                }
                if (this.elements.privateKey) {
                    this.elements.privateKey.value = session.private_key || '';
                }
                if (this.elements.passphrase) {
                    this.elements.passphrase.value = session.passphrase || '';
                }
            }
        } catch (error) {
            console.error('Error loading complete session data:', error);
            // Fallback to basic data
            if (this.elements.password) {
                this.elements.password.value = session.password || '';
            }
            if (this.elements.privateKey) {
                this.elements.privateKey.value = session.private_key || '';
            }
            if (this.elements.passphrase) {
                this.elements.passphrase.value = session.passphrase || '';
            }
        }

        // Store the filled session name in a hidden attribute
        const quickConnectForm = document.getElementById('quick-connect-form');
        if (quickConnectForm) {
            quickConnectForm.setAttribute('data-filled-session-name', session.name);
        }

        // Only show message if explicitly requested (default: true for single click)
        if (showMessage) {
            this.showFormFilledFeedback(session.name);
        }
    }

    showFormFilledFeedback(sessionName) {
        // Add shake animation to Quick Connect form
        const quickConnectSection = document.querySelector('.quick-connect-section');
        if (quickConnectSection) {
            quickConnectSection.classList.add('form-filled-shake');
            setTimeout(() => {
                quickConnectSection.classList.remove('form-filled-shake');
            }, 600);
        }

        // Show "已填充" indicator
        this.showFilledIndicator(sessionName);
    }

    showFilledIndicator(sessionName) {
        // Remove existing indicator if any
        const existingIndicator = document.querySelector('.form-filled-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // Create new indicator
        const indicator = document.createElement('div');
        indicator.className = 'form-filled-indicator';
        indicator.textContent = '已填充';

        // Find Quick Connect section and add indicator to section-header
        const quickConnectSection = document.querySelector('.quick-connect-section');
        if (quickConnectSection) {
            const sectionHeader = quickConnectSection.querySelector('.section-header');
            if (sectionHeader) {
                // Insert indicator between h3 and toggle button
                const h3 = sectionHeader.querySelector('h3');
                const toggleBtn = sectionHeader.querySelector('.section-toggle');

                if (h3 && toggleBtn) {
                    // Insert before toggle button
                    sectionHeader.insertBefore(indicator, toggleBtn);
                } else if (h3) {
                    // Fallback: append to section-header
                    sectionHeader.appendChild(indicator);
                }
            }
        }

        // Remove after 2 seconds
        setTimeout(() => {
            if (indicator && indicator.parentNode) {
                indicator.remove();
            }
        }, 2000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showAboutModal() {
        if (!this.elements.modalOverlay || !this.elements.aboutModal) return;

        // Ensure only about modal is shown - close all other modals
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(modal => {
            if (modal.id !== 'about-modal') {
                modal.style.display = 'none';
            }
        });

        this.elements.aboutModal.style.display = 'block';
        this.elements.modalOverlay.classList.remove('hidden');
    }

    hideAboutModal() {
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.classList.add('hidden');
        }
        if (this.elements.aboutModal) {
            this.elements.aboutModal.style.display = 'none';
        }
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
                    console.error('Error in UI event listener:', error);
                }
            });
        }
    }
}