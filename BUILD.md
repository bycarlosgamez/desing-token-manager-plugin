# Build Instructions

## Plugin Architecture

The plugin consists of two parts:
1. **Plugin Code** (`code.ts`) - Runs in Figma's plugin context
2. **UI Code** (`ui.tsx`) - Runs in the browser-like UI iframe

## Building Plugin Code

The plugin code needs to compile all TypeScript files into a single `code.js` file:

```bash
# Simple build (outputs separate files)
npx tsc code.ts --outFile code.js --target es6 --lib es6 --moduleResolution node --types @figma/plugin-typings

# However, with imports, you need to bundle them together
# Recommended: Use a bundler or compile all files together
```

### Recommended Build Process

1. **Option A: Simple concatenation** (works for small projects)
   - Compile each file separately
   - Manually concatenate or use a bundler

2. **Option B: Use a bundler** (recommended)
   - Use Rollup, Webpack, or esbuild
   - Bundle all imports into single `code.js`

3. **Option C: Manual build**
   ```bash
   # Compile all files to a temp directory
   npx tsc *.ts --outDir dist --target es6 --moduleResolution node --skipLibCheck
   
   # Then bundle them manually or use a script
   ```

## Building UI Code

The UI uses React with TypeScript. You need to:

1. **Compile TSX to JS**
2. **Bundle React** (or use CDN)

### Current Setup

- `ui.html` loads React from CDN
- `ui.tsx` should be compiled to `ui.js`
- React expects `window.React` and `window.ReactDOM` to be available

### Building UI

```bash
# Compile TSX to JS (requires React types)
npx tsc ui.tsx --outFile ui.js --target es2017 --lib es2017,dom --jsx react --moduleResolution node --skipLibCheck
```

## Quick Start Build Script

Create a `build.sh` or add to `package.json`:

```json
{
  "scripts": {
    "build": "npm run build:code && npm run build:ui",
    "build:code": "tsc code.ts token-types.ts token-utils.ts token-scanner.ts token-storage.ts --outFile code.js --target es6 --lib es6 --moduleResolution node --skipLibCheck --module none",
    "build:ui": "tsc ui.tsx --outFile ui.js --target es2017 --lib es2017,dom --jsx react --moduleResolution node --skipLibCheck"
  }
}
```

**Note**: The `--module none` flag is important to avoid module syntax in the output.

## Runtime Types

The Figma plugin API provides global objects:
- `figma` - Main Figma API object
- `__html__` - HTML content for UI (set by Figma)
- `console` - Standard console (available in plugin context)

These are typed via `@figma/plugin-typings` but don't exist at compile time.
