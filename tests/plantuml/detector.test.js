const assert = require("assert");

global.NamespaceManager = {
    dataAttr: function(name) { return "data-tp_" + name; },
    cls: function(name) { return "tp_" + name; }
};
global.EventBus = {
    emit: function() {},
    on: function() {}
};

const PlantUMLDetector = require("../../plugin/custom/plugins/plantuml/detector");
const detector = new PlantUMLDetector();

// Scenario: a newly added node is itself a plantuml fence and must be detected.
const selfMatchingNode = {
    nodeType: 1,
    querySelectorAll: function() {
        return [];
    },
    matches: function(selector) {
        return selector === 'pre.md-fences[lang="plantuml"]';
    }
};

const descendantNode = { id: "child" };
const containerNode = {
    nodeType: 1,
    querySelectorAll: function() {
        return [descendantNode];
    },
    matches: function() {
        return false;
    }
};

assert.deepStrictEqual(
    detector._collectPlantUMLBlocks(selfMatchingNode),
    [selfMatchingNode]
);

assert.deepStrictEqual(
    detector._collectPlantUMLBlocks(containerNode),
    [descendantNode]
);

// Scenario: registration should work for both the node itself and its descendants.
const registered = [];
detector._registerBlock = function(node) {
    registered.push(node);
};

detector._checkNode(selfMatchingNode);
detector._checkNode(containerNode);

assert.deepStrictEqual(registered, [selfMatchingNode, descendantNode]);

// Scenario: content mutations inside a block should map back to the owning pre element.
const blockElement = {
    nodeType: 1,
    attrs: { "data-tp_block-id": "block-1" },
    matches: function(selector) {
        return selector === 'pre.md-fences[lang="plantuml"]';
    },
    getAttribute: function(name) {
        return this.attrs[name];
    },
    removeAttribute: function(name) {
        delete this.attrs[name];
    },
    parentElement: null,
    parentNode: null
};

const innerNode = {
    matches: null,
    parentElement: blockElement,
    parentNode: blockElement
};

assert.strictEqual(detector._findPlantUMLBlockElement(innerNode), blockElement);

const updates = [];
detector.updateBlockContent = function(blockId) {
    updates.push(blockId);
};

detector._handlePotentialContentChange(innerNode);
assert.deepStrictEqual(updates, ["block-1"]);

updates.length = 0;
detector._handleMutations([
    {
        type: "childList",
        target: innerNode,
        addedNodes: []
    },
    {
        type: "characterData",
        target: { parentElement: blockElement, parentNode: blockElement }
    }
]);
assert.deepStrictEqual(updates, ["block-1", "block-1"]);

// Scenario: manual render/hotkey should find the current block from the editor selection.
global.window = {
    getSelection: function() {
        return {
            rangeCount: 1,
            anchorNode: innerNode,
            focusNode: innerNode
        };
    }
};
global.document = {
    activeElement: null
};
detector.blocks.set("block-1", { element: blockElement, content: "@startuml\n@enduml" });
assert.deepStrictEqual(detector.findCurrentBlock(), {
    id: "block-1",
    element: blockElement,
    content: "@startuml\n@enduml"
});

// Scenario: changing the fence language away from plantuml should unregister the block.
const emitted = [];
global.EventBus.emit = function(event, data) {
    emitted.push({ event, data });
};
const nonPlantUMLBlock = {
    nodeType: 1,
    attrs: { "data-tp_block-id": "block-2" },
    matches: function(selector) {
        return selector === 'pre.md-fences[data-tp_block-id]';
    },
    getAttribute: function(name) {
        return this.attrs[name];
    },
    removeAttribute: function(name) {
        delete this.attrs[name];
    },
    parentElement: null,
    parentNode: null
};
detector.blocks.set("block-2", { element: nonPlantUMLBlock, content: "" });
detector._handleAttributeMutation(nonPlantUMLBlock);
assert.strictEqual(detector.blocks.has("block-2"), false);
assert.deepStrictEqual(emitted.pop(), {
    event: "plantuml:block-removed",
    data: { blockId: "block-2" }
});

// Scenario: UI cleanup must run before the tracking attribute is removed from the original block.
const removalOrder = [];
global.EventBus.emit = function(event, data) {
    removalOrder.push({
        event: event,
        blockId: data.blockId,
        attrPresentDuringEmit: orderSensitiveBlock.getAttribute("data-tp_block-id")
    });
};
const orderSensitiveBlock = {
    nodeType: 1,
    attrs: { "data-tp_block-id": "block-2b" },
    matches: function(selector) {
        return selector === 'pre.md-fences[lang="plantuml"]';
    },
    getAttribute: function(name) {
        return this.attrs[name];
    },
    removeAttribute: function(name) {
        delete this.attrs[name];
    },
    parentElement: null,
    parentNode: null
};
detector.blocks.set("block-2b", { element: orderSensitiveBlock, content: "" });
detector._unregisterBlockByElement(orderSensitiveBlock);
assert.deepStrictEqual(removalOrder.pop(), {
    event: "plantuml:block-removed",
    blockId: "block-2b",
    attrPresentDuringEmit: "block-2b"
});
assert.strictEqual(orderSensitiveBlock.getAttribute("data-tp_block-id"), undefined);

// Scenario: removing a registered block from DOM should also unregister and emit cleanup.
global.EventBus.emit = function(event, data) {
    emitted.push({ event, data });
};
const removedBlock = {
    nodeType: 1,
    attrs: { "data-tp_block-id": "block-3" },
    matches: function(selector) {
        return selector === 'pre.md-fences[data-tp_block-id]';
    },
    querySelectorAll: function() {
        return [];
    },
    getAttribute: function(name) {
        return this.attrs[name];
    },
    removeAttribute: function(name) {
        delete this.attrs[name];
    },
    parentElement: null,
    parentNode: null
};
detector.blocks.set("block-3", { element: removedBlock, content: "" });
detector._handleRemovedNode(removedBlock);
assert.strictEqual(detector.blocks.has("block-3"), false);
assert.deepStrictEqual(emitted.pop(), {
    event: "plantuml:block-removed",
    data: { blockId: "block-3" }
});

console.log("detector.test.js passed");
