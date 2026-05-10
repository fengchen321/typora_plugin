const assert = require("assert");

global.NamespaceManager = {
    cls: function(name) { return "tp_" + name; }
};

const PlantUMLAutocomplete = require("../../plugin/custom/plugins/plantuml/autocomplete");
const autocomplete = new PlantUMLAutocomplete({
    enableFenceAutocomplete: true,
    fenceAutocompleteMinChars: 3
});

// Scenario: typing a clear `pla` prefix at fence language position should suggest plantuml.
assert.deepStrictEqual(
    autocomplete._matchFenceLine("```pla"),
    {
        typed: "pla",
        suggestion: "plantuml",
        replacement: "```plantuml"
    }
);

// Scenario: indented fenced blocks should preserve indentation when autocompleting.
assert.deepStrictEqual(
    autocomplete._matchFenceLine("    ```plan"),
    {
        typed: "plan",
        suggestion: "plantuml",
        replacement: "    ```plantuml"
    }
);

// Scenario: suggestions should stay hidden for empty or ambiguous prefixes.
assert.strictEqual(autocomplete._matchFenceLine("```"), null);
assert.strictEqual(autocomplete._matchFenceLine("```p"), null);
assert.strictEqual(autocomplete._matchFenceLine("```pl"), null);
assert.strictEqual(autocomplete._matchFenceLine("```plantuml"), null);
assert.strictEqual(autocomplete._matchFenceLine("```python"), null);

console.log("autocomplete.test.js passed");
