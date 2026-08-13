const markdownInput = document.getElementById('markdown-input');
const renderedOutput = document.getElementById('rendered-output');
const fileInput = document.getElementById('file-input');
const appTitle = document.getElementById('app-title');
const saveMdButton = document.getElementById('save-md');
const saveAsMdButton = document.getElementById('save-as-md');
const saveHtmlButton = document.getElementById('save-html');
const savePdfButton = document.getElementById('save-pdf');
const saveWordButton = document.getElementById('save-word');
const saveImageButton = document.getElementById('save-image');
const copyClipboardButton = document.getElementById('copy-clipboard');
const themeToggle = document.getElementById('theme-toggle');
const refreshButton = document.getElementById('refresh-file');
const clearButton = document.getElementById('clear-editor');
const pasteButton = document.getElementById('paste-clipboard');
const wrapToggle = document.getElementById('wrap-toggle');
const saveStatus = document.getElementById('save-status');
const findBar = document.getElementById('find-bar');
const findInput = document.getElementById('find-input');
const findCount = document.getElementById('find-count');
const replaceRow = document.getElementById('replace-row');
const replaceInput = document.getElementById('replace-input');
const shortcutsOverlay = document.getElementById('shortcuts-overlay');
const shortcutsBody = document.getElementById('shortcuts-body');
function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Colour fenced code blocks. Only when the fence names a language: highlight.js
// can guess, but it guesses badly on short snippets, and mis-coloured code is
// worse than plain code. Guarded so a CDN miss just yields plain blocks.
function highlightCode(str, lang) {
    if (lang && window.hljs) {
        try {
            if (hljs.getLanguage(lang)) {
                return '<pre class="hljs"><code class="language-' + escapeHtml(lang) + '">' +
                    hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                    '</code></pre>';
            }
        } catch { /* fall through to a plain block */ }
    }
    return '<pre class="hljs"><code>' + escapeHtml(str) + '</code></pre>';
}

const md = window.markdownit({ highlight: highlightCode });
// Footnote support ([^1] … [^1]: …). Guarded so a CDN miss won't break rendering.
if (window.markdownitFootnote) md.use(window.markdownitFootnote);
// GitHub-style task lists: "- [ ] todo" / "- [x] done" render as checkboxes.
if (window.markdownitTaskLists) md.use(window.markdownitTaskLists);
// ==highlighted text== → <mark>, the convention Obsidian and many note apps use.
if (window.markdownitMark) md.use(window.markdownitMark);

// Allow a literal <br> as a line break — the usual way to break a line inside a
// table cell, where Markdown offers no syntax for it. Raw HTML stays disabled
// (markdown-it's html:false default), so every other tag is still escaped to
// text: pasting <script> or <img onerror=…> can never execute. This is an
// inline rule rather than a post-render string replacement, so a <br> written
// inside a code block or `inline code` is still shown verbatim.
md.inline.ruler.before('text', 'safe_br', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x3C /* < */) return false;
    const match = /^<br\s*\/?>/i.exec(state.src.slice(state.pos, state.pos + 8));
    if (!match) return false;
    if (!silent) state.push('hardbreak', 'br', 0);
    state.pos += match[0].length;
    return true;
});

let currentFile = null;
let isDirty = false;

// Set when the document came from a URL rather than a local file. Deliberately
// separate from currentFile: in Local mode currentFile is a disk path that Save
// writes to, and a URL must never end up being written to disk.
let sourceUrl = null;

// --- Mobile adaptation (≤768px) ---------------------------------------------
// At phone width the app is reduced to its core path: paste → read → Copy/Snap.
// The layout work lives in the CSS breakpoint; these helpers drive the
// behaviour CSS can't express (fixed appearance, default view, no split mode).
// Queried live rather than captured once, so it is never read before layout
// has settled.
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

// Appearance is fixed on phones: light + Aurum. Applied directly instead of via
// applyStyle()/toggleTheme() so a desktop preference stored in the same browser
// profile is never overwritten.
function applyMobileAppearance() {
    if (!isMobile()) return;
    document.body.classList.add('light-mode');
    document.body.dataset.style = 'editorial';
}

// Backend detection: true when the local server.js is running (Local mode),
// false on the hosted static site (Web mode). Set by initBackendMode() at startup.
let HAS_BACKEND = false;

// --- Theme toggle ---
// Default is dark; light-mode class switches to light theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

// --- Editor word wrap toggle (Alt+Z) ---
// Default: wrap on. .no-wrap switches the editor to horizontal scrolling.
function applyWrap(wrap) {
    markdownInput.classList.toggle('no-wrap', !wrap);
    wrapToggle.classList.toggle('active', wrap);
    wrapToggle.setAttribute('aria-pressed', wrap ? 'true' : 'false');
}
function toggleWrap() {
    const wrap = markdownInput.classList.contains('no-wrap'); // was off → turning on
    applyWrap(wrap);
    try { localStorage.setItem('wrap', wrap ? 'on' : 'off'); } catch { /* ignore */ }
}
applyWrap(localStorage.getItem('wrap') !== 'off');   // default: wrap on
wrapToggle.addEventListener('click', toggleWrap);

// --- Unsaved changes tracking ---
function markDirty() {
    if (!isDirty) {
        isDirty = true;
        saveStatus.textContent = '● unsaved';
        saveStatus.className = 'status-indicator unsaved';
    }
}

function markSaved() {
    isDirty = false;
    saveStatus.textContent = '✓ saved';
    saveStatus.className = 'status-indicator saved';
    setTimeout(() => {
        if (!isDirty) {
            saveStatus.textContent = '';
            saveStatus.className = 'status-indicator';
        }
    }, 2200);
}

// --- Title update ---
// Last path segment of a URL, e.g. ".../main/README.md" → "README.md".
function urlFileName(url) {
    try {
        const name = decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean).pop();
        return name || '';
    } catch {
        return '';
    }
}

function updateTitle(filePath) {
    currentFile = filePath;
    // A document loaded from a URL has no local path, so fall back to the file
    // name in the URL; the full address goes in the tooltip so the source of
    // the content is always checkable.
    const name = filePath ? filePath.split(/[\\/]/).pop() : (sourceUrl ? urlFileName(sourceUrl) : '');
    appTitle.textContent = name || 'MarkPaste';
    appTitle.title = sourceUrl || filePath || '';
    document.title = name ? `${name} — MarkPaste` : 'MarkPaste';
}

// --- File loading ---
function loadFileContent(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        markdownInput.value = e.target.result;
        renderMarkdown();
        updateTitle(file.path || file.name);
        saveDraft();
        isDirty = false;
        saveStatus.textContent = '';
        saveStatus.className = 'status-indicator';
        markFileInSync();
    };
    reader.readAsText(file);
}

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) loadFileContent(file);
});

// --- Drag & Drop ---
markdownInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    markdownInput.classList.add('drag-over');
});

markdownInput.addEventListener('dragleave', () => {
    markdownInput.classList.remove('drag-over');
});

markdownInput.addEventListener('drop', (e) => {
    e.preventDefault();
    markdownInput.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.md')) {
        loadFileContent(file);
    } else {
        alert('Please drop a .md file.');
    }
});

// --- Live preview ---
function renderMarkdown() {
    renderedOutput.innerHTML = md.render(markdownInput.value);
}

markdownInput.addEventListener('input', () => {
    renderMarkdown();
    markDirty();
    saveDraft();
});

// --- Draft persistence (localStorage) — never lose content on refresh ---
const DRAFT_KEY = 'markpaste:draft';
let draftTimer = null;

function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}
function writeDraftNow() {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            content: markdownInput.value,
            currentFile,
            sourceUrl,
            updatedAt: Date.now()
        }));
    } catch { /* storage full / unavailable — ignore */ }
}
function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraftNow, 400);
}
// Flush synchronously right before the page unloads (reload/close), so even an
// edit made a split-second before a refresh is never lost. If there are
// unsaved changes, also ask the browser to show its "Leave site?" prompt
// (covers Ctrl+W, tab close, and closing the whole window).
window.addEventListener('beforeunload', (e) => {
    clearTimeout(draftTimer);
    writeDraftNow();
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';   // required by Chrome/Edge to show the prompt
    }
});

function showDraftRestoredHint() {
    saveStatus.textContent = '↩ unsaved edits restored';
    saveStatus.className = 'status-indicator saved';
    setTimeout(() => {
        if (!isDirty) {
            saveStatus.textContent = '';
            saveStatus.className = 'status-indicator';
        }
    }, 2600);
}

// Restore a saved draft when the editor is empty (Web mode, or Local mode opened
// with no ?file=). Opening a real file via ?file= is handled in loadFromUrl,
// which prefers a newer draft for that same file (Design 2).
function restoreDraftIfEmpty() {
    if (markdownInput.value.trim() !== '') return;
    const draft = readDraft();
    if (!draft || !draft.content) return;
    markdownInput.value = draft.content;
    renderMarkdown();
    // Restore the URL identity too, so the title and Refresh keep working after
    // a reload of a document that was loaded from a link.
    sourceUrl = draft.sourceUrl || null;
    if (draft.currentFile || sourceUrl) updateTitle(draft.currentFile || null);
    updateRefreshVisibility();
    showDraftRestoredHint();
}

// --- Save functions ---
async function saveToServer(filePath, content) {
    const response = await fetch('/save-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
}

// Strip characters that are illegal in file names (and emoji/symbols), keeping
// CJK and normal text. Used to build safe download names.
function sanitizeFileName(name) {
    return name
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
        .replace(/[<>:"/\\|?*-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
        .trim();
}

// Base name (no path, no extension) for all exports: prefer the open file's
// name; otherwise the document's first heading; otherwise a generic fallback.
function exportBaseName() {
    if (currentFile) {
        const fromFile = sanitizeFileName(
            currentFile.split(/[\\/]/).pop().replace(/\.(md|markdown)$/i, '')
        );
        if (fromFile) return fromFile;
    }
    if (sourceUrl) {
        const fromUrl = sanitizeFileName(urlFileName(sourceUrl).replace(/\.(md|markdown)$/i, ''));
        if (fromUrl) return fromUrl;
    }
    const heading = renderedOutput.querySelector('h1, h2, h3');
    const fromHeading = heading ? sanitizeFileName(heading.textContent) : '';
    if (fromHeading) return fromHeading;
    return 'markpaste';
}

// Web mode fallback: download the markdown as a .md file via the browser.
function downloadMarkdown(content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportBaseName() + '.md';
    a.click();
}

saveMdButton.addEventListener('click', async () => {
    // Web mode: no disk backend, so Save downloads the file instead.
    if (!HAS_BACKEND) {
        downloadMarkdown(markdownInput.value);
        markSaved();
        return;
    }
    if (!currentFile) {
        alert('No file opened yet. Use "Save As" to specify a path.');
        return;
    }
    try {
        await saveToServer(currentFile, markdownInput.value);
        markSaved();
        await markFileInSync();   // our own write must not read as an external change
    } catch (error) {
        alert('Error saving file: ' + error.message);
    }
});

saveAsMdButton.addEventListener('click', async () => {
    // Web mode: "Save As" is the same browser download as Save.
    if (!HAS_BACKEND) {
        downloadMarkdown(markdownInput.value);
        markSaved();
        return;
    }
    const filePath = prompt('Enter file path to save:', currentFile || 'output.md');
    if (!filePath) return;
    try {
        await saveToServer(filePath, markdownInput.value);
        updateTitle(filePath);
        markSaved();
        await markFileInSync();
    } catch (error) {
        alert('Error saving file: ' + error.message);
    }
});

// --- Loading Markdown from a URL -------------------------------------------
// There is no backend to proxy through, so this is subject to CORS: GitHub raw
// and gists send Access-Control-Allow-Origin, most other hosts do not. Every
// failure is therefore treated as "not a Markdown URL" and falls back silently.

const FETCH_TIMEOUT_MS = 3000;
const FETCH_MAX_BYTES = 2 * 1024 * 1024;

// The URL you copy from GitHub's address bar points at the HTML page, not the
// file. Rewrite those to their raw equivalent so the common case just works.
function toRawUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'github.com') {
            // /owner/repo/blob/ref/path → raw.githubusercontent.com/owner/repo/ref/path
            const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
            if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
        }
        if (u.hostname === 'gist.github.com') {
            return `https://gist.githubusercontent.com${u.pathname}/raw`;
        }
    } catch { /* not a parsable URL — caller handles it */ }
    return url;
}

// True only when the text is nothing but a single http(s) URL. Anything else is
// ordinary content: pasting a bare URL as an entire document is never the
// intent, and Ctrl+V in the editor still inserts URLs as text as usual.
function isBareHttpUrl(text) {
    if (/\s/.test(text)) return false;
    try {
        const u = new URL(text);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

// Fetch Markdown, or throw. Rejects anything that isn't plain text so a fetched
// web page never lands in the editor as a screenful of escaped HTML tags.
async function fetchMarkdownFromUrl(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(toRawUrl(url), {
            signal: controller.signal,
            redirect: 'follow',
            credentials: 'omit'
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const type = (response.headers.get('content-type') || '').toLowerCase();
        if (type && !/^text\/(plain|markdown|x-markdown)/.test(type)) {
            throw new Error('not Markdown (' + type.split(';')[0] + ')');
        }
        const size = Number(response.headers.get('content-length') || 0);
        if (size > FETCH_MAX_BYTES) throw new Error('file too large');

        const text = await response.text();
        if (text.length > FETCH_MAX_BYTES) throw new Error('file too large');
        return text;
    } finally {
        clearTimeout(timer);
    }
}

// Put fetched Markdown into the editor. currentFile stays null on purpose so
// Save can never try to write back to the URL.
function applyFetchedMarkdown(text, url) {
    markdownInput.value = text;
    currentFile = null;
    sourceUrl = url;
    updateTitle(null);
    renderMarkdown();
    isDirty = false;
    saveDraft();
    updateRefreshVisibility();
    try {
        saveStatus.textContent = '↓ loaded from ' + new URL(url).hostname;
        saveStatus.className = 'status-indicator saved';
        setTimeout(() => {
            if (!isDirty) {
                saveStatus.textContent = '';
                saveStatus.className = 'status-indicator';
            }
        }, 2600);
    } catch { /* ignore */ }
}

// --- New / Paste (quickly start or replace the document) ---
// Both replace everything, so check before throwing away unsaved edits.
function confirmDiscard() {
    return !isDirty || confirm('You have unsaved changes. Replace the current document?');
}

// Clear the editor to a blank, untitled document.
function clearEditor() {
    if (!confirmDiscard()) return;
    markdownInput.value = '';
    currentFile = null;
    sourceUrl = null;
    updateTitle(null);          // untitled → exports fall back to heading/generic name
    renderMarkdown();
    isDirty = false;
    saveStatus.textContent = '';
    saveStatus.className = 'status-indicator';
    saveDraft();
    updateRefreshVisibility();
    markdownInput.focus();
}

// Replace the whole document with the clipboard contents. If the clipboard is
// nothing but a link, fetch it and load the Markdown it points at instead —
// failures fall back to pasting the URL as plain text.
async function clearAndPasteFromClipboard() {
    if (!confirmDiscard()) return;
    let text;
    try {
        text = await navigator.clipboard.readText();
    } catch (err) {
        alert('Could not read the clipboard (' + err.message +
              ').\nAllow clipboard access, or click the editor and press Ctrl+V to paste manually.');
        return;
    }

    const trimmed = text.trim();
    let linkFailure = null;
    if (isBareHttpUrl(trimmed)) {
        try {
            const markdown = await fetchMarkdownFromUrl(trimmed);
            applyFetchedMarkdown(markdown, trimmed);
            // Make the loaded document shareable and reload-safe.
            history.replaceState(null, '', '?url=' + encodeURIComponent(trimmed));
            markdownInput.focus();
            return;
        } catch (err) {
            // Fall through and paste the URL as text, but remember why: pasting
            // plain text silently is right, silently failing on a link is not.
            linkFailure = err.name === 'AbortError' ? 'timed out' : err.message;
        }
    }

    markdownInput.value = text;
    currentFile = null;
    sourceUrl = null;
    updateTitle(null);
    renderMarkdown();
    // Set the indicator outright rather than via markDirty(), which is a no-op
    // when the document is already dirty and would leave a stale message up.
    isDirty = !!text.trim();
    saveStatus.textContent = isDirty ? '● unsaved' : '';
    saveStatus.className = isDirty ? 'status-indicator unsaved' : 'status-indicator';
    saveDraft();
    updateRefreshVisibility();
    if (linkFailure) {
        // Overwrites the "unsaved" marker for a moment, which is fine: the
        // reason the link did not load is the more useful thing to show.
        saveStatus.textContent = '⚠ link not loaded (' + linkFailure + ') — pasted as text';
        saveStatus.className = 'status-indicator unsaved';
        setTimeout(() => {
            if (isDirty) {
                saveStatus.textContent = '● unsaved';
                saveStatus.className = 'status-indicator unsaved';
            }
        }, 4000);
    }
    markdownInput.focus();
}

clearButton.addEventListener('click', clearEditor);
pasteButton.addEventListener('click', clearAndPasteFromClipboard);

saveHtmlButton.addEventListener('click', () => {
    const renderedHtml = renderedOutput.innerHTML;
    const blob = new Blob([renderedHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportBaseName() + '.html';
    a.click();
});

savePdfButton.addEventListener('click', async () => {
    const baseName = exportBaseName();

    // Web mode (no backend): use the browser's native print-to-PDF. The @media
    // print stylesheet shows only the rendered output, so "Save as PDF" yields a
    // true text-based, full-content, multi-page PDF.
    if (!HAS_BACKEND) {
        window.print();
        return;
    }

    // Local mode: let the server render a true text-based PDF via headless
    // Edge/Chrome (system fonts, full content, multi-page, tiny file) — one click.
    try {
        const response = await fetch('/export-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: renderedOutput.innerHTML, title: baseName })
        });
        if (!response.ok) {
            let msg = 'PDF export failed';
            try { msg = (await response.json()).error || msg; } catch {}
            throw new Error(msg);
        }
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = baseName + '.pdf';
        a.click();
        URL.revokeObjectURL(a.href);
    } catch (error) {
        // Fall back to the browser print dialog if the server route fails.
        alert('Server PDF export failed (' + error.message +
              ').\nFalling back to the browser print dialog — choose "Save as PDF".');
        window.print();
    }
});

saveWordButton.addEventListener('click', () => {
    const renderedHtml = renderedOutput.innerHTML;
    const wordContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Export</title></head><body>${renderedHtml}</body></html>`;
    const blob = new Blob([wordContent], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportBaseName() + '.doc';
    a.click();
});

// --- Snap: mobile-ready long image ------------------------------------------
// Renders the preview as a phone-width PNG and copies it to the clipboard
// (Universal Clipboard pastes it straight on an iPhone). Falls back to a
// .png download when the clipboard can't take images.

// Pick the capture size. On a phone, use the visitor's own screen; on desktop,
// default to the iPhone 13 mini preset (375pt logical @3x → 1125px wide).
function snapshotTarget() {
    const isMobile = window.matchMedia('(pointer: coarse)').matches
        && Math.min(window.innerWidth, window.innerHeight) < 768;
    if (isMobile) {
        return {
            width: Math.min(screen.width, 480),
            scale: Math.min(window.devicePixelRatio || 2, 3)
        };
    }
    return { width: 375, scale: 3 };
}

async function captureLongImage() {
    if (!window.html2canvas) {
        alert('Image library failed to load (html2canvas CDN). Check your connection and reload.');
        return;
    }
    const target = snapshotTarget();

    // Opaque overlay hides the capture-time reflow of the real preview node.
    const overlay = document.createElement('div');
    overlay.className = 'snapshot-overlay';
    overlay.textContent = '📸 Generating long image…';
    document.body.appendChild(overlay);

    // Snapshot state we must restore afterwards.
    const wasLight = document.body.classList.contains('light-mode');
    const prevScroll = renderedOutput.scrollTop;
    const watermark = document.createElement('div');
    watermark.className = 'snapshot-watermark';
    watermark.textContent = '◈ markpaste.com';

    try {
        document.body.classList.add('light-mode', 'snapshot-mode');
        renderedOutput.style.width = target.width + 'px';
        renderedOutput.appendChild(watermark);

        // Let the browser reflow (and settle fonts) before measuring/painting.
        await new Promise(requestAnimationFrame);

        // Safety net: if something still refuses to fit the phone width (a wide
        // image, an unbreakable code line), widen the capture rather than let
        // html2canvas clip the right edge.
        if (renderedOutput.scrollWidth > target.width + 1) {
            renderedOutput.style.width = renderedOutput.scrollWidth + 'px';
            await new Promise(requestAnimationFrame);
        }

        // Canvas height is capped (~32k px); drop the scale for very long docs.
        let scale = target.scale;
        const contentHeight = renderedOutput.scrollHeight;
        if (contentHeight * scale > 32000) {
            scale = Math.max(1, Math.floor(32000 / contentHeight));
        }

        const canvas = await html2canvas(renderedOutput, {
            scale,
            useCORS: true,
            backgroundColor: null,
            logging: false
        });

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Canvas produced no image (document may be too long)');

        let copied = false;
        if (navigator.clipboard && window.ClipboardItem) {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                copied = true;
            } catch { /* fall through to download */ }
        }
        if (!copied) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = exportBaseName() + '.png';
            a.click();
            URL.revokeObjectURL(a.href);
        }

        const orig = saveImageButton.textContent;
        saveImageButton.textContent = copied ? 'Copied!' : 'Saved!';
        setTimeout(() => { saveImageButton.textContent = orig; }, 1500);
    } catch (error) {
        alert('Failed to generate image: ' + error.message);
    } finally {
        watermark.remove();
        renderedOutput.style.width = '';
        document.body.classList.remove('snapshot-mode');
        if (!wasLight) document.body.classList.remove('light-mode');
        renderedOutput.scrollTop = prevScroll;
        overlay.remove();
    }
}

// Optional-chained: during a deploy, a cached older index.html can be paired
// with this newer script. A missing button must not throw here, or every
// feature defined below (find, shortcuts, view modes…) would stop loading.
saveImageButton?.addEventListener('click', captureLongImage);

// Copy the rendered preview as rich text (text/html + text/plain) — the
// signature feature. Reused by the Copy button and the Ctrl/⌘+Shift+C shortcut.
const copyLabel = copyClipboardButton.querySelector('.copy-label');
async function copyRichText() {
    try {
        const htmlContent = renderedOutput.innerHTML;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([renderedOutput.innerText], { type: 'text/plain' });
        await navigator.clipboard.write([
            new ClipboardItem({
                'text/html': blob,
                'text/plain': textBlob
            })
        ]);
        copyLabel.textContent = 'Copied!';
        copyClipboardButton.classList.add('copied');
        setTimeout(() => {
            copyLabel.textContent = 'Copy';
            copyClipboardButton.classList.remove('copied');
        }, 1500);
    } catch (error) {
        alert('Failed to copy: ' + error.message);
    }
}

copyClipboardButton.addEventListener('click', copyRichText);

// --- Toolbar actions ---
const toolbarActions = {
    bold:        { prefix: '**', suffix: '**', placeholder: 'bold text' },
    italic:      { prefix: '*',  suffix: '*',  placeholder: 'italic text' },
    strikethrough: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough text' },
    h1:          { prefix: '# ',   suffix: '', placeholder: 'Heading 1',  lineStart: true },
    h2:          { prefix: '## ',  suffix: '', placeholder: 'Heading 2',  lineStart: true },
    h3:          { prefix: '### ', suffix: '', placeholder: 'Heading 3',  lineStart: true },
    ul:          { prefix: '- ',   suffix: '', placeholder: 'List item',  lineStart: true },
    ol:          { prefix: '1. ',  suffix: '', placeholder: 'List item',  lineStart: true },
    checklist:   { prefix: '- [ ] ', suffix: '', placeholder: 'Task',     lineStart: true },
    link:        { prefix: '[', suffix: '](url)', placeholder: 'link text' },
    image:       { prefix: '![', suffix: '](url)', placeholder: 'alt text' },
    code:        { prefix: '`', suffix: '`', placeholder: 'code' },
    codeblock:   { prefix: '```\n', suffix: '\n```', placeholder: 'code here', block: true },
    blockquote:  { prefix: '> ', suffix: '', placeholder: 'quote', lineStart: true },
    hr:          { prefix: '\n---\n', suffix: '', placeholder: '', insert: true },
    table: {
        prefix: '| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| ',
        suffix: ' |  |  |',
        placeholder: 'data',
        insert: true
    }
};

document.querySelector('.toolbar').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = toolbarActions[button.dataset.action];
    if (!action) return;
    applyToolbarAction(action);
});

function applyToolbarAction(action) {
    const start = markdownInput.selectionStart;
    const end = markdownInput.selectionEnd;
    const text = markdownInput.value;
    const selected = text.substring(start, end);

    let insertText;
    if (action.insert) {
        insertText = action.prefix + (selected || action.placeholder) + action.suffix;
    } else if (action.lineStart) {
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const before = text.substring(0, lineStart);
        const after = text.substring(end);
        const lineContent = selected || action.placeholder;
        insertText = action.prefix + lineContent + action.suffix;
        markdownInput.value = before + insertText + after;
        markdownInput.selectionStart = lineStart + action.prefix.length;
        markdownInput.selectionEnd = lineStart + action.prefix.length + lineContent.length;
        renderMarkdown();
        markDirty();
        markdownInput.focus();
        return;
    } else {
        const content = selected || action.placeholder;
        insertText = action.prefix + content + action.suffix;
    }

    const before = text.substring(0, start);
    const after = text.substring(end);
    markdownInput.value = before + insertText + after;

    const cursorPos = start + action.prefix.length;
    const selLength = (selected || action.placeholder).length;
    markdownInput.selectionStart = cursorPos;
    markdownInput.selectionEnd = cursorPos + selLength;
    renderMarkdown();
    markDirty();
    markdownInput.focus();
}

// --- Resizable panels ---
// Panels are .panel-wrapper elements; resize those directly
const resizer = document.getElementById('resizer');
const editorContainer = document.querySelector('.editor-container');
const editorPanel = document.getElementById('editor-panel');
const previewPanel = document.getElementById('preview-panel');

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerRect = editorContainer.getBoundingClientRect();
    const offset = e.clientX - containerRect.left;
    const totalWidth = containerRect.width;
    const ratio = Math.max(0.15, Math.min(0.85, offset / totalWidth));
    editorPanel.style.flex = 'none';
    previewPanel.style.flex = 'none';
    editorPanel.style.width = `calc(${ratio * 100}% - 11px)`;
    previewPanel.style.width = `calc(${(1 - ratio) * 100}% - 11px)`;
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});

// --- Open file from URL parameter (Local mode only) ---
async function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    if (!filePath) return;
    try {
        const response = await fetch('/open-file?path=' + encodeURIComponent(filePath));
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        updateTitle(result.filePath);

        // Design 2 (Option 2): if a draft for THIS same file holds unsaved edits
        // that differ from disk, keep the draft (your in-progress work) on every
        // load — page reload AND reopening in a new tab both show your edits,
        // flagged "unsaved". The in-app ↺ Refresh button is the single action that
        // discards the draft and reverts to the file on disk.
        const draft = readDraft();
        if (draft && draft.currentFile === result.filePath && draft.content !== result.content) {
            markdownInput.value = draft.content;
            renderMarkdown();
            markDirty();   // persistent "● unsaved" — content differs from disk
        } else {
            markdownInput.value = result.content;
            renderMarkdown();
            saveDraft();
        }
        await markFileInSync();
    } catch (error) {
        alert('Failed to open file: ' + error.message);
    }
}

// --- Open Markdown from ?url= (works in both modes) ---
// Makes a loaded document shareable: send someone markpaste.com/?url=<md> and
// they get it rendered. Only http(s) is accepted, so javascript:/data: URLs
// can never be smuggled in through the query string.
async function loadFromUrlParam() {
    const raw = new URLSearchParams(window.location.search).get('url');
    if (!raw || !isBareHttpUrl(raw.trim())) return;
    try {
        const markdown = await fetchMarkdownFromUrl(raw.trim());
        applyFetchedMarkdown(markdown, raw.trim());
    } catch (error) {
        alert('Could not load ' + raw + '\n(' + error.message +
              ')\nThe site may not allow cross-origin requests.');
    }
}

// Refresh means "reload from the source". That exists when a backend can re-read
// the file, or when the document came from a URL. Clearing the inline style
// rather than setting one lets the mobile stylesheet keep it hidden on phones.
function updateRefreshVisibility() {
    refreshButton.style.display = (HAS_BACKEND || sourceUrl) ? '' : 'none';
}

// --- Auto-sync (Local mode) -------------------------------------------------
// When an agent or another editor rewrites the open file, pick the change up
// without being asked. Unsaved edits are never overwritten: if the document is
// dirty the change is only announced, and Refresh remains the way to take it.
const WATCH_INTERVAL_MS = 1500;
let watchTimer = null;
let watchedMtime = null;
let announcedExternalChange = false;

async function readFileMtime(path) {
    const response = await fetch('/file-stat?path=' + encodeURIComponent(path), { cache: 'no-store' });
    if (!response.ok) throw new Error('stat failed');
    return (await response.json()).mtimeMs;
}

// Call after any load or save so our own write is not seen as someone else's.
async function markFileInSync() {
    if (!HAS_BACKEND || !currentFile) return;
    try { watchedMtime = await readFileMtime(currentFile); } catch { watchedMtime = null; }
    announcedExternalChange = false;
}

async function pollFileForChanges() {
    if (!HAS_BACKEND || !currentFile || document.hidden) return;
    let mtime;
    try { mtime = await readFileMtime(currentFile); } catch { return; }  // deleted/renamed: stay quiet
    if (watchedMtime === null) { watchedMtime = mtime; return; }
    if (mtime === watchedMtime) return;

    if (isDirty) {
        // Two versions have diverged; the one being typed wins until told otherwise.
        if (!announcedExternalChange) {
            announcedExternalChange = true;
            saveStatus.textContent = '⚠ changed on disk — ↺ Refresh to load it';
            saveStatus.className = 'status-indicator unsaved';
        }
        return;
    }

    try {
        const response = await fetch('/open-file?path=' + encodeURIComponent(currentFile));
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        const caret = markdownInput.selectionStart;
        markdownInput.value = result.content;
        renderMarkdown();
        markdownInput.setSelectionRange(Math.min(caret, result.content.length),
                                        Math.min(caret, result.content.length));
        saveDraft();
        watchedMtime = mtime;
        saveStatus.textContent = '↻ synced';
        saveStatus.className = 'status-indicator saved';
        setTimeout(() => {
            if (!isDirty && saveStatus.textContent === '↻ synced') {
                saveStatus.textContent = '';
                saveStatus.className = 'status-indicator';
            }
        }, 1800);
    } catch { /* transient read error — try again next tick */ }
}

function startFileWatcher() {
    if (watchTimer || !HAS_BACKEND) return;
    watchTimer = setInterval(pollFileForChanges, WATCH_INTERVAL_MS);
}

// --- Backend detection + mode setup ---
// Probe /api/health: a real backend (server.js) replies with JSON { ok: true }.
// A static host (e.g. Cloudflare Pages) has no such route and falls back to
// serving index.html with a 200 + text/html — so checking response.ok alone is
// not enough; we must confirm the JSON body. Backend present → Local mode (disk
// open/save/refresh, ?file=); absent → Web mode (Save downloads, Refresh hidden,
// ?file= ignored).
(async function initBackendMode() {
    try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
            const data = await response.json();
            HAS_BACKEND = data && data.ok === true;
        }
    } catch {
        HAS_BACKEND = false;
    }

    if (HAS_BACKEND) {
        await loadFromUrl();
    }

    // ?url= loads Markdown straight from the web. ?file= is Local-mode only and
    // more explicit, so it wins when both are present. A URL always beats a
    // stored draft: a shared link must show the document it points at.
    if (!currentFile) {
        await loadFromUrlParam();
    }

    updateRefreshVisibility();
    startFileWatcher();   // Local mode: pick up edits made by agents or other editors

    // If nothing loaded a document, recover the last draft.
    restoreDraftIfEmpty();

    // Phones get one pane, chosen by what the visitor most likely wants next:
    // an empty document means they came to paste something, anything else means
    // they came to read or share it. Re-assert the appearance here too — by now
    // layout has settled, so the breakpoint is known for certain.
    if (isMobile()) {
        applyMobileAppearance();
        setViewMode(markdownInput.value.trim() === '' ? 'editor' : 'preview', false);
    }
})();

// --- View mode toggle (editor / split / preview) ---
const viewBtns = {
    editor:  document.getElementById('view-editor'),
    split:   document.getElementById('view-split'),
    preview: document.getElementById('view-preview'),
};

// persist=false for the phone's automatic choice, so it never overwrites the
// split/editor/preview preference the same profile uses on a desktop.
function setViewMode(mode, persist = true) {
    editorContainer.classList.remove('mode-editor', 'mode-preview');
    if (mode === 'editor')  editorContainer.classList.add('mode-editor');
    if (mode === 'preview') editorContainer.classList.add('mode-preview');

    Object.entries(viewBtns).forEach(([key, btn]) => {
        btn.classList.toggle('active', key === mode);
    });
    if (persist) {
        try { localStorage.setItem('view', mode); } catch { /* ignore */ }
    }
}

viewBtns.editor.addEventListener('click',  () => setViewMode('editor'));
viewBtns.split.addEventListener('click',   () => setViewMode('split'));
viewBtns.preview.addEventListener('click', () => setViewMode('preview'));

// Restore last-used view mode
// A desktop preference (often "split") makes no sense on a phone, where the
// view is chosen by initBackendMode() from whether there's content to show.
const savedView = localStorage.getItem('view');
if (!isMobile() && savedView && viewBtns[savedView]) setViewMode(savedView);

// --- Output style selector (Editorial / Business / Academic) ---
const styleMenu = document.querySelector('.style-menu');
const styleTrigger = document.getElementById('style-trigger');
const styleDropdown = document.getElementById('style-dropdown');
const styleCurrent = document.getElementById('style-current');
const styleOptions = [...document.querySelectorAll('.style-option')];
const STYLE_LABELS = { editorial: 'Aurum', business: 'Metro', academic: 'Folio' };

function applyStyle(style) {
    if (!STYLE_LABELS[style]) style = 'editorial';
    document.body.dataset.style = style;
    styleCurrent.textContent = STYLE_LABELS[style];
    styleOptions.forEach(o => o.classList.toggle('active', o.dataset.style === style));
    try { localStorage.setItem('style', style); } catch { /* ignore */ }
}

function toggleStyleMenu(open) {
    const willOpen = open ?? styleDropdown.hasAttribute('hidden');
    styleDropdown.toggleAttribute('hidden', !willOpen);
    styleTrigger.setAttribute('aria-expanded', String(willOpen));
}

styleTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleStyleMenu(); });
styleOptions.forEach(o => o.addEventListener('click', () => {
    applyStyle(o.dataset.style);
    toggleStyleMenu(false);
}));
document.addEventListener('click', (e) => { if (!styleMenu.contains(e.target)) toggleStyleMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleStyleMenu(false); });

applyStyle(localStorage.getItem('style') || 'editorial');
applyMobileAppearance();   // early, so a phone never flashes the dark theme

// The ⋯ menu holds the controls hidden at phone width. Each item just clicks
// the real button (still in the DOM), so no export logic is duplicated.
const moreMenu = document.querySelector('.more-menu');
const moreTrigger = document.getElementById('more-trigger');
const moreDropdown = document.getElementById('more-dropdown');

function toggleMoreMenu(open) {
    const willOpen = open ?? moreDropdown.hasAttribute('hidden');
    moreDropdown.toggleAttribute('hidden', !willOpen);
    moreTrigger.setAttribute('aria-expanded', String(willOpen));
}

if (moreTrigger) {
    moreTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleMoreMenu(); });
    document.querySelectorAll('.more-option').forEach(o => o.addEventListener('click', () => {
        toggleMoreMenu(false);
        document.getElementById(o.dataset.target)?.click();
    }));
    document.addEventListener('click', (e) => { if (!moreMenu.contains(e.target)) toggleMoreMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMoreMenu(false); });
}

// --- Refresh (reload the document from wherever it came from) ---
refreshButton.addEventListener('click', async () => {
    // Loaded from a link: re-fetch the source. Same meaning as re-reading a
    // file from disk, so it shares the button.
    if (sourceUrl) {
        if (!confirmDiscard()) return;
        try {
            const markdown = await fetchMarkdownFromUrl(sourceUrl);
            applyFetchedMarkdown(markdown, sourceUrl);
        } catch (error) {
            alert('Failed to reload from ' + sourceUrl + '\n(' + error.message + ')');
        }
        return;
    }
    if (!currentFile) {
        alert('No file opened yet.');
        return;
    }
    try {
        const response = await fetch('/open-file?path=' + encodeURIComponent(currentFile));
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        markdownInput.value = result.content;
        renderMarkdown();
        saveDraft();
        isDirty = false;
        saveStatus.textContent = '';
        saveStatus.className = 'status-indicator';
        await markFileInSync();   // taking the disk version clears the divergence
    } catch (error) {
        alert('Failed to refresh file: ' + error.message);
    }
});

// --- OneNote-style list & indent editing (Enter / Tab / Shift+Tab) ---
const INDENT_UNIT = '  '; // two spaces per indent level

// Remove one indent level from a leading-whitespace string.
function outdentIndent(indent) {
    if (indent.endsWith('\t')) return indent.slice(0, -1);
    if (indent.endsWith('  ')) return indent.slice(0, -2);
    if (indent.endsWith(' ')) return indent.slice(0, -1);
    return '';
}

// Replace [from,to) with text, keeping the native undo stack, then refresh preview.
function editorReplace(from, to, text) {
    markdownInput.setRangeText(text, from, to, 'end');
    markdownInput.dispatchEvent(new Event('input', { bubbles: true }));
}

// Enter: continue the current list/indentation; Enter on an empty item steps
// out one level (then clears the marker) — like OneNote. Returns true if handled.
function smartEnter() {
    const ta = markdownInput;
    if (ta.selectionStart !== ta.selectionEnd) return false;   // ignore selections
    const caret = ta.selectionStart;
    const v = ta.value;
    const lineStart = v.lastIndexOf('\n', caret - 1) + 1;
    const nl = v.indexOf('\n', caret);
    const lineEnd = nl === -1 ? v.length : nl;
    if (caret !== lineEnd) return false;                       // only at end of line
    const line = v.slice(lineStart, lineEnd);

    // List item: indent + bullet + optional checkbox + content
    const list = line.match(/^([ \t]*)([-*+]|\d+\.)[ \t]+(\[[ xX]\][ \t]+)?(.*)$/);
    if (list) {
        const indent = list[1], bullet = list[2], checkbox = list[3], content = list[4];
        if (content.trim() === '') {
            if (indent) {
                editorReplace(lineStart, lineEnd,
                    outdentIndent(indent) + bullet + ' ' + (checkbox ? '[ ] ' : ''));
            } else {
                editorReplace(lineStart, lineEnd, '');           // top level → drop marker
            }
        } else {
            const marker = /^\d+\.$/.test(bullet) ? (parseInt(bullet, 10) + 1) + '.' : bullet;
            editorReplace(caret, caret, '\n' + indent + marker + ' ' + (checkbox ? '[ ] ' : ''));
        }
        return true;
    }

    // Plain indented line: keep indent; Enter on an empty indented line outdents.
    const indented = line.match(/^([ \t]+)(.*)$/);
    if (indented) {
        const indent = indented[1], content = indented[2];
        if (content.trim() === '') editorReplace(lineStart, lineEnd, outdentIndent(indent));
        else editorReplace(caret, caret, '\n' + indent);
        return true;
    }
    return false;
}

// Tab / Shift+Tab: indent or outdent every line touched by the selection/caret.
function indentBlock(outdent) {
    const ta = markdownInput, v = ta.value;
    const blockStart = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let blockEnd = v.indexOf('\n', ta.selectionEnd);
    if (blockEnd === -1) blockEnd = v.length;
    const lines = v.slice(blockStart, blockEnd).split('\n').map(l =>
        outdent ? l.replace(/^(\t| {1,2})/, '') : INDENT_UNIT + l
    );
    ta.setRangeText(lines.join('\n'), blockStart, blockEnd, 'preserve');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- Line-level formatting (headings, lists, checkbox, star, move line) ---
// Split a line into indentation, a leading list/heading marker, and the content.
function parseLine(line) {
    const m = line.match(/^([ \t]*)((?:[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+\.[ \t]+|#{1,6}[ \t]+))?(.*)$/);
    return { indent: m[1], marker: m[2] || '', content: m[3] };
}

// Apply transform({indent,marker,content}) -> newLine to the caret's line.
function modifyLine(transform) {
    const ta = markdownInput, v = ta.value;
    const caret = ta.selectionStart;
    const lineStart = v.lastIndexOf('\n', caret - 1) + 1;
    const nl = v.indexOf('\n', caret);
    const lineEnd = nl === -1 ? v.length : nl;
    const newLine = transform(parseLine(v.slice(lineStart, lineEnd)));
    const fromEnd = Math.max(0, lineEnd - caret);   // keep caret's distance from line end
    ta.setRangeText(newLine, lineStart, lineEnd, 'end');
    const newCaret = Math.max(lineStart, lineStart + newLine.length - fromEnd);
    ta.setSelectionRange(newCaret, newCaret);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
}

function setHeading(n) {
    modifyLine(({ indent, marker, content }) => {
        const hashes = (marker.match(/^(#+)/) || [, ''])[1];
        if (hashes.length === n) return indent + content;        // same level → toggle off
        return indent + '#'.repeat(n) + ' ' + content;           // set (replaces any marker)
    });
}

function toggleList(kind) {
    modifyLine(({ indent, marker, content }) => {
        const isUL = /^[-*+][ \t]/.test(marker) && !/\[/.test(marker);
        const isOL = /^\d+\.[ \t]/.test(marker);
        if (kind === 'ul') return indent + (isUL ? '' : '- ') + content;
        return indent + (isOL ? '' : '1. ') + content;
    });
}

function toggleCheckbox() {
    modifyLine(({ indent, marker, content }) => {
        const isCheck = /^[-*+][ \t]+\[[ xX]\]/.test(marker);
        return indent + (isCheck ? '' : '- [ ] ') + content;
    });
}

const STAR = '⭐';
function toggleStar() {
    modifyLine(({ indent, marker, content }) => {
        if (content.startsWith(STAR)) return indent + marker + content.replace(/^⭐\s*/, '');
        return indent + marker + STAR + ' ' + content;
    });
}

// Move the caret's line up (-1) or down (+1), swapping with its neighbour.
function moveLine(dir) {
    const ta = markdownInput, v = ta.value;
    const caret = ta.selectionStart;
    const curStart = v.lastIndexOf('\n', caret - 1) + 1;
    const curNl = v.indexOf('\n', caret);
    const curEnd = curNl === -1 ? v.length : curNl;
    const curLine = v.slice(curStart, curEnd);
    const col = caret - curStart;
    if (dir === -1) {
        if (curStart === 0) return;                              // already first line
        const prevStart = v.lastIndexOf('\n', curStart - 2) + 1;
        const prevLine = v.slice(prevStart, curStart - 1);
        ta.setRangeText(curLine + '\n' + prevLine, prevStart, curEnd, 'preserve');
        const nc = prevStart + Math.min(col, curLine.length);
        ta.setSelectionRange(nc, nc);
    } else {
        if (curNl === -1) return;                                // already last line
        const nextStart = curNl + 1;
        const nextNl = v.indexOf('\n', nextStart);
        const nextEnd = nextNl === -1 ? v.length : nextNl;
        const nextLine = v.slice(nextStart, nextEnd);
        ta.setRangeText(nextLine + '\n' + curLine, curStart, nextEnd, 'preserve');
        const nc = curStart + nextLine.length + 1 + Math.min(col, curLine.length);
        ta.setSelectionRange(nc, nc);
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
}

// Duplicate the caret's line; dir -1 keeps the caret on the upper copy,
// dir +1 moves it to the lower copy (VS Code Shift+Alt+Up/Down).
function duplicateLine(dir) {
    const ta = markdownInput, v = ta.value;
    const caret = ta.selectionStart;
    const start = v.lastIndexOf('\n', caret - 1) + 1;
    const nl = v.indexOf('\n', caret);
    const end = nl === -1 ? v.length : nl;
    const line = v.slice(start, end);
    const col = caret - start;
    ta.setRangeText(line + '\n' + line, start, end, 'preserve');
    const base = dir === 1 ? start + line.length + 1 : start;
    ta.setSelectionRange(base + col, base + col);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
}

// Delete the caret's whole line (VS Code Ctrl+Shift+K).
function deleteLine() {
    const ta = markdownInput, v = ta.value;
    const caret = ta.selectionStart;
    const start = v.lastIndexOf('\n', caret - 1) + 1;
    const nl = v.indexOf('\n', caret);
    const col = caret - start;
    let from = start;
    let to = nl === -1 ? v.length : nl + 1;
    if (nl === -1 && start > 0) from = start - 1;   // last line: eat preceding \n
    ta.setRangeText('', from, to, 'start');
    const v2 = ta.value;
    const ls = v2.lastIndexOf('\n', from - 1) + 1;
    const ne = v2.indexOf('\n', ls);
    const le = ne === -1 ? v2.length : ne;
    const nc = Math.min(ls + col, le);
    ta.setSelectionRange(nc, nc);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
}

// Insert a blank line below/above the caret's line, keeping its indentation
// (VS Code Ctrl+Enter / Ctrl+Shift+Enter).
function insertLine(above) {
    const ta = markdownInput, v = ta.value;
    const caret = ta.selectionStart;
    const start = v.lastIndexOf('\n', caret - 1) + 1;
    const nl = v.indexOf('\n', caret);
    const end = nl === -1 ? v.length : nl;
    const indent = (v.slice(start, end).match(/^[ \t]*/) || [''])[0];
    if (above) {
        ta.setRangeText(indent + '\n', start, start, 'start');
        ta.setSelectionRange(start + indent.length, start + indent.length);
    } else {
        ta.setRangeText('\n' + indent, end, end, 'end');
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
}

// --- Keyboard shortcuts (editor-scoped: lists, formatting, save) ---
markdownInput.addEventListener('keydown', (e) => {
    // Smart Enter — but NEVER while composing (Japanese/IME Enter confirms text).
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 &&
        !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (smartEnter()) { e.preventDefault(); return; }
    }
    // Tab / Shift+Tab — indent / outdent list lines
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        indentBlock(e.shiftKey);
        return;
    }
    // Headings H1–H5 — Ctrl/⌘+Alt+1..5
    if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && /^Digit[1-5]$/.test(e.code)) {
        e.preventDefault();
        setHeading(+e.code.slice(5));
        return;
    }
    // Lists — Ctrl/⌘+. (bullet)  /  Ctrl/⌘+/ (numbered)  (OneNote style)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'Period') {
        e.preventDefault(); toggleList('ul'); return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'Slash') {
        e.preventDefault(); toggleList('ol'); return;
    }
    // Checkbox — Alt+C (Ctrl/⌘+Alt+C also works). Plain Alt+letter, because
    // enterprise tools like Citrix Workspace swallow Ctrl+Alt+letter globally.
    if (e.altKey && !e.shiftKey && e.code === 'KeyC') {
        e.preventDefault(); toggleCheckbox(); return;
    }
    // Star ⭐ at line start — Alt+S (Ctrl/⌘+Alt+S also works)
    if (e.altKey && !e.shiftKey && e.code === 'KeyS') {
        e.preventDefault(); toggleStar(); return;
    }
    // Move line — Alt+Up / Down (VS Code)
    if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey &&
        (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault(); moveLine(e.code === 'ArrowUp' ? -1 : 1); return;
    }
    // Duplicate line — Shift+Alt+Up / Down (VS Code)
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey &&
        (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault(); duplicateLine(e.code === 'ArrowUp' ? -1 : 1); return;
    }
    // Delete line — Ctrl/⌘+Shift+K (VS Code)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === 'KeyK') {
        e.preventDefault(); deleteLine(); return;
    }
    // Insert line below / above — Ctrl/⌘+Enter / Ctrl/⌘+Shift+Enter (VS Code)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'Enter' && !e.isComposing) {
        e.preventDefault(); insertLine(e.shiftKey); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        applyToolbarAction(toolbarActions.bold);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        applyToolbarAction(toolbarActions.italic);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveMdButton.click();
    }
});

// --- Find & replace (Ctrl+F / Ctrl+H, Mac ⌘F / ⌥⌘F) ---
// Plain-text, case-insensitive search over the editor. A textarea can't
// highlight every match, so we select + scroll to the current one and show a
// "3/14" counter — VS Code-style navigation with Enter / Shift+Enter.
let findMatches = [];            // [{start, end}]
let findMatchCase = false;       // Aa  (Alt+C in the find input)
let findWholeWord = false;       // ab  (Alt+W)
let findUseRegex = false;        // .*  (Alt+R)

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build the search regex from the term + option toggles.
// global=true for scanning the document; false for one-off tests.
function buildFindRegex(global = true) {
    let src = findInput.value;
    if (!src) return null;
    if (!findUseRegex) src = escapeRegExp(src);
    if (findWholeWord) src = '\\b(?:' + src + ')\\b';
    const flags = (global ? 'g' : '') + (findMatchCase ? '' : 'i');
    try { return new RegExp(src, flags); } catch { return null; }   // invalid pattern
}

function refreshFindMatches() {
    findMatches = [];
    if (!findInput.value) { findCount.textContent = ''; return; }
    const re = buildFindRegex(true);
    if (!re) { findCount.textContent = '⚠ regex'; return; }
    const v = markdownInput.value;
    let m;
    while ((m = re.exec(v)) !== null) {
        findMatches.push({ start: m.index, end: m.index + m[0].length });
        if (m[0].length === 0) re.lastIndex++;   // guard zero-length matches
    }
    if (!findMatches.length) findCount.textContent = '0/0';
}

function scrollEditorToSelection() {
    const ta = markdownInput;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 24;
    const lineIdx = (ta.value.slice(0, ta.selectionStart).match(/\n/g) || []).length;
    ta.scrollTop = Math.max(0, lineIdx * lh - ta.clientHeight / 2);
}

function gotoFindMatch(dir) {
    refreshFindMatches();
    const n = findMatches.length;
    if (!n) return;
    let idx;
    if (dir >= 0) {
        idx = findMatches.findIndex(m => m.start >= markdownInput.selectionEnd);
        if (idx === -1) idx = 0;                              // wrap to top
    } else {
        idx = -1;
        for (let k = n - 1; k >= 0; k--) {
            if (findMatches[k].start < markdownInput.selectionStart) { idx = k; break; }
        }
        if (idx === -1) idx = n - 1;                          // wrap to bottom
    }
    const m = findMatches[idx];
    markdownInput.setSelectionRange(m.start, m.end);
    scrollEditorToSelection();
    findCount.textContent = `${idx + 1}/${n}`;
}

function openFindBar(withReplace) {
    findBar.classList.add('open');
    replaceRow.style.display = withReplace ? 'flex' : 'none';
    const sel = markdownInput.value.slice(markdownInput.selectionStart, markdownInput.selectionEnd);
    if (sel && !sel.includes('\n')) findInput.value = sel;
    findInput.focus();
    findInput.select();
    // Collapse the editor selection to its start so the search lands on the
    // occurrence the caret is on, not the one after it.
    markdownInput.setSelectionRange(markdownInput.selectionStart, markdownInput.selectionStart);
    gotoFindMatch(1);
}

function closeFindBar() {
    findBar.classList.remove('open');
    markdownInput.focus();
}

// In regex mode the replacement string may use $1, $& etc.; in plain mode any
// "$" is literal, so escape it for String.replace.
function replacementText() {
    return findUseRegex ? replaceInput.value : replaceInput.value.replace(/\$/g, '$$$$');
}

function replaceCurrent() {
    if (!findInput.value) return;
    refreshFindMatches();
    const s = markdownInput.selectionStart, e = markdownInput.selectionEnd;
    const cur = findMatches.find(m => m.start === s && m.end === e);
    if (cur) {
        const re1 = buildFindRegex(false);
        const slice = markdownInput.value.slice(s, e);
        const newText = re1 ? slice.replace(re1, replacementText()) : replaceInput.value;
        markdownInput.setRangeText(newText, s, e, 'end');
        markdownInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    gotoFindMatch(1);
}

function replaceAllMatches() {
    if (!findInput.value) return;
    refreshFindMatches();
    const n = findMatches.length;
    if (!n) return;
    const re = buildFindRegex(true);
    if (!re) return;
    const nv = markdownInput.value.replace(re, replacementText());
    markdownInput.setRangeText(nv, 0, markdownInput.value.length, 'start');
    markdownInput.dispatchEvent(new Event('input', { bubbles: true }));
    findCount.textContent = `replaced ${n}`;
}

// Copy — or cut (copy + delete) — every line containing the search term.
// The textarea can't multi-select like VS Code's "Select All Occurrences",
// so this acts on whole matching lines in one click, which is the real goal.
function copyOrCutMatchingLines(cut) {
    if (!findInput.value) return;
    const re = buildFindRegex(false);   // stateless test per line, honours Aa/ab/.*
    if (!re) { findCount.textContent = '⚠ regex'; return; }
    const all = markdownInput.value.split('\n');
    const matched = all.filter(l => re.test(l));
    if (!matched.length) { findCount.textContent = '0 lines'; return; }
    navigator.clipboard.writeText(matched.join('\n')).then(() => {
        if (cut) {
            const rest = all.filter(l => !re.test(l));
            markdownInput.setRangeText(rest.join('\n'), 0, markdownInput.value.length, 'start');
            markdownInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        findCount.textContent = `${cut ? 'cut' : 'copied'} ${matched.length} line${matched.length > 1 ? 's' : ''}`;
    }).catch(err => alert('Could not write to the clipboard: ' + err.message));
}

document.getElementById('copy-lines').addEventListener('click', () => copyOrCutMatchingLines(false));
document.getElementById('cut-lines').addEventListener('click', () => copyOrCutMatchingLines(true));

// --- Find option toggles (Aa / ab / .*) ---
function toggleFindOption(which) {
    if (which === 'case') findMatchCase = !findMatchCase;
    if (which === 'word') findWholeWord = !findWholeWord;
    if (which === 'regex') findUseRegex = !findUseRegex;
    document.getElementById('find-case').classList.toggle('active', findMatchCase);
    document.getElementById('find-word').classList.toggle('active', findWholeWord);
    document.getElementById('find-regex').classList.toggle('active', findUseRegex);
    markdownInput.setSelectionRange(markdownInput.selectionStart, markdownInput.selectionStart);
    gotoFindMatch(1);
    findInput.focus();
}
document.getElementById('find-case').addEventListener('click', () => toggleFindOption('case'));
document.getElementById('find-word').addEventListener('click', () => toggleFindOption('word'));
document.getElementById('find-regex').addEventListener('click', () => toggleFindOption('regex'));

findInput.addEventListener('input', () => {
    // Stay on the match under the caret while the term is being typed.
    markdownInput.setSelectionRange(markdownInput.selectionStart, markdownInput.selectionStart);
    gotoFindMatch(1);
});
document.getElementById('find-next').addEventListener('click', () => gotoFindMatch(1));
document.getElementById('find-prev').addEventListener('click', () => gotoFindMatch(-1));
document.getElementById('find-close').addEventListener('click', closeFindBar);
document.getElementById('replace-one').addEventListener('click', replaceCurrent);
document.getElementById('replace-all').addEventListener('click', replaceAllMatches);

findInput.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyC') { e.preventDefault(); toggleFindOption('case'); }
    else if (e.altKey && e.code === 'KeyW') { e.preventDefault(); toggleFindOption('word'); }
    else if (e.altKey && e.code === 'KeyR') { e.preventDefault(); toggleFindOption('regex'); }
    else if (e.key === 'Enter' && e.altKey) { e.preventDefault(); copyOrCutMatchingLines(false); }
    else if (e.key === 'Enter') { e.preventDefault(); gotoFindMatch(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFindBar(); }
});
replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFindBar(); }
});

// --- Keyboard shortcuts dialog (Ctrl+K) — Teams-style ---
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const K_MOD = IS_MAC ? '⌘' : 'Ctrl';
const K_ALT = IS_MAC ? '⌥' : 'Alt';
const K_SHIFT = IS_MAC ? '⇧' : 'Shift';

function renderShortcutsDialog() {
    const sections = [
        { title: 'General', items: [
            ['Save', [K_MOD, 'S']],
            ['Copy as rich text', [K_MOD, K_SHIFT, 'C']],
            ['New (blank document)', [K_MOD, K_SHIFT, 'X']],
            ['Paste (replace document)', [K_MOD, K_SHIFT, 'V']],
            ['Find', [K_MOD, 'F']],
            ['Replace', IS_MAC ? [K_ALT, K_MOD, 'F'] : [K_MOD, 'H']],
            ['Copy matching lines (in Find)', [K_ALT, 'Enter']],
            ['Find options: case / word / regex', [K_ALT, 'C / W / R']],
            ['Keyboard shortcuts', [K_MOD, 'K']],
        ]},
        { title: 'Lines', items: [
            ['Move line up / down', [K_ALT, '↑ / ↓']],
            ['Duplicate line up / down', [K_SHIFT, K_ALT, '↑ / ↓']],
            ['Delete line', [K_MOD, K_SHIFT, 'K']],
            ['Insert line below', [K_MOD, 'Enter']],
            ['Insert line above', [K_MOD, K_SHIFT, 'Enter']],
            ['Indent / outdent', ['Tab', K_SHIFT + '+Tab']],
        ]},
        { title: 'Formatting', items: [
            ['Bold', [K_MOD, 'B']],
            ['Italic', [K_MOD, 'I']],
            ['Heading 1–5', [K_MOD, K_ALT, '1–5']],
            ['Bullet list', [K_MOD, '.']],
            ['Numbered list', [K_MOD, '/']],
            ['Checkbox', [K_ALT, 'C']],
            ['Star line', [K_ALT, 'S']],
        ]},
        { title: 'View', items: [
            ['Editor / Split / Preview', [K_ALT, '1 / 2 / 3']],
            ['Word wrap', [K_ALT, 'Z']],
        ]},
    ];
    shortcutsBody.innerHTML = sections.map(sec => `
        <div class="shortcuts-section">
            <h3>${sec.title}</h3>
            ${sec.items.map(([label, keys]) => `
                <div class="shortcut-row">
                    <span>${label}</span>
                    <span class="shortcut-keys">${keys.map(k => `<kbd>${k}</kbd>`).join('')}</span>
                </div>`).join('')}
        </div>`).join('');
}

function toggleShortcutsDialog(show) {
    const open = show ?? !shortcutsOverlay.classList.contains('open');
    if (open && !shortcutsBody.childElementCount) renderShortcutsDialog();
    shortcutsOverlay.classList.toggle('open', open);
}

document.getElementById('shortcuts-btn').addEventListener('click', () => toggleShortcutsDialog(true));
document.getElementById('shortcuts-close').addEventListener('click', () => toggleShortcutsDialog(false));
shortcutsOverlay.addEventListener('click', (e) => {
    if (e.target === shortcutsOverlay) toggleShortcutsDialog(false);
});

// --- Global shortcuts (work regardless of focus) ---
// Use e.code (physical key) so Alt/Option combos are unaffected by Mac dead keys.
document.addEventListener('keydown', (e) => {
    // Find — Ctrl/⌘+F; Replace — Ctrl+H (Win) / ⌥⌘F (Mac)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyF') {
        e.preventDefault(); openFindBar(replaceRow.style.display === 'flex'); return;
    }
    if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.code === 'KeyH') {
        e.preventDefault(); openFindBar(true); return;
    }
    if (e.metaKey && e.altKey && !e.shiftKey && e.code === 'KeyF') {
        e.preventDefault(); openFindBar(true); return;
    }
    // Keyboard shortcuts dialog — Ctrl/⌘+K
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyK') {
        e.preventDefault(); toggleShortcutsDialog(); return;
    }
    if (e.key === 'Escape') {
        if (shortcutsOverlay.classList.contains('open')) { toggleShortcutsDialog(false); return; }
        if (findBar.classList.contains('open')) { closeFindBar(); return; }
    }
    // Copy as rich text — Ctrl/⌘ + Shift + C
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyC') {
        e.preventDefault();
        copyRichText();
        return;
    }
    // Clear editor (blank document) — Ctrl/⌘ + Shift + X
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyX') {
        e.preventDefault();
        clearEditor();
        return;
    }
    // Clear & paste from clipboard — Ctrl/⌘ + Shift + V
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyV') {
        e.preventDefault();
        clearAndPasteFromClipboard();
        return;
    }
    // View modes — Alt + 1 / 2 / 3
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.code === 'Digit1') { e.preventDefault(); setViewMode('editor'); }
        else if (e.code === 'Digit2') { e.preventDefault(); setViewMode('split'); }
        else if (e.code === 'Digit3') { e.preventDefault(); setViewMode('preview'); }
        else if (e.code === 'KeyZ') { e.preventDefault(); toggleWrap(); }
    }
});
