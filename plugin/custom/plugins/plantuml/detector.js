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

        // 初始扫描（延迟执行，等待 Typora 渲染完成）
        setTimeout(function() {
            self._scanExistingBlocks();
        }, 500);

        // 启动观察器
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

        // 发送事件
        EventBus.emit("plantuml:block-detected", { blockId: blockId, content: content });
    };

    PlantUMLDetector.prototype._extractContent = function(element) {
        console.log("[PlantUML Detector] Extracting content from element:", element);

        // Typora 使用 CodeMirror 来渲染代码块
        var cmContent = element.querySelector(".CodeMirror-code");
        console.log("[PlantUML Detector] CodeMirror-code element:", cmContent);

        if (cmContent) {
            var lines = cmContent.querySelectorAll(".CodeMirror-line");
            console.log("[PlantUML Detector] Found CodeMirror lines:", lines.length);
            var contents = [];
            for (var i = 0; i < lines.length; i++) {
                var lineText = lines[i].textContent;
                console.log("[PlantUML Detector] Line", i, ":", lineText.substring(0, 50));
                contents.push(lineText);
            }
            var result = contents.join("\n");
            console.log("[PlantUML Detector] Extracted content length:", result.length);
            return result;
        }

        // 备选方案：直接文本内容
        var codeElement = element.querySelector("code") || element;
        var textContent = codeElement.textContent || "";
        console.log("[PlantUML Detector] Fallback text content length:", textContent.length);
        return textContent;
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