const markdownInput = document.getElementById('markdown-input');
const renderedOutput = document.getElementById('rendered-output');
const fileInput = document.getElementById('file-input');
const appTitle = document.getElementById('app-title');
const saveMdButton = document.getElementById('save-md');
const saveAsMdButton = document.getElementById('save-as-md');
const saveHtmlButton = document.getElementById('save-html');
const savePdfButton = document.getElementById('save-pdf');
const saveWordButton = document.getElementById('save-word');
const copyClipboardButton = document.getElementById('copy-clipboard');
const themeToggle = document.getElementById('theme-toggle');
const refreshButton = document.getElementById('refresh-file');
const clearButton = document.getElementById('clear-editor');
const pasteButton = document.getElementById('paste-clipboard');
const wrapToggle = document.getElementById('wrap-toggle');
const saveStatus = document.getElementById('save-status');
const md = window.markdownit();
// Footnote support ([^1] … [^1]: …). Guarded so a CDN miss won't break rendering.
if (window.markdownitFootnote) md.use(window.markdownitFootnote);
// GitHub-style task lists: "- [ ] todo" / "- [x] done" render as checkboxes.
if (window.markdownitTaskLists) md.use(window.markdownitTaskLists);

let currentFile = null;
let isDirty = false;

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
function updateTitle(filePath) {
    currentFile = filePath;
    appTitle.textContent = filePath ? filePath.split(/[\\/]/).pop() : 'MarkPaste';
    document.title = filePath ? `${filePath.split(/[\\/]/).pop()} — MarkPaste` : 'MarkPaste';
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
            updatedAt: Date.now()
        }));
    } catch { /* storage full / unavailable — ignore */ }
}
function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraftNow, 400);
}
// Flush synchronously right before the page unloads (reload/close), so even an
// edit made a split-second before a refresh is never lost.
window.addEventListener('beforeunload', () => {
    clearTimeout(draftTimer);
    writeDraftNow();
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
    if (draft.currentFile) updateTitle(draft.currentFile);
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
    } catch (error) {
        alert('Error saving file: ' + error.message);
    }
});

// --- New / Clear & paste (quickly start a fresh document) ---
// Clear the editor to a blank, untitled document.
function clearEditor() {
    markdownInput.value = '';
    updateTitle(null);          // untitled → exports fall back to heading/generic name
    renderMarkdown();
    isDirty = false;
    saveStatus.textContent = '';
    saveStatus.className = 'status-indicator';
    saveDraft();
    markdownInput.focus();
}

// Replace the whole document with the clipboard contents (clear + paste).
async function clearAndPasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        markdownInput.value = text;
        updateTitle(null);
        renderMarkdown();
        if (text.trim()) {
            markDirty();
        } else {
            isDirty = false;
            saveStatus.textContent = '';
            saveStatus.className = 'status-indicator';
        }
        saveDraft();
        markdownInput.focus();
    } catch (err) {
        alert('Could not read the clipboard (' + err.message +
              ').\nAllow clipboard access, or click the editor and press Ctrl+V to paste manually.');
    }
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
    } catch (error) {
        alert('Failed to open file: ' + error.message);
    }
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
    } else {
        // Disk-only controls have no meaning without a backend.
        refreshButton.style.display = 'none';
    }

    // After any file load attempt: if still empty, recover the last draft.
    restoreDraftIfEmpty();
})();

// --- View mode toggle (editor / split / preview) ---
const viewBtns = {
    editor:  document.getElementById('view-editor'),
    split:   document.getElementById('view-split'),
    preview: document.getElementById('view-preview'),
};

function setViewMode(mode) {
    editorContainer.classList.remove('mode-editor', 'mode-preview');
    if (mode === 'editor')  editorContainer.classList.add('mode-editor');
    if (mode === 'preview') editorContainer.classList.add('mode-preview');

    Object.entries(viewBtns).forEach(([key, btn]) => {
        btn.classList.toggle('active', key === mode);
    });
    try { localStorage.setItem('view', mode); } catch { /* ignore */ }
}

viewBtns.editor.addEventListener('click',  () => setViewMode('editor'));
viewBtns.split.addEventListener('click',   () => setViewMode('split'));
viewBtns.preview.addEventListener('click', () => setViewMode('preview'));

// Restore last-used view mode
const savedView = localStorage.getItem('view');
if (savedView && viewBtns[savedView]) setViewMode(savedView);

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

// --- Refresh (reload current file from disk) ---
refreshButton.addEventListener('click', async () => {
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
    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        applyToolbarAction(toolbarActions.bold);
    } else if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        applyToolbarAction(toolbarActions.italic);
    } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveMdButton.click();
    }
});

// --- Global shortcuts (work regardless of focus) ---
// Use e.code (physical key) so Alt/Option combos are unaffected by Mac dead keys.
document.addEventListener('keydown', (e) => {
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
