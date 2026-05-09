// plugin/custom/plugins/plantuml/detector.js

const NamespaceManager = require("../core/namespace");
const EventBus = require("../core/eventBus");

class PlantUMLDetector {
    constructor() {
        this.observer = null;
        this.blocks = new Map();
        this.ns = NamespaceManager;
    }

    // Start monitoring DOM
    start() {
        const editor = document.querySelector("#write");
        if (!editor) {
            console.error("PlantUML Detector: Editor not found");
            return;
        }

        // Initial scan
        this._scanExistingBlocks();

        // Start observing
        this.observer = new MutationObserver((mutations) => {
            this._handleMutations(mutations);
        });

        this.observer.observe(editor, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "data-lang"],
        });
    }

    // Stop monitoring
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.blocks.clear();
    }

    // Scan existing blocks on start
    _scanExistingBlocks() {
        const blocks = document.querySelectorAll('pre.md-fences[data-lang="plantuml"]');
        blocks.forEach((block) => this._registerBlock(block));
    }

    // Handle DOM mutations
    _handleMutations(mutations) {
        for (const mutation of mutations) {
            if (mutation.type === "childList") {
                for (const node of mutation.addedNodes) {
                    this._checkNode(node);
                }
            } else if (mutation.type === "attributes") {
                this._checkNode(mutation.target);
            }
        }
    }

    // Check if node contains PlantUML blocks
    _checkNode(node) {
        if (!node.querySelectorAll && !node.matches) return;

        const blocks = node.querySelectorAll?.('pre.md-fences[data-lang="plantuml"]')
            || (node.matches?.('pre.md-fences[data-lang="plantuml"]') ? [node] : []);

        for (const block of blocks) {
            this._registerBlock(block);
        }
    }

    // Register a new code block
    _registerBlock(element) {
        // Skip if already registered
        if (element.hasAttribute(this.ns.dataAttr("block-id"))) return;

        const blockId = this._generateId();
        element.setAttribute(this.ns.dataAttr("block-id"), blockId);

        const content = this._extractContent(element);
        this.blocks.set(blockId, { element, content, state: "pending" });

        // Emit event
        EventBus.emit("plantuml:block-detected", { blockId, content });
    }

    // Extract code content from element
    _extractContent(element) {
        // Typora uses CodeMirror for code blocks
        const cmContent = element.querySelector(".CodeMirror-code");
        if (cmContent) {
            // Get text from CodeMirror lines
            const lines = cmContent.querySelectorAll(".CodeMirror-line");
            return Array.from(lines).map(line => line.textContent).join("\n");
        }

        // Fallback: direct text content
        const codeElement = element.querySelector("code") || element;
        return codeElement.textContent || "";
    }

    // Generate unique block ID
    _generateId() {
        return `plantuml-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    // Get block info
    getBlock(blockId) {
        return this.blocks.get(blockId);
    }

    // Update block content (after edit)
    updateBlockContent(blockId) {
        const block = this.blocks.get(blockId);
        if (!block) return;

        const newContent = this._extractContent(block.element);

        // Only emit if content actually changed
        if (newContent !== block.content) {
            block.content = newContent;
            block.state = "modified";
            EventBus.emit("plantuml:block-updated", { blockId, content: newContent });
        }
    }

    // Find current block (for manual trigger)
    findCurrentBlock() {
        const activeElement = document.activeElement;
        if (!activeElement) return null;

        const block = activeElement.closest('pre.md-fences[data-lang="plantuml"]');
        if (!block) return null;

        const blockId = block.getAttribute(this.ns.dataAttr("block-id"));
        return blockId ? { id: blockId, ...this.blocks.get(blockId) } : null;
    }
}

module.exports = PlantUMLDetector;
