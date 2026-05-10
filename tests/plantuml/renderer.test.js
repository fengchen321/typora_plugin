const assert = require("assert");
const PlantUMLRenderer = require("../../plugin/custom/plugins/plantuml/renderer");

const renderer = new PlantUMLRenderer({
    serverUrl: "http://www.plantuml.com/plantuml",
    outputFormat: "svg",
    timeout: 1000,
    cacheLimit: 20,
});

const helloDiagram = "@startuml\nBob -> Alice : hello\n@enduml";
const helloDiagramCRLF = "@startuml\r\nBob -> Alice : hello\r\n@enduml";
const expectedEncoded = "SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9vt98pKifpSq100";

// Scenario: the canonical hello-world diagram should encode to the stable PlantUML URL payload.
assert.strictEqual(renderer.encode(helloDiagram), expectedEncoded);

// Scenario: CRLF input from Windows documents should normalize to the same encoded payload.
assert.strictEqual(renderer.encode(helloDiagramCRLF), expectedEncoded);

console.log("renderer.test.js passed");
