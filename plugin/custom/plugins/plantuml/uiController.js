// plugin/custom/plugins/plantuml/uiController.js
// PlantUML UI 控制器 - UMD 模块

(function(root) {
    'use strict';

    // 植入依赖
    var NamespaceManager = root.NamespaceManager;
    var EventBus = root.EventBus;

    if (!NamespaceManager || !EventBus) {
        console.error('[PlantUML UIController] Missing dependencies: NamespaceManager or EventBus');
        return;
    }

    function PlantUMLUIController() {
        this.ns = NamespaceManager;
        this.activeBlockId = null;
        this.exitHandler = null;
    }

    PlantUMLUIController.prototype.createPreview = function(blockId, originalElement, imageUrl) {
        var self = this;

        // 创建容器
        var container = document.createElement("div");
        container.className = this.ns.cls("preview-container");
        container.setAttribute(this.ns.dataAttr("block-id"), blockId);
        container.setAttribute(this.ns.dataAttr("state"), "rendered");

        // 创建图片
        var img = document.createElement("img");
        img.src = imageUrl;
        img.className = this.ns.cls("preview-image");
        img.alt = "PlantUML Diagram";

        // 创建工具栏
        var toolbar = this._createToolbar(blockId);

        // 组装
        container.appendChild(img);
        container.appendChild(toolbar);

        // 隐藏原始代码块并插入预览
        originalElement.style.display = "none";
        originalElement.insertAdjacentElement("afterend", container);

        // 绑定事件
        this._bindEvents(container, blockId, originalElement);

        return container;
    };

    PlantUMLUIController.prototype._createToolbar = function(blockId) {
        var self = this;
        var toolbar = document.createElement("div");
        toolbar.className = this.ns.cls("toolbar");

        var editBtn = document.createElement("button");
        editBtn.className = this.ns.cls("toolbar-btn edit-btn");
        editBtn.textContent = "Edit";
        editBtn.onclick = function() {
            self.enterEditMode(blockId);
        };

        var refreshBtn = document.createElement("button");
        refreshBtn.className = this.ns.cls("toolbar-btn refresh-btn");
        refreshBtn.textContent = "Refresh";
        refreshBtn.onclick = function() {
            EventBus.emit("plantuml:refresh-requested", { blockId: blockId });
        };

        toolbar.appendChild(editBtn);
        toolbar.appendChild(refreshBtn);

        return toolbar;
    };

    PlantUMLUIController.prototype._bindEvents = function(container, blockId, originalElement) {
        var self = this;
        var img = container.querySelector("." + this.ns.cls("preview-image"));

        // 双击编辑
        img.addEventListener("dblclick", function(e) {
            e.preventDefault();
            self.enterEditMode(blockId);
        });

        // 单击放大（可选的 future feature）
        img.addEventListener("click", function(e) {
            // 预留给放大功能
        });
    };

    PlantUMLUIController.prototype.enterEditMode = function(blockId) {
        var preview = document.querySelector("[" + this.ns.dataAttr("block-id") + '="' + blockId + '"].' + this.ns.cls("preview-container"));
        var codeBlock = document.querySelector("pre[" + this.ns.dataAttr("block-id") + '="' + blockId + '"]');

        if (!preview || !codeBlock) return;

        // 隐藏预览
        preview.style.display = "none";

        // 显示代码块并聚焦
        codeBlock.style.display = "";
        codeBlock.focus();

        this.activeBlockId = blockId;

        // 设置退出处理器
        this._setupExitHandler(blockId);
    };

    PlantUMLUIController.prototype._setupExitHandler = function(blockId) {
        var self = this;

        // 移除之前的处理器
        if (this.exitHandler) {
            document.removeEventListener("click", this.exitHandler);
        }

        this.exitHandler = function(e) {
            var block = document.querySelector("[" + self.ns.dataAttr("block-id") + '="' + blockId + '"]');
            if (!block) return;

            var preview = document.querySelector("[" + self.ns.dataAttr("block-id") + '="' + blockId + '"].' + self.ns.cls("preview-container"));
            var codeBlock = document.querySelector("pre[" + self.ns.dataAttr("block-id") + '="' + blockId + '"]');

            // 检查点击是否在预览和代码块之外
            if (preview && codeBlock &&
                !preview.contains(e.target) &&
                !codeBlock.contains(e.target)) {

                self.exitEditMode(blockId);
            }
        };

        // 延迟添加以避免立即触发
        setTimeout(function() {
            document.addEventListener("click", self.exitHandler);
        }, 100);
    };

    PlantUMLUIController.prototype.exitEditMode = function(blockId) {
        // 移除退出处理器
        if (this.exitHandler) {
            document.removeEventListener("click", this.exitHandler);
            this.exitHandler = null;
        }

        // 请求更新
        EventBus.emit("plantuml:exit-edit", { blockId: blockId });

        this.activeBlockId = null;
    };

    PlantUMLUIController.prototype.showPreview = function(blockId) {
        var preview = document.querySelector("[" + this.ns.dataAttr("block-id") + '="' + blockId + '"].' + this.ns.cls("preview-container"));
        var codeBlock = document.querySelector("pre[" + this.ns.dataAttr("block-id") + '="' + blockId + '"]');

        if (preview) preview.style.display = "";
        if (codeBlock) codeBlock.style.display = "none";
    };

    PlantUMLUIController.prototype.showLoading = function(blockId) {
        var preview = document.querySelector("[" + this.ns.dataAttr("block-id") + '="' + blockId + '"].' + this.ns.cls("preview-container"));
        if (!preview) return;

        preview.innerHTML = '<div class="' + this.ns.cls("loading") + '"></div>';
        preview.setAttribute(this.ns.dataAttr("state"), "loading");
    };

    PlantUMLUIController.prototype.showError = function(blockId, error) {
        var self = this;
        var preview = document.querySelector("[" + this.ns.dataAttr("block-id") + '="' + blockId + '"].' + this.ns.cls("preview-container"));
        if (!preview) return;

        var errorMsg = error.message || "Render failed";
        preview.innerHTML =
            '<div class="' + this.ns.cls("error") + '">' +
            '  <span class="' + this.ns.cls("error-icon") + '">!</span>' +
            '  <span class="' + this.ns.cls("error-message") + '">' + this._escapeHtml(errorMsg) + '</span>' +
            '  <button class="' + this.ns.cls("retry-btn") + '">Retry</button>' +
            '</div>';
        preview.setAttribute(this.ns.dataAttr("state"), "error");

        // 绑定重试按钮
        var retryBtn = preview.querySelector("." + this.ns.cls("retry-btn"));
        if (retryBtn) {
            retryBtn.onclick = function() {
                EventBus.emit("plantuml:refresh-requested", { blockId: blockId });
            };
        }
    };

    PlantUMLUIController.prototype._escapeHtml = function(text) {
        var div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    };

    PlantUMLUIController.prototype.removePreview = function(blockId) {
        var preview = document.querySelector("[" + this.ns.dataAttr("block-id") + '="' + blockId + '"].' + this.ns.cls("preview-container"));
        if (preview) preview.remove();

        var codeBlock = document.querySelector("pre[" + this.ns.dataAttr("block-id") + '="' + blockId + '"]');
        if (codeBlock) codeBlock.style.display = "";
    };

    // UMD 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PlantUMLUIController;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return PlantUMLUIController; });
    } else {
        root.PlantUMLUIController = PlantUMLUIController;
    }

})(typeof global !== 'undefined' ? global : window);