# MarkPaste

**Markdown in, rich text out** — write Markdown, hit **Copy**, and paste it into Word, Outlook, Gmail or Notion with the formatting intact.

[English](README.md) · [简体中文](README.zh-CN.md) · [markpaste.com](https://markpaste.com)

[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Live](https://img.shields.io/badge/markpaste.com-live-D4A843)](https://markpaste.com)
[![Zero install](https://img.shields.io/badge/zero%20install-runs%20in%20your%20browser-brightgreen)](https://markpaste.com)
[![No build step](https://img.shields.io/badge/no%20build%20step-vanilla%20JS-lightgrey)](#tech-stack)

No conversion, no cleanup, nothing to install — open the page and write.

## What's new

- **📸 Snap** — turn a document into a phone-width long image, straight to your clipboard. Paste it into a post; no screenshot tool, no cropping.
- **🎨 Three output styles** — *Aurum* (gold serif), *Metro* (clean sans), *Folio* (academic). The preview, the long image and the PDF all follow your choice.
- **🌈 Syntax highlighting** — fenced code blocks are coloured, and the toolbar's ` ``` ` button writes the fence for you from a language list.
- **🔄 Live file sync** — when Claude Code, another agent or another editor rewrites the open file, the change appears on its own. Unsaved edits are never overwritten.
- **📱 Mobile** — a phone gets a single-pane layout with the core path only: paste → read → Copy / Snap.
- **🔗 Open from a link** — copy a Markdown URL, hit **Paste**, and the document behind it loads. `markpaste.com/?url=<md>` renders any Markdown file you can link to.

## Features

**Writing**

- Live preview as you type, powered by [markdown-it](https://github.com/markdown-it/markdown-it)
- Editor / Split / Preview view modes (`Alt+1` / `Alt+2` / `Alt+3`)
- Formatting toolbar and a full keyboard-shortcut set — press `Ctrl+K` to see all of them
- Line editing: move, duplicate or delete lines, indent and outdent, OneNote-style list continuation
- Find and replace with case, whole-word and regex options, plus copy/cut all matching lines
- Footnotes, task lists, tables, and `==highlighted text==`
- Word wrap toggle (`Alt+Z`), dark / light theme, three output styles

**Getting it out**

- **Copy as rich text** (`Ctrl/⌘+Shift+C`) — writes both `text/html` and `text/plain`, so it pastes cleanly into Word, email and chat apps
- **Snap** — a phone-width long image (1125px at 3×) copied to the clipboard, ready to post
- Export to HTML, Word (`.doc`) and PDF

**Not losing work**

- Every keystroke is drafted to `localStorage`; a reload brings the document back
- **New** and **Paste** ask before discarding unsaved changes

## Use it online

👉 **[markpaste.com](https://markpaste.com)** — nothing to install. Everything runs in your browser and no file is ever uploaded. **Save** downloads a `.md`; no server touches your disk.

To open and save `.md` files directly on disk, run it locally instead.

## Run locally

Requires [Node.js](https://nodejs.org/).

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

MarkPaste is **backend-optional**: the frontend probes `/api/health` at startup. With the local server running it enables **Local mode** — open, save and refresh files on disk, the `?file=` URL parameter, and live sync when something else edits the open file. Served as a plain static site (like markpaste.com) the probe fails and it runs in **Web mode**: Save downloads a `.md`, Refresh is hidden, `?file=` is ignored. Same code, no server required.

The local server reads and writes `.md` files and **binds to `127.0.0.1`**, so it is not reachable from the network. **It is meant for local use only** — do not expose it to the internet. If you must run it on a reachable host, set `MD_BASE_DIR` to confine all file access to one directory:

```bash
MD_BASE_DIR=/path/to/notes npm start
```

## Local edition (one offline file)

Build a single self-contained `markpaste-local.html` — every library inlined, **no network requests at all**:

```bash
npm install
npm run build:local
```

Double-click it in any browser: edit, live preview, **syntax highlighting for 59 languages**, Copy to clipboard, export HTML/Word, and PDF through the print dialog. About 415 KB, and it works on a machine with no internet — handy for locked-down or air-gapped environments.

Snap is left out of this edition: html2canvas alone is 194 KB, and a phone-sized share image is not what an offline editor is for.

## Tech stack

- **Frontend**: vanilla HTML / CSS / JS — no framework, no bundler, no build step
- **Backend** (optional): Node.js + Express, for local file read/write only
- **Libraries**: markdown-it (+ footnote, task-lists, mark) and highlight.js — from a CDN online, inlined in the local edition

## Optional: Windows right-click integration

`add-context-menu.reg` / `remove-context-menu.reg`, `open-md.ps1` and `start-hidden.vbs` add an "open `.md` in MarkPaste" entry to the Windows right-click menu. Optional, and Windows-only.

## License

[MIT](LICENSE) © tokicode
