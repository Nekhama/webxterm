/**
 * Internationalization (i18n) Manager
 * Provides elegant multi-language support with dynamic text replacement
 */

import { en } from './en.js';
import { zh_CN } from './zh_CN.js';
import { zh_TW } from './zh_TW.js';

class I18nManager {
    constructor() {
        this.languages = {
            'en': en,
            'zh_CN': zh_CN,
            'zh_TW': zh_TW
        };

        this.currentLanguage = 'en';
        this.currentPack = this.languages[this.currentLanguage];

        // Callbacks for language change events
        this.changeCallbacks = [];
    }

    /**
     * Set current language
     * @param {string} lang Language code
     */
    setLanguage(lang) {
        if (!this.languages[lang]) {
            console.warn(`Language pack not found: ${lang}`);
            return false;
        }

        this.currentLanguage = lang;
        this.currentPack = this.languages[lang];

        // Trigger language change
        this.updateAllTexts();
        this.notifyLanguageChange(lang);

        return true;
    }

    /**
     * Get translated text by key path
     * @param {string} keyPath Dot-separated key path (e.g., 'buttons.connect')
     * @param {Object} variables Variables to replace in text (e.g., {name: 'Session1'})
     * @returns {string} Translated text
     */
    t(keyPath, variables = {}) {
        const keys = keyPath.split('.');
        let value = this.currentPack;

        // Navigate through nested object
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                console.warn(`Translation key not found: ${keyPath}`);
                return keyPath; // Return key path as fallback
            }
        }

        if (typeof value !== 'string') {
            console.warn(`Translation value is not a string: ${keyPath}`);
            return keyPath;
        }

        // Replace variables in format {variable}
        return this.replaceVariables(value, variables);
    }

    /**
     * Replace variables in text
     * @param {string} text Text with variables
     * @param {Object} variables Variables to replace
     * @returns {string} Text with replaced variables
     */
    replaceVariables(text, variables) {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return variables.hasOwnProperty(key) ? variables[key] : match;
        });
    }

    /**
     * Update all elements with i18n attributes
     * In integrated mode, only updates elements within webXTerm container
     */
    updateAllTexts() {
        // 在集成模式下，只更新 webXTerm 容器内的元素，避免影响主应用
        let root = document;
        if (window.__WEBXTERM_INTEGRATED_MODE__) {
            const container = document.querySelector('.webxterm-container');
            if (container) {
                root = container;
            }
        }
        
        // Update elements with data-i18n attribute
        const elements = root.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const keyPath = element.getAttribute('data-i18n');
            // 检查翻译键是否存在，避免警告
            if (!this.hasTranslation(keyPath)) {
                return; // 跳过不存在的翻译键
            }
            const variables = this.parseVariables(element.getAttribute('data-i18n-vars'));

            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                // For input elements, update placeholder
                if (element.hasAttribute('placeholder')) {
                    element.placeholder = this.t(keyPath, variables);
                } else {
                    element.value = this.t(keyPath, variables);
                }
            } else {
                // For other elements, update text content
                element.textContent = this.t(keyPath, variables);
            }
        });

        // Update elements with data-i18n-title attribute (tooltips)
        const titleElements = root.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const keyPath = element.getAttribute('data-i18n-title');
            if (!this.hasTranslation(keyPath)) {
                return;
            }
            const variables = this.parseVariables(element.getAttribute('data-i18n-title-vars'));
            element.title = this.t(keyPath, variables);
        });

        // Update elements with data-i18n-placeholder attribute
        const placeholderElements = root.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const keyPath = element.getAttribute('data-i18n-placeholder');
            if (!this.hasTranslation(keyPath)) {
                return;
            }
            const variables = this.parseVariables(element.getAttribute('data-i18n-placeholder-vars'));
            element.placeholder = this.t(keyPath, variables);
        });
    }
    
    /**
     * Check if a translation key exists (without logging warning)
     * @param {string} keyPath Dot-separated key path
     * @returns {boolean} Whether the key exists
     */
    hasTranslation(keyPath) {
        const keys = keyPath.split('.');
        let value = this.currentPack;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return false;
            }
        }

        return typeof value === 'string';
    }

    /**
     * Parse variables from attribute value
     * @param {string} varsString JSON string of variables
     * @returns {Object} Parsed variables object
     */
    parseVariables(varsString) {
        if (!varsString) return {};

        try {
            return JSON.parse(varsString);
        } catch (error) {
            console.warn('Failed to parse i18n variables:', varsString);
            return {};
        }
    }

    /**
     * Add callback for language change events
     * @param {Function} callback Callback function
     */
    onLanguageChange(callback) {
        this.changeCallbacks.push(callback);
    }

    /**
     * Remove callback for language change events
     * @param {Function} callback Callback function to remove
     */
    offLanguageChange(callback) {
        const index = this.changeCallbacks.indexOf(callback);
        if (index > -1) {
            this.changeCallbacks.splice(index, 1);
        }
    }

    /**
     * Notify all callbacks about language change
     * @param {string} lang New language code
     */
    notifyLanguageChange(lang) {
        this.changeCallbacks.forEach(callback => {
            try {
                callback(lang);
            } catch (error) {
                console.error('Error in language change callback:', error);
            }
        });
    }

    /**
     * Get current language code
     * @returns {string} Current language code
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get available languages
     * @returns {Array} Array of available language codes
     */
    getAvailableLanguages() {
        return Object.keys(this.languages);
    }

    /**
     * Check if a language is supported
     * @param {string} lang Language code
     * @returns {boolean} Whether the language is supported
     */
    isLanguageSupported(lang) {
        return this.languages.hasOwnProperty(lang);
    }

    /**
     * Add a new language pack
     * @param {string} lang Language code
     * @param {Object} languagePack Language pack object
     */
    addLanguagePack(lang, languagePack) {
        this.languages[lang] = languagePack;
        console.log(`Language pack added: ${lang}`);
    }

    /**
     * Format time duration with localized units
     * @param {number} seconds Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        if (seconds < 60) {
            return `${seconds} ${this.t('time.seconds')}`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} ${this.t('time.minutes')}`;
        } else if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            return `${hours} ${this.t('time.hours')}`;
        } else {
            const days = Math.floor(seconds / 86400);
            return `${days} ${this.t('time.days')}`;
        }
    }

    /**
     * Show localized message
     * @param {string} keyPath Translation key path
     * @param {Object} variables Variables to replace
     * @param {string} type Message type (success, error, info)
     */
    showMessage(keyPath, variables = {}, type = 'info') {
        const message = this.t(keyPath, variables);
        // This will be integrated with the existing UI message system
        if (window.app && window.app.uiManager) {
            if (type === 'success') {
                window.app.uiManager.showSuccess(message);
            } else if (type === 'error') {
                window.app.uiManager.showError(message);
            } else {
                window.app.uiManager.showInfo(message);
            }
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Create global instance
const i18n = new I18nManager();

// Export both the class and the instance
export { I18nManager, i18n };