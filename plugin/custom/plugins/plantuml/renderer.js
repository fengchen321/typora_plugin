// plugin/custom/plugins/plantuml/renderer.js

// PlantUML uses a custom base64 character set
const UML_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

class PlantUMLRenderer {
    constructor(config) {
        this.config = config;
        this.cache = new Map();
    }

    // Encode PlantUML text for server URL
    encode(text) {
        // Use Node.js zlib for deflate compression
        const zlib = require("zlib");

        // 1. Deflate compress
        const compressed = zlib.deflateRawSync(Buffer.from(text, "utf-8"));

        // 2. Convert to standard base64
        const base64 = compressed.toString("base64");

        // 3. Map to PlantUML's custom character set
        let result = "";
        for (let i = 0; i < base64.length; i++) {
            const c = base64[i];
            if (c >= "A" && c <= "Z") {
                result += UML_CHARS[c.charCodeAt(0) - 65 + 10];
            } else if (c >= "a" && c <= "z") {
                result += UML_CHARS[c.charCodeAt(0) - 97 + 36];
            } else if (c >= "0" && c <= "9") {
                result += UML_CHARS[c.charCodeAt(0) - 48];
            } else if (c === "+") {
                result += "-";
            } else if (c === "/") {
                result += "_";
            } else {
                result += c; // '=' remains as is
            }
        }
        return result;
    }

    // Render PlantUML content, return image URL
    async render(content) {
        // Check cache first
        const cacheKey = this._hashContent(content);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Encode and build URL
        const encoded = this.encode(content);
        const url = `${this.config.serverUrl}/${this.config.outputFormat}/${encoded}`;

        // Preload image to verify it works
        await this._loadImage(url);

        // Cache result
        this._addToCache(cacheKey, url);

        return url;
    }

    // Preload image with timeout
    async _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                img.src = "";
                reject(new Error("Image load timeout"));
            }, this.config.timeout);

            img.onload = () => {
                clearTimeout(timeout);
                resolve(url);
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Failed to load image"));
            };

            img.src = url;
        });
    }

    // Simple content hash for caching
    _hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // Add to cache with LRU eviction
    _addToCache(key, value) {
        // Evict oldest if over limit
        if (this.cache.size >= this.config.cacheLimit) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }
}

module.exports = PlantUMLRenderer;
