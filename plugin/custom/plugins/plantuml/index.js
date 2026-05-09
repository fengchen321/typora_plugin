// plugin/custom/plugins/plantuml/index.js

const NamespaceManager = require("../core/namespace");
const EventBus = require("../core/eventBus");
const ConfigManager = require("../core/configManager");
const defaultConfig = require("./config");
const PlantUMLDetector = require("./detector");
const PlantUMLRenderer = require("./renderer");
const PlantUMLUIController = require("./uiController");

class PlantUMLPlugin extends BaseCustomPlugin {
    constructor() {
        super();
        this.configManager = null;
        this.detector = null;
        this.renderer = null;
        this.ui = null;
        this.ns = NamespaceManager;
        this.debounceTimers = new Map();
    }

    // Plugin configuration
    selector = () => null; // Available everywhere

    style = () => `
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
@keyframes tp_spin { to { transform: rotate(360deg); } }
@media (prefers-color-scheme: dark) {
    .tp_preview-container { --bg-color: #2d2d2d; --border-color: #404040; --btn-bg: #3d3d3d; --btn-border: #505050; --btn-hover-bg: #4d4d4d; --text-color: #e0e0e0; --error-bg: #4d3d00; --error-border: #665200; --error-text: #ffd966; --retry-bg: #665200; --retry-hover-bg: #806600; --spinner-border: #404040; --spinner-accent: #4da6ff; }
}`;

    html = () => null;

    hotkey = () => [this.config.hotkey];

    hint = () => "Render PlantUML diagram";

    // Lifecycle: Initialize
    init = () => {
        // Create config manager
        this.configManager = ConfigManager.create("plantuml_plugin_config", defaultConfig);

        // Get merged config (default + user overrides)
        this.config = this.configManager.getAll();

        // Initialize modules
        this.detector = new PlantUMLDetector();
        this.renderer = new PlantUMLRenderer(this.config);
        this.ui = new PlantUMLUIController();

        // Bind events
        this._bindEvents();
    };

    // Lifecycle: Main processing
    process = () => {
        // Start detector if in auto mode
        if (this.config.renderMode === "auto") {
            this.detector.start();
        }
    };

    // Callback: Manual trigger from menu/hotkey
    callback = (anchorNode) => {
        const block = this.detector.findCurrentBlock();
        if (block) {
            this._renderBlock(block.id, block.content);
        } else {
            this.utils.notification.show("No PlantUML code block found");
        }
    };

    // Bind EventBus listeners
    _bindEvents = () => {
        // New block detected
        EventBus.on("plantuml:block-detected", ({ blockId, content }) => {
            if (this.config.renderMode === "auto") {
                this._renderBlockDebounced(blockId, content);
            }
        });

        // Block content updated
        EventBus.on("plantuml:block-updated", ({ blockId, content }) => {
            if (this.config.renderMode === "auto") {
                this._renderBlockDebounced(blockId, content);
            }
        });

        // Manual refresh requested
        EventBus.on("plantuml:refresh-requested", ({ blockId }) => {
            const block = this.detector.getBlock(blockId);
            if (block) {
                this._renderBlock(blockId, block.content);
            }
        });

        // Exit edit mode
        EventBus.on("plantuml:exit-edit", ({ blockId }) => {
            this.detector.updateBlockContent(blockId);
        });
    };

    // Render a block
    _renderBlock = async (blockId, content) => {
        const block = this.detector.getBlock(blockId);
        if (!block) return;

        try {
            block.state = "rendering";
            this.ui.showLoading(blockId);

            const imageUrl = await this.renderer.render(content);
            this.ui.createPreview(blockId, block.element, imageUrl);

            block.state = "rendered";
        } catch (error) {
            block.state = "error";
            this.ui.showError(blockId, error);
            console.error(`PlantUML render error [${blockId}]:`, error);
        }
    };

    // Debounced render for real-time preview
    _renderBlockDebounced = (blockId, content) => {
        // Clear existing timer
        if (this.debounceTimers.has(blockId)) {
            clearTimeout(this.debounceTimers.get(blockId));
        }

        // Set new timer
        this.debounceTimers.set(blockId, setTimeout(() => {
            this._renderBlock(blockId, content);
            this.debounceTimers.delete(blockId);
        }, this.config.debounceDelay));
    };

    // Cleanup
    afterProcess = () => {
        // Clean up debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    };
}

module.exports = { plugin: PlantUMLPlugin };