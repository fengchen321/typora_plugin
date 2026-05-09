// plugin/custom/plugins/plantuml/uiController.js

const NamespaceManager = require("../core/namespace");
const EventBus = require("../core/eventBus");

class PlantUMLUIController {
    constructor() {
        this.ns = NamespaceManager;
        this.activeBlockId = null;
        this.exitHandler = null;
    }

    // Create preview container and insert after code block
    createPreview(blockId, originalElement, imageUrl) {
        // Create container
        const container = document.createElement("div");
        container.className = this.ns.cls("preview-container");
        container.setAttribute(this.ns.dataAttr("block-id"), blockId);
        container.setAttribute(this.ns.dataAttr("state"), "rendered");

        // Create image
        const img = document.createElement("img");
        img.src = imageUrl;
        img.className = this.ns.cls("preview-image");
        img.alt = "PlantUML Diagram";

        // Create toolbar
        const toolbar = this._createToolbar(blockId);

        // Assemble
        container.appendChild(img);
        container.appendChild(toolbar);

        // Hide original block and insert preview
        originalElement.style.display = "none";
        originalElement.insertAdjacentElement("afterend", container);

        // Bind events
        this._bindEvents(container, blockId, originalElement);

        return container;
    }

    // Create toolbar with edit/refresh buttons
    _createToolbar(blockId) {
        const toolbar = document.createElement("div");
        toolbar.className = this.ns.cls("toolbar");

        const editBtn = document.createElement("button");
        editBtn.className = this.ns.cls("toolbar-btn edit-btn");
        editBtn.textContent = "Edit";
        editBtn.onclick = () => this.enterEditMode(blockId);

        const refreshBtn = document.createElement("button");
        refreshBtn.className = this.ns.cls("toolbar-btn refresh-btn");
        refreshBtn.textContent = "Refresh";
        refreshBtn.onclick = () => EventBus.emit("plantuml:refresh-requested", { blockId });

        toolbar.appendChild(editBtn);
        toolbar.appendChild(refreshBtn);

        return toolbar;
    }

    // Bind interaction events
    _bindEvents(container, blockId, originalElement) {
        const img = container.querySelector(`.${this.ns.cls("preview-image")}`);

        // Double-click to edit
        img.addEventListener("dblclick", (e) => {
            e.preventDefault();
            this.enterEditMode(blockId);
        });

        // Single-click to enlarge (optional future feature)
        img.addEventListener("click", (e) => {
            // Placeholder for enlarge feature
        });
    }

    // Enter edit mode: show code, hide preview
    enterEditMode(blockId) {
        const preview = document.querySelector(`[${this.ns.dataAttr("block-id")}="${blockId}"].${this.ns.cls("preview-container")}`);
        const codeBlock = document.querySelector(`pre[${this.ns.dataAttr("block-id")}="${blockId}"]`);

        if (!preview || !codeBlock) return;

        // Hide preview
        preview.style.display = "none";

        // Show code block and focus
        codeBlock.style.display = "";
        codeBlock.focus();

        this.activeBlockId = blockId;

        // Set up exit handler
        this._setupExitHandler(blockId);
    }

    // Set up handler to exit edit mode on outside click
    _setupExitHandler(blockId) {
        // Remove previous handler if exists
        if (this.exitHandler) {
            document.removeEventListener("click", this.exitHandler);
        }

        this.exitHandler = (e) => {
            const block = document.querySelector(`[${this.ns.dataAttr("block-id")}="${blockId}"]`);
            if (!block) return;

            const preview = document.querySelector(`[${this.ns.dataAttr("block-id")}="${blockId}"].${this.ns.cls("preview-container")}`);
            const codeBlock = document.querySelector(`pre[${this.ns.dataAttr("block-id")}="${blockId}"]`);

            // Check if click is outside both preview and code block
            if (preview && codeBlock &&
                !preview.contains(e.target) &&
                !codeBlock.contains(e.target)) {

                this.exitEditMode(blockId);
            }
        };

        // Delay to avoid immediate trigger
        setTimeout(() => {
            document.addEventListener("click", this.exitHandler);
        }, 100);
    }

    // Exit edit mode: re-render and show preview
    exitEditMode(blockId) {
        // Remove exit handler
        if (this.exitHandler) {
            document.removeEventListener("click", this.exitHandler);
            this.exitHandler = null;
        }

        // Request update from detector
        EventBus.emit("plantuml:exit-edit", { blockId });

        this.activeBlockId = null;
    }

    // Show preview (hide code)
    showPreview(blockId) {
        const preview = document.querySelector(`[${this.ns.dataAttr("block-id")}="${blockId}"].${this.ns.cls("preview-container")}`);
        const codeBlock = document.querySelector(`pre[${this.ns.dataAttr("block-id")}="${blockId}"]`);

        if (preview) preview.style.display = "";
        if (codeBlock) codeBlock.style.display = "none";
    }

    // Show loading state
    showLoading(blockId) {
        const preview = document.querySelector(`[${this.ns.dataAttr("block-id")}="${blockId}"].${this.ns.cls("preview-container")}`);
        if (!preview) return;

        preview.innerHTML = `<div class="${this.ns.cls("loading")}"></div>`;
        preview.setAttribute(this.ns.dataAttr("state"), "loading");
    }

    // Show error message
    showError(blockId, error) {
        const preview = document.querySelector(`[${this.ns.dataAttr("block-id")}="${blockId}"].${this.ns.cls("preview-container")}`);
        if (!preview) return;

        preview.innerHTML = `
            <div class="${this.ns.cls("error")}">
                <span class="${this.ns.cls("error-icon")}">!</span>
                <span class="${this.ns.cls("error-message")}">${this._escapeHtml(error.message || "Render failed")}</span>
                <button class="${this.ns.cls("retry-btn")}">Retry</button>
            </div>
        `;
        preview.setAttribute(this.ns.dataAttr("state"), "error");

        // Bind retry button
        const retryBtn = preview.querySelector(`.${this.ns.cls("retry-btn")}`);
        if (retryBtn) {
            retryBtn.onclick = () => EventBus.emit("plantuml:refresh-requested", { blockId });
        }
    }

    // Escape HTML for safe display
    _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // Remove preview
    removePreview(blockId) {
        const preview = document.querySelector(`[${this.ns.dataAttr("block-id")}="${blockId}"].${this.ns.cls("preview-container")}`);
        if (preview) preview.remove();

        const codeBlock = document.querySelector(`pre[${this.ns.dataAttr("block-id")}="${blockId}"]`);
        if (codeBlock) codeBlock.style.display = "";
    }
}

module.exports = PlantUMLUIController;