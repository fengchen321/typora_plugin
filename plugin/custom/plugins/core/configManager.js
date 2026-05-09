// plugin/custom/plugins/core/configManager.js
// 配置管理器 - UMD 模块

(function(root) {
    'use strict';

    var ConfigManager = {
        create: function(storageKey, defaultConfig) {
            return {
                storageKey: storageKey,
                defaultConfig: defaultConfig,
                _cache: null,

                get: function(key) {
                    var config = this.getAll();
                    return key ? config[key] : config;
                },

                getAll: function() {
                    if (this._cache) return this._cache;

                    try {
                        var stored = localStorage.getItem(this.storageKey);
                        if (stored) {
                            this._cache = Object.assign({}, this.defaultConfig, JSON.parse(stored));
                            return this._cache;
                        }
                    } catch (e) {
                        console.warn("ConfigManager: Failed to read config:", e);
                    }

                    this._cache = Object.assign({}, this.defaultConfig);
                    return this._cache;
                },

                set: function(key, value) {
                    var config = this.getAll();
                    config[key] = value;
                    this._save();
                },

                setAll: function(config) {
                    this._cache = Object.assign({}, this.defaultConfig, config);
                    this._save();
                },

                reset: function() {
                    this._cache = Object.assign({}, this.defaultConfig);
                    this._save();
                },

                _save: function() {
                    try {
                        localStorage.setItem(this.storageKey, JSON.stringify(this._cache));
                    } catch (e) {
                        console.error("ConfigManager: Failed to save config:", e);
                    }
                }
            };
        }
    };

    // UMD 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ConfigManager;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return ConfigManager; });
    } else {
        root.ConfigManager = ConfigManager;
    }

})(typeof global !== 'undefined' ? global : window);