# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Markdown file editor and converter built with Node.js + Express. Users can load `.md` files, edit with live preview, and export as Markdown, HTML, or PDF.

## Commands

### Run the application
```bash
node server.js
```
Server starts at http://localhost:3000

### Install dependencies
```bash
npm install
```

No test framework or linter is currently configured.

## Architecture

### Backend (server.js)
- Express 5 static file server serving the frontend from the project root
- `POST /save-markdown` — accepts `{ filePath, content }`, writes to disk via `fs.writeFileSync`
- `GET /open-file?path=` — reads a local file and returns `{ filePath, content }`; used by `?file=` URL param

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
   - **Save MD**: POST to `/save-markdown` endpoint → server writes file to disk
   - **Save HTML/PDF**: Client-side only via html2canvas + jsPDF → browser download
