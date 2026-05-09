// plugin/custom/plugins/plantuml/index.js
// 独立插件，不依赖 typora_plugin 项目

const NamespaceManager = require("../core/namespace");
const EventBus = require("../core/eventBus");
const ConfigManager = require("../core/configManager");
const defaultConfig = require("./config");
const PlantUMLDetector = require("./detector");
const PlantUMLRenderer = require("./renderer");
const PlantUMLUIController = require("./uiController");

class PlantUMLPlugin {
    constructor(config = {}) {
        this.config = { ...defaultConfig, ...config };
        this.configManager = null;
        this.detector = null;
        this.renderer = null;
        this.ui = null;
        this.ns = NamespaceManager;
        this.debounceTimers = new Map();
    }

    // 样式（内联 CSS）
    style() {
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
@keyframes tp_spin { to { transform: rotate(360deg); } }
@media (prefers-color-scheme: dark) {
    .tp_preview-container { --bg-color: #2d2d2d; --border-color: #404040; --btn-bg: #3d3d3d; --btn-border: #505050; --btn-hover-bg: #4d4d4d; --text-color: #e0e0e0; --error-bg: #4d3d00; --error-border: #665200; --error-text: #ffd966; --retry-bg: #665200; --retry-hover-bg: #806600; --spinner-border: #404040; --spinner-accent: #4da6ff; }
}`;
    }

    // 提示文本
    hint() {
        return "Render PlantUML diagram";
    }

    // 生命周期：初始化前
    async beforeProcess() {
        // 创建配置管理器
        this.configManager = ConfigManager.create("plantuml_plugin_config", defaultConfig);
        this.config = this.configManager.getAll();
    }

    // 生命周期：初始化
    init() {
        // 初始化模块
        this.detector = new PlantUMLDetector();
        this.renderer = new PlantUMLRenderer(this.config);
        this.ui = new PlantUMLUIController();

        // 注入样式
        this._injectStyles();

        // 绑定事件
        this._bindEvents();
    }

    // 生命周期：主处理
    process() {
        // 自动模式下启动检测器
        if (this.config.renderMode === "auto") {
            this.detector.start();
            console.log("[PlantUML Plugin] Auto render mode enabled");
        }
    }

    // 生命周期：清理
    afterProcess() {
        // 清理防抖定时器
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        // 停止检测器
        if (this.detector) {
            this.detector.stop();
        }
    }

    // 手动触发回调
    callback(anchorNode) {
        if (!this.detector) {
            console.warn("[PlantUML Plugin] Plugin not initialized");
            return;
        }

        const block = this.detector.findCurrentBlock();
        if (block) {
            this._renderBlock(block.id, block.content);
        } else {
            console.log("[PlantUML Plugin] No PlantUML code block found at cursor position");
        }
    }

    // 注入样式
    _injectStyles() {
        const styleEl = document.createElement("style");
        styleEl.id = "plantuml-plugin-styles";
        styleEl.textContent = this.style();
        document.head.appendChild(styleEl);
    }

    // 绑定 EventBus 事件
    _bindEvents() {
        // 新代码块检测
        EventBus.on("plantuml:block-detected", ({ blockId, content }) => {
            if (this.config.renderMode === "auto") {
                this._renderBlockDebounced(blockId, content);
            }
        });

        // 代码块内容更新
        EventBus.on("plantuml:block-updated", ({ blockId, content }) => {
            if (this.config.renderMode === "auto") {
                this._renderBlockDebounced(blockId, content);
            }
        });

        // 手动刷新请求
        EventBus.on("plantuml:refresh-requested", ({ blockId }) => {
            const block = this.detector.getBlock(blockId);
            if (block) {
                this._renderBlock(blockId, block.content);
            }
        });

        // 退出编辑模式
        EventBus.on("plantuml:exit-edit", ({ blockId }) => {
            this.detector.updateBlockContent(blockId);
        });
    }

    // 渲染代码块
    async _renderBlock(blockId, content) {
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
            console.error(`[PlantUML Plugin] Render error [${blockId}]:`, error);
        }
    }

    // 防抖渲染
    _renderBlockDebounced(blockId, content) {
        // 清除现有定时器
        if (this.debounceTimers.has(blockId)) {
            clearTimeout(this.debounceTimers.get(blockId));
        }

        // 设置新定时器
        this.debounceTimers.set(blockId, setTimeout(() => {
            this._renderBlock(blockId, content);
            this.debounceTimers.delete(blockId);
        }, this.config.debounceDelay));
    }
}

module.exports = { plugin: PlantUMLPlugin };
