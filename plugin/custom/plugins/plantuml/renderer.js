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

        // 1. UTF-8 编码并 Deflate 压缩（使用 deflate 而非 deflateRaw）
        var buffer = Buffer.from(text, "utf-8");
        var compressed = zlib.deflateSync(buffer);

        console.log("[PlantUML Renderer] Compressed length:", compressed.length);

        // 2. 转换为标准 base64
        var base64 = compressed.toString("base64");
        console.log("[PlantUML Renderer] Base64 length:", base64.length);

        // 3. 映射到 PlantUML 自定义字符集
        var result = "";
        for (var i = 0; i < base64.length; i++) {
            var c = base64[i];
            var code = c.charCodeAt(0);
            if (c >= "A" && c <= "Z") {
                result += UML_CHARS[code - 65 + 10];
            } else if (c >= "a" && c <= "z") {
                result += UML_CHARS[code - 97 + 36];
            } else if (c >= "0" && c <= "9") {
                result += UML_CHARS[code - 48];
            } else if (c === "+") {
                result += "-";
            } else if (c === "/") {
                result += "_";
            } else if (c === "=") {
                // PlantUML 不需要 padding
                continue;
            } else {
                result += c;
            }
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

        // 编码并构建 URL
        var encoded = this.encode(content);
        // 添加 ~1 前缀表示使用 deflate 压缩
        var url = this.config.serverUrl + "/" + this.config.outputFormat + "/~1" + encoded;

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