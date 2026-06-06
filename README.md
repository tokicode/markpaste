# MarkPaste

A fast, no-fuss Markdown editor with live preview — and a one-click **Copy to Clipboard** that turns your Markdown into **rich, formatted text** you can paste straight into Word, Outlook, Gmail, or Slack.

Write in Markdown, click **Copy**, paste anywhere as proper formatted content. No conversion, no cleanup.

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
node server.js
```

Then open <http://localhost:3000>.

The local server lets you open and save `.md` files directly on disk. **It is intended for local use only** — do not expose it to the public internet, since the file endpoints read and write the local filesystem.

## Tech stack

- **Backend**: Node.js + Express (static file serving + local file read/write)
- **Frontend**: vanilla HTML / CSS / JS, no bundler
- **Libraries (via CDN)**: markdown-it, html2canvas, jsPDF

## Optional: Windows right-click integration

The `add-context-menu.reg` / `remove-context-menu.reg`, `open-md.ps1`, and `start-hidden.vbs` files set up a Windows right-click "open `.md` in MarkPaste" context menu. These are optional and Windows-only.

## License

[MIT](LICENSE) © tokicode
