/**
 * Traditional Chinese Language Pack
 */

export const zh_TW = {
    // Application title and navigation
    app: {
        title: 'webXTerm'
    },

    // Buttons
    buttons: {
        connect: '連接',
        disconnect: '斷開',
        save: '儲存',
        delete: '刪除',
        edit: '編輯',
        duplicate: '複製',
        cancel: '取消',
        confirm: '確認',
        close: '關閉',
        refresh: '重新整理',
        fullscreen: '全螢幕',
        exitFullscreen: '退出全螢幕',
        newSession: '新建會話',
        closeAll: '關閉所有'
    },

    // About modal
    about: {
        title: '關於 webXTerm',
        version: '版本',
        author: '作者',
        github: 'GitHub',
        description: '現代化網頁版 SSH/Telnet/USBSerial 終端管理工具'
    },

    // Form labels and placeholders
    form: {
        quickConnect: '快速連接',
        sessionName: '會話名稱',
        sessionNamePlaceholder: '輸入會話名稱...',
        hostname: '主機名稱',
        hostnamePlaceholder: '輸入主機名稱或IP位址...',
        protocolPort: '通訊協定/連接埠',
        port: '連接埠',
        username: '使用者名稱',
        usernamePlaceholder: '輸入使用者名稱...',
        password: '密碼',
        passwordPlaceholder: '輸入密碼...',
        protocol: '通訊協定',
        encoding: '伺服器編碼',
        encodingAuto: '自動檢測',
        encodingUtf8: 'UTF-8',
        encodingGbk: 'GBK/GB2312',
        search: '搜尋',
        searchPlaceholder: '搜尋會話...',
        moreOptions: '更多選項',
        privateKey: '私鑰',
        privateKeyPlaceholder: '-----BEGIN PRIVATE KEY-----',
        passphrase: '密鑰密碼',
        passphrasePlaceholder: '輸入密鑰密碼...',
        group: '群組 (可選)',
        groupPlaceholder: '輸入群組名稱...',
        sshOptions: 'SSH選項',
        hideSshOptions: '隱藏SSH選項',
        connectPrompt: '點擊"連接"開始新會話',
        toggleQuickConnect: '切換快速連接',
        sshKey: 'SSH密鑰',
        sshKeyNone: '不使用密鑰',
        serialDevice: '裝置',
        serialBaudRate: '鮑率'
    },

    // Connection status
    status: {
        disconnected: '已斷開',
        connecting: '連接中...',
        connected: '已連接',
        connectionFailed: '連接失敗',
        authenticated: '已驗證',
        reconnecting: '重新連接中...'
    },

    // Messages and notifications
    messages: {
        connectionSuccess: '連接建立成功',
        connectionFailed: '連接失敗：{error}',
        sessionSaved: '會話儲存成功',
        sessionDeleted: '會話刪除成功',
        sessionDuplicated: '會話複製成功',
        allSessionsClosed: '所有會話已關閉',
        confirmDelete: '確定要刪除此會話嗎？',
        confirmCloseAll: '確定要關閉所有會話嗎？',
        sessionFilled: '會話資訊已填入',
        noSessionsFound: '未找到會話',
        invalidInput: '請檢查輸入內容',
        networkError: '網路錯誤'
    },

    // Tooltips and help text
    tooltips: {
        theme: '切換主題',
        language: '切換語言',
        connect: '連接到會話',
        disconnect: '中斷會話',
        disconnectCurrentSession: '中斷當前會話',
        fullscreen: '進入全螢幕模式',
        exitFullscreen: '退出全螢幕模式',
        newSession: '建立新會話',
        refreshSessions: '重新整理會話清單',
        editSession: '編輯會話',
        duplicateSession: '複製會話',
        deleteSession: '刪除會話',
        sessionStatus: '會話狀態',
        terminalSize: '終端機大小'
    },

    // Session management
    sessions: {
        title: '會話',
        saved: '已儲存的會話',
        active: '活躍會話',
        noSessions: '沒有可用會話',
        noSavedSessions: '暫無已儲存的會話',
        noActiveSessionToDisconnect: '沒有活躍會話需要中斷',
        sessionInfo: '會話資訊',
        connectionTime: '本次會話時長',
        reconnect: '重新連接',
        summary: '會話摘要',
        loading: '載入會話中...',
        last: '最近',
        quickConnect: '快速連線',
        connectionError: '連線錯誤',
        connectionSummary: '連線摘要',
        connectionLost: '連線遺失',
        unknownError: '未知錯誤',
        noConnectionToReconnect: '沒有可重連的連線'
    },

    // Connection progress messages
    connection: {
        initiating: '正在建立連線...',
        establishing: '正在建立安全連線...',
        authenticating: '正在驗證身份...',
        connected: '連線已建立'
    },

    // Time units
    time: {
        seconds: '秒',
        minutes: '分鐘',
        hours: '小時',
        days: '天'
    },

    // Error messages
    errors: {
        connectionTimeout: '連接逾時',
        authenticationFailed: '驗證失敗',
        authenticationFailedMessage: '帳號或密碼不正確',
        unableToConnect: '無法連接到伺服器',
        connectionRefused: '連接被拒絕，請檢查主機位址和連接埠號',
        networkUnavailable: '網路不可用',
        serverError: '伺服器錯誤',
        invalidCredentials: '憑證無效',
        sessionNotFound: '會話未找到',
        unexpectedError: '發生意外錯誤',
        connectionFailed: '連接失敗',
        connectionFailedWithReason: '連接失敗：{reason}'
    },

    // Modal dialogs
    modals: {
        saveSession: {
            title: '儲存會話',
            sessionName: '會話名稱',
            hostname: '主機名稱',
            port: '連接埠',
            username: '使用者名稱',
            protocol: '通訊協定',
            encoding: '編碼',
            save: '儲存',
            cancel: '取消'
        },
        editSession: {
            title: '編輯會話'
        },
        deleteSession: {
            title: '刪除會話',
            message: '確定要刪除此會話嗎？',
            warning: '此操作不可撤銷。',
            confirm: '刪除',
            cancel: '取消'
        }
    },

    // Context menus
    contextMenu: {
        terminal: {
            copy: '複製',
            paste: '貼上',
            selectAll: '全選',
            clear: '清除'
        },
        session: {
            connect: '連接',
            edit: '編輯',
            duplicate: '複製',
            delete: '刪除'
        }
    },

    // SSH Keys management
    sshKeys: {
        title: 'SSH 密鑰',
        manage: '管理密鑰',
        clickToManage: '點擊管理密鑰',
        noKeys: '暫無保存的密鑰',
        addKey: '添加密鑰',
        add: '添加 SSH 密鑰',
        fingerprint: '指紋',
        lastUsed: '最後使用',
        confirmDelete: '確定要刪除密鑰 "{name}" 嗎？',

        modal: {
            title: 'SSH 密鑰管理',
            deleteTitle: '刪除 SSH 密鑰',
            deleteMessage: '確定要刪除此 SSH 密鑰嗎？',
            deleteWarning: '此操作無法撤銷。',
            deleteConfirm: '刪除',
            deleteCancel: '取消'
        },

        form: {
            title: '添加 SSH 密鑰',
            addTitle: '添加 SSH 密鑰',
            editTitle: '編輯 SSH 密鑰',
            name: '密鑰名稱',
            namePlaceholder: '輸入密鑰名稱...',
            description: '描述 (可選)',
            descriptionPlaceholder: '輸入密鑰描述...',
            privateKey: '私鑰內容',
            privateKeyPlaceholder: '貼上私鑰內容或點擊上傳文件...',
            passphrase: '密鑰密碼',
            passphrasePlaceholder: '如果私鑰有密碼，請輸入...',
            uploadFile: '上傳文件',
            save: '保存',
            cancel: '取消'
        },

        errors: {
            loadFailed: '加載密鑰失敗',
            saveFailed: '保存密鑰失敗',
            deleteFailed: '刪除密鑰失敗',
            invalidKey: '無效的密鑰格式'
        },

        success: {
            created: '密鑰添加成功',
            updated: '密鑰更新成功',
            deleted: '密鑰刪除成功'
        }
    }
};
