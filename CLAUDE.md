# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarkPaste — a Markdown editor with live preview and one-click "copy to rich text". Users load `.md` files, edit with live preview, copy formatted output to the clipboard, and export as Markdown, HTML, Word, or PDF.

The app is **backend-optional** and ships in two forms from one codebase:
- **Local mode** (`node server.js` running): full disk access — open/save/refresh `.md` files, `?file=` URL param.
- **Web mode** (hosted as a static site, e.g. markpaste.com): no backend; Save downloads a `.md`, Refresh is hidden, `?file=` is ignored. All other features (preview, copy, HTML/Word/PDF export, drag-drop) are pure client-side and work identically.

The frontend decides which mode to use by probing `GET /api/health` at startup (`initBackendMode()` in script.js), setting the `HAS_BACKEND` flag.

## Commands

### Run the application
```bash
npm start          # = node server.js
```
Server starts at http://localhost:3000 (bound to 127.0.0.1, local-only).

### Install dependencies
```bash
npm install
```

No test framework or linter is currently configured.

## Architecture

### Backend (server.js)
- Express 5 static file server serving the frontend from the project root; binds to `127.0.0.1` only
- `GET /api/health` — returns `{ ok: true }`; the frontend probes this to detect Local vs Web mode
- `POST /save-markdown` — accepts `{ filePath, content }`, writes to disk via `fs.writeFileSync` (only `filePath` is required; empty `content` is a valid cleared document)
- `GET /open-file?path=` — reads a local file and returns `{ filePath, content }`; used by `?file=` URL param and Refresh
- Optional sandbox: when `MD_BASE_DIR` is set, `/open-file` and `/save-markdown` reject paths outside it (403); unset = unrestricted (default)

### Frontend (index.html, script.js, style.css)
- Two-column layout: `#editor-panel` (left) and `#preview-panel` (right) are `.panel-wrapper` flex children of `.editor-container`
- `#markdown-input` (textarea) and `#rendered-output` (div) live inside those wrappers — resizer targets the wrappers, not the inner elements
- `#file-input` is CSS-hidden; triggered by `<label for="file-input">` — the `change` event listener still works normally
- Theme: dark by default; `body.light-mode` class activates light theme (stored in localStorage as `'light'`/`'dark'`)
- View mode toggle: three buttons in header switch `.editor-container` between `mode-editor` / default / `mode-preview` classes; CSS hides the inactive panel and resizer
- Google Fonts loaded via `<link>` in `<head>` (not CSS @import) for performance
- CDN dependencies (no bundler):
  - **markdown-it** (v12.3.2) — Markdown parsing and HTML rendering
  - **html2canvas** (v1.4.1) — HTML-to-canvas conversion for PDF export
  - **jsPDF** (v2.5.1) — PDF generation and download

### Data Flow
1. User loads a `.md` file via HTML file input → FileReader reads content
2. markdown-it parses Markdown → renders HTML into the preview panel
3. Edits in the textarea trigger live re-rendering
4. Save options:
   - **Save MD**: Local mode → POST to `/save-markdown` (server writes to disk); Web mode → browser download of a `.md`
   - **Copy**: writes both `text/html` (rich) and `text/plain` to the clipboard via the Clipboard API
   - **Save HTML/Word/PDF**: Client-side only (Blob download / html2canvas + jsPDF) → browser download
