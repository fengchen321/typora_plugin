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

const selfMatchingNode = {
    querySelectorAll: function() {
        return [];
    },
    matches: function(selector) {
        return selector === 'pre.md-fences[lang="plantuml"]';
    }
};

const descendantNode = { id: "child" };
const containerNode = {
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

const registered = [];
detector._registerBlock = function(node) {
    registered.push(node);
};

detector._checkNode(selfMatchingNode);
detector._checkNode(containerNode);

assert.deepStrictEqual(registered, [selfMatchingNode, descendantNode]);

const blockElement = {
    attrs: { "data-tp_block-id": "block-1" },
    matches: function(selector) {
        return selector === 'pre.md-fences[lang="plantuml"]';
    },
    getAttribute: function(name) {
        return this.attrs[name];
    },
    parentElement: null,
    parentNode: null
};

const innerNode = {
    matches: null,
    parentElement: blockElement,
    parentNode: blockElement
};

assert.strictEqual(detector._findBlockElement(innerNode), blockElement);

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

console.log("detector.test.js passed");
