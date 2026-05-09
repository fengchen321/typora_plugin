# PlantUML Typora Plugin Design Specification

## Overview

A Typora plugin that enables PlantUML syntax support. When users write PlantUML code in code blocks (````plantuml`), the plugin automatically renders them as images.

### Core Features

1. **Code Block Detection**: Find all code blocks marked as `plantuml` language in Typora's preview area
2. **Render Replacement**: Extract code content, call render module, replace with `<img>` tag pointing to rendered image URL
3. **Dynamic Monitoring**: Use MutationObserver to monitor content changes, auto re-render when user modifies or adds PlantUML code blocks
4. **Edit Fallback**: Allow users to click rendered image to switch back to original code block for editing
5. **Style Isolation**: All injected styles and logic use namespaced prefixes to avoid affecting Typora's native functionality
6. **Extensibility**: Designed for easy addition of future plugin features

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Typora Window (Browser Context)               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  PluginLoader (Entry)                        │    │
│  │  - Plugin registration and lifecycle management              │    │
│  │  - Unified API for all plugins                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │ PlantUMLPlugin   │ │ Future Plugin X  │ │ Future Plugin Y  │    │
│  │                  │ │                  │ │                  │    │
│  │ ┌──────────────┐ │ │                  │ │                  │    │
│  │ │ Detector     │ │ │                  │ │                  │    │
│  │ │ (Code Detect)│ │ │                  │ │                  │    │
│  │ └──────────────┘ │ │                  │ │                  │    │
│  │ ┌──────────────┐ │ │                  │ │                  │    │
│  │ │ Renderer     │ │ │                  │ │                  │    │
│  │ │ (Render Mgmt)│ │ │                  │ │                  │    │
│  │ └──────────────┘ │ │                  │ │                  │    │
│  │ ┌──────────────┐ │ │                  │ │                  │    │
│  │ │ UIController │ │ │                  │ │                  │    │
│  │ │ (UI Interact)│ │ │                  │ │                  │    │
│  │ └──────────────┘ │ │                  │ │                  │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Global Utilities (Reusable)                      │  │
│  │  - NamespaceManager: CSS namespace isolation                  │  │
│  │  - EventBus: Plugin inter-communication                       │  │
│  │  - ConfigManager: Config storage (localStorage)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
plugin/custom/plugins/
├── core/                          # Core infrastructure (reusable)
│   ├── loader.js                  # Plugin loader
│   ├── namespace.js               # Namespace management
│   ├── eventBus.js                # Event bus
│   └── configManager.js           # Base config manager
│
├── plantuml/                      # PlantUML plugin
│   ├── index.js                   # Plugin entry
│   ├── detector.js                # Code block detector
│   ├── renderer.js                # Renderer (encoding + request)
│   ├── uiController.js            # UI interaction controller
│   ├── config.js                  # Plugin config
│   └── style.css                  # Plugin styles
│
└── index.js                       # Plugin registration entry
```

---

## Module Specifications

### 1. Core Infrastructure

#### 1.1 core/loader.js - Plugin Loader

**Responsibility**: Provide unified plugin registration and management mechanism for future extensibility.

**API**:

```javascript
// Base plugin class
class BasePlugin {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.state = 'idle';  // idle | active | error
  }
  
  // Lifecycle methods
  async init() {}      // Initialize
  async activate() {}  // Activate
  async deactivate() {}// Deactivate
  async destroy() {}   // Destroy
  
  // Utility methods
  getContainer() {}    // Get plugin container
  emit(event, data) {} // Emit event
  on(event, handler) {}// Listen to event
}

// Plugin loader
const PluginLoader = {
  plugins: new Map(),
  
  register(id, PluginClass, config) {...},
  async activateAll() {...},
  get(id) {...}
};
```

#### 1.2 core/namespace.js - Namespace Management

**Responsibility**: Ensure all CSS class names, data attributes, and event names have unique prefixes to avoid conflicts.

**API**:

```javascript
const PREFIX = "tp_";  // Typora Plugin prefix

const NamespaceManager = {
  cls(name) { return `${PREFIX}${name}`; },
  dataAttr(name) { return `data-${PREFIX}${name}`; },
  event(name) { return `${PREFIX}:${name}`; },
  selector(name) { return `.${PREFIX}${name}`; }
};

// Usage examples:
// NamespaceManager.cls("preview") → "tp_preview"
// NamespaceManager.dataAttr("block-id") → "data-tp_block-id"
```

#### 1.3 core/eventBus.js - Event Bus

**Responsibility**: Plugin inter-communication, decoupling module dependencies.

**API**:

```javascript
const EventBus = {
  listeners: new Map(),
  on(event, handler) {...},
  off(event, handler) {...},
  emit(event, data) {...},
  once(event, handler) {...}
};

// Usage:
// EventBus.on("plantuml:rendered", (data) => {...});
// EventBus.emit("plantuml:rendered", { blockId, imageUrl });
```

---

### 2. PlantUML Plugin Modules

#### 2.1 plantuml/detector.js - Code Block Detector

**Responsibility**:
- Monitor DOM changes
- Identify PlantUML code blocks
- Manage code block lifecycle

**Key Methods**:

| Method | Description |
|--------|-------------|
| `start()` | Start MutationObserver monitoring |
| `stop()` | Stop monitoring |
| `registerBlock(element)` | Register new code block |
| `extractContent(element)` | Extract code content from element |
| `getBlock(blockId)` | Get block info by ID |
| `updateBlockContent(blockId, content)` | Update block content |

**DOM Structure Detection**:

```html
<pre class="md-fences md-end-block ty-contain-cm mode-loaded" 
     data-lang="plantuml">
  <code>...</code>
</pre>
```

**Events Emitted**:
- `plantuml:block-detected`: New block found
- `plantuml:block-updated`: Block content modified

#### 2.2 plantuml/renderer.js - Renderer

**Responsibility**:
- PlantUML text encoding (deflate + custom base64)
- Request render server
- Cache management

**Encoding Algorithm**:

1. UTF-8 text → deflate compression
2. Compressed result → custom base64 variant (replace `+/` with `-_`)

**Key Methods**:

| Method | Description |
|--------|-------------|
| `encode(text)` | Encode PlantUML text for server |
| `render(content)` | Render and return image URL |
| `loadImage(url)` | Preload image with error handling |
| `hashContent(content)` | Generate content hash for caching |

**Server URL Format**:
```
{SERVER_URL}/{OUTPUT_FORMAT}/{ENCODED_CONTENT}
```

#### 2.3 plantuml/uiController.js - UI Controller

**Responsibility**:
- Manage rendered result display
- Handle click/double-click events
- Implement edit fallback functionality

**Key Methods**:

| Method | Description |
|--------|-------------|
| `createPreview(blockId, element, imageUrl)` | Create preview container |
| `createToolbar(blockId)` | Create toolbar (edit, refresh buttons) |
| `bindEvents(container, blockId, element)` | Bind interaction events |
| `enterEditMode(blockId)` | Switch to edit mode |
| `exitEditMode(blockId)` | Exit edit mode and re-render |
| `showError(blockId, error)` | Display error message |

**Edit Fallback Behavior**:
1. Double-click image → hide preview, show original code block
2. Click outside editing area → hide code, show preview
3. Content changes trigger re-render

#### 2.4 plantuml/config.js - Plugin Config

**Default Configuration**:

```javascript
const defaultConfig = {
  serverUrl: "http://www.plantuml.com/plantuml",
  renderMode: "auto",      // "auto" real-time preview, "manual" manual trigger
  outputFormat: "svg",     // "svg" or "png"
  timeout: 10000           // Request timeout (ms)
};
```

**Storage**: localStorage with key `plantuml_plugin_config`

#### 2.5 plantuml/index.js - Plugin Entry

**Responsibility**: Integrate all modules, implement plugin lifecycle.

**Lifecycle Flow**:

```
init() → bindEvents() → injectStyles()
          ↓
    activate() → detector.start()
          ↓
    Events: block-detected → renderBlock()
            block-updated → renderBlock()
            refresh-requested → renderBlock()
```

---

## Core Workflow

### 1. Initialization Phase

```
PluginLoader.register("plantuml", PlantUMLPlugin, config)
    ↓
PluginLoader.activateAll()
    ↓
Load config from localStorage
    ↓
Initialize Detector, Renderer, UIController
    ↓
Bind EventBus listeners
    ↓
Inject CSS styles
    ↓
Start MutationObserver
```

### 2. Detection Phase

```
DOM mutation detected
    ↓
Query for pre.md-fences[data-lang="plantuml"]
    ↓
Generate unique blockId
    ↓
Extract code content
    ↓
Emit "plantuml:block-detected" event
```

### 3. Rendering Phase

```
Receive block-detected event
    ↓
Check cache for existing render
    ↓
If not cached:
    → Encode content (deflate + custom base64)
    → Build server URL
    → Fetch image
    → Cache result
    ↓
Create preview container
    ↓
Insert after original code block
    ↓
Bind interaction events
    ↓
Emit "plantuml:rendered" event
```

### 4. Edit Fallback Flow

```
User double-clicks preview image
    ↓
Hide preview container
    ↓
Show original code block
    ↓
User edits code
    ↓
User clicks outside editing area
    ↓
Re-extract code content
    ↓
Trigger re-render
    ↓
Show updated preview
```

---

## Style Isolation

All CSS classes use `tp_` prefix managed by `NamespaceManager`:

```css
/* Preview container */
.tp_preview-container { ... }

/* Preview image */
.tp_preview-image { ... }

/* Toolbar */
.tp_toolbar { ... }
.tp_toolbar-btn { ... }

/* Error display */
.tp_error { ... }
.tp_error-message { ... }

/* Loading state */
.tp_loading { ... }
@keyframes tp_spin { ... }
```

**Data Attributes**:
- `data-tp_block-id`: Unique block identifier
- `data-tp_state`: Block state (pending, rendering, rendered, error)

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Server unreachable | Display error message, don't block editing |
| PlantUML syntax error | Display server-returned error text |
| Network timeout | Show timeout message, allow retry |
| localStorage failure | Use default config |

---

## Caching Strategy

- **Content-based caching**: Same content = same hash = same cached image
- **Cache key**: Simple hash of code content
- **Cache limit**: Last 20 rendered images (configurable)

---

## Extension Points

### Adding New Plugins

1. Create new directory under `plugin/custom/plugins/`
2. Extend `BasePlugin` or `BaseCustomPlugin`
3. Register with `PluginLoader.register(id, Class, config)`
4. Reuse core utilities (NamespaceManager, EventBus, ConfigManager)

### Adding New Features to PlantUML Plugin

- Add new config options in `config.js`
- Extend `renderer.js` for new output formats
- Add new UI elements in `uiController.js`
- Subscribe to new events via EventBus

---

## Testing Strategy

| Test Item | Method |
|-----------|--------|
| Encoding algorithm | Unit test, compare with official encoding |
| Config read/write | Unit test with mocked localStorage |
| DOM detection | Manual test in Typora |
| Render flow | Test with simple PlantUML content |
| Edit fallback | Manual interaction test |

---

## Dependencies

- **Node.js built-ins**: `zlib` (for deflate compression)
- **Browser APIs**: `MutationObserver`, `localStorage`, `fetch`/`Image`
- **Typora APIs**: Custom plugin mechanism (`BaseCustomPlugin`)

---

## Security Considerations

- **No eval**: No dynamic code execution
- **CORS**: Images loaded from external server
- **XSS prevention**: Error messages sanitized
- **Config isolation**: Plugin config doesn't affect Typora settings

---

## Performance Considerations

- **Debounced rendering**: Don't render on every keystroke
- **Lazy loading**: Only render visible code blocks
- **Cache hits**: Avoid redundant network requests
- **Observer optimization**: Only watch relevant DOM attributes

---

## Future Enhancements

1. **Offline support**: Bundle PlantUML jar for local rendering
2. **Export integration**: Ensure images export correctly to PDF/HTML
3. **Multiple themes**: Support different PlantUML themes
4. **Code completion**: PlantUML syntax hints
5. **Live preview panel**: Side-by-side preview panel
