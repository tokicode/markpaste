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
const saveStatus = document.getElementById('save-status');
const md = window.markdownit();

let currentFile = null;
let isDirty = false;

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
    appTitle.textContent = filePath ? filePath.split(/[\\/]/).pop() : 'Markdown Studio';
    document.title = filePath ? `${filePath.split(/[\\/]/).pop()} — Markdown Studio` : 'Markdown Studio';
}

// --- File loading ---
function loadFileContent(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        markdownInput.value = e.target.result;
        renderMarkdown();
        updateTitle(file.path || file.name);
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
});

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

saveMdButton.addEventListener('click', async () => {
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

saveHtmlButton.addEventListener('click', () => {
    const renderedHtml = renderedOutput.innerHTML;
    const blob = new Blob([renderedHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (currentFile || 'output').replace(/\.md$/, '') + '.html';
    a.click();
});

savePdfButton.addEventListener('click', () => {
    window.html2canvas = html2canvas;
    window.jsPDF = window.jspdf.jsPDF;
    html2canvas(renderedOutput).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save((currentFile || 'output').replace(/\.md$/, '') + '.pdf');
    });
});

saveWordButton.addEventListener('click', () => {
    const renderedHtml = renderedOutput.innerHTML;
    const wordContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Export</title></head><body>${renderedHtml}</body></html>`;
    const blob = new Blob([wordContent], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (currentFile || 'output').replace(/\.md$/, '') + '.doc';
    a.click();
});

copyClipboardButton.addEventListener('click', async () => {
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
        const orig = copyClipboardButton.textContent;
        copyClipboardButton.textContent = 'Copied!';
        setTimeout(() => { copyClipboardButton.textContent = orig; }, 1500);
    } catch (error) {
        alert('Failed to copy: ' + error.message);
    }
});

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

// --- Open file from URL parameter ---
(async function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    if (!filePath) return;
    try {
        const response = await fetch('/open-file?path=' + encodeURIComponent(filePath));
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        markdownInput.value = result.content;
        renderMarkdown();
        updateTitle(result.filePath);
    } catch (error) {
        alert('Failed to open file: ' + error.message);
    }
})();

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
        isDirty = false;
        saveStatus.textContent = '';
        saveStatus.className = 'status-indicator';
    } catch (error) {
        alert('Failed to refresh file: ' + error.message);
    }
});

// --- Keyboard shortcuts ---
markdownInput.addEventListener('keydown', (e) => {
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
