// MarkPaste local server.
//
// ⚠️ This server is intended for LOCAL USE ONLY. It reads and writes files on
// the local filesystem and binds to 127.0.0.1 so it is not reachable from the
// network. Do NOT expose it to the public internet. If you must self-host it on
// a reachable host, set the MD_BASE_DIR environment variable to confine all
// file access to a single directory (see below).
//
// The hosted web app (markpaste.com) ships WITHOUT this server: the frontend
// detects the absence of a backend and runs in a static, disk-free "Web mode".

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const app = express();
const port = 3000;

// Optional sandbox: when MD_BASE_DIR is set, all file access is confined to it.
// When unset (the default), file access is unrestricted — same as before.
const baseDir = process.env.MD_BASE_DIR
  ? path.resolve(process.env.MD_BASE_DIR)
  : null;

// Resolve a user-supplied path, enforcing the sandbox when one is configured.
// Returns the absolute path, or null if it escapes MD_BASE_DIR.
function resolveSafe(filePath) {
  const resolved = path.resolve(filePath);
  if (baseDir && !(resolved === baseDir || resolved.startsWith(baseDir + path.sep))) {
    return null;
  }
  return resolved;
}

app.use(express.json({ limit: '25mb' }));

// Health probe — lets the frontend detect that a backend is present and enable
// Local mode (disk open/save/refresh). Absent backend → Web mode.
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// API routes first
app.get('/open-file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'path parameter is required' });
  }
  const resolved = resolveSafe(filePath);
  if (!resolved) {
    return res.status(403).json({ error: 'Access denied: path is outside MD_BASE_DIR' });
  }
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    res.json({ filePath: resolved, content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read file: ' + error.message });
  }
});

app.post('/save-markdown', (req, res) => {
  const { filePath, content } = req.body;

  // Only filePath is required; an empty string is a valid (cleared) document.
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  const resolved = resolveSafe(filePath);
  if (!resolved) {
    return res.status(403).json({ error: 'Access denied: path is outside MD_BASE_DIR' });
  }

  try {
    fs.writeFileSync(resolved, content ?? '', 'utf8');
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save file: ' + error.message });
  }
});

// --- PDF export via headless Edge/Chrome -----------------------------------
// Generates a TRUE text-based, multi-page PDF from the rendered preview HTML
// using the system browser's print engine. This renders CJK/emoji with the OS
// fonts (e.g. Yu Gothic / Meiryo) — no font embedding by the app — and produces
// a tiny, selectable-text PDF. Local-only; the web build falls back to print().

// Locate an installed Chromium-based browser. Override with MARKPASTE_BROWSER.
function findBrowser() {
  const override = process.env.MARKPASTE_BROWSER;
  if (override && fs.existsSync(override)) return override;
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// Wrap the rendered body in a self-contained, print-optimized document.
// Uses a system font stack so Japanese falls back to Yu Gothic / Meiryo with no
// network dependency (the app's Google Fonts are Latin-only display faces).
function buildPrintHtml(bodyHtml, title) {
  const safeTitle = String(title || 'MarkPaste').replace(/[<>&]/g, '');
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI','Yu Gothic UI','Yu Gothic',Meiryo,sans-serif;
    color:#1a1a1a; background:#fff; font-size:11pt; line-height:1.65; margin:0; }
  h1,h2,h3,h4,h5,h6 { line-height:1.3; margin:1.2em 0 .5em; break-after:avoid; }
  h1 { font-size:1.9em; border-bottom:2px solid #ddd; padding-bottom:.2em; }
  h2 { font-size:1.5em; border-bottom:1px solid #eee; padding-bottom:.15em; }
  h3 { font-size:1.25em; } h4 { font-size:1.1em; }
  p { margin:.6em 0; }
  ul,ol { margin:.5em 0; padding-left:1.6em; }
  li { margin:.25em 0; break-inside:avoid; }
  blockquote { margin:.8em 0; padding:.2em 1em; border-left:4px solid #ccc; color:#555; break-inside:avoid; }
  code { font-family:'Cascadia Code',Consolas,monospace; background:#f4f4f4; padding:.1em .35em; border-radius:3px; font-size:.92em; }
  pre { background:#f4f4f4; padding:.8em 1em; border-radius:6px; white-space:pre-wrap; overflow-wrap:anywhere; break-inside:avoid; }
  pre code { background:none; padding:0; }
  a { color:#1155cc; text-decoration:underline; word-break:break-all; }
  table { border-collapse:collapse; width:100%; margin:.8em 0; break-inside:avoid; }
  th,td { border:1px solid #ccc; padding:.4em .6em; text-align:left; }
  th { background:#f0f0f0; }
  hr { border:none; border-top:1px solid #ddd; margin:1.2em 0; }
  img { max-width:100%; break-inside:avoid; }
</style></head><body>${bodyHtml}</body></html>`;
}

app.post('/export-pdf', (req, res) => {
  const { html, title } = req.body || {};
  if (typeof html !== 'string' || !html.trim()) {
    return res.status(400).json({ error: 'html is required' });
  }
  const browser = findBrowser();
  if (!browser) {
    return res.status(500).json({
      error: 'No Edge/Chrome found. Set the MARKPASTE_BROWSER env var to the browser .exe path.',
    });
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const htmlPath = path.join(os.tmpdir(), `markpaste-${stamp}.html`);
  const pdfPath = path.join(os.tmpdir(), `markpaste-${stamp}.pdf`);
  const userDataDir = path.join(os.tmpdir(), `markpaste-profile-${stamp}`);

  const cleanup = () => {
    try { fs.rmSync(htmlPath, { force: true }); } catch {}
    try { fs.rmSync(pdfPath, { force: true }); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  };

  try {
    fs.writeFileSync(htmlPath, buildPrintHtml(html, title), 'utf8');
  } catch (e) {
    cleanup();
    return res.status(500).json({ error: 'Failed to write temp HTML: ' + e.message });
  }

  // A dedicated temp profile lets headless run even while the user's Edge is open.
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    `--print-to-pdf=${pdfPath}`,
    htmlPath,
  ];

  const child = spawn(browser, args, { windowsHide: true });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  let done = false;
  const finish = (fn) => { if (!done) { done = true; fn(); } };

  const timer = setTimeout(() => {
    try { child.kill(); } catch {}
    finish(() => { cleanup(); res.status(500).json({ error: 'PDF generation timed out' }); });
  }, 30000);

  child.on('error', (err) => {
    clearTimeout(timer);
    finish(() => { cleanup(); res.status(500).json({ error: 'Failed to launch browser: ' + err.message }); });
  });

  child.on('exit', (code) => {
    clearTimeout(timer);
    finish(() => {
      fs.readFile(pdfPath, (err, data) => {
        if (err || !data || !data.length) {
          cleanup();
          return res.status(500).json({
            error: 'PDF was not generated. ' + (stderr.slice(0, 500) || `browser exit code ${code}`),
          });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.send(data);
        cleanup();
      });
    });
  });
});

// Static files last
app.use(express.static(__dirname));

// Bind to loopback only so the disk-backed endpoints are never network-reachable.
// We listen on BOTH IPv4 (127.0.0.1) and IPv6 (::1) loopback because on Windows
// "localhost" resolves to ::1 first; binding only one family makes the browser's
// localhost request miss the server. Both are loopback, so neither exposes the
// network. If a family is unavailable, ignore that listener gracefully.
const loopbackHosts = ['127.0.0.1', '::1'];
for (const host of loopbackHosts) {
  const display = host.includes(':') ? `[${host}]` : host;
  app
    .listen(port, host, () => {
      console.log(`Server listening at http://${display}:${port}`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use on ${display}.`);
      } else if (err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL') {
        // This address family isn't available on this machine — skip it.
      } else {
        throw err;
      }
    });
}
