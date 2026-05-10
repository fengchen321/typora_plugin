const assert = require("assert");
const RenderPolicy = require("./renderPolicy");

assert.strictEqual(RenderPolicy.shouldRender(""), false);
assert.strictEqual(RenderPolicy.shouldRender("   \n\t"), false);
assert.strictEqual(RenderPolicy.shouldRender("@startuml"), false);
assert.strictEqual(RenderPolicy.shouldRender("@enduml"), false);
assert.strictEqual(RenderPolicy.shouldRender("@startuml\nAlice -> Bob: hi"), false);
assert.strictEqual(RenderPolicy.shouldRender("@startuml\nAlice -> Bob: hi\n@enduml"), true);
assert.strictEqual(RenderPolicy.shouldRender("Alice -> Bob: hi"), true);

console.log("renderPolicy.test.js passed");
