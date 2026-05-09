// plugin/custom/plugins/plantuml/config.js

const defaultConfig = {
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
};

module.exports = defaultConfig;