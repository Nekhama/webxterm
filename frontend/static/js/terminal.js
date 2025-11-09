/**
 * Terminal Manager
 * Handles xterm.js terminal instance and interactions
 */

export class TerminalManager {
    constructor(connectionType = null) {
        this.terminal = null;
        this.fitAddon = null;
        this.webLinksAddon = null;
        this.container = null;
        this.eventListeners = new Map();
        this.connectionType = connectionType;
        this.dataBuffer = []; // Buffer for data received before terminal is ready
        
        this.themes = {
            dark: {
                background: '#1e1e1e',
                foreground: '#cccccc',
                cursor: '#cccccc',
                cursorAccent: '#1e1e1e',
                selection: '#ffffff40',
                black: '#000000',
                red: '#f14c4c',
                green: '#16825d',
                yellow: '#f9f1a5',
                blue: '#007acc',
                magenta: '#bc05bc',
                cyan: '#0598bc',
                white: '#cccccc',
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#16825d',
                brightYellow: '#f9f1a5',
                brightBlue: '#007acc',
                brightMagenta: '#bc05bc',
                brightCyan: '#0598bc',
                brightWhite: '#ffffff'
            }
        };
    }

    init(containerElement = null) {
        this.container = containerElement || document.getElementById('terminal');
        if (!this.container) {
            throw new Error('Terminal container not found');
        }

        this.createTerminal();
        this.setupEventListeners();
    }

    createTerminal() {
        // Get current theme
        const currentTheme = document.body.getAttribute('data-theme') || 'dark';

        // Terminal options
        const options = {
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "Courier New", monospace',
            fontSize: 14,
            fontWeight: 'normal',
            fontWeightBold: 'bold',
            lineHeight: 1.2,
            letterSpacing: 0,
            cursorBlink: true,
            cursorStyle: 'block',
            cursorWidth: 1,
            bellSound: null,
            bellStyle: 'none',
            drawBoldTextInBrightColors: true,
            fastScrollModifier: 'alt',
            fastScrollSensitivity: 5,
            macOptionIsMeta: false,
            macOptionClickForcesSelection: false,
            rightClickSelectsWord: true,
            scrollback: 10000,
            scrollSensitivity: 1,
            theme: this.themes[currentTheme],
            allowTransparency: false,
            altClickMovesCursor: true,
            convertEol: false,
            disableStdin: false,
            windowsMode: false,
            wordSeparator: ' ()[]{}\\\'\"`',

            // xterm.js 5.x specific options
            rescaleOverlappingGlyphs: false, // GB18030 compliance, default false
        };

        // Create terminal instance
        this.terminal = new window.Terminal(options);

        // Create and load addons
        this.fitAddon = new window.FitAddon.FitAddon();
        this.webLinksAddon = new window.WebLinksAddon.WebLinksAddon();

        this.terminal.loadAddon(this.fitAddon);
        this.terminal.loadAddon(this.webLinksAddon);

        // Open terminal in container
        this.terminal.open(this.container);

        // Initial fit
        this.fit();

        // Process buffered data now that terminal is ready
        if (this.dataBuffer.length > 0) {
            this.dataBuffer.forEach(data => {
                this.terminal.write(data);
            });
            this.dataBuffer = []; // Clear buffer
        }

        console.log('Terminal created with xterm.js 5.5.0');
    }

    setupEventListeners() {
        // Terminal data handler
        this.terminal.onData((data) => {
            // Debug: Log Tab key specifically
            if (data.charCodeAt(0) === 0x09) {
                console.log('[TERMINAL] Tab key sent for completion');
            }

            // Apply character mapping for Telnet connections
            const mappedData = this.applyCharacterMapping(data);
            this.emit('data', mappedData);
        });

        // Terminal resize handler
        this.terminal.onResize(({ cols, rows }) => {
            this.emit('resize', cols, rows);
        });

        // Terminal selection change
        this.terminal.onSelectionChange(() => {
            const selection = this.terminal.getSelection();
            if (selection) {
                this.emit('selectionChange', selection);
            }
        });

        // Terminal title change
        this.terminal.onTitleChange((title) => {
            this.emit('titleChange', title);
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.fit();
        });

        // Context menu handler
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });
    }

    fit() {
        if (this.fitAddon && this.terminal) {
            try {
                this.fitAddon.fit();
                const dimensions = this.fitAddon.proposeDimensions();
                if (dimensions) {
                    // Smart row adjustment based on current mode
                    let rowsToReduce = 0;

                    // Check if we're in fullscreen mode
                    const isFullscreen = document.body.classList.contains('terminal-fullscreen');

                    if (isFullscreen) {
                        // Fullscreen mode: no reduction needed
                        rowsToReduce = 0;
                    } else {
                        // Normal mode: reduce by 1 row
                        rowsToReduce = 1;
                    }

                    const adjustedRows = Math.max(1, dimensions.rows - rowsToReduce);
                    console.log(`Terminal fitted to ${dimensions.cols}x${adjustedRows} (original: ${dimensions.cols}x${dimensions.rows}, mode: ${isFullscreen ? 'fullscreen' : 'normal'})`);

                    // Manually resize terminal to adjusted dimensions
                    this.terminal.resize(dimensions.cols, adjustedRows);

                    // Store adjusted dimensions for other code to reference
                    this.adjustedDimensions = { cols: dimensions.cols, rows: adjustedRows };

                    this.emit('resize', dimensions.cols, adjustedRows);
                }
            } catch (error) {
                console.error('Failed to fit terminal:', error);
            }
        }
    }

    write(data) {
        if (this.terminal) {
            this.terminal.write(data);
        } else {
            // Terminal not ready, buffer data
            this.dataBuffer.push(data);
        }
    }

    writeln(data) {
        if (this.terminal) {
            this.terminal.writeln(data);
        }
    }

    clear() {
        if (this.terminal) {
            this.terminal.clear();
        }
    }

    reset() {
        if (this.terminal) {
            this.terminal.reset();
        }
    }

    focus() {
        if (this.terminal) {
            this.terminal.focus();
        }
    }

    blur() {
        if (this.terminal) {
            this.terminal.blur();
        }
    }

    onData(callback) {
        this.on('data', callback);
    }

    setTheme(themeName) {
        if (this.terminal && this.themes[themeName]) {
            this.terminal.setOption('theme', this.themes[themeName]);
        }
    }

    setFontSize(size) {
        if (this.terminal) {
            this.terminal.setOption('fontSize', size);
            this.fit();
        }
    }

    getSelection() {
        return this.terminal ? this.terminal.getSelection() : '';
    }

    selectAll() {
        if (this.terminal) {
            this.terminal.selectAll();
        }
    }

    clearSelection() {
        if (this.terminal) {
            this.terminal.clearSelection();
        }
    }

    copy() {
        const selection = this.getSelection();
        if (selection) {
            navigator.clipboard.writeText(selection).then(() => {
                this.emit('copy', selection);
            }).catch((error) => {
                console.error('Failed to copy to clipboard:', error);
            });
        }
    }

    async paste() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                this.emit('data', text);
            }
        } catch (error) {
            console.error('Failed to paste from clipboard:', error);
        }
    }

    showContextMenu(event) {
        const selection = this.getSelection();
        const hasSelection = Boolean(selection);

        // Get i18n instance from global app
        const i18n = window.app ? window.app.i18n : null;

        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item ${hasSelection ? '' : 'disabled'}" data-action="copy">
                <span class="menu-icon">📋</span>
                ${i18n ? i18n.t('contextMenu.terminal.copy') : 'Copy'}
            </div>
            <div class="context-menu-item" data-action="paste">
                <span class="menu-icon">📄</span>
                ${i18n ? i18n.t('contextMenu.terminal.paste') : 'Paste'}
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="selectAll">
                <span class="menu-icon">🔘</span>
                ${i18n ? i18n.t('contextMenu.terminal.selectAll') : 'Select All'}
            </div>
            <div class="context-menu-item" data-action="clear">
                <span class="menu-icon">🗑️</span>
                ${i18n ? i18n.t('contextMenu.terminal.clear') : 'Clear'}
            </div>
        `;

        // Position menu
        menu.style.position = 'absolute';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        menu.style.zIndex = '9999';

        // Add menu to document
        document.body.appendChild(menu);

        // Handle menu clicks
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action && !e.target.closest('.disabled')) {
                this.handleContextMenuAction(action);
            }
            this.hideContextMenu();
        });

        // Hide menu on outside click
        const hideHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', hideHandler), 0);

        this.currentContextMenu = menu;
    }

    hideContextMenu() {
        if (this.currentContextMenu) {
            this.currentContextMenu.remove();
            this.currentContextMenu = null;
        }
    }

    handleContextMenuAction(action) {
        switch (action) {
            case 'copy':
                this.copy();
                break;
            case 'paste':
                this.paste();
                break;
            case 'selectAll':
                this.selectAll();
                break;
            case 'clear':
                this.clear();
                break;
        }
    }

    getTerminalDimensions() {
        if (this.terminal) {
            return {
                cols: this.terminal.cols,
                rows: this.terminal.rows
            };
        }
        return { cols: 80, rows: 24 };
    }

    dispose() {
        const containerId = this.container?.id || 'unknown';
        console.log(`🗑️ [Terminal ${containerId}] 开始清理`);

        if (this.terminal) {
            try {
                this.terminal.dispose();
            } catch (error) {
                console.error(`❌ [Terminal ${containerId}] 清理终端失败:`, error);
            }
            this.terminal = null;
        }
        this.fitAddon = null;
        this.webLinksAddon = null;
        this.eventListeners.clear();

        console.log(`✅ [Terminal ${containerId}] 清理完成`);
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
                    console.error('Error in terminal event listener:', error);
                }
            });
        }
    }

    /**
     * 设置连接类型（用于字符映射）
     * Set connection type (for character mapping)
     */
    setConnectionType(connectionType) {
        this.connectionType = connectionType;
    }

    /**
     * 应用字符映射，适用于SSH和Telnet连接
     * Apply character mapping for SSH and Telnet connections
     */
    applyCharacterMapping(data) {
        // 对SSH和Telnet连接都应用字符映射
        // Apply character mapping for both SSH and Telnet connections
        if (this.connectionType !== 'ssh' && this.connectionType !== 'telnet') {
            return data;
        }

        // 将字符串转换为字符数组进行映射
        // Convert string to character array for mapping
        let result = '';
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            const charCode = char.charCodeAt(0);

            // SSH和Telnet字符映射和过滤
            // SSH and Telnet character mapping and filtering
            switch (charCode) {
                case 0x09: // Tab (9) - 确保Tab键正常传递
                    result += char;
                    break;
                case 0x7f: // DEL (127) - convert to Ctrl-H for both SSH and Telnet
                    result += String.fromCharCode(0x08); // Ctrl-H
                    break;
                case 0x1a: // Ctrl-Z (26) - SUB字符，可能来自调试代码 (仅Telnet)
                    if (this.connectionType === 'telnet') {
                        // SUB character, possibly from debugging code for Telnet only
                        console.debug('Filtered out unwanted ^Z character for Telnet');
                        break;
                    }
                    result += char;
                    break;
                case 0x1f: // Unit Separator (31) - 可能是^_ 字符 (仅Telnet)
                    if (this.connectionType === 'telnet') {
                        // Unit Separator, possibly ^_ character for Telnet only
                        console.debug('Filtered out unwanted ^_ character for Telnet');
                        break;
                    }
                    result += char;
                    break;
                case 0x1e: // Record Separator (30) - 可能导致控制台错误 (仅Telnet)
                    if (this.connectionType === 'telnet') {
                        // Record Separator, can cause console errors for Telnet only
                        console.debug('Filtered out unwanted ^^ character (0x1e) for Telnet');
                        break;
                    }
                    result += char;
                    break;
                case 0x1d: // Group Separator (29) - 可能是^] 字符 (仅Telnet)
                    if (this.connectionType === 'telnet') {
                        // Group Separator, possibly ^] character for Telnet only
                        console.debug('Filtered out unwanted ^] character (0x1d) for Telnet');
                        break;
                    }
                    result += char;
                    break;
                case 0x1c: // File Separator (28) - 可能是^\ 字符 (仅Telnet)
                    if (this.connectionType === 'telnet') {
                        // File Separator, possibly ^\ character for Telnet only
                        console.debug('Filtered out unwanted ^\\ character (0x1c) for Telnet');
                        break;
                    }
                    result += char;
                    break;
                case 0x00: // NULL (0) - 空字符可能导致终端解析错误 (仅Telnet)
                    if (this.connectionType === 'telnet') {
                        // NULL character can cause terminal parsing errors for Telnet only
                        console.debug('Filtered out NULL character (0x00) for Telnet');
                        break;
                    }
                    result += char;
                    break;
                case 0x5E: // '^' (94) - 插入符号导致Unknown command错误 (仅Telnet)
                    if (this.connectionType === 'telnet') {
                        // Caret character causing Unknown command errors for Telnet only
                        console.debug('Filtered out ^ character (0x5E) for Telnet');
                        break;
                    }
                    result += char;
                    break;
                default:
                    // 过滤其他低位控制字符 (1-6, 14-23 范围) 但保留常用的如 \t \n \r
                    // Filter other low control characters (1-6, 14-23 range) but keep common ones like \t \n \r
                    if (this.connectionType === 'telnet' &&
                        ((charCode >= 0x01 && charCode <= 0x06) ||
                         (charCode >= 0x0e && charCode <= 0x17))) {
                        console.debug(`Filtered out control character 0x${charCode.toString(16).padStart(2, '0')} for Telnet`);
                        break;
                    }
                    result += char;
                    break;
            }
        }

        return result;
    }
}
