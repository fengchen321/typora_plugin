// plugin/custom/plugins/plantuml/config.js
// PlantUML 默认配置 - UMD 模块

(function(root) {
    'use strict';

    var defaultConfig = {
        // Render server URL (default to public PlantUML server)
        serverUrl: "http://www.plantuml.com/plantuml",

        // Render mode: "auto" (real-time) or "manual" (trigger on demand)
        renderMode: "auto",

        // Output format: "svg" or "png"
        outputFormat: "svg",

        // Request timeout in milliseconds
        timeout: 10000,

        // Cache limit (number of rendered images to cache)
        cacheLimit: 20,

        // Debounce delay for real-time rendering (ms)
        debounceDelay: 500,

        // Hotkey for manual render (Ctrl+Shift+U)
        hotkey: "ctrl+shift+u",
    };

    // UMD 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = defaultConfig;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return defaultConfig; });
    } else {
        root.PlantUMLDefaultConfig = defaultConfig;
    }

})(typeof global !== 'undefined' ? global : window);