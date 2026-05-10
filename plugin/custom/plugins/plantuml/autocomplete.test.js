const assert = require("assert");

global.NamespaceManager = {
    cls: function(name) { return "tp_" + name; }
};

const PlantUMLAutocomplete = require("./autocomplete");
const autocomplete = new PlantUMLAutocomplete({
    enableFenceAutocomplete: true,
    fenceAutocompleteMinChars: 3
});

assert.deepStrictEqual(
    autocomplete._matchFenceLine("```pla"),
    {
        typed: "pla",
        suggestion: "plantuml",
        replacement: "```plantuml"
    }
);

assert.deepStrictEqual(
    autocomplete._matchFenceLine("    ```plan"),
    {
        typed: "plan",
        suggestion: "plantuml",
        replacement: "    ```plantuml"
    }
);

assert.strictEqual(autocomplete._matchFenceLine("```"), null);
assert.strictEqual(autocomplete._matchFenceLine("```p"), null);
assert.strictEqual(autocomplete._matchFenceLine("```pl"), null);
assert.strictEqual(autocomplete._matchFenceLine("```plantuml"), null);
assert.strictEqual(autocomplete._matchFenceLine("```python"), null);

console.log("autocomplete.test.js passed");
