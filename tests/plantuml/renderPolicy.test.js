const assert = require("assert");
const RenderPolicy = require("../../plugin/custom/plugins/plantuml/renderPolicy");

// Scenario: empty or whitespace-only blocks should never render.
assert.strictEqual(RenderPolicy.shouldRender(""), false);
assert.strictEqual(RenderPolicy.shouldRender("   \n\t"), false);

// Scenario: explicit @start/@end syntax should render only after the block is complete.
assert.strictEqual(RenderPolicy.shouldRender("@startuml"), false);
assert.strictEqual(RenderPolicy.shouldRender("@enduml"), false);
assert.strictEqual(RenderPolicy.shouldRender("@startuml\nAlice -> Bob: hi"), false);
assert.strictEqual(RenderPolicy.shouldRender("@startuml\nAlice -> Bob: hi\n@enduml"), true);

// Scenario: shorthand syntax without @start/@end remains supported.
assert.strictEqual(RenderPolicy.shouldRender("Alice -> Bob: hi"), true);

console.log("renderPolicy.test.js passed");
