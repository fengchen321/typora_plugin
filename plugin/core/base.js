// plugin/core/base.js
// 独立插件基类，不依赖外部项目

class BasePlugin {
    constructor(config = {}) {
        this.config = config;
        this.state = 'idle';
    }

    // 生命周期方法
    async beforeProcess() {}
    async init() {}
    async process() {}
    async afterProcess() {}

    // 工具方法
    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }

    error(...args) {
        console.error(`[${this.constructor.name}]`, ...args);
    }

    warn(...args) {
        console.warn(`[${this.constructor.name}]`, ...args);
    }
}

class BaseCustomPlugin extends BasePlugin {
    constructor(config = {}) {
        super(config);
    }

    // 右键菜单提示
    hint() {
        return '';
    }

    // 光标选择器
    selector() {
        return null;
    }

    // 回调方法
    callback(anchorNode) {}

    // 快捷键
    hotkey() {
        return [];
    }

    // 样式
    style() {
        return '';
    }

    // HTML 元素
    html() {
        return '';
    }
}

module.exports = {
    BasePlugin,
    BaseCustomPlugin
};
