/**
 * Session Manager
 * Handles saved connection sessions
 */

export class SessionManager {
    constructor() {
        this.sessions = [];
        this.groups = [];
        this.eventListeners = new Map();
        // 支持子应用挂载：优先使用全局配置的 API 基础路径
        const apiPrefix = window.WEBXTERM_API_BASE || '/api';
        this.apiBase = `${apiPrefix}/sessions`;
    }

    async init() {
        // Load sessions from server
        await this.loadSessions();
    }

    async loadSessions() {
        try {
            console.log('SessionManager: Loading sessions from', this.apiBase);
            const response = await fetch(this.apiBase);
            console.log('SessionManager: Response status:', response.status);

            if (!response.ok) {
                console.error('SessionManager: Response not ok:', response.status, response.statusText);
                throw new Error(`Failed to load sessions: ${response.status}`);
            }

            this.sessions = await response.json();
            console.log('SessionManager: Loaded', this.sessions.length, 'sessions');

            this.updateGroups();
            this.emit('sessionsLoaded', this.sessions);

            return this.sessions;
        } catch (error) {
            console.error('SessionManager: Error loading sessions:', error);
            throw error;
        }
    }

    async saveSession(sessionConfig) {
        try {
            const response = await fetch(this.apiBase, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sessionConfig)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save session');
            }

            const savedSession = await response.json();
            this.sessions.push(savedSession);
            this.updateGroups();
            this.emit('sessionSaved', savedSession);
            this.emit('sessionsLoaded', this.sessions);

            return savedSession;
        } catch (error) {
            console.error('Error saving session:', error);
            throw error;
        }
    }

    async updateSession(sessionId, updates) {
        try {
            const response = await fetch(`${this.apiBase}/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update session');
            }

            const updatedSession = await response.json();

            // Update local sessions array
            const index = this.sessions.findIndex(s => s.id === sessionId);
            if (index !== -1) {
                this.sessions[index] = updatedSession;
                this.updateGroups();
                this.emit('sessionUpdated', updatedSession);
                this.emit('sessionsLoaded', this.sessions);
            }

            return updatedSession;
        } catch (error) {
            console.error('Error updating session:', error);
            throw error;
        }
    }

    async deleteSession(sessionId) {
        try {
            const response = await fetch(`${this.apiBase}/${sessionId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete session');
            }

            // Remove from local sessions array
            this.sessions = this.sessions.filter(s => s.id !== sessionId);
            this.updateGroups();
            this.emit('sessionDeleted', sessionId);
            this.emit('sessionsLoaded', this.sessions);

        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }

    async useSession(sessionId) {
        try {
            const response = await fetch(`${this.apiBase}/${sessionId}/use`, {
                method: 'POST'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to use session');
            }

            const connectionData = await response.json();

            // Update last_used timestamp locally
            const session = this.sessions.find(s => s.id === sessionId);
            if (session) {
                session.last_used = new Date().toISOString();
                this.emit('sessionUsed', session);
            }

            return connectionData;
        } catch (error) {
            console.error('Error using session:', error);
            throw error;
        }
    }

    async getSession(sessionId) {
        try {
            const response = await fetch(`${this.apiBase}/${sessionId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get session');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting session:', error);
            throw error;
        }
    }

    async exportSessions(groupName = null) {
        try {
            const url = new URL(`${this.apiBase}/export`, window.location.origin);
            if (groupName) {
                url.searchParams.set('group_name', groupName);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to export sessions');
            }

            const exportData = await response.json();

            // Download as JSON file
            this.downloadJson(exportData, `webxterm-sessions-${new Date().toISOString().split('T')[0]}.json`);

            return exportData;
        } catch (error) {
            console.error('Error exporting sessions:', error);
            throw error;
        }
    }

    downloadJson(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }

    updateGroups() {
        const groupSet = new Set();
        this.sessions.forEach(session => {
            if (session.group_name) {
                groupSet.add(session.group_name);
            }
        });
        this.groups = Array.from(groupSet).sort();
        this.emit('groupsUpdated', this.groups);
    }

    getSessionsByGroup(groupName) {
        if (!groupName) {
            return this.sessions.filter(session => !session.group_name);
        }
        return this.sessions.filter(session => session.group_name === groupName);
    }

    getSessionsByType(connectionType) {
        return this.sessions.filter(session => session.connection_type === connectionType);
    }

    searchSessions(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.sessions.filter(session => {
            return session.name.toLowerCase().includes(lowercaseQuery) ||
                   session.hostname.toLowerCase().includes(lowercaseQuery) ||
                   session.username.toLowerCase().includes(lowercaseQuery) ||
                   (session.group_name && session.group_name.toLowerCase().includes(lowercaseQuery));
        });
    }

    getRecentSessions(limit = 5) {
        return this.sessions
            .filter(session => session.last_used)
            .sort((a, b) => new Date(b.last_used) - new Date(a.last_used))
            .slice(0, limit);
    }

    getSessionsGrouped() {
        const grouped = {
            ungrouped: []
        };

        this.sessions.forEach(session => {
            const group = session.group_name || 'ungrouped';
            if (!grouped[group]) {
                grouped[group] = [];
            }
            grouped[group].push(session);
        });

        // Sort sessions within each group
        Object.keys(grouped).forEach(group => {
            grouped[group].sort((a, b) => {
                // Sort by last_used (most recent first), then by name
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

    selectSession(session) {
        this.emit('sessionSelected', session);
    }

    // Validation helpers
    validateSessionData(sessionData) {
        const errors = [];

        if (!sessionData.name || sessionData.name.trim() === '') {
            errors.push('Session name is required');
        }

        if (!sessionData.hostname || sessionData.hostname.trim() === '') {
            errors.push('Hostname is required');
        }

        if (!sessionData.username || sessionData.username.trim() === '') {
            errors.push('Username is required');
        }

        if (!sessionData.connection_type || !['ssh', 'telnet'].includes(sessionData.connection_type)) {
            errors.push('Valid connection type is required');
        }

        if (sessionData.port && (sessionData.port < 1 || sessionData.port > 65535)) {
            errors.push('Port must be between 1 and 65535');
        }

        // Check for duplicate names within the same group
        const existingSession = this.sessions.find(s =>
            s.name === sessionData.name &&
            s.group_name === (sessionData.group_name || null)
        );

        if (existingSession) {
            errors.push('Session name already exists in this group');
        }

        return errors;
    }

    // Local storage helpers for quick access
    saveToLocalStorage() {
        try {
            const sessionsData = {
                sessions: this.sessions,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem('webxterm-sessions', JSON.stringify(sessionsData));
        } catch (error) {
            console.warn('Failed to save sessions to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('webxterm-sessions');
            if (data) {
                const parsed = JSON.parse(data);
                return parsed.sessions || [];
            }
        } catch (error) {
            console.warn('Failed to load sessions from localStorage:', error);
        }
        return [];
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
                    console.error('Error in session event listener:', error);
                }
            });
        }
    }
}