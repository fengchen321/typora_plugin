// plugin/custom/plugins/core/eventBus.js
// 事件总线 - UMD 模块

(function(root) {
    'use strict';

    const EventBus = {
        listeners: new Map(),

        on: function(event, handler) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(handler);
        },

        off: function(event, handler) {
            var handlers = this.listeners.get(event);
            if (handlers) {
                handlers.delete(handler);
            }
        },

        emit: function(event, data) {
            var handlers = this.listeners.get(event);
            if (handlers) {
                handlers.forEach(function(handler) {
                    try {
                        handler(data);
                    } catch (e) {
                        console.error("EventBus handler error [" + event + "]:", e);
                    }
                });
            }
        },

        once: function(event, handler) {
            var self = this;
            var wrapper = function(data) {
                handler(data);
                self.off(event, wrapper);
            };
            this.on(event, wrapper);
        },

        clear: function() {
            this.listeners.clear();
        }
    };

    // UMD 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventBus;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return EventBus; });
    } else {
        root.EventBus = EventBus;
    }

})(typeof global !== 'undefined' ? global : window);