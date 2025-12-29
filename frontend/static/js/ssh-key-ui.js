/**
 * SSH Key UI Controller
 * Handles SSH key management UI and events
 */

import { SSHKeyManager } from './ssh-keys.js';

export class SSHKeyUI {
    constructor(i18n, options = {}) {
        this.i18n = i18n;
        this.keyManager = new SSHKeyManager();
        this.currentEditingKeyId = null;
        this.deferLoading = options.deferLoading || false;
        
        // 🆕 存储 ScopedDOM（解决多实例冲突）
        this.dom = options.dom || null;
        this.container = options.container || null;
        
        // 🆕 创建作用域 DOM 查询辅助函数
        this.byId = this.dom ? (id) => this.dom.byId(id) : (id) => document.getElementById(id);
        this.$ = this.dom ? (selector) => this.dom.$(selector) : (selector) => document.querySelector(selector);
        this.$$ = this.dom ? (selector) => this.dom.$$(selector) : (selector) => document.querySelectorAll(selector);
        
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        // 🆕 使用 ScopedDOM 查询（解决多实例冲突）
        // Modal elements
        this.modal = this.byId('ssh-key-modal');
        this.modalOverlay = this.byId('modal-overlay');
        this.closeBtn = this.byId('ssh-key-modal-close');

        // Delete modal elements
        this.deleteModal = this.byId('delete-ssh-key-modal');
        this.deleteModalClose = this.byId('delete-ssh-key-modal-close');
        this.deleteModalMessage = this.byId('delete-ssh-key-modal-message');
        this.deleteConfirmBtn = this.byId('delete-ssh-key-confirm');
        this.deleteCancelBtn = this.byId('delete-ssh-key-cancel');

        // List elements
        this.keysList = this.byId('ssh-keys-list-content');
        this.addKeyBtn = this.byId('add-ssh-key-btn');

        // Form elements
        this.formContainer = this.byId('ssh-key-form-container');
        this.formTitle = this.byId('ssh-key-form-title');
        this.form = this.byId('ssh-key-form');
        this.keyIdInput = this.byId('ssh-key-id');
        this.nameInput = this.byId('ssh-key-name');
        this.descInput = this.byId('ssh-key-description');
        this.privateKeyInput = this.byId('ssh-key-private-key');
        this.passphraseInput = this.byId('ssh-key-passphrase');
        this.cancelFormBtn = this.byId('cancel-ssh-key-form');

        // File upload
        this.uploadBtn = this.byId('upload-key-file-btn');
        this.fileInput = this.byId('key-file-input');

        // Trigger button
        this.manageKeysBtn = this.byId('manage-keys-btn');

        // Key selectors in forms
        this.quickConnectKeySelect = this.byId('ssh-key-select');
        this.sessionKeySelect = this.byId('session-ssh-key-select');
    }

    initEventListeners() {
        // Open modal
        if (this.manageKeysBtn) {
            this.manageKeysBtn.addEventListener('click', () => this.openModal());
        }

        // Close modal
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Click outside modal to close
        if (this.modalOverlay) {
            this.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.modalOverlay) {
                    this.closeModal();
                    this.hideDeleteModal();
                }
            });
        }

        // Delete modal events
        if (this.deleteModalClose) {
            this.deleteModalClose.addEventListener('click', () => this.hideDeleteModal());
        }
        if (this.deleteCancelBtn) {
            this.deleteCancelBtn.addEventListener('click', () => this.hideDeleteModal());
        }
        if (this.deleteConfirmBtn) {
            this.deleteConfirmBtn.addEventListener('click', () => this.confirmDeleteKey());
        }

        // Add key button
        if (this.addKeyBtn) {
            this.addKeyBtn.addEventListener('click', () => this.showKeyForm());
        }

        // Cancel form
        if (this.cancelFormBtn) {
            this.cancelFormBtn.addEventListener('click', () => this.hideKeyForm());
        }

        // Form submit
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // File upload
        if (this.uploadBtn) {
            this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Key manager events
        this.keyManager.on('keysLoaded', (keys) => {
            this.renderKeysList(keys);
            this.updateKeySelectors(keys);
        });
        this.keyManager.on('keyCreated', () => this.handleKeyCreated());
        this.keyManager.on('keyUpdated', () => this.handleKeyUpdated());
        this.keyManager.on('keyDeleted', () => this.handleKeyDeleted());

        // Load keys initially to populate selectors (unless deferred)
        if (!this.deferLoading) {
            this.keyManager.loadKeys().catch(err => {
                console.error('Failed to load SSH keys for selectors:', err);
            });
        }
    }
    
    /**
     * 延迟加载 SSH 密钥（用于自动连接模式后台加载）
     */
    loadKeysDeferred() {
        this.keyManager.loadKeys().catch(err => {
            console.error('Failed to load SSH keys (deferred):', err);
        });
    }

    async openModal() {
        // Close other modals first
        const otherModals = document.querySelectorAll('.modal');
        otherModals.forEach(modal => {
            if (modal.id !== 'ssh-key-modal') {
                modal.style.display = 'none';
            }
        });

        this.modal.style.display = 'block';
        this.modalOverlay.classList.remove('hidden');
        this.hideKeyForm();
        await this.loadKeys();
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.modalOverlay.classList.add('hidden');
        this.hideKeyForm();
    }

    async loadKeys() {
        try {
            await this.keyManager.loadKeys();
        } catch (error) {
            console.error('Failed to load SSH keys:', error);
            this.showError(this.i18n.t('sshKeys.errors.loadFailed'));
        }
    }

    renderKeysList(keys) {
        if (!this.keysList) return;

        if (keys.length === 0) {
            this.keysList.innerHTML = `
                <div class="empty-state">
                    <p>${this.i18n.t('sshKeys.noKeys')}</p>
                </div>
            `;
            return;
        }

        const keysHtml = keys.map(key => `
            <div class="ssh-key-item" data-key-id="${key.id}">
                <div class="key-info">
                    <div class="key-name">🔑 ${this.escapeHtml(key.name)}</div>
                    ${key.description ? `<div class="key-desc">${this.escapeHtml(key.description)}</div>` : ''}
                    <div class="key-meta">
                        <span class="key-fingerprint" title="${this.i18n.t('sshKeys.fingerprint')}">${key.fingerprint}</span>
                        ${key.last_used ? `<span class="key-last-used">${this.i18n.t('sshKeys.lastUsed')}: ${this.formatDate(key.last_used)}</span>` : ''}
                    </div>
                </div>
                <div class="key-actions">
                    <button class="icon-btn edit-key-btn" data-key-id="${key.id}" title="${this.i18n.t('buttons.edit')}">
                        <span>✏️</span>
                    </button>
                    <div class="delete-action-group">
                        <button class="icon-btn delete-key-btn" data-key-id="${key.id}" title="${this.i18n.t('buttons.delete')}">
                            <span>🗑️</span>
                        </button>
                        <div class="delete-confirm-group" style="display: none;">
                            <button class="btn-danger confirm-delete-btn" data-key-id="${key.id}">
                                ${this.i18n.t('sshKeys.modal.deleteConfirm')}
                            </button>
                            <button class="btn-secondary cancel-delete-btn" data-key-id="${key.id}">
                                ${this.i18n.t('sshKeys.modal.deleteCancel')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        this.keysList.innerHTML = keysHtml;

        // Add event listeners
        this.keysList.querySelectorAll('.edit-key-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const keyId = e.currentTarget.dataset.keyId;
                this.editKey(keyId);
            });
        });

        // Delete button - show inline confirmation
        this.keysList.querySelectorAll('.delete-key-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deleteGroup = e.currentTarget.closest('.delete-action-group');
                const deleteBtn = deleteGroup.querySelector('.delete-key-btn');
                const confirmGroup = deleteGroup.querySelector('.delete-confirm-group');

                // Hide delete button, show confirm/cancel buttons
                deleteBtn.style.display = 'none';
                confirmGroup.style.display = 'flex';
            });
        });

        // Confirm delete button
        this.keysList.querySelectorAll('.confirm-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const keyId = e.currentTarget.dataset.keyId;
                await this.confirmDeleteKey(keyId);
            });
        });

        // Cancel delete button
        this.keysList.querySelectorAll('.cancel-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deleteGroup = e.currentTarget.closest('.delete-action-group');
                const deleteBtn = deleteGroup.querySelector('.delete-key-btn');
                const confirmGroup = deleteGroup.querySelector('.delete-confirm-group');

                // Hide confirm/cancel buttons, show delete button again
                confirmGroup.style.display = 'none';
                deleteBtn.style.display = 'inline-flex';
            });
        });
    }

    showKeyForm(key = null) {
        this.currentEditingKeyId = key ? key.id : null;

        if (key) {
            this.formTitle.textContent = this.i18n.t('sshKeys.form.editTitle');
            this.keyIdInput.value = key.id;
            this.nameInput.value = key.name;
            this.descInput.value = key.description || '';
            this.privateKeyInput.value = ''; // Don't show private key
            this.passphraseInput.value = '';
        } else {
            this.formTitle.textContent = this.i18n.t('sshKeys.form.addTitle');
            this.form.reset();
            this.keyIdInput.value = '';
        }

        this.formContainer.style.display = 'block';
    }

    hideKeyForm() {
        this.formContainer.style.display = 'none';
        this.form.reset();
        this.currentEditingKeyId = null;
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = {
            name: this.nameInput.value.trim(),
            description: this.descInput.value.trim(),
            private_key: this.privateKeyInput.value.trim(),
            passphrase: this.passphraseInput.value.trim() || null
        };

        try {
            if (this.currentEditingKeyId) {
                // Update
                await this.keyManager.updateKey(this.currentEditingKeyId, formData);
            } else {
                // Create
                await this.keyManager.createKey(formData);
            }
        } catch (error) {
            console.error('Failed to save SSH key:', error);
            this.showError(error.message || this.i18n.t('sshKeys.errors.saveFailed'));
        }
    }

    async editKey(keyId) {
        const key = this.keyManager.getKeyById(keyId);
        if (key) {
            this.showKeyForm(key);
        }
    }

    async deleteKey(keyId) {
        const key = this.keyManager.getKeyById(keyId);
        if (!key) return;

        // Store key to delete
        this.keyToDelete = key;

        // Update modal message
        this.deleteModalMessage.innerHTML = 
            this.i18n.t('sshKeys.confirmDelete', { name: `<strong>"${this.escapeHtml(key.name)}"</strong>` });

        // Show delete modal
        this.showDeleteModal();
    }

    showDeleteModal() {
        if (!this.deleteModal || !this.modalOverlay) return;

        // Ensure SSH key modal is still visible in background
        this.deleteModal.style.display = 'block';
        this.modalOverlay.classList.remove('hidden');

        // Focus delete button
        if (this.deleteConfirmBtn) {
            this.deleteConfirmBtn.focus();
        }
    }

    hideDeleteModal() {
        if (this.deleteModal) {
            this.deleteModal.style.display = 'none';
        }
        this.keyToDelete = null;
    }

    async confirmDeleteKey(keyId = null) {
        // Support both inline deletion (with keyId) and modal deletion (with this.keyToDelete)
        const idToDelete = keyId || (this.keyToDelete ? this.keyToDelete.id : null);
        if (!idToDelete) return;

        try {
            await this.keyManager.deleteKey(idToDelete);
            // If using modal, hide it
            if (this.keyToDelete) {
                this.hideDeleteModal();
            }
        } catch (error) {
            console.error('Failed to delete SSH key:', error);
            this.showError(this.i18n.t('sshKeys.errors.deleteFailed'));
            if (this.keyToDelete) {
                this.hideDeleteModal();
            }
        }
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this.privateKeyInput.value = event.target.result;
        };
        reader.readAsText(file);
    }

    handleKeyCreated() {
        this.hideKeyForm();
        this.showSuccess(this.i18n.t('sshKeys.success.created'));
    }

    handleKeyUpdated() {
        this.hideKeyForm();
        this.showSuccess(this.i18n.t('sshKeys.success.updated'));
    }

    handleKeyDeleted() {
        this.showSuccess(this.i18n.t('sshKeys.success.deleted'));
    }

    showError(message) {
        // Use existing notification system if available
        if (window.app && window.app.uiManager) {
            window.app.uiManager.showError(message);
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        // Use existing notification system if available
        if (window.app && window.app.uiManager) {
            window.app.uiManager.showSuccess(message);
        } else {
            alert(message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    getKeyManager() {
        return this.keyManager;
    }

    updateKeySelectors(keys) {
        // Update quick connect form key selector
        if (this.quickConnectKeySelect) {
            const currentValue = this.quickConnectKeySelect.value;
            this.quickConnectKeySelect.innerHTML = `<option value="">${this.i18n.t('form.sshKeyNone')}</option>`;
            keys.forEach(key => {
                const option = document.createElement('option');
                option.value = key.id;
                option.textContent = `${key.name}${key.description ? ' - ' + key.description : ''}`;
                this.quickConnectKeySelect.appendChild(option);
            });
            // Restore previous selection if it still exists
            if (currentValue && keys.find(k => k.id === currentValue)) {
                this.quickConnectKeySelect.value = currentValue;
            }
        }

        // Update session modal key selector
        if (this.sessionKeySelect) {
            const currentValue = this.sessionKeySelect.value;
            this.sessionKeySelect.innerHTML = `<option value="">${this.i18n.t('form.sshKeyNone')}</option>`;
            keys.forEach(key => {
                const option = document.createElement('option');
                option.value = key.id;
                option.textContent = `${key.name}${key.description ? ' - ' + key.description : ''}`;
                this.sessionKeySelect.appendChild(option);
            });
            // Restore previous selection if it still exists
            if (currentValue && keys.find(k => k.id === currentValue)) {
                this.sessionKeySelect.value = currentValue;
            }
        }
    }
}
