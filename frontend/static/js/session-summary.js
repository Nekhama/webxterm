/**
 * Session Summary Utility
 * Handles connection summary displays and error messages
 */

export class SessionSummaryUtil {
    /**
     * Format duration for connection summary
     * @param {number} durationMs - Duration in milliseconds
     * @param {Object} i18n - i18n instance for translations (optional)
     * @returns {string} Formatted duration string
     */
    static formatDuration(durationMs, i18n = null) {
        const totalSeconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const hours = Math.floor(minutes / 60);

        const remainingMinutes = minutes % 60;
        const remainingSeconds = totalSeconds % 60;

        // Get translated time units
        const getUnit = (key, fallback) => i18n ? i18n.t(key) : fallback;

        if (hours > 0) {
            return `${hours}${getUnit('time.hours', '小时')}${remainingMinutes}${getUnit('time.minutes', '分钟')}${remainingSeconds}${getUnit('time.seconds', '秒')}`;
        } else if (minutes > 0) {
            return `${minutes}${getUnit('time.minutes', '分钟')}${remainingSeconds}${getUnit('time.seconds', '秒')}`;
        } else {
            return `${totalSeconds}${getUnit('time.seconds', '秒')}`;
        }
    }

    /**
     * Show session summary overlay
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element to append overlay
     * @param {string} options.reason - Disconnection reason
     * @param {Date} options.connectedAt - Connection start time
     * @param {Object} options.sessionInfo - Session information
     * @param {Function} options.onReconnect - Reconnect callback function
     * @param {Object} options.i18n - Internationalization instance
     */
    static showSessionSummary(options) {
        const { container, reason, connectedAt, sessionInfo, onReconnect, i18n } = options;

        if (!container) return;

        // Calculate duration
        let duration = null;
        if (connectedAt) {
            const disconnectedAt = new Date();
            const durationMs = disconnectedAt.getTime() - connectedAt.getTime();
            duration = SessionSummaryUtil.formatDuration(durationMs, i18n);
        }

        // Remove existing overlay if any
        const existingOverlay = container.querySelector('.session-summary-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Determine overlay content based on whether it's an error or normal disconnection
        const isError = reason && reason !== 'user_disconnect';
        const icon = isError ? '❌' : '📊';
        const title = isError ?
            (i18n ? i18n.t('sessions.connectionError') : 'Connection Error') :
            (i18n ? i18n.t('sessions.connectionSummary') : 'Connection Summary');

        // Get session name and connection info
        const sessionName = sessionInfo?.name ||
                           (i18n ? i18n.t('sessions.quickConnect') : 'Quick Connect');
        const connectionType = sessionInfo?.connection_type || sessionInfo?.type || 'Unknown';
        const typeDisplay = connectionType.toUpperCase();
        const sessionNameWithType = `${typeDisplay}: ${sessionName}`;

        // Build connection detail string: user@host:port
        const username = sessionInfo?.username || '';
        const hostname = sessionInfo?.hostname || '';
        const port = sessionInfo?.port || '';
        let connectionDetail = '';
        if (username && hostname) {
            connectionDetail = port ? `${username}@${hostname}:${port}` : `${username}@${hostname}`;
        } else if (hostname) {
            connectionDetail = port ? `${hostname}:${port}` : hostname;
        }

        // Error message handling with i18n support
        let errorMessage = '';
        if (isError) {
            const rawError = reason.toLowerCase();

            // Map error patterns to i18n keys - provides user-friendly error messages
            const errorPatterns = [
                {
                    patterns: ['authentication failed'],
                    i18nKey: 'errors.authenticationFailedMessage',
                    fallback: 'Invalid username or password'
                },
                {
                    patterns: ['unable to connect', 'connection refused', 'econnrefused'],
                    i18nKey: 'errors.connectionRefused',
                    fallback: 'Connection refused, please check host address and port'
                },
                {
                    patterns: ['timeout'],
                    i18nKey: 'errors.connectionTimeout',
                    fallback: 'Connection timeout'
                },
                {
                    patterns: ['network'],
                    i18nKey: 'errors.networkUnavailable',
                    fallback: 'Network unavailable'
                },
                {
                    patterns: ['connection_closed'],
                    i18nKey: 'sessions.connectionLost',
                    fallback: 'Connection lost'
                },
                {
                    patterns: ['connection_error'],
                    i18nKey: 'sessions.connectionError',
                    fallback: 'Connection error'
                }
            ];

            // Find matching error pattern
            const matchedPattern = errorPatterns.find(pattern =>
                pattern.patterns.some(p => rawError.includes(p))
            );

            if (matchedPattern) {
                errorMessage = i18n ? i18n.t(matchedPattern.i18nKey) : matchedPattern.fallback;
            } else {
                // For unrecognized errors, show the original message but clean it up
                errorMessage = reason.replace(/^(Connection failed|Failed to connect|Error):\s*/i, '');
            }
        }

        // Create session summary overlay
        const overlay = document.createElement('div');
        overlay.className = 'session-summary-overlay';
        overlay.innerHTML = `
            <div class="session-summary-content">
                <div class="session-summary-icon">${icon}</div>
                <div class="session-summary-title">${title}</div>
                <div class="session-summary-info">
                    <div class="session-name">${sessionNameWithType}</div>
                    ${connectionDetail ? `<div class="session-connection-detail">${connectionDetail}</div>` : ''}
                    ${isError ? `<div class="session-error">${errorMessage}</div>` : ''}
                    ${duration && !isError ? `<div class="session-duration">${i18n ? i18n.t('sessions.connectionTime') : 'Connected for'}: ${duration}</div>` : ''}
                </div>
                <div class="session-summary-actions">
                    <button class="btn btn-primary reconnect-btn">
                        <span class="btn-icon">⚡</span>
                        ${i18n ? i18n.t('sessions.reconnect') : 'Reconnect'}
                    </button>
                </div>
            </div>
        `;

        // Add overlay to container
        container.appendChild(overlay);

        // Set up reconnect functionality
        const reconnectBtn = overlay.querySelector('.reconnect-btn');
        if (reconnectBtn && onReconnect) {
            reconnectBtn.addEventListener('click', () => {
                // Remove overlay
                overlay.remove();
                // Call reconnect callback
                onReconnect();
            });
        }
    }

    /**
     * Get appropriate container element for session summary
     * @param {string} sessionId - Session ID (optional)
     * @returns {HTMLElement|null} Container element
     */
    static getContainer(sessionId = null) {
        if (sessionId) {
            // Find session-specific terminal element
            const sessionTab = document.querySelector(`[data-session-id="${sessionId}"]`);
            return sessionTab ? sessionTab.querySelector('.terminal') : null;
        } else {
            // Use main terminal container
            return document.querySelector('.terminal-container');
        }
    }

    /**
     * Show connection failure summary
     * @param {Object} options - Configuration options
     * @param {string} options.errorMessage - Error message to display
     * @param {Object} options.sessionInfo - Session information (optional)
     * @param {Function} options.onReconnect - Reconnect callback function
     * @param {Object} options.i18n - Internationalization instance
     */
    static showConnectionError(options) {
        const { errorMessage, sessionInfo, onReconnect, i18n } = options;

        const container = SessionSummaryUtil.getContainer();
        if (!container) return;

        // Use the shared session summary method with error message as reason
        SessionSummaryUtil.showSessionSummary({
            container,
            reason: errorMessage, // Pass error message directly as reason
            connectedAt: null,    // No connection time for failed connections
            sessionInfo,
            onReconnect,
            i18n
        });
    }
}