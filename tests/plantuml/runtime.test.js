const assert = require("assert");
const PlantUMLRuntime = require("../../plugin/custom/plugins/plantuml/runtime");
const RenderPolicy = require("../../plugin/custom/plugins/plantuml/renderPolicy");

function createEventBus() {
    const listeners = new Map();

    return {
        on(event, handler) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event).add(handler);
        },
        off(event, handler) {
            const set = listeners.get(event);
            if (set) {
                set.delete(handler);
            }
        },
        emit(event, data) {
            const set = listeners.get(event);
            if (set) {
                Array.from(set).forEach(function(handler) {
                    handler(data);
                });
            }
        },
        listenerCount(event) {
            const set = listeners.get(event);
            return set ? set.size : 0;
        }
    };
}

async function main() {
    const eventBus = createEventBus();
    const renderCalls = [];
    const removePreviewCalls = [];
    const showLoadingCalls = [];
    const createPreviewCalls = [];
    const showErrorCalls = [];
    const extractCalls = [];
    const ui = {
        removePreview(blockId) {
            removePreviewCalls.push(blockId);
        },
        showLoading(blockId) {
            showLoadingCalls.push(blockId);
        },
        createPreview(blockId, element, imageUrl) {
            createPreviewCalls.push({ blockId, imageUrl, element });
        },
        showError(blockId, error) {
            showErrorCalls.push({ blockId, error });
        }
    };

    const detector = {
        blocks: new Map([
            ["block-1", { element: { id: "el-1" }, content: "@startuml\nA->B\n@enduml" }],
            ["block-2", { element: { id: "el-2" }, content: "" }]
        ]),
        getBlock(blockId) {
            return this.blocks.get(blockId);
        },
        findCurrentBlock() {
            return { id: "block-1", content: "@startuml\nA->B\n@enduml" };
        },
        _extractContent(element) {
            extractCalls.push(element.id);
            return "@startuml\nB->C\n@enduml";
        },
        startCalled: 0,
        stopCalled: 0,
        start() {
            this.startCalled += 1;
        },
        stop() {
            this.stopCalled += 1;
        }
    };

    const autocomplete = {
        startCalled: 0,
        stopCalled: 0,
        start() {
            this.startCalled += 1;
        },
        stop() {
            this.stopCalled += 1;
        }
    };

    const renderer = {
        async render(content) {
            renderCalls.push(content);
            return "url:" + content.length;
        }
    };

    // Scenario: shared runtime should bind one event pipeline and start detector/autocomplete once.
    const runtime = new PlantUMLRuntime({
        config: { renderMode: "auto", debounceDelay: 0, hotkey: "ctrl+shift+u" },
        detector,
        renderer,
        ui,
        autocomplete,
        renderPolicy: RenderPolicy,
        eventBus
    });
    runtime.start();
    assert.strictEqual(detector.startCalled, 1);
    assert.strictEqual(autocomplete.startCalled, 1);
    assert.strictEqual(eventBus.listenerCount("plantuml:block-detected") > 0, true);

    // Scenario: incomplete content should be skipped by the shared runtime without calling renderer.
    await runtime.renderBlock("block-2", "");
    assert.deepStrictEqual(renderCalls, []);
    assert.deepStrictEqual(removePreviewCalls, ["block-2"]);

    // Scenario: block-detected should render through the shared runtime pipeline.
    eventBus.emit("plantuml:block-detected", { blockId: "block-1", content: "@startuml\nA->B\n@enduml" });
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.deepStrictEqual(renderCalls, ["@startuml\nA->B\n@enduml"]);
    assert.deepStrictEqual(showLoadingCalls, ["block-1"]);
    assert.strictEqual(createPreviewCalls.length, 1);

    // Scenario: refresh requests should re-extract latest content before rendering.
    eventBus.emit("plantuml:refresh-requested", { blockId: "block-1" });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepStrictEqual(extractCalls, ["el-1"]);
    assert.deepStrictEqual(renderCalls[1], "@startuml\nB->C\n@enduml");

    // Scenario: removing a block should cancel pending work and clean up preview.
    runtime.renderDebounced("block-1", "@startuml\nX->Y\n@enduml");
    eventBus.emit("plantuml:block-removed", { blockId: "block-1" });
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.strictEqual(renderCalls.includes("@startuml\nX->Y\n@enduml"), false);
    assert.strictEqual(removePreviewCalls.includes("block-1"), true);

    // Scenario: renderCurrentBlock should delegate through the same shared runtime path.
    const didRenderCurrent = runtime.renderCurrentBlock();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.strictEqual(didRenderCurrent, true);
    assert.strictEqual(renderCalls[renderCalls.length - 1], "@startuml\nA->B\n@enduml");

    runtime.stop();
    assert.strictEqual(detector.stopCalled, 1);
    assert.strictEqual(autocomplete.stopCalled, 1);
    assert.strictEqual(eventBus.listenerCount("plantuml:block-detected"), 0);
    assert.deepStrictEqual(showErrorCalls, []);
}

main().then(function() {
    console.log("runtime.test.js passed");
}).catch(function(error) {
    console.error(error);
    process.exit(1);
});
