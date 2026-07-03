# MarkPaste

A fast, no-fuss Markdown editor with live preview — and a one-click **Copy to Clipboard** that turns your Markdown into **rich, formatted text** you can paste straight into Word, Outlook, Gmail, or Slack.

Write in Markdown, click **Copy**, paste anywhere as proper formatted content. No conversion, no cleanup.

## Use it online

👉 **[markpaste.com](https://markpaste.com)** — nothing to install. Everything runs in your browser; no files are uploaded anywhere. On the web, **Save** downloads a `.md` file (there's no server touching your disk).

Want to open and save `.md` files directly on disk? Run it locally — see below.

## Features

- **Live preview** — Markdown rendered as you type (powered by [markdown-it](https://github.com/markdown-it/markdown-it))
- **One-click Copy to Clipboard** — copies rich `text/html` (formatted) *and* `text/plain`, so it pastes cleanly into Word, email, and chat apps
- **Editor / Split / Preview** view modes
- **Formatting toolbar** + keyboard shortcuts (Ctrl+B / Ctrl+I / Ctrl+S)
- **Export** to HTML, Word (`.doc`), and PDF
- **Drag & drop** a `.md` file to open
- **Dark / Light** theme
- Open and save local `.md` files (when run locally, see below)

## Run locally

Requires [Node.js](https://nodejs.org/).

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

MarkPaste is **backend-optional**: the frontend probes `/api/health` at startup. With the local server running it enables **Local mode** (open/save/refresh files directly on disk, plus the `?file=` URL parameter). Served as a plain static site (like markpaste.com), the probe fails and it runs in **Web mode** (Save downloads a `.md`, Refresh is hidden, `?file=` is ignored) — the same code, no server required.

The local server lets you read and write `.md` files on disk and **binds to `127.0.0.1`** so it is not reachable from the network. **It is intended for local use only** — do not expose it to the public internet. If you must self-host it on a reachable host, set the `MD_BASE_DIR` environment variable to confine all file access to a single directory:

```bash
MD_BASE_DIR=/path/to/notes npm start
```

## Offline single-file edition

Build one self-contained `markpaste-standalone.html` (style, script, and the
markdown-it libraries all inlined) to share or run without a server:

```bash
npm install
npm run build:standalone
```

Double-click the resulting file to open it in any browser — no install, no
server, works offline (Google Fonts degrade to system fonts when offline).
It runs in Web mode: edit, live preview, Copy to clipboard, export HTML/Word,
and PDF via the browser's print dialog.

## Tech stack

- **Backend**: Node.js + Express (static file serving + local file read/write)
- **Frontend**: vanilla HTML / CSS / JS, no bundler
- **Libraries**: markdown-it (+ footnote, task-lists) via CDN online, inlined in the offline build

## Optional: Windows right-click integration

The `add-context-menu.reg` / `remove-context-menu.reg`, `open-md.ps1`, and `start-hidden.vbs` files set up a Windows right-click "open `.md` in MarkPaste" context menu. These are optional and Windows-only.

## License

[MIT](LICENSE) © tokicode
