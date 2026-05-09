// plugin/index.js
// Typora PlantUML 插件加载器
// 独立使用，不依赖外部项目

(function() {
    'use strict';

    // 等待 Typora 加载完成
    window.addEventListener('load', function() {
        console.log(`
  ______                        ___  __          _
 /_  __/_ _____  ___  _______ _/ _ \\/ /_ _____ _(_)__)
  / / / // / _ \\/ _ \\/ __/ _ \`/ ___/ / // / _ \`/ / _ \\
 /_/  \\_, / .__/\\___/_/  \\_,_/_/  /_/\\_,_/\\_, /_/_//_/
     /___/_/                             /___/

       PlantUML Plugin for Typora
        `);

        initPlugin();
    });

    async function initPlugin() {
        try {
            // 加载核心模块
            const { BaseCustomPlugin } = require('./core/base');
            const NamespaceManager = require('./custom/plugins/core/namespace');
            const EventBus = require('./custom/plugins/core/eventBus');
            const ConfigManager = require('./custom/plugins/core/configManager');

            // 注册全局变量（供插件使用）
            global.BaseCustomPlugin = BaseCustomPlugin;
            global.NamespaceManager = NamespaceManager;
            global.EventBus = EventBus;

            // 加载配置
            const defaultConfig = require('./custom/plugins/plantuml/config');
            const configManager = ConfigManager.create('plantuml_plugin_config', defaultConfig);
            const config = configManager.getAll();

            // 注入样式
            injectStyles();

            // 加载插件
            const { plugin: PlantUMLPlugin } = require('./custom/plugins/plantuml/index');
            const pluginInstance = new PlantUMLPlugin(config);

            // 生命周期
            await pluginInstance.beforeProcess();
            pluginInstance.init();
            pluginInstance.process();

            // 注册快捷键
            registerHotkey(pluginInstance, config);

            // 保存实例供调试
            global.__plantuml_plugin__ = pluginInstance;

            console.log('[PlantUML Plugin] Loaded successfully');

        } catch (error) {
            console.error('[PlantUML Plugin] Failed to load:', error);
        }
    }

    function injectStyles() {
        // 基础样式已内联在插件中，这里可以添加全局样式
        const style = document.createElement('style');
        style.id = 'plantuml-plugin-styles';
        style.textContent = `
            /* 全局样式变量 */
            :root {
                --tp-primary: #007bff;
                --tp-danger: #dc3545;
                --tp-warning: #ffc107;
                --tp-success: #28a745;
            }
        `;
        document.head.appendChild(style);
    }

    function registerHotkey(plugin, config) {
        if (!config.hotkey) return;

        document.addEventListener('keydown', function(e) {
            const hotkey = config.hotkey.toLowerCase();
            const keys = hotkey.split('+');

            let ctrl = keys.includes('ctrl') || keys.includes('control');
            let alt = keys.includes('alt');
            let shift = keys.includes('shift');
            let key = keys[keys.length - 1];

            if (e.ctrlKey === ctrl &&
                e.altKey === alt &&
                e.shiftKey === shift &&
                e.key.toLowerCase() === key) {

                e.preventDefault();
                const anchorNode = document.activeElement;
                plugin.callback(anchorNode);
            }
        });

        console.log(`[PlantUML Plugin] Hotkey registered: ${config.hotkey}`);
    }

})();
