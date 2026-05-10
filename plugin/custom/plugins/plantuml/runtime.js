// plugin/custom/plugins/plantuml/runtime.js
// PlantUML 共享运行时

(function(root) {
    'use strict';

    function PlantUMLRuntime(options) {
        options = options || {};

        this.config = options.config || {};
        this.detector = options.detector;
        this.renderer = options.renderer;
        this.ui = options.ui;
        this.autocomplete = options.autocomplete || null;
        this.renderPolicy = options.renderPolicy;
        this.eventBus = options.eventBus;

        this.debounceTimers = new Map();
        this.listeners = [];
        this.hotkeyHandler = null;
        this.styleElement = null;
        this.started = false;
    }

    PlantUMLRuntime.getStyles = function() {
        return `
/* Preview container */
.tp_preview-container { margin: 16px 0; padding: 12px; background: var(--bg-color, #f8f9fa); border-radius: 8px; border: 1px solid var(--border-color, #e9ecef); position: relative; }
.tp_preview-image { max-width: 100%; height: auto; display: block; margin: 0 auto; cursor: pointer; }
.tp_toolbar { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s ease; }
.tp_preview-container:hover .tp_toolbar { opacity: 1; }
.tp_toolbar-btn { padding: 4px 12px; background: var(--btn-bg, white); border: 1px solid var(--btn-border, #dee2e6); border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; color: var(--text-color, #333); }
.tp_toolbar-btn:hover { background: var(--btn-hover-bg, #f1f3f4); }
.tp_error { padding: 16px; background: var(--error-bg, #fff3cd); border: 1px solid var(--error-border, #ffc107); border-radius: 4px; color: var(--error-text, #856404); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tp_error-icon { font-size: 18px; }
.tp_error-message { flex: 1; min-width: 100px; font-family: monospace; word-break: break-word; }
.tp_retry-btn { padding: 4px 12px; background: var(--retry-bg, #ffc107); border: none; border-radius: 4px; cursor: pointer; font-family: inherit; }
.tp_retry-btn:hover { background: var(--retry-hover-bg, #e0a800); }
.tp_loading { display: flex; align-items: center; justify-content: center; padding: 32px; min-height: 100px; }
.tp_loading::after { content: ""; width: 32px; height: 32px; border: 3px solid var(--spinner-border, #e9ecef); border-top-color: var(--spinner-accent, #007bff); border-radius: 50%; animation: tp_spin 1s linear infinite; }
.tp_autocomplete-popup { position: absolute; z-index: 9999; min-width: 180px; padding: 6px; background: var(--menu-bg, #ffffff); border: 1px solid var(--menu-border, #d0d7de); border-radius: 10px; box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18); }
.tp_autocomplete-item { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 10px; background: transparent; border: none; border-radius: 8px; cursor: pointer; text-align: left; font: inherit; color: var(--menu-text, #1f2328); }
.tp_autocomplete-item:hover { background: var(--menu-hover, #f3f4f6); }
.tp_autocomplete-text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.tp_autocomplete-hint { font-size: 12px; color: var(--menu-muted, #6b7280); }
@keyframes tp_spin { to { transform: rotate(360deg); } }
@media (prefers-color-scheme: dark) {
    .tp_preview-container { --bg-color: #2d2d2d; --border-color: #404040; --btn-bg: #3d3d3d; --btn-border: #505050; --btn-hover-bg: #4d4d4d; --text-color: #e0e0e0; --error-bg: #4d3d00; --error-border: #665200; --error-text: #ffd966; --retry-bg: #665200; --retry-hover-bg: #806600; --spinner-border: #404040; --spinner-accent: #4da6ff; --menu-bg: #20242b; --menu-border: #313843; --menu-text: #e5e7eb; --menu-hover: #2d3642; --menu-muted: #9ca3af; }
}`;
    };

    PlantUMLRuntime.prototype.injectStyles = function(doc) {
        var targetDocument = doc || document;
        var existing = targetDocument.getElementById("plantuml-plugin-styles");
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        var style = targetDocument.createElement("style");
        style.id = "plantuml-plugin-styles";
        style.textContent = PlantUMLRuntime.getStyles();
        targetDocument.head.appendChild(style);
        this.styleElement = style;
    };

    PlantUMLRuntime.prototype.start = function() {
        if (this.started) {
            return;
        }

        this.started = true;
        this._bindEvents();
        this._registerHotkey();

        if (this.config.renderMode === "auto" && this.detector && this.detector.start) {
            this.detector.start();
        }
        if (this.autocomplete && this.autocomplete.start) {
            this.autocomplete.start();
        }
    };

    PlantUMLRuntime.prototype.stop = function() {
        if (!this.started) {
            return;
        }

        this.started = false;
        this._unbindEvents();
        this._removeHotkey();

        this.debounceTimers.forEach(function(timer) {
            clearTimeout(timer);
        });
        this.debounceTimers.clear();

        if (this.detector && this.detector.stop) {
            this.detector.stop();
        }
        if (this.autocomplete && this.autocomplete.stop) {
            this.autocomplete.stop();
        }
        if (this.ui && this.ui._removeExitHandlers) {
            this.ui._removeExitHandlers();
        }
    };

    PlantUMLRuntime.prototype.renderCurrentBlock = function() {
        if (!this.detector || !this.detector.findCurrentBlock) {
            return false;
        }

        var block = this.detector.findCurrentBlock();
        if (!block) {
            return false;
        }

        this.renderBlock(block.id, block.content);
        return true;
    };

    PlantUMLRuntime.prototype._on = function(event, handler) {
        this.eventBus.on(event, handler);
        this.listeners.push({ event: event, handler: handler });
    };

    PlantUMLRuntime.prototype._bindEvents = function() {
        var self = this;

        this._on("plantuml:block-detected", function(data) {
            if (self.config.renderMode === "auto") {
                self.renderDebounced(data.blockId, data.content);
            }
        });

        this._on("plantuml:block-updated", function(data) {
            if (self.config.renderMode === "auto") {
                self.renderDebounced(data.blockId, data.content);
            }
        });

        this._on("plantuml:block-removed", function(data) {
            self.cancelDebounced(data.blockId);
            if (self.ui) {
                self.ui.removePreview(data.blockId);
            }
        });

        this._on("plantuml:refresh-requested", function(data) {
            var block = self.detector && self.detector.getBlock ? self.detector.getBlock(data.blockId) : null;
            if (!block) {
                return;
            }

            var newContent = self.detector._extractContent(block.element);
            block.content = newContent;
            self.renderBlock(data.blockId, newContent);
        });

        this._on("plantuml:exit-edit", function(data) {
            var block = self.detector && self.detector.getBlock ? self.detector.getBlock(data.blockId) : null;
            if (!block) {
                return;
            }

            var newContent = self.detector._extractContent(block.element);
            block.content = newContent;
            self.renderBlock(data.blockId, newContent);
        });
    };

    PlantUMLRuntime.prototype._unbindEvents = function() {
        while (this.listeners.length) {
            var listener = this.listeners.pop();
            this.eventBus.off(listener.event, listener.handler);
        }
    };

    PlantUMLRuntime.prototype._registerHotkey = function() {
        if (this.hotkeyHandler || !this.config.hotkey || typeof document === "undefined") {
            return;
        }

        var self = this;
        this.hotkeyHandler = function(e) {
            var hotkey = self.config.hotkey.toLowerCase();
            var keys = hotkey.split("+");

            var ctrl = keys.includes("ctrl") || keys.includes("control");
            var alt = keys.includes("alt");
            var shift = keys.includes("shift");
            var key = keys[keys.length - 1];

            if (e.ctrlKey === ctrl &&
                e.altKey === alt &&
                e.shiftKey === shift &&
                e.key.toLowerCase() === key) {

                e.preventDefault();

                var block = self.detector && self.detector.findCurrentBlock ? self.detector.findCurrentBlock() : null;
                if (block) {
                    self.eventBus.emit("plantuml:refresh-requested", { blockId: block.id });
                }
            }
        };

        document.addEventListener("keydown", this.hotkeyHandler);
    };

    PlantUMLRuntime.prototype._removeHotkey = function() {
        if (!this.hotkeyHandler || typeof document === "undefined") {
            return;
        }

        document.removeEventListener("keydown", this.hotkeyHandler);
        this.hotkeyHandler = null;
    };

    PlantUMLRuntime.prototype.cancelDebounced = function(blockId) {
        if (!this.debounceTimers.has(blockId)) {
            return;
        }

        clearTimeout(this.debounceTimers.get(blockId));
        this.debounceTimers.delete(blockId);
    };

    PlantUMLRuntime.prototype.renderDebounced = function(blockId, content) {
        var self = this;

        this.cancelDebounced(blockId);
        this.debounceTimers.set(blockId, setTimeout(function() {
            self.renderBlock(blockId, content);
            self.debounceTimers.delete(blockId);
        }, this.config.debounceDelay));
    };

    PlantUMLRuntime.prototype.renderBlock = async function(blockId, content) {
        var block = this.detector && this.detector.getBlock ? this.detector.getBlock(blockId) : null;
        if (!block) {
            return;
        }

        var normalizedContent = this.renderPolicy.normalizeContent(content);
        if (!this.renderPolicy.shouldRender(normalizedContent)) {
            block.state = "pending";
            if (this.ui) {
                this.ui.removePreview(blockId);
            }
            return;
        }

        try {
            block.state = "rendering";
            if (this.ui) {
                this.ui.showLoading(blockId);
            }

            var imageUrl = await this.renderer.render(normalizedContent);
            if (this.ui) {
                this.ui.createPreview(blockId, block.element, imageUrl);
            }
            block.state = "rendered";
        } catch (error) {
            block.state = "error";
            if (this.ui) {
                this.ui.showError(blockId, error);
            }
            console.error("[PlantUML Plugin] Render error [" + blockId + "]:", error);
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PlantUMLRuntime;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return PlantUMLRuntime; });
    } else {
        root.PlantUMLRuntime = PlantUMLRuntime;
    }

})(typeof global !== 'undefined' ? global : window);
