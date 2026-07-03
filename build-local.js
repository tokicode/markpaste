// Build the MarkPaste "local edition" — a single self-contained HTML file to
// run locally or share with colleagues.
//
//   npm install        (once, to fetch the markdown-it libraries)
//   npm run build:local
//
// It inlines style.css, script.js, and the three markdown-it libraries (from
// node_modules) into one markpaste-local.html, and drops the footer's GitHub /
// Buy-me-a-coffee links. Double-click to open in any browser: edit, live
// preview, Copy to clipboard, export HTML/Word, and PDF via the print dialog —
// no server. Google Fonts still load over the network for full-quality type.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'markpaste-local.html');

// Read minified UMD builds from node_modules (no network — works behind proxies).
const LIBS = [
  'node_modules/markdown-it/dist/markdown-it.min.js',
  'node_modules/markdown-it-footnote/dist/markdown-it-footnote.min.js',
  'node_modules/markdown-it-task-lists/dist/markdown-it-task-lists.min.js',
];

// Break any literal </script> so inlined code can't close the host <script> tag.
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${rel} — run "npm install" first.`);
  }
  return fs.readFileSync(p, 'utf8');
}

let html = read('index.html');
const css = read('style.css');
const js = read('script.js');

const libTags = LIBS
  .map((rel) => `<script>/* ${path.basename(rel)} */\n${safe(read(rel))}\n</script>`)
  .join('\n');

// NOTE: use function replacements everywhere — the inlined CSS/JS/libraries
// contain "$" sequences (e.g. regex "$&") that String.replace would otherwise
// interpret as special patterns and corrupt.

// Inline the stylesheet.
html = html.replace(
  /<link rel="stylesheet" href="style\.css">/,
  () => `<style>\n${css}\n</style>`
);

// Drop the three CDN <script src> tags (re-added inline below).
html = html.replace(
  /[ \t]*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/markdown-it[^"]*"><\/script>\r?\n?/g,
  ''
);

// Replace the app script with the inlined libraries + app code (order preserved).
html = html.replace(
  /<script src="script\.js"><\/script>/,
  () => `${libTags}\n<script>\n${safe(js)}\n</script>`
);

// Local edition: drop the footer's GitHub / Buy-me-a-coffee links.
html = html.replace(/[ \t]*<nav class="footer-links">[\s\S]*?<\/nav>\r?\n?/, '');

fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${OUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
