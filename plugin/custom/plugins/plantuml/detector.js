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

    PlantUMLDetector.prototype._plantUMLSelector = function() {
        return 'pre.md-fences[lang="plantuml"]';
    };

    PlantUMLDetector.prototype._trackedBlockSelector = function() {
        return 'pre.md-fences[' + this.ns.dataAttr("block-id") + ']';
    };

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
            characterData: true,
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
        var blocks = document.querySelectorAll(this._plantUMLSelector());
        console.log("[PlantUML Detector] Scanning, found blocks:", blocks.length);
        blocks.forEach(function(block) {
            self._registerBlock(block);
        });
    };

    PlantUMLDetector.prototype._handleMutations = function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            if (mutation.type === "childList") {
                var addedNodes = mutation.addedNodes || [];
                var removedNodes = mutation.removedNodes || [];

                for (var j = 0; j < addedNodes.length; j++) {
                    this._checkNode(addedNodes[j]);
                }
                for (var k = 0; k < removedNodes.length; k++) {
                    this._handleRemovedNode(removedNodes[k]);
                }
                this._handlePotentialContentChange(mutation.target);
            } else if (mutation.type === "characterData") {
                this._handlePotentialContentChange(mutation.target);
            } else if (mutation.type === "attributes") {
                this._handleAttributeMutation(mutation.target);
            }
        }
    };

    PlantUMLDetector.prototype._checkNode = function(node) {
        if (!node.querySelectorAll && !node.matches) return;

        var blocks = this._collectPlantUMLBlocks(node);

        for (var i = 0; i < blocks.length; i++) {
            this._registerBlock(blocks[i]);
        }
    };

    PlantUMLDetector.prototype._collectPlantUMLBlocks = function(node) {
        var selector = this._plantUMLSelector();
        var blocks = [];

        if (node.matches && node.matches(selector)) {
            blocks.push(node);
        }

        if (node.querySelectorAll) {
            var descendants = node.querySelectorAll(selector);
            for (var i = 0; i < descendants.length; i++) {
                blocks.push(descendants[i]);
            }
        }

        return blocks;
    };

    PlantUMLDetector.prototype._collectTrackedBlocks = function(node) {
        var selector = this._trackedBlockSelector();
        var blocks = [];

        if (node.matches && node.matches(selector)) {
            blocks.push(node);
        }

        if (node.querySelectorAll) {
            var descendants = node.querySelectorAll(selector);
            for (var i = 0; i < descendants.length; i++) {
                blocks.push(descendants[i]);
            }
        }

        return blocks;
    };

    PlantUMLDetector.prototype._handleAttributeMutation = function(node) {
        var trackedBlock = this._findTrackedBlockElement(node);
        if (trackedBlock && !this._isPlantUMLBlock(trackedBlock)) {
            this._unregisterBlockByElement(trackedBlock);
            return;
        }

        this._checkNode(node);
        this._handlePotentialContentChange(node);
    };

    PlantUMLDetector.prototype._handleRemovedNode = function(node) {
        var blocks = this._collectTrackedBlocks(node);
        for (var i = 0; i < blocks.length; i++) {
            this._unregisterBlockByElement(blocks[i]);
        }
    };

    PlantUMLDetector.prototype._handlePotentialContentChange = function(node) {
        var blockElement = this._findPlantUMLBlockElement(node);
        if (!blockElement) {
            return;
        }

        var blockId = blockElement.getAttribute(this.ns.dataAttr("block-id"));
        if (!blockId) {
            return;
        }

        this.updateBlockContent(blockId);
    };

    PlantUMLDetector.prototype._findClosest = function(node, selector) {
        var current = node;
        if (current && current.nodeType !== 1) {
            current = current.parentElement || current.parentNode;
        }

        while (current) {
            if (current.matches && current.matches(selector)) {
                return current;
            }
            current = current.parentElement || current.parentNode;
        }

        return null;
    };

    PlantUMLDetector.prototype._findPlantUMLBlockElement = function(node) {
        return this._findClosest(node, this._plantUMLSelector());
    };

    PlantUMLDetector.prototype._findTrackedBlockElement = function(node) {
        return this._findClosest(node, this._trackedBlockSelector());
    };

    PlantUMLDetector.prototype._isPlantUMLBlock = function(node) {
        return !!(node && node.matches && node.matches(this._plantUMLSelector()));
    };

    PlantUMLDetector.prototype._unregisterBlockByElement = function(element) {
        if (!element) {
            return;
        }

        var blockId = element.getAttribute(this.ns.dataAttr("block-id"));
        if (!blockId) {
            return;
        }

        this.blocks.delete(blockId);
        EventBus.emit("plantuml:block-removed", { blockId: blockId });

        if (element.removeAttribute) {
            element.removeAttribute(this.ns.dataAttr("block-id"));
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
        var selection = typeof window !== "undefined" && window.getSelection ? window.getSelection() : null;
        var activeElement = typeof document !== "undefined" ? document.activeElement : null;
        var block = null;

        if (selection && selection.rangeCount) {
            block = this._findPlantUMLBlockElement(selection.anchorNode || selection.focusNode);
        }
        if (!block && activeElement) {
            block = this._findPlantUMLBlockElement(activeElement);
        }
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
