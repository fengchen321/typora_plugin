# PlantUML Typora Plugin Design Specification

## Status

This document describes the current implemented design, not the initial proposal.

The plugin is now built around a shared runtime so that the browser entrypoint and the standalone plugin-class entrypoint both reuse the same rendering pipeline and lifecycle logic.

## Scope

The plugin adds PlantUML support to Typora by:

1. Detecting fenced code blocks with `lang="plantuml"`
2. Extracting source text from the active CodeMirror instance
3. Rendering valid PlantUML source through a PlantUML server
4. Replacing the source block with an image preview
5. Allowing users to return to source editing and re-render
6. Cleaning up state when blocks are removed or no longer use the `plantuml` language

## Current Architecture

### Entrypoints

- `plugin/index.js`
  Browser-context loader used from `window.html`
- `plugin/custom/plugins/plantuml/index.js`
  Standalone plugin-class entry

Both entrypoints now construct the same module graph and delegate behavior to `plantuml/runtime.js`.

### Core Shared Modules

- `custom/plugins/core/namespace.js`
  Generates `tp_`-prefixed class names and `data-tp_*` attributes
- `custom/plugins/core/eventBus.js`
  Handles inter-module events
- `custom/plugins/core/configManager.js`
  Reads and caches config from `localStorage`

### PlantUML Modules

- `plantuml/detector.js`
  Tracks block lifecycle:
  - initial scan
  - new block registration
  - content updates from DOM/CodeMirror mutations
  - block removal
  - unregister when fence language changes away from `plantuml`
- `plantuml/renderer.js`
  Encodes source using `deflateRaw + PlantUML base64`, builds the server URL, preloads images, and caches results
- `plantuml/renderPolicy.js`
  Prevents rendering when content is empty or incomplete
- `plantuml/uiController.js`
  Manages preview containers, edit mode, loading state, and error state
- `plantuml/autocomplete.js`
  Suggests `plantuml` when the user types ` ```pla `
- `plantuml/runtime.js`
  Shared runtime for:
  - event binding
  - debounce management
  - hotkey registration
  - render pipeline
  - start/stop lifecycle
  - shared style injection

## Runtime Flow

```text
window.html
  -> plugin/index.js
  -> load core modules and plantuml modules
  -> create runtime
  -> runtime.start()

detector
  -> emit plantuml:block-detected
  -> emit plantuml:block-updated
  -> emit plantuml:block-removed

runtime
  -> debounce by block id
  -> renderPolicy.shouldRender()
  -> renderer.render()
  -> uiController.showLoading/createPreview/showError/removePreview()
```

## Detection Rules

### Block Identification

PlantUML blocks are identified by:

```css
pre.md-fences[lang="plantuml"]
```

The detector also tracks registered blocks through:

```css
pre.md-fences[data-tp_block-id]
```

### Content Extraction

The detector prefers `CodeMirror.getValue()` because reading rendered DOM text can introduce artifacts such as NBSPs.

Fallback order:

1. `CodeMirror.getValue()`
2. `.CodeMirror-line` text extraction
3. `<br>`-split DOM fallback
4. raw `textContent`

## Render Rules

### When Rendering Happens

The runtime will render when:

- the block is registered and contains renderable content
- the block content changes
- the user manually refreshes the block
- the user exits edit mode with complete content

### When Rendering Is Skipped

The runtime will skip rendering when:

- the block is empty
- the content contains `@start...` without a matching `@end...`
- the content contains `@end...` without a matching `@start...`

This avoids invalid requests while the user is still typing.

## Cleanup Rules

The detector unregisters blocks when:

- the DOM node is removed
- the `lang` attribute changes away from `plantuml`

The runtime reacts to `plantuml:block-removed` by:

- cancelling pending debounced renders
- removing the preview container
- leaving the original source block visible

## Configuration

Current runtime configuration source:

- key: `plantuml_plugin_config`
- storage: `localStorage`

Supported keys:

- `serverUrl`
- `renderMode`
- `outputFormat`
- `timeout`
- `cacheLimit`
- `debounceDelay`
- `hotkey`
- `enableFenceAutocomplete`
- `fenceAutocompleteMinChars`

## Tests

Repository tests live under `tests/plantuml/`.

Coverage currently includes:

- renderer encoding stability
- autocomplete matching behavior
- detector block registration and cleanup
- render policy guard behavior
- shared runtime integration behavior

Each test file includes short scenario comments describing the regression it protects against.
