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

app.use(express.json());

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
