# Design Tokens Manager

A Figma plugin inspired by [figma-tokens.com](https://figma-tokens.com/), but simpler and more opinionated.

## Overview

This plugin allows you to:
- **Scan** Figma document for local styles and variables
- **Map** them to a standardized design token format
- **Edit** tokens in a simple UI
- **Import/Export** tokens as JSON
- **Sync** tokens back to Figma styles (coming soon)

## Architecture

```
/
├── manifest.json          # Figma plugin manifest
├── code.ts               # Main plugin logic (runs in Figma context)
├── ui.html               # UI entry point
├── ui.tsx                # React UI component
├── token-types.ts        # TypeScript types for token schema
├── token-utils.ts        # Utility functions (color conversion, path resolution)
├── token-scanner.ts      # Functions to scan Figma styles/variables
├── token-storage.ts      # ClientStorage read/write utilities
└── package.json          # Dependencies and build scripts
```

## Token Schema

Based on W3C Design Tokens Format:

```json
{
  "color": {
    "brand": {
      "primary": {
        "value": "#2E9FB9",
        "type": "color",
        "description": "Primary brand color",
        "$extensions": {
          "com.figma.style-id": "S:123..."
        }
      }
    }
  },
  "spacing": {
    "base": {
      "value": "8px",
      "type": "spacing"
    }
  }
}
```

### Token Types Supported

- `color` - Colors (hex, rgba)
- `spacing` - Spacing values (px, rem, etc.)
- `typography` - Typography definitions
- `borderRadius` - Border radius values
- `number` - Numeric values

### Token References (Aliases)

Tokens can reference other tokens:

```json
{
  "color": {
    "text": {
      "primary": {
        "value": "{color.brand.primary}",
        "type": "color"
      }
    }
  }
}
```

## Features

### ✅ Implemented

1. **Scan Document** - Reads local color styles and variables
2. **Token Storage** - Saves tokens using `figma.clientStorage`
3. **Import/Export** - JSON import/export functionality
4. **Color Support** - Full color token scanning from:
   - Paint styles (solid colors)
   - Variables (COLOR type)

### 🚧 Coming Soon

1. **Spacing** - Scan spacing tokens from variables/styles
2. **Typography** - Scan text styles
3. **Border Radius** - Scan border radius values
4. **Token Editor** - Edit token values in UI
5. **Sync to Figma** - Create/update Figma styles from tokens
6. **Token References** - Full alias/reference resolution

## Figma API Usage

### Reading Styles

```typescript
// Get all local paint styles
const paintStyles = figma.getLocalPaintStyles();

// Get style properties
for (const style of paintStyles) {
  const paints = style.paints; // Paint[] array
  const name = style.name; // Style name
  const id = style.id; // Style ID
  const description = style.description; // Optional description
}
```

### Reading Variables (API 1.0.0+)

```typescript
// Get local variables (async)
const variables = await figma.variables.getLocalVariablesAsync();

// Get variable collections
const collections = await figma.variables.getLocalVariableCollectionsAsync();

// Access variable properties
for (const variable of variables) {
  const type = variable.resolvedType; // 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  const name = variable.name;
  const valuesByMode = variable.valuesByMode; // { [modeId]: VariableValue }
  const variableCollectionId = variable.variableCollectionId;
}
```

### ClientStorage

```typescript
// Save data
await figma.clientStorage.setAsync('key', data);

// Load data
const data = await figma.clientStorage.getAsync('key');

// Delete data
await figma.clientStorage.deleteAsync('key');
```

### Plugin UI Communication

```typescript
// Send message from plugin code to UI
figma.ui.postMessage({
  type: 'tokens-scanned',
  payload: { tokens, metadata }
});

// Listen for messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'scan-document') {
    // Handle scan request
  }
};
```

## Building

### Prerequisites

- Node.js 16+
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Build

```bash
# Build plugin code (code.ts -> code.js)
npm run build:code

# Build UI (ui.tsx -> ui.js)
# Note: This requires a bundler (webpack/vite) for React
# For now, use a bundler or manual compilation
npm run build:ui

# Build everything
npm run build
```

### Development

```bash
# Watch mode
npm run watch
```

## Development Notes

### React UI Build

The UI uses React with TypeScript (TSX). To properly bundle React:

1. **Option 1**: Use a bundler like Webpack or Vite
2. **Option 2**: Use React via CDN (simpler, but less type-safe)
3. **Option 3**: Compile TSX to JS and include React via CDN

Currently, `ui.html` loads React from CDN. The `ui.js` file should be compiled separately.

### TypeScript Compilation

The plugin code needs to be compiled to ES6 JavaScript. The code runs in:
- **Plugin code**: Figma's plugin sandbox (Node.js-like environment)
- **UI code**: Browser environment (can use DOM APIs)

## Token Naming Conventions

Styles and variables are automatically parsed into token paths:

- `color/brand/primary` → `{ color: { brand: { primary: {...} } } }`
- `color.brand.primary` → `{ color: { brand: { primary: {...} } } }`
- `Brand/Primary Color` → `{ color: { brand: { primaryColor: {...} } } }`

Names are converted to camelCase automatically.

## Contributing

1. Add new token types in `token-types.ts`
2. Implement scanners in `token-scanner.ts`
3. Add utilities in `token-utils.ts`
4. Update UI in `ui.tsx`

## License

MIT
