# PlantUML Typora Plugin Implementation Notes

## Purpose

This document records the implemented structure and major milestones after the plugin was completed and refactored. It replaces the original step-by-step build checklist.

## Final Layout

```text
plugin/
├── index.js
├── core/
├── custom/plugins/
│   ├── core/
│   │   ├── configManager.js
│   │   ├── eventBus.js
│   │   └── namespace.js
│   └── plantuml/
│       ├── autocomplete.js
│       ├── config.js
│       ├── detector.js
│       ├── index.js
│       ├── renderPolicy.js
│       ├── renderer.js
│       ├── runtime.js
│       └── uiController.js
└── global/settings/custom_plugin.user.toml

tests/
└── plantuml/
    ├── autocomplete.test.js
    ├── detector.test.js
    ├── renderPolicy.test.js
    ├── renderer.test.js
    └── runtime.test.js
```

## Key Implementation Decisions

### 1. Shared Runtime

The most important refactor was introducing `plantuml/runtime.js`.

Before this refactor:

- `plugin/index.js` and `plantuml/index.js` each maintained their own render pipeline
- behavior could drift between the browser loader path and the standalone plugin-class path

After the refactor:

- both entrypoints build modules and delegate all operational behavior to the shared runtime
- debounce, hotkey, event binding, start/stop, and render flow now live in one place

### 2. CodeMirror-First Extraction

DOM text extraction caused content corruption in Typora, especially:

- NBSP pollution
- incorrect line text for indented sequence diagrams

The detector now prefers `CodeMirror.getValue()` and only falls back to DOM extraction when necessary.

### 3. Lifecycle Cleanup

The detector/runtime pair now treats blocks as lifecycle-managed entities:

- register on detection
- update on content change
- unregister on DOM removal
- unregister when the fence language changes away from `plantuml`

This avoids stale hidden source blocks, orphan preview containers, and dangling debounced renders.

### 4. Render Guard

`renderPolicy.js` was added to prevent useless or broken requests while the user is still editing.

Current guard behavior:

- skip empty blocks
- skip incomplete `@start...` / `@end...` pairs
- allow shorthand syntax without explicit start/end markers

### 5. Fence Autocomplete

The plugin now offers a lightweight Typora-side suggestion for `plantuml` fences without modifying Typora’s internal language list.

Trigger behavior:

- no popup for plain ` ``` `
- popup for ` ```pla ` and longer matching prefixes

## Test Strategy

Tests are intentionally outside `plugin/` so deployment copies do not include them.

### Current Test Files

- `renderer.test.js`
  guards URL encoding stability
- `autocomplete.test.js`
  guards fence suggestion matching
- `detector.test.js`
  guards block registration, update, current-block lookup, and cleanup
- `renderPolicy.test.js`
  guards incomplete-content skip behavior
- `runtime.test.js`
  guards the shared runtime integration path

### Execution

```bash
node tests/plantuml/renderer.test.js
node tests/plantuml/autocomplete.test.js
node tests/plantuml/detector.test.js
node tests/plantuml/renderPolicy.test.js
node tests/plantuml/runtime.test.js
```

## Remaining Constraints

- The plugin still depends on Typora’s DOM and CodeMirror internals, so future Typora updates may require detector adjustments.
- Configuration is still stored via `localStorage`; no dedicated UI exists yet.
- The public PlantUML server is still the default and may not be suitable for all environments.

## Recommended Next Steps

If development continues, the next valuable improvements are:

1. Add a lightweight config UI for server URL and render mode
2. Reduce debug logging now that behavior is stable
3. Add browser-context smoke tests if a repeatable Typora harness becomes available
