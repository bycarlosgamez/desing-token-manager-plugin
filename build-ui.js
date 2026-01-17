/**
 * Build script for UI using esbuild
 * React and ReactDOM are loaded via CDN, so we externalize them
 */

const esbuild = require('esbuild');

console.log('Building UI with esbuild...');

esbuild.build({
  entryPoints: ['ui.tsx'],
  bundle: true,
  outfile: 'ui.js',
  platform: 'browser',
  target: 'es2017',
  format: 'iife',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  banner: {
    js: '"use strict"; console.log("UI JS Banner: Executing..."); try {',
  },
  footer: {
    js: '} catch (e) { console.error("CRITICAL UI JS ERROR:", e); }',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // React and ReactDOM are bundled
  // React and ReactDOM are bundled
  external: [],
  inject: [],
}).then(() => {
  const fs = require('fs');
  // Read the bundled JS
  let jsCode = fs.readFileSync('ui.js', 'utf8');

  // Let's actually WRITE the ui.html content securely here to ensure it's clean
  // Note: We escape backticks or specific characters if needed, but since jsCode is read as string, 
  // simply embedding it in a template literal is fine as long as it doesn't contain backtick-dollar-brace sequences that confuse JS.
  // Ideally we should use simple replace strings to be safer.

  const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Design Tokens Manager</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #root {
      width: 100%;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="root">Loading UI...</div>
  <script>
    ${jsCode}
  </script>
</body>
</html>`;

  fs.writeFileSync('ui.html', htmlTemplate);

  console.log('✓ Build complete! Inlined ui.js into ui.html');
}).catch((error) => {
  console.error('✗ Build failed:', error);
  process.exit(1);
});
