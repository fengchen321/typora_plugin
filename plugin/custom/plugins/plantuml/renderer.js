// plugin/custom/plugins/plantuml/renderer.js
// PlantUML 渲染器 - UMD 模块

(function(root) {
    'use strict';

    // PlantUML 使用自定义 base64 字符集
    var UML_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

    function PlantUMLRenderer(config) {
        this.config = config;
        this.cache = new Map();
    }

    PlantUMLRenderer.prototype.encode = function(text) {
        console.log("[PlantUML Renderer] Encoding text, length:", text.length);
        console.log("[PlantUML Renderer] Text content:", text);

        // 使用 Node.js zlib 进行 deflate 压缩
        var zlib;
        var reqnode = global.reqnode || global.require;
        if (reqnode) {
            zlib = reqnode("zlib");
        }

        if (!zlib) {
            throw new Error("Cannot load zlib module. PlantUML encoding requires Node.js zlib.");
        }

        // 1. UTF-8 编码并 Deflate 压缩
        var buffer = Buffer.from(text, "utf-8");
        var compressed = zlib.deflateRawSync(buffer);

        console.log("[PlantUML Renderer] Compressed bytes:", compressed.length);

        // 打印前10个字节用于调试
        var firstBytes = [];
        for (var j = 0; j < Math.min(10, compressed.length); j++) {
            firstBytes.push(compressed[j]);
        }
        console.log("[PlantUML Renderer] First 10 bytes:", firstBytes.join(", "));

        // 2. PlantUML 的自定义 base64 编码
        var result = "";
        var len = compressed.length;

        for (var i = 0; i < len; i += 3) {
            var b1 = compressed[i];
            var b2 = (i + 1 < len) ? compressed[i + 1] : 0;
            var b3 = (i + 2 < len) ? compressed[i + 2] : 0;

            // 6位一组，映射到 PlantUML 字符集
            var c1 = (b1 >> 2) & 0x3F;
            var c2 = ((b1 & 0x03) << 4) | ((b2 >> 4) & 0x0F);
            var c3 = ((b2 & 0x0F) << 2) | ((b3 >> 6) & 0x03);
            var c4 = b3 & 0x3F;

            result += UML_CHARS[c1] + UML_CHARS[c2];
            if (i + 1 < len) result += UML_CHARS[c3];
            if (i + 2 < len) result += UML_CHARS[c4];
        }

        console.log("[PlantUML Renderer] Encoded result:", result);
        return result;
    };

    PlantUMLRenderer.prototype.render = async function(content) {
        var self = this;

        // 先检查缓存
        var cacheKey = this._hashContent(content);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // 编码并构建 URL（不需要前缀）
        var encoded = this.encode(content);
        var url = this.config.serverUrl + "/" + this.config.outputFormat + "/" + encoded;

        console.log("[PlantUML Renderer] Render URL:", url);

        // 预加载图片以验证其有效
        await this._loadImage(url);

        // 缓存结果
        this._addToCache(cacheKey, url);

        return url;
    };

    PlantUMLRenderer.prototype._loadImage = function(url) {
        var self = this;
        return new Promise(function(resolve, reject) {
            var img = new Image();
            var timeout = setTimeout(function() {
                img.src = "";
                reject(new Error("Image load timeout"));
            }, self.config.timeout);

            img.onload = function() {
                clearTimeout(timeout);
                resolve(url);
            };

            img.onerror = function() {
                clearTimeout(timeout);
                reject(new Error("Failed to load image"));
            };

            img.src = url;
        });
    };

    PlantUMLRenderer.prototype._hashContent = function(content) {
        var hash = 0;
        for (var i = 0; i < content.length; i++) {
            var char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    };

    PlantUMLRenderer.prototype._addToCache = function(key, value) {
        // 超出限制时淘汰最旧的条目
        if (this.cache.size >= this.config.cacheLimit) {
            var firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    };

    PlantUMLRenderer.prototype.clearCache = function() {
        this.cache.clear();
    };

    // UMD 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PlantUMLRenderer;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return PlantUMLRenderer; });
    } else {
        root.PlantUMLRenderer = PlantUMLRenderer;
    }

})(typeof global !== 'undefined' ? global : window);