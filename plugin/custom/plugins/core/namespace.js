// plugin/custom/plugins/core/namespace.js
// CSS 命名空间管理 - UMD 模块

(function(root) {
    'use strict';

    const PREFIX = "tp_";

    const NamespaceManager = {
        cls: function(name) {
            return PREFIX + name;
        },

        dataAttr: function(name) {
            return "data-" + PREFIX + name;
        },

        event: function(name) {
            return PREFIX + ":" + name;
        },

        selector: function(name) {
            return "." + PREFIX + name;
        }
    };

    // UMD 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NamespaceManager;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return NamespaceManager; });
    } else {
        root.NamespaceManager = NamespaceManager;
    }

})(typeof global !== 'undefined' ? global : window);
