// Build the MarkPaste "local edition" — a single self-contained HTML file to
// run offline or hand to a colleague.
//
//   npm install        (once, to fetch the markdown-it libraries)
//   npm run build:local
//
// The local edition is a pure Markdown + code editor. Everything it needs is
// inlined, so it works with no network at all: no CDN, no fonts to fetch, no
// failed requests at a customer site. Double-click to open in any browser —
// edit, live preview, syntax highlighting, Copy to clipboard, export HTML/Word,
// and PDF via the browser's print dialog.
//
// Deliberately dropped, to keep the file small and the tool focused:
//   * Snap (the mobile long-image button) — html2canvas alone is 194 KB, and a
//     phone-sized share image is not what this edition is for.
//   * The footer's GitHub / Buy-me-a-coffee links.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'markpaste-local.html');

// Browser (UMD) builds read straight from node_modules — no network needed.
const LIBS = [
  'node_modules/markdown-it/dist/markdown-it.min.js',
  'node_modules/markdown-it-footnote/dist/markdown-it-footnote.min.js',
  'node_modules/markdown-it-task-lists/dist/markdown-it-task-lists.min.js',
  'node_modules/markdown-it-mark/dist/markdown-it-mark.min.js',
];

// The main highlight.js package ships only CommonJS and ESM, both of which
// would need a bundler; @highlightjs/cdn-assets is the same project's
// pre-compiled browser build, so nothing has to be vendored into this repo.
// highlight.min.js carries ~40 common languages; each file listed in
// HL_EXTRA_LANGS registers one more against the global hljs and must load
// after it. Keep this list tight — every entry is weight in the offline file.
const HL_DIR = 'node_modules/@highlightjs/cdn-assets';
const HL_CORE = `${HL_DIR}/highlight.min.js`;
const HL_EXTRA_LANGS = [
  'powershell', 'dockerfile', 'nginx', 'apache', 'dos', 'groovy', 'scala',
  'dart', 'elixir', 'erlang', 'haskell', 'julia', 'latex', 'vim', 'awk',
  'matlab', 'fortran', 'prolog', 'verilog', 'lisp', 'clojure', 'ocaml', 'fsharp',
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

const langFiles = HL_EXTRA_LANGS.map((l) => `${HL_DIR}/languages/${l}.min.js`);

const libTags = [...LIBS, HL_CORE, ...langFiles]
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

// Drop every remote <script src> (the libraries are re-added inline below, and
// html2canvas is dropped altogether along with the Snap button).
html = html.replace(/[ \t]*<script src="https:\/\/[^"]*"><\/script>\r?\n?/g, '');

// Drop the Snap button — it needs html2canvas, which this edition omits.
html = html.replace(/[ \t]*<button id="save-image"[\s\S]*?<\/button>\r?\n?/, '');

// Replace the app script with the inlined libraries + app code (order preserved).
html = html.replace(
  /<script src="script\.js"><\/script>/,
  () => `${libTags}\n<script>\n${safe(js)}\n</script>`
);

// Local edition: drop the footer's GitHub / Buy-me-a-coffee links.
html = html.replace(/[ \t]*<nav class="footer-links">[\s\S]*?<\/nav>\r?\n?/, '');

fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${OUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB) ` +
            `— ${HL_EXTRA_LANGS.length} extra languages inlined`);
