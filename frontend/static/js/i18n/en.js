/**
 * English Language Pack
 */

export const en = {
    // Application title and navigation
    app: {
        title: 'webXTerm'
    },

    // Buttons
    buttons: {
        connect: 'Connect',
        disconnect: 'Disconnect',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        duplicate: 'Duplicate',
        cancel: 'Cancel',
        confirm: 'Confirm',
        close: 'Close',
        refresh: 'Refresh',
        fullscreen: 'Fullscreen',
        exitFullscreen: 'Exit Fullscreen',
        newSession: 'New Session',
        closeAll: 'Close All'
    },

    // About modal
    about: {
        title: 'About webXTerm',
        version: 'Version',
        author: 'Author',
        github: 'GitHub',
        description: 'A modern web-based SSH/Telnet/USBSerial terminal management tool'
    },

    // Form labels and placeholders
    form: {
        quickConnect: 'Quick Connect',
        sessionName: 'Session Name',
        sessionNamePlaceholder: 'Enter session name...',
        hostname: 'Hostname',
        hostnamePlaceholder: 'Enter hostname or IP...',
        protocolPort: 'Protocol/Port',
        port: 'Port',
        username: 'Username',
        usernamePlaceholder: 'Enter username...',
        password: 'Password',
        passwordPlaceholder: 'Enter password...',
        protocol: 'Protocol',
        encoding: 'Server Encoding',
        encodingAuto: 'Auto Detection',
        encodingUtf8: 'UTF-8',
        encodingGbk: 'GBK/GB2312',
        search: 'Search',
        searchPlaceholder: 'input keyword',
        moreOptions: 'More Options',
        privateKey: 'Private Key',
        privateKeyPlaceholder: '-----BEGIN PRIVATE KEY-----',
        passphrase: 'Key Passphrase',
        passphrasePlaceholder: 'Enter key passphrase...',
        group: 'Group (optional)',
        groupPlaceholder: 'Enter group name...',
        sshOptions: 'SSH Options',
        hideSshOptions: 'Hide SSH Options',
        connectPrompt: 'Click "Connect" to start a new session',
        toggleQuickConnect: 'Toggle Quick Connect',
        sshKey: 'SSH Key',
        sshKeyNone: 'No Key',
        serialDevice: 'Device',
        serialBaudRate: 'Baud Rate',
        localTerminal: 'Local Terminal'
    },

    // Connection status
    status: {
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        connected: 'Connected',
        connectionFailed: 'Connection Failed',
        authenticated: 'Authenticated',
        reconnecting: 'Reconnecting...'
    },

    // Messages and notifications
    messages: {
        connectionSuccess: 'Connection established successfully',
        connectionFailed: 'Failed to connect: {error}',
        sessionSaved: 'Session saved successfully',
        sessionDeleted: 'Session deleted successfully',
        sessionDuplicated: 'Session duplicated successfully',
        allSessionsClosed: 'All sessions closed',
        confirmDelete: 'Are you sure you want to delete this session?',
        confirmCloseAll: 'Are you sure you want to close all sessions?',
        sessionFilled: 'Session information filled',
        noSessionsFound: 'No sessions found',
        invalidInput: 'Please check your input',
        networkError: 'Network error occurred'
    },

    // Tooltips and help text
    tooltips: {
        theme: 'Toggle theme',
        language: 'Switch language',
        connect: 'Connect to session',
        disconnect: 'Disconnect session',
        disconnectCurrentSession: 'Disconnect current session',
        fullscreen: 'Enter fullscreen mode',
        exitFullscreen: 'Exit fullscreen mode',
        newSession: 'Create new session',
        refreshSessions: 'Refresh session list',
        editSession: 'Edit session',
        duplicateSession: 'Duplicate session',
        deleteSession: 'Delete session',
        sessionStatus: 'Session status',
        terminalSize: 'Terminal size'
    },

    // Session management
    sessions: {
        title: 'Sessions',
        saved: 'Saved List',
        active: 'Active Sessions',
        noSessions: 'No sessions available',
        noSavedSessions: 'No saved sessions',
        noActiveSessionToDisconnect: 'No active session to disconnect',
        sessionInfo: 'Session Information',
        connectionTime: 'Connected for',
        reconnect: 'Reconnect',
        summary: 'Session Summary',
        loading: 'Loading sessions...',
        last: 'Last',
        quickConnect: 'Quick Connect',
        connectionError: 'Connection Error',
        connectionSummary: 'Connection Summary',
        connectionLost: 'Connection lost',
        unknownError: 'Unknown error',
        noConnectionToReconnect: 'No connection to reconnect'
    },

    // Connection progress messages
    connection: {
        initiating: 'Initiating connection...',
        establishing: 'Establishing secure connection...',
        authenticating: 'Authenticating...',
        connected: 'Connection established'
    },

    // Time units
    time: {
        seconds: 'seconds',
        minutes: 'minutes',
        hours: 'hours',
        days: 'days'
    },

    // Error messages
    errors: {
        connectionTimeout: 'Connection timeout',
        authenticationFailed: 'Authentication failed',
        authenticationFailedMessage: 'Invalid username or password',
        unableToConnect: 'Unable to connect to server',
        connectionRefused: 'Connection refused, please check host address and port',
        networkUnavailable: 'Network unavailable',
        serverError: 'Server error',
        invalidCredentials: 'Invalid credentials',
        sessionNotFound: 'Session not found',
        unexpectedError: 'An unexpected error occurred',
        connectionFailed: 'Connection failed',
        connectionFailedWithReason: 'Connection failed: {reason}'
    },

    // Modal dialogs
    modals: {
        saveSession: {
            title: 'Save Session',
            sessionName: 'Session Name',
            hostname: 'Hostname',
            port: 'Port',
            username: 'Username',
            protocol: 'Protocol',
            encoding: 'Encoding',
            save: 'Save',
            cancel: 'Cancel'
        },
        editSession: {
            title: 'Edit Session'
        },
        deleteSession: {
            title: 'Delete Session',
            message: 'Are you sure you want to delete this session?',
            warning: 'This action cannot be undone.',
            confirm: 'Delete',
            cancel: 'Cancel'
        }
    },

    // Context menus
    contextMenu: {
        terminal: {
            copy: 'Copy',
            paste: 'Paste',
            selectAll: 'Select All',
            clear: 'Clear'
        },
        session: {
            connect: 'Connect',
            edit: 'Edit',
            duplicate: 'Duplicate',
            delete: 'Delete'
        }
    },

    // SSH Keys management
    sshKeys: {
        title: 'SSH Keys',
        manage: 'Manage Keys',
        clickToManage: 'Click to manage keys',
        noKeys: 'No saved keys',
        addKey: 'Add Key',
        add: 'Add SSH Key',
        fingerprint: 'Fingerprint',
        lastUsed: 'Last Used',
        confirmDelete: 'Are you sure you want to delete key "{name}"?',

        form: {
            title: 'Add SSH Key',
            addTitle: 'Add SSH Key',
            editTitle: 'Edit SSH Key',
            name: 'Key Name',
            namePlaceholder: 'Enter key name...',
            description: 'Description (optional)',
            descriptionPlaceholder: 'Enter key description...',
            privateKey: 'Private Key',
            privateKeyPlaceholder: 'Paste private key content or click to upload file...',
            passphrase: 'Key Passphrase',
            passphrasePlaceholder: 'Enter passphrase if the key is encrypted...',
            uploadFile: 'Upload File',
            save: 'Save',
            cancel: 'Cancel'
        },

        errors: {
            loadFailed: 'Failed to load keys',
            saveFailed: 'Failed to save key',
            deleteFailed: 'Failed to delete key',
            invalidKey: 'Invalid key format'
        },

        success: {
            created: 'Key added successfully',
            updated: 'Key updated successfully',
            deleted: 'Key deleted successfully'
        },

        modal: {
            title: 'SSH Key Management',
            deleteTitle: 'Delete SSH Key',
            deleteMessage: 'Are you sure you want to delete this SSH key?',
            deleteWarning: 'This action cannot be undone.',
            deleteConfirm: 'Delete',
            deleteCancel: 'Cancel'
        }
    }
};
