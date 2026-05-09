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

            // 创建插件实例
            const detector = new Detector();
            const renderer = new Renderer(config);
            const ui = new UIController();

            // 注入样式
            injectStyles(getStyles());

            // 绑定事件
            bindEvents(detector, renderer, ui, config);

            // 启动检测器
            if (config.renderMode === 'auto') {
                detector.start();
            }

            // 注册快捷键
            registerHotkey(detector, renderer, config);

            // 保存引用供调试
            global.__plantuml_plugin__ = {
                detector,
                renderer,
                ui,
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
        // Typora 插件目录结构:
        // Windows: %APPDATA%/Typora/plugins/ 或 Typora/resources/plugins/
        // macOS: ~/Library/Application Support/Typora/plugins/
        // Linux: ~/.config/Typora/plugins/

        const fs = _require('fs');
        const process = _require('process');
        const os = _require('os');

        let candidatePaths = [];

        // 方式1: 通过 script 标签的 src 解析（最可靠）
        const scripts = document.querySelectorAll('script[src*="plugin/index.js"], script[src*="plugins/index.js"]');
        console.log('[PlantUML Plugin] Found scripts:', scripts.length);
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
            console.log('[PlantUML Plugin] Script src:', src);
            if (src) {
                // file:// 协议
                if (src.startsWith('file://')) {
                    const filePath = decodeURIComponent(src.replace(/^file:\/\//, '').replace(/^\/([A-Za-z]:)/, '$1'));
                    const pluginDir = path.dirname(filePath);
                    console.log('[PlantUML Plugin] Derived from script:', pluginDir);
                    return pluginDir;
                }
                // typora:// 协议（Typora 内部）
                if (src.startsWith('typora://')) {
                    // typora://app/typemark/plugin/index.js -> 需要转换
                    // 这种情况下使用备选方案
                    console.log('[PlantUML Plugin] typora:// protocol detected');
                }
            }
        }

        // 方式2: 检查 Typora 用户数据目录
        if (process.platform === 'win32') {
            candidatePaths = [
                path.join(process.env.APPDATA || '', 'Typora', 'plugins'),
                path.join(process.env.LOCALAPPDATA || '', 'Typora', 'plugins'),
            ];
        } else if (process.platform === 'darwin') {
            candidatePaths = [
                path.join(os.homedir(), 'Library', 'Application Support', 'Typora', 'plugins'),
            ];
        } else {
            candidatePaths = [
                path.join(os.homedir(), '.config', 'Typora', 'plugins'),
            ];
        }

        // 方式3: 添加 Typora 安装目录下的 plugins
        if (typeof __dirname !== 'undefined') {
            console.log('[PlantUML Plugin] __dirname:', __dirname);
            // 从 electron.asar/renderer 向上找到 resources 目录
            const resourcesDir = path.dirname(path.dirname(__dirname));
            candidatePaths.push(path.join(resourcesDir, 'plugins'));
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

    function injectStyles(css) {
        const style = document.createElement('style');
        style.id = 'plantuml-plugin-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function getStyles() {
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

    function bindEvents(detector, renderer, ui, config) {
        // 新代码块检测
        EventBus.on('plantuml:block-detected', function(data) {
            if (config.renderMode === 'auto') {
                renderDebounced(detector, renderer, ui, config, data.blockId, data.content);
            }
        });

        // 代码块内容更新
        EventBus.on('plantuml:block-updated', function(data) {
            if (config.renderMode === 'auto') {
                renderDebounced(detector, renderer, ui, config, data.blockId, data.content);
            }
        });

        // 手动刷新
        EventBus.on('plantuml:refresh-requested', function(data) {
            const block = detector.getBlock(data.blockId);
            if (block) {
                renderBlock(detector, renderer, ui, data.blockId, block.content);
            }
        });

        // 退出编辑模式
        EventBus.on('plantuml:exit-edit', function(data) {
            detector.updateBlockContent(data.blockId);
        });
    }

    // 防抖定时器
    const debounceTimers = new Map();

    function renderDebounced(detector, renderer, ui, config, blockId, content) {
        if (debounceTimers.has(blockId)) {
            clearTimeout(debounceTimers.get(blockId));
        }

        debounceTimers.set(blockId, setTimeout(function() {
            renderBlock(detector, renderer, ui, blockId, content);
            debounceTimers.delete(blockId);
        }, config.debounceDelay));
    }

    async function renderBlock(detector, renderer, ui, blockId, content) {
        const block = detector.getBlock(blockId);
        if (!block) return;

        try {
            block.state = 'rendering';
            ui.showLoading(blockId);

            const imageUrl = await renderer.render(content);
            ui.createPreview(blockId, block.element, imageUrl);

            block.state = 'rendered';
        } catch (error) {
            block.state = 'error';
            ui.showError(blockId, error);
            console.error('[PlantUML Plugin] Render error [' + blockId + ']:', error);
        }
    }

    function registerHotkey(detector, config) {
        document.addEventListener('keydown', function(e) {
            if (!config.hotkey) return;

            const hotkey = config.hotkey.toLowerCase();
            const keys = hotkey.split('+');

            const ctrl = keys.includes('ctrl') || keys.includes('control');
            const alt = keys.includes('alt');
            const shift = keys.includes('shift');
            const key = keys[keys.length - 1];

            if (e.ctrlKey === ctrl &&
                e.altKey === alt &&
                e.shiftKey === shift &&
                e.key.toLowerCase() === key) {

                e.preventDefault();

                const block = detector.findCurrentBlock();
                if (block) {
                    EventBus.emit('plantuml:refresh-requested', { blockId: block.id });
                }
            }
        });

        console.log('[PlantUML Plugin] Hotkey registered: ' + config.hotkey);
    }

})();
