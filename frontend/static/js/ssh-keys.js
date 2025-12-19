/**
 * SSH Key Manager
 * Handles SSH key management operations
 */

import { EventEmitter } from './event-emitter.js';

export class SSHKeyManager extends EventEmitter {
    constructor() {
        super();
        this.keys = [];
        // 支持子应用挂载：优先使用全局配置的 API 基础路径
        this.apiBase = window.WEBXTERM_API_BASE || '/api';
    }

    async loadKeys() {
        try {
            const response = await fetch(`${this.apiBase}/ssh-keys`);
            if (!response.ok) {
                throw new Error(`Failed to load SSH keys: ${response.statusText}`);
            }
            this.keys = await response.json();
            this.emit('keysLoaded', this.keys);
            return this.keys;
        } catch (error) {
            console.error('Error loading SSH keys:', error);
            throw error;
        }
    }

    async createKey(keyData) {
        try {
            const response = await fetch(`${this.apiBase}/ssh-keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(keyData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create SSH key');
            }

            const newKey = await response.json();
            this.keys.push(newKey);
            this.emit('keyCreated', newKey);
            this.emit('keysLoaded', this.keys);
            return newKey;
        } catch (error) {
            console.error('Error creating SSH key:', error);
            throw error;
        }
    }

    async updateKey(keyId, keyData) {
        try {
            const response = await fetch(`${this.apiBase}/ssh-keys/${keyId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(keyData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update SSH key');
            }

            const updatedKey = await response.json();
            const index = this.keys.findIndex(k => k.id === keyId);
            if (index !== -1) {
                this.keys[index] = updatedKey;
            }
            this.emit('keyUpdated', updatedKey);
            this.emit('keysLoaded', this.keys);
            return updatedKey;
        } catch (error) {
            console.error('Error updating SSH key:', error);
            throw error;
        }
    }

    async deleteKey(keyId) {
        try {
            const response = await fetch(`${this.apiBase}/ssh-keys/${keyId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete SSH key');
            }

            this.keys = this.keys.filter(k => k.id !== keyId);
            this.emit('keyDeleted', keyId);
            this.emit('keysLoaded', this.keys);
        } catch (error) {
            console.error('Error deleting SSH key:', error);
            throw error;
        }
    }

    async getKeyWithSecret(keyId) {
        try {
            const response = await fetch(`${this.apiBase}/ssh-keys/${keyId}/secret`);
            if (!response.ok) {
                throw new Error('Failed to get SSH key');
            }
            return await response.json();
        } catch (error) {
            console.error('Error getting SSH key with secret:', error);
            throw error;
        }
    }

    getKeys() {
        return this.keys;
    }

    getKeyById(keyId) {
        return this.keys.find(k => k.id === keyId);
    }
}
