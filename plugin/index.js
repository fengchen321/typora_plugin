// plugin/index.js
// Typora PlantUML 插件加载器
// 独立使用，不依赖外部项目

(function() {
    'use strict';

    // Typora/Electron 环境下的 require
    // 使用 global.reqnode (Typora 特有) 或 global.require
    const reqnode = global.reqnode || global.require;

    // 如果 reqnode 不可用，尝试普通 require（某些环境）
    const _require = typeof reqnode === 'function' ? reqnode :
                     typeof require === 'function' ? require : null;

    if (!_require) {
        console.error('[PlantUML Plugin] Cannot find require function. Are you running in Typora?');
        return;
    }

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

    function initPlugin() {
        try {
            // 获取插件目录路径
            const path = _require('path');
            const pluginDir = getPluginDir(path);

            if (!pluginDir) {
                console.error('[PlantUML Plugin] Cannot determine plugin directory');
                return;
            }

            console.log('[PlantUML Plugin] Plugin directory:', pluginDir);

            // 加载核心模块
            const NamespaceManager = loadModule(path.join(pluginDir, 'custom/plugins/core/namespace.js'));
            const EventBus = loadModule(path.join(pluginDir, 'custom/plugins/core/eventBus.js'));
            const ConfigManager = loadModule(path.join(pluginDir, 'custom/plugins/core/configManager.js'));

            // 注册全局变量
            global.NamespaceManager = NamespaceManager;
            global.EventBus = EventBus;

            // 加载配置
            const defaultConfig = loadModule(path.join(pluginDir, 'custom/plugins/plantuml/config.js'));
            const configManager = ConfigManager.create('plantuml_plugin_config', defaultConfig);
            const config = configManager.getAll();

            // 加载插件模块
            const Detector = loadModule(path.join(pluginDir, 'custom/plugins/plantuml/detector.js'));
            const Renderer = loadModule(path.join(pluginDir, 'custom/plugins/plantuml/renderer.js'));
            const UIController = loadModule(path.join(pluginDir, 'custom/plugins/plantuml/uiController.js'));
            const Autocomplete = loadModule(path.join(pluginDir, 'custom/plugins/plantuml/autocomplete.js'));
            const RenderPolicy = loadModule(path.join(pluginDir, 'custom/plugins/plantuml/renderPolicy.js'));
            const Runtime = loadModule(path.join(pluginDir, 'custom/plugins/plantuml/runtime.js'));

            // 创建插件实例
            const detector = new Detector();
            const renderer = new Renderer(config);
            const ui = new UIController();
            const autocomplete = new Autocomplete(config);
            const runtime = new Runtime({
                config: config,
                detector: detector,
                renderer: renderer,
                ui: ui,
                autocomplete: autocomplete,
                renderPolicy: RenderPolicy,
                eventBus: EventBus
            });

            // 注入样式
            runtime.injectStyles(document);
            runtime.start();

            // 保存引用供调试
            global.__plantuml_plugin__ = {
                detector,
                renderer,
                ui,
                autocomplete,
                runtime,
                renderPolicy: RenderPolicy,
                config,
                configManager
            };

            console.log('[PlantUML Plugin] Loaded successfully');

        } catch (error) {
            console.error('[PlantUML Plugin] Failed to load:', error);
            console.error(error.stack);
        }
    }

    function getPluginDir(path) {
        const fs = _require('fs');
        const process = _require('process');
        const os = _require('os');

        let candidatePaths = [];

        // 方式1: 从 __dirname 推导（最可靠）
        // __dirname = D:\Application\Typora\resources\electron.asar\renderer
        // plugin 目录 = D:\Application\Typora\resources\plugin
        if (typeof __dirname !== 'undefined') {
            console.log('[PlantUML Plugin] __dirname:', __dirname);
            // electron.asar/renderer -> electron.asar -> resources
            const resourcesDir = path.dirname(path.dirname(__dirname));
            console.log('[PlantUML Plugin] resourcesDir:', resourcesDir);
            candidatePaths.push(path.join(resourcesDir, 'plugin'));
        }

        // 方式2: 检查用户数据目录
        if (process.platform === 'win32') {
            candidatePaths.push(
                path.join(process.env.APPDATA || '', 'Typora', 'plugin'),
                path.join(process.env.LOCALAPPDATA || '', 'Typora', 'plugin')
            );
        } else if (process.platform === 'darwin') {
            candidatePaths.push(
                path.join(os.homedir(), 'Library', 'Application Support', 'Typora', 'plugin')
            );
        } else {
            candidatePaths.push(
                path.join(os.homedir(), '.config', 'Typora', 'plugin')
            );
        }

        // 查找存在的插件目录
        console.log('[PlantUML Plugin] Candidate paths:', candidatePaths);
        for (const pluginPath of candidatePaths) {
            try {
                console.log('[PlantUML Plugin] Checking:', pluginPath);
                if (fs.existsSync(pluginPath)) {
                    const indexPath = path.join(pluginPath, 'index.js');
                    if (fs.existsSync(indexPath)) {
                        console.log('[PlantUML Plugin] Found valid plugin dir:', pluginPath);
                        return pluginPath;
                    }
                }
            } catch (e) {
                console.log('[PlantUML Plugin] Error checking path:', pluginPath, e.message);
            }
        }

        return null;
    }

    function loadModule(modulePath) {
        try {
            return _require(modulePath);
        } catch (e) {
            console.error(`[PlantUML Plugin] Failed to load module: ${modulePath}`, e);
            throw e;
        }
    }

})();
