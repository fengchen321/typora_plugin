// plugin/custom/plugins/plantuml/renderPolicy.js
// PlantUML 渲染前置条件判断

(function(root) {
    'use strict';

    var RenderPolicy = {
        normalizeContent: function(content) {
            return String(content || "")
                .replace(/\r\n?/g, "\n")
                .replace(/^\uFEFF/, "");
        },

        shouldRender: function(content) {
            var normalized = this.normalizeContent(content);
            var trimmed = normalized.trim();
            if (!trimmed) {
                return false;
            }

            var hasStart = /@start[a-z0-9_-]*/i.test(trimmed);
            var hasEnd = /@end[a-z0-9_-]*/i.test(trimmed);

            // 对显式 @start/@end 语法，等待块闭合后再渲染，避免编辑中不断打到错误页。
            if (hasStart || hasEnd) {
                return hasStart && hasEnd;
            }

            // 未使用 @start/@end 的简写语法保持兼容。
            return true;
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RenderPolicy;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return RenderPolicy; });
    } else {
        root.PlantUMLRenderPolicy = RenderPolicy;
    }

})(typeof global !== 'undefined' ? global : window);
