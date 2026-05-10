// plugin/custom/plugins/plantuml/index.js
// 独立插件，不依赖 typora_plugin 项目

const NamespaceManager = require("../core/namespace");
const EventBus = require("../core/eventBus");
const ConfigManager = require("../core/configManager");
const defaultConfig = require("./config");
const PlantUMLDetector = require("./detector");
const PlantUMLRenderer = require("./renderer");
const PlantUMLUIController = require("./uiController");
const PlantUMLAutocomplete = require("./autocomplete");
const RenderPolicy = require("./renderPolicy");
const PlantUMLRuntime = require("./runtime");

class PlantUMLPlugin {
    constructor(config = {}) {
        this.config = { ...defaultConfig, ...config };
        this.configManager = null;
        this.detector = null;
        this.renderer = null;
        this.ui = null;
        this.autocomplete = null;
        this.runtime = null;
        this.ns = NamespaceManager;
    }

    // 样式（内联 CSS）
    style() {
        return PlantUMLRuntime.getStyles();
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
        this.autocomplete = new PlantUMLAutocomplete(this.config);
        this.runtime = new PlantUMLRuntime({
            config: this.config,
            detector: this.detector,
            renderer: this.renderer,
            ui: this.ui,
            autocomplete: this.autocomplete,
            renderPolicy: RenderPolicy,
            eventBus: EventBus
        });
        this.runtime.injectStyles(document);
    }

    // 生命周期：主处理
    process() {
        if (this.runtime) {
            this.runtime.start();
            console.log("[PlantUML Plugin] Runtime started");
        }
    }

    // 生命周期：清理
    afterProcess() {
        if (this.runtime) {
            this.runtime.stop();
        }
    }

    // 手动触发回调
    callback(anchorNode) {
        if (!this.detector) {
            console.warn("[PlantUML Plugin] Plugin not initialized");
            return;
        }

        if (!this.runtime || !this.runtime.renderCurrentBlock()) {
            console.log("[PlantUML Plugin] No PlantUML code block found at cursor position");
        }
    }
}

module.exports = { plugin: PlantUMLPlugin };
