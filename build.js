/**
 * Build script using esbuild to bundle TypeScript files for Figma plugin
 */

const esbuild = require('esbuild');
const path = require('path');

console.log('Building plugin code with esbuild...');

const fs = require('fs');

esbuild.build({
  entryPoints: ['code.ts'],
  bundle: true,
  write: false,
  platform: 'neutral',
  target: 'es6',
  format: 'iife',
  banner: {
    js: '"use strict";',
  },
  external: [],
}).then((result) => {
  // Get the bundled code
  let code = result.outputFiles[0].text;

  // Ensure initPlugin() is called at the end
  if (!code.includes('initPlugin()')) {
    code += '\n\n// Initialize plugin\ninitPlugin();';
  }

  // Write to file
  fs.writeFileSync('code.js', code);
  console.log('✓ Build complete! Created code.js');
}).catch((error) => {
  console.error('✗ Build failed:', error);
  process.exit(1);
});
