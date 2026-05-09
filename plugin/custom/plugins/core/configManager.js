// plugin/custom/plugins/core/configManager.js

const ConfigManager = {
    create(storageKey, defaultConfig) {
        return {
            storageKey,
            defaultConfig,
            _cache: null,

            get(key) {
                const config = this.getAll();
                return key ? config[key] : config;
            },

            getAll() {
                if (this._cache) return this._cache;

                try {
                    const stored = localStorage.getItem(this.storageKey);
                    if (stored) {
                        this._cache = { ...this.defaultConfig, ...JSON.parse(stored) };
                        return this._cache;
                    }
                } catch (e) {
                    console.warn("ConfigManager: Failed to read config:", e);
                }

                this._cache = { ...this.defaultConfig };
                return this._cache;
            },

            set(key, value) {
                const config = this.getAll();
                config[key] = value;
                this._save();
            },

            setAll(config) {
                this._cache = { ...this.defaultConfig, ...config };
                this._save();
            },

            reset() {
                this._cache = { ...this.defaultConfig };
                this._save();
            },

            _save() {
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify(this._cache));
                } catch (e) {
                    console.error("ConfigManager: Failed to save config:", e);
                }
            },
        };
    },
};

module.exports = ConfigManager;
