// plugin/custom/plugins/plantuml/detector.js
// PlantUML 代码块检测器 - UMD 模块

(function(root) {
    'use strict';

    // 植入依赖
    var NamespaceManager = root.NamespaceManager;
    var EventBus = root.EventBus;

    if (!NamespaceManager || !EventBus) {
        console.error('[PlantUML Detector] Missing dependencies: NamespaceManager or EventBus');
        return;
    }

    function PlantUMLDetector() {
        this.observer = null;
        this.blocks = new Map();
        this.ns = NamespaceManager;
    }

    PlantUMLDetector.prototype.start = function() {
        var self = this;
        var editor = document.querySelector("#write");
        if (!editor) {
            console.error("[PlantUML Detector] Editor #write not found");
            return;
        }

        console.log("[PlantUML Detector] Starting, editor found:", editor);

        // 先启动观察器
        this.observer = new MutationObserver(function(mutations) {
            self._handleMutations(mutations);
        });

        this.observer.observe(editor, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "lang"]
        });

        console.log("[PlantUML Detector] Observer started");

        // 延迟扫描现有代码块（等待 CodeMirror 渲染完成）
        setTimeout(function() {
            console.log("[PlantUML Detector] Running delayed scan...");
            self._scanExistingBlocks();
        }, 1000);
    };

    PlantUMLDetector.prototype.stop = function() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.blocks.clear();
    };

    PlantUMLDetector.prototype._scanExistingBlocks = function() {
        var self = this;
        // Typora 使用 lang="plantuml" 而不是 data-lang="plantuml"
        var blocks = document.querySelectorAll('pre.md-fences[lang="plantuml"]');
        console.log("[PlantUML Detector] Scanning, found blocks:", blocks.length);
        blocks.forEach(function(block) {
            self._registerBlock(block);
        });
    };

    PlantUMLDetector.prototype._handleMutations = function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            if (mutation.type === "childList") {
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    this._checkNode(mutation.addedNodes[j]);
                }
            } else if (mutation.type === "attributes") {
                this._checkNode(mutation.target);
            }
        }
    };

    PlantUMLDetector.prototype._checkNode = function(node) {
        if (!node.querySelectorAll && !node.matches) return;

        var blocks;
        if (node.querySelectorAll) {
            blocks = node.querySelectorAll('pre.md-fences[lang="plantuml"]');
        }
        if (!blocks && node.matches && node.matches('pre.md-fences[lang="plantuml"]')) {
            blocks = [node];
        }

        if (blocks) {
            for (var i = 0; i < blocks.length; i++) {
                this._registerBlock(blocks[i]);
            }
        }
    };

    PlantUMLDetector.prototype._registerBlock = function(element) {
        // 跳过已注册的块
        if (element.hasAttribute(this.ns.dataAttr("block-id"))) {
            console.log("[PlantUML Detector] Block already registered, skipping");
            return;
        }

        var blockId = this._generateId();
        element.setAttribute(this.ns.dataAttr("block-id"), blockId);

        var content = this._extractContent(element);
        this.blocks.set(blockId, { element: element, content: content, state: "pending" });

        console.log("[PlantUML Detector] Registered block:", blockId, "content length:", content.length);

        // 如果 CodeMirror 还没渲染完成，延迟重新提取和渲染
        var cmContent = element.querySelector(".CodeMirror-code");
        if (!cmContent) {
            console.log("[PlantUML Detector] CodeMirror not ready, scheduling retry...");
            var self = this;
            setTimeout(function() {
                var newContent = self._extractContent(element);
                if (newContent !== content && newContent.length > content.length) {
                    console.log("[PlantUML Detector] Retry extraction, new length:", newContent.length);
                    var block = self.blocks.get(blockId);
                    if (block) {
                        block.content = newContent;
                        EventBus.emit("plantuml:block-detected", { blockId: blockId, content: newContent });
                    }
                }
            }, 500);
            return;
        }

        // 发送事件
        EventBus.emit("plantuml:block-detected", { blockId: blockId, content: content });
    };

    PlantUMLDetector.prototype._extractContent = function(element) {
        console.log("[PlantUML Detector] Extracting content from element:", element);

        // 优先从 CodeMirror 实例获取原始文本，避免从渲染后的 DOM 中读到 NBSP 等占位字符。
        var codeMirrorValue = this._getCodeMirrorValue(element);
        if (codeMirrorValue != null) {
            console.log("[PlantUML Detector] Using CodeMirror instance value, length:", codeMirrorValue.length);
            return codeMirrorValue;
        }

        // Typora 使用 CodeMirror 来渲染代码块
        var cmContent = element.querySelector(".CodeMirror-code");
        console.log("[PlantUML Detector] CodeMirror-code element:", cmContent);

        if (cmContent) {
            var lines = cmContent.querySelectorAll(".CodeMirror-line");
            console.log("[PlantUML Detector] Found CodeMirror lines:", lines.length);
            var contents = [];
            for (var i = 0; i < lines.length; i++) {
                var lineText = this._normalizeLineText(lines[i].textContent);
                console.log("[PlantUML Detector] Line", i, ":", lineText.substring(0, 50));
                contents.push(lineText);
            }
            var result = this._normalizeExtractedContent(contents.join("\n"));
            console.log("[PlantUML Detector] Extracted content length:", result.length);
            return result;
        }

        // 备选方案：尝试从 innerHTML 解析行
        var codeElement = element.querySelector("code") || element;

        // 方法1：通过 <br> 标签分割
        var html = codeElement.innerHTML;
        if (html && html.indexOf("<br") !== -1) {
            console.log("[PlantUML Detector] Using <br> split method");
            var tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            var textContent = this._normalizeExtractedContent(tempDiv.textContent || tempDiv.innerText || "");
            console.log("[PlantUML Detector] Fallback text content length:", textContent.length);
            return textContent;
        }

        // 方法2：直接文本内容
        var textContent = this._normalizeExtractedContent(codeElement.textContent || "");
        console.log("[PlantUML Detector] Fallback text content length:", textContent.length);
        return textContent;
    };

    PlantUMLDetector.prototype._getCodeMirrorValue = function(element) {
        var cmElement = element.querySelector(".CodeMirror");
        var cm = cmElement && cmElement.CodeMirror;
        if (!cm || typeof cm.getValue !== "function") {
            return null;
        }

        try {
            return this._normalizeExtractedContent(cm.getValue());
        } catch (error) {
            console.warn("[PlantUML Detector] Failed to read CodeMirror value:", error);
            return null;
        }
    };

    PlantUMLDetector.prototype._normalizeLineText = function(text) {
        return String(text || "")
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
            .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ");
    };

    PlantUMLDetector.prototype._normalizeExtractedContent = function(text) {
        return this._normalizeLineText(text)
            .replace(/\r\n?/g, "\n")
            .replace(/^\n+|\n+$/g, "");
    };

    PlantUMLDetector.prototype._generateId = function() {
        return "plantuml-" + Date.now() + "-" + Math.random().toString(36).substring(2, 11);
    };

    PlantUMLDetector.prototype.getBlock = function(blockId) {
        return this.blocks.get(blockId);
    };

    PlantUMLDetector.prototype.updateBlockContent = function(blockId) {
        var block = this.blocks.get(blockId);
        if (!block) return;

        var newContent = this._extractContent(block.element);

        // 只在内容变化时发送事件
        if (newContent !== block.content) {
            block.content = newContent;
            block.state = "modified";
            EventBus.emit("plantuml:block-updated", { blockId: blockId, content: newContent });
        }
    };

    PlantUMLDetector.prototype.findCurrentBlock = function() {
        var activeElement = document.activeElement;
        if (!activeElement) return null;

        var block = activeElement.closest('pre.md-fences[data-lang="plantuml"]');
        if (!block) return null;

        var blockId = block.getAttribute(this.ns.dataAttr("block-id"));
        if (blockId) {
            var blockData = this.blocks.get(blockId);
            return blockData ? { id: blockId, element: blockData.element, content: blockData.content } : null;
        }
        return null;
    };

    // UMD 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PlantUMLDetector;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return PlantUMLDetector; });
    } else {
        root.PlantUMLDetector = PlantUMLDetector;
    }

})(typeof global !== 'undefined' ? global : window);
