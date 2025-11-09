/**
 * Simplified Chinese Language Pack
 */

export const zh_CN = {
    // Application title and navigation
    app: {
        title: 'webXTerm'
    },

    // Buttons
    buttons: {
        connect: '连接',
        disconnect: '断开',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        duplicate: '复制',
        cancel: '取消',
        confirm: '确认',
        close: '关闭',
        refresh: '刷新',
        fullscreen: '全屏',
        exitFullscreen: '退出全屏',
        newSession: '新建会话',
        closeAll: '关闭所有'
    },

    // About modal
    about: {
        title: '关于 webXTerm',
        version: '版本',
        author: '作者',
        github: 'GitHub',
        description: '现代化网页版 SSH/Telnet 终端管理工具'
    },

    // Form labels and placeholders
    form: {
        quickConnect: '快速连接',
        sessionName: '会话名称',
        sessionNamePlaceholder: '输入会话名称...',
        hostname: '主机名',
        hostnamePlaceholder: '输入主机名或IP地址...',
        protocolPort: '协议/端口',
        port: '端口',
        username: '用户名',
        usernamePlaceholder: '输入用户名...',
        password: '密码',
        passwordPlaceholder: '输入密码...',
        protocol: '协议',
        encoding: '服务器编码',
        encodingAuto: '自动检测',
        encodingUtf8: 'UTF-8',
        encodingGbk: 'GBK/GB2312',
        search: '搜索',
        searchPlaceholder: '搜索会话...',
        moreOptions: '更多选项',
        privateKey: '私钥',
        privateKeyPlaceholder: '-----BEGIN PRIVATE KEY-----',
        passphrase: '密钥密码',
        passphrasePlaceholder: '输入密钥密码...',
        group: '分组 (可选)',
        groupPlaceholder: '输入分组名称...',
        sshOptions: 'SSH选项',
        hideSshOptions: '隐藏SSH选项',
        connectPrompt: '点击"连接"开始新会话',
        toggleQuickConnect: '切换快速连接',
        sshKey: 'SSH密钥',
        sshKeyNone: '不使用密钥'
    },

    // Connection status
    status: {
        disconnected: '已断开',
        connecting: '连接中...',
        connected: '已连接',
        connectionFailed: '连接失败',
        authenticated: '已认证',
        reconnecting: '重连中...'
    },

    // Messages and notifications
    messages: {
        connectionSuccess: '连接建立成功',
        connectionFailed: '连接失败：{error}',
        sessionSaved: '会话保存成功',
        sessionDeleted: '会话删除成功',
        sessionDuplicated: '会话复制成功',
        allSessionsClosed: '所有会话已关闭',
        confirmDelete: '确定要删除此会话吗？',
        confirmCloseAll: '确定要关闭所有会话吗？',
        sessionFilled: '会话信息已填充',
        noSessionsFound: '未找到会话',
        invalidInput: '请检查输入内容',
        networkError: '网络错误'
    },

    // Tooltips and help text
    tooltips: {
        theme: '切换主题',
        language: '切换语言',
        connect: '连接到会话',
        disconnect: '断开会话',
        disconnectCurrentSession: '断开当前会话',
        fullscreen: '进入全屏模式',
        exitFullscreen: '退出全屏模式',
        newSession: '创建新会话',
        refreshSessions: '刷新会话列表',
        editSession: '编辑会话',
        duplicateSession: '复制会话',
        deleteSession: '删除会话',
        sessionStatus: '会话状态',
        terminalSize: '终端大小'
    },

    // Session management
    sessions: {
        title: '会话',
        saved: '已保存的会话',
        active: '活跃会话',
        noSessions: '没有可用会话',
        noActiveSessionToDisconnect: '没有活动会话需要断开',
        sessionInfo: '会话信息',
        connectionTime: '本次会话时长',
        reconnect: '重新连接',
        summary: '会话摘要',
        loading: '加载会话中...',
        last: '最近',
        quickConnect: '快速连接',
        connectionError: '连接错误',
        connectionSummary: '连接摘要',
        connectionLost: '连接丢失',
        unknownError: '未知错误',
        noConnectionToReconnect: '没有可重连的连接'
    },

    // Connection progress messages
    connection: {
        initiating: '正在建立连接...',
        establishing: '正在建立安全连接...',
        authenticating: '正在验证身份...',
        connected: '连接已建立'
    },

    // Time units
    time: {
        seconds: '秒',
        minutes: '分钟',
        hours: '小时',
        days: '天'
    },

    // Error messages
    errors: {
        connectionTimeout: '连接超时',
        authenticationFailed: '验证失败',
        authenticationFailedMessage: '账号或密码不正确',
        unableToConnect: '无法连接到服务器',
        connectionRefused: '连接被拒绝，请检查主机地址和端口号',
        networkUnavailable: '网络不可用',
        serverError: '服务器错误',
        invalidCredentials: '凭据无效',
        sessionNotFound: '会话未找到',
        unexpectedError: '发生意外错误',
        connectionFailed: '连接失败',
        connectionFailedWithReason: '连接失败：{reason}'
    },

    // Modal dialogs
    modals: {
        saveSession: {
            title: '保存会话',
            sessionName: '会话名称',
            hostname: '主机名',
            port: '端口',
            username: '用户名',
            protocol: '协议',
            encoding: '编码',
            save: '保存',
            cancel: '取消'
        },
        editSession: {
            title: '编辑会话'
        },
        deleteSession: {
            title: '删除会话',
            message: '确定要删除此会话吗？',
            warning: '此操作不可撤销。',
            confirm: '删除',
            cancel: '取消'
        }
    },

    // Context menus
    contextMenu: {
        terminal: {
            copy: '复制',
            paste: '粘贴',
            selectAll: '全选',
            clear: '清空'
        },
        session: {
            connect: '连接',
            edit: '编辑',
            duplicate: '复制',
            delete: '删除'
        }
    },

    // SSH Keys management
    sshKeys: {
        title: 'SSH 密钥',
        manage: '管理密钥',
        clickToManage: '点击管理密钥',
        noKeys: '暂无保存的密钥',
        addKey: '添加密钥',
        add: '添加 SSH 密钥',
        fingerprint: '指纹',
        lastUsed: '最后使用',
        confirmDelete: '确定要删除密钥 "{name}" 吗？',

        modal: {
            title: 'SSH 密钥管理',
            deleteTitle: '删除 SSH 密钥',
            deleteMessage: '确定要删除此 SSH 密钥吗？',
            deleteWarning: '此操作不可撤销。',
            deleteConfirm: '删除',
            deleteCancel: '取消'
        },

        form: {
            title: '添加 SSH 密钥',
            addTitle: '添加 SSH 密钥',
            editTitle: '编辑 SSH 密钥',
            name: '密钥名称',
            namePlaceholder: '输入密钥名称...',
            description: '描述 (可选)',
            descriptionPlaceholder: '输入密钥描述...',
            privateKey: '私钥内容',
            privateKeyPlaceholder: '粘贴私钥内容或点击上传文件...',
            passphrase: '密钥密码',
            passphrasePlaceholder: '如果私钥有密码，请输入...',
            uploadFile: '上传文件',
            save: '保存',
            cancel: '取消'
        },

        errors: {
            loadFailed: '加载密钥失败',
            saveFailed: '保存密钥失败',
            deleteFailed: '删除密钥失败',
            invalidKey: '无效的密钥格式'
        },

        success: {
            created: '密钥添加成功',
            updated: '密钥更新成功',
            deleted: '密钥删除成功'
        }
    }
};
