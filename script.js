(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    const els = {
        input: $('inputCode'),
        output: $('outputCode'),
        language: $('languageSelect'),
        commit: $('commitButton'),
        reset: $('resetButton'),
        copy: $('copyButton'),
        download: $('downloadButton'),
        upload: $('uploadButton'),
        file: $('fileInput'),
        theme: $('themeToggle'),
        inputMeta: $('inputMeta'),
        outputMeta: $('outputMeta'),
        stats: $('stats'),
        statComments: $('statComments'),
        statLines: $('statLines'),
        statChars: $('statChars'),
        statPct: $('statPct'),
        toasts: $('toastContainer'),
        dropzone: $('inputDropzone'),
        optPreserveDocs: $('optPreserveDocs'),
        optPreserveLicense: $('optPreserveLicense'),
        optCollapseBlankLines: $('optCollapseBlankLines'),
        optTrimTrailing: $('optTrimTrailing'),
    };

    const STORAGE_KEYS = {
        theme: 'cr.theme',
        language: 'cr.language',
        opts: 'cr.options',
    };

    let lastFileName = null;

    // ---------- Theme ----------
    const initTheme = () => {
        const saved = localStorage.getItem(STORAGE_KEYS.theme);
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
    };

    const toggleTheme = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(STORAGE_KEYS.theme, next);
    };

    // ---------- Persisted options ----------
    const loadPrefs = () => {
        const lang = localStorage.getItem(STORAGE_KEYS.language);
        if (lang) els.language.value = lang;
        try {
            const opts = JSON.parse(localStorage.getItem(STORAGE_KEYS.opts) || '{}');
            if (typeof opts.preserveDocs === 'boolean') els.optPreserveDocs.checked = opts.preserveDocs;
            if (typeof opts.preserveLicense === 'boolean') els.optPreserveLicense.checked = opts.preserveLicense;
            if (typeof opts.collapseBlankLines === 'boolean') els.optCollapseBlankLines.checked = opts.collapseBlankLines;
            if (typeof opts.trimTrailing === 'boolean') els.optTrimTrailing.checked = opts.trimTrailing;
        } catch { /* ignore */ }
    };

    const savePrefs = () => {
        localStorage.setItem(STORAGE_KEYS.language, els.language.value);
        localStorage.setItem(STORAGE_KEYS.opts, JSON.stringify({
            preserveDocs: els.optPreserveDocs.checked,
            preserveLicense: els.optPreserveLicense.checked,
            collapseBlankLines: els.optCollapseBlankLines.checked,
            trimTrailing: els.optTrimTrailing.checked,
        }));
    };

    // ---------- Toasts ----------
    const toast = (message, kind = 'info') => {
        const el = document.createElement('div');
        el.className = `toast toast-${kind}`;
        el.textContent = message;
        els.toasts.appendChild(el);
        setTimeout(() => {
            el.classList.add('is-leaving');
            el.addEventListener('animationend', () => el.remove(), { once: true });
        }, 2400);
    };

    // ---------- Language detection ----------
    const EXT_MAP = {
        js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
        ts: 'javascript', tsx: 'javascript',
        py: 'python', pyw: 'python',
        html: 'html', htm: 'html', xml: 'html', svg: 'html', vue: 'html', svelte: 'html',
        css: 'css', scss: 'css', sass: 'css', less: 'css',
        c: 'c', h: 'c', cpp: 'c', hpp: 'c', cc: 'c', cs: 'c',
        java: 'c', go: 'c', rs: 'c', swift: 'c', kt: 'c', kts: 'c', php: 'c', scala: 'c', dart: 'c',
        sql: 'sql',
        sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
        yaml: 'shell', yml: 'shell', toml: 'shell',
        rb: 'shell', pl: 'shell', r: 'shell',
        lua: 'lua',
    };

    const detectFromFilename = (name) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return EXT_MAP[ext] || null;
    };

    const detectFromContent = (code) => {
        const head = code.slice(0, 2048);
        if (/^\s*<\?xml|^\s*<!DOCTYPE|^\s*<html|^\s*<svg|^\s*<!--/i.test(head)) return 'html';
        if (/^#!.*\b(python)/i.test(head)) return 'python';
        if (/^#!.*\b(bash|sh|zsh|env)/i.test(head)) return 'shell';
        if (/\b(def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import)\b/.test(head) && /:\s*$/m.test(head)) return 'python';
        if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE)\b/i.test(head)) return 'sql';
        if (/(\b(function|const|let|var|class|import|export)\b|=>)/.test(head)) return 'javascript';
        if (/[#.\w-]+\s*\{[^}]*[\w-]+\s*:/.test(head)) return 'css';
        return 'c';
    };

    const resolveLanguage = (code, filename) => {
        const choice = els.language.value;
        if (choice !== 'auto') return choice;
        if (filename) {
            const fromExt = detectFromFilename(filename);
            if (fromExt) return fromExt;
        }
        return detectFromContent(code);
    };

    // ---------- Helpers ----------
    const isLicenseBlock = (text) =>
        /\b(licen[sc]e|copyright|SPDX-License-Identifier|@license|GPL|MIT|Apache|BSD|Mozilla Public)\b/i.test(text);

    // ---------- Removers ----------
    // C-style: //, /* */, strings ('', "", ``), template ${...}
    const removeCStyle = (code, opts) => {
        let out = '';
        let i = 0;
        const n = code.length;
        let comments = 0;

        while (i < n) {
            const ch = code[i];
            const next = code[i + 1];

            if (ch === '"' || ch === "'" || ch === '`') {
                const quote = ch;
                out += ch;
                i++;
                while (i < n) {
                    const c = code[i];
                    if (c === '\\' && i + 1 < n) { out += c + code[i + 1]; i += 2; continue; }
                    if (c === quote) { out += c; i++; break; }
                    if (quote === '`' && c === '$' && code[i + 1] === '{') {
                        out += '${';
                        i += 2;
                        let depth = 1;
                        while (i < n && depth > 0) {
                            const k = code[i];
                            if (k === '{') depth++;
                            else if (k === '}') depth--;
                            out += k;
                            i++;
                            if (depth === 0) break;
                        }
                        continue;
                    }
                    if (c === '\n' && quote !== '`') { out += c; i++; break; }
                    out += c;
                    i++;
                }
                continue;
            }

            if (ch === '/' && next === '/') {
                comments++;
                while (i < n && code[i] !== '\n') i++;
                continue;
            }

            if (ch === '/' && next === '*') {
                const start = i;
                const isDoc = code[i + 2] === '*' && code[i + 3] !== '/';
                i += 2;
                while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
                if (i < n) i += 2;
                const block = code.slice(start, i);

                if ((opts.preserveDocs && isDoc) ||
                    (opts.preserveLicense && isLicenseBlock(block))) {
                    out += block;
                } else {
                    comments++;
                }
                continue;
            }

            out += ch;
            i++;
        }
        return { code: out, comments };
    };

    // Python: # line comments. Triple-quoted strings are preserved (they are strings).
    const removePython = (code, opts) => {
        let out = '';
        let i = 0;
        const n = code.length;
        let comments = 0;
        let firstNonShebang = true;

        // Preserve shebang on first line
        if (opts.preserveLicense && code.startsWith('#!')) {
            const nl = code.indexOf('\n');
            const end = nl === -1 ? n : nl + 1;
            out = code.slice(0, end);
            i = end;
            firstNonShebang = false;
        }

        while (i < n) {
            const ch = code[i];

            // Triple-quoted string
            if ((ch === '"' || ch === "'") && code[i + 1] === ch && code[i + 2] === ch) {
                const quote = ch;
                out += code.slice(i, i + 3);
                i += 3;
                while (i < n) {
                    if (code[i] === '\\' && i + 1 < n) { out += code[i] + code[i + 1]; i += 2; continue; }
                    if (code[i] === quote && code[i + 1] === quote && code[i + 2] === quote) {
                        out += code.slice(i, i + 3);
                        i += 3;
                        break;
                    }
                    out += code[i];
                    i++;
                }
                continue;
            }

            // Single-line string
            if (ch === '"' || ch === "'") {
                const quote = ch;
                out += ch;
                i++;
                while (i < n && code[i] !== quote) {
                    if (code[i] === '\\' && i + 1 < n) { out += code[i] + code[i + 1]; i += 2; continue; }
                    if (code[i] === '\n') break;
                    out += code[i];
                    i++;
                }
                if (i < n && code[i] === quote) { out += code[i]; i++; }
                continue;
            }

            if (ch === '#') {
                // Find end of line
                let j = i;
                while (j < n && code[j] !== '\n') j++;
                const block = code.slice(i, j);
                if (opts.preserveLicense && firstNonShebang && isLicenseBlock(block)) {
                    out += block;
                } else {
                    comments++;
                }
                i = j;
                continue;
            }

            if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') firstNonShebang = false;
            out += ch;
            i++;
        }
        return { code: out, comments };
    };

    // HTML / XML: <!-- ... -->
    const removeHTML = (code, opts) => {
        let out = '';
        let i = 0;
        const n = code.length;
        let comments = 0;

        while (i < n) {
            if (code[i] === '<' && code.startsWith('<!--', i)) {
                const start = i;
                i += 4;
                while (i < n && !code.startsWith('-->', i)) i++;
                if (i < n) i += 3;
                const block = code.slice(start, i);
                if (opts.preserveLicense && isLicenseBlock(block)) {
                    out += block;
                } else {
                    comments++;
                }
                continue;
            }
            if (code[i] === '<' && code.startsWith('<![CDATA[', i)) {
                const end = code.indexOf(']]>', i);
                const stop = end === -1 ? n : end + 3;
                out += code.slice(i, stop);
                i = stop;
                continue;
            }
            out += code[i];
            i++;
        }
        return { code: out, comments };
    };

    // CSS / SCSS / LESS
    const removeCSS = (code, opts) => {
        let out = '';
        let i = 0;
        const n = code.length;
        let comments = 0;

        while (i < n) {
            const ch = code[i];
            if (ch === '"' || ch === "'") {
                const quote = ch;
                out += ch; i++;
                while (i < n && code[i] !== quote) {
                    if (code[i] === '\\' && i + 1 < n) { out += code[i] + code[i + 1]; i += 2; continue; }
                    if (code[i] === '\n') break;
                    out += code[i]; i++;
                }
                if (i < n && code[i] === quote) { out += code[i]; i++; }
                continue;
            }
            if (ch === '/' && code[i + 1] === '*') {
                const start = i;
                i += 2;
                while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
                if (i < n) i += 2;
                const block = code.slice(start, i);
                if (opts.preserveLicense && isLicenseBlock(block)) out += block;
                else comments++;
                continue;
            }
            if (ch === '/' && code[i + 1] === '/') {
                comments++;
                while (i < n && code[i] !== '\n') i++;
                continue;
            }
            out += ch; i++;
        }
        return { code: out, comments };
    };

    // SQL: -- line, /* */, ANSI strings (''-escape inside '...')
    const removeSQL = (code, opts) => {
        let out = '';
        let i = 0;
        const n = code.length;
        let comments = 0;

        while (i < n) {
            const ch = code[i];
            if (ch === "'" || ch === '"') {
                const quote = ch;
                out += ch; i++;
                while (i < n) {
                    if (code[i] === quote && code[i + 1] === quote) { out += code[i] + code[i + 1]; i += 2; continue; }
                    if (code[i] === quote) { out += code[i]; i++; break; }
                    out += code[i]; i++;
                }
                continue;
            }
            if (ch === '-' && code[i + 1] === '-') {
                comments++;
                while (i < n && code[i] !== '\n') i++;
                continue;
            }
            if (ch === '/' && code[i + 1] === '*') {
                const start = i;
                i += 2;
                while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
                if (i < n) i += 2;
                const block = code.slice(start, i);
                if (opts.preserveLicense && isLicenseBlock(block)) out += block;
                else comments++;
                continue;
            }
            out += ch; i++;
        }
        return { code: out, comments };
    };

    // Shell / Ruby / YAML / TOML / Perl / R
    const removeHash = (code, opts) => {
        let out = '';
        let i = 0;
        const n = code.length;
        let comments = 0;
        let preservedShebang = false;

        if (opts.preserveLicense && code.startsWith('#!')) {
            const nl = code.indexOf('\n');
            const end = nl === -1 ? n : nl + 1;
            out = code.slice(0, end);
            i = end;
            preservedShebang = true;
        }

        while (i < n) {
            const ch = code[i];
            if (ch === '"' || ch === "'") {
                const quote = ch;
                out += ch; i++;
                while (i < n && code[i] !== quote) {
                    if (quote === '"' && code[i] === '\\' && i + 1 < n) { out += code[i] + code[i + 1]; i += 2; continue; }
                    out += code[i]; i++;
                }
                if (i < n && code[i] === quote) { out += code[i]; i++; }
                continue;
            }
            if (ch === '#') {
                // Don't strip a fragment-like '#' inside (e.g. URLs) — but without full lexer
                // we apply the safe rule: '#' starts a comment unless preceded by a non-whitespace
                // character (treating "value#frag" as part of value is rare in these languages
                // outside strings, which are already handled above).
                const prev = out.length > 0 ? out[out.length - 1] : '\n';
                if (/[\s]/.test(prev) || prev === '\n' || out.length === 0) {
                    comments++;
                    while (i < n && code[i] !== '\n') i++;
                    continue;
                }
            }
            out += ch; i++;
        }
        return { code: out, comments };
    };

    // Lua: -- line, --[[ ... ]] block
    const removeLua = (code, opts) => {
        let out = '';
        let i = 0;
        const n = code.length;
        let comments = 0;

        while (i < n) {
            const ch = code[i];
            if (ch === '"' || ch === "'") {
                const quote = ch;
                out += ch; i++;
                while (i < n && code[i] !== quote) {
                    if (code[i] === '\\' && i + 1 < n) { out += code[i] + code[i + 1]; i += 2; continue; }
                    if (code[i] === '\n') break;
                    out += code[i]; i++;
                }
                if (i < n && code[i] === quote) { out += code[i]; i++; }
                continue;
            }
            if (ch === '-' && code[i + 1] === '-') {
                if (code[i + 2] === '[' && code[i + 3] === '[') {
                    i += 4;
                    while (i < n && !(code[i] === ']' && code[i + 1] === ']')) i++;
                    if (i < n) i += 2;
                    comments++;
                    continue;
                }
                comments++;
                while (i < n && code[i] !== '\n') i++;
                continue;
            }
            out += ch; i++;
        }
        return { code: out, comments };
    };

    const REMOVERS = {
        javascript: removeCStyle,
        c: removeCStyle,
        python: removePython,
        html: removeHTML,
        css: removeCSS,
        sql: removeSQL,
        shell: removeHash,
        lua: removeLua,
    };

    // ---------- Post-processing ----------
    const postProcess = (code, opts) => {
        let result = code;
        if (opts.trimTrailing) {
            result = result.split('\n').map((line) => line.replace(/[ \t]+$/, '')).join('\n');
        }
        if (opts.collapseBlankLines) {
            result = result.replace(/\n{3,}/g, '\n\n');
        }
        return result.replace(/^\s*\n/, '').replace(/\n+$/, '\n');
    };

    // ---------- Stats ----------
    const updateInputMeta = () => {
        const v = els.input.value;
        const lines = v ? v.split('\n').length : 0;
        els.inputMeta.textContent = `${lines.toLocaleString()} lines · ${v.length.toLocaleString()} chars`;
    };

    const updateOutputMeta = () => {
        const v = els.output.value;
        const lines = v ? v.split('\n').length : 0;
        els.outputMeta.textContent = `${lines.toLocaleString()} lines · ${v.length.toLocaleString()} chars`;
    };

    const showStats = (inputCode, outputCode, comments) => {
        const inLines = inputCode ? inputCode.split('\n').length : 0;
        const outLines = outputCode ? outputCode.split('\n').length : 0;
        const linesRemoved = Math.max(0, inLines - outLines);
        const charsSaved = Math.max(0, inputCode.length - outputCode.length);
        const pct = inputCode.length > 0
            ? Math.round((charsSaved / inputCode.length) * 100)
            : 0;
        els.statComments.textContent = comments.toLocaleString();
        els.statLines.textContent = linesRemoved.toLocaleString();
        els.statChars.textContent = charsSaved.toLocaleString();
        els.statPct.textContent = `${pct}%`;
        els.stats.hidden = false;
    };

    // ---------- Main action ----------
    const process = () => {
        const code = els.input.value;
        if (!code.trim()) {
            toast('Nothing to process — paste some code first.', 'error');
            els.input.focus();
            return;
        }

        const opts = {
            preserveDocs: els.optPreserveDocs.checked,
            preserveLicense: els.optPreserveLicense.checked,
            collapseBlankLines: els.optCollapseBlankLines.checked,
            trimTrailing: els.optTrimTrailing.checked,
        };

        const lang = resolveLanguage(code, lastFileName);
        const remover = REMOVERS[lang] || removeCStyle;

        let result;
        try {
            result = remover(code, opts);
        } catch (err) {
            console.error(err);
            toast('Failed to process — check console for details.', 'error');
            return;
        }

        const cleaned = postProcess(result.code, opts);
        els.output.value = cleaned;

        updateOutputMeta();
        showStats(code, cleaned, result.comments);

        els.copy.disabled = cleaned.length === 0;
        els.download.disabled = cleaned.length === 0;

        if (result.comments === 0) {
            toast(`No comments detected (language: ${lang}).`, 'info');
        } else {
            toast(`Removed ${result.comments} comment${result.comments === 1 ? '' : 's'}.`, 'success');
        }
    };

    // ---------- Reset ----------
    const resetForm = () => {
        els.input.value = '';
        els.output.value = '';
        lastFileName = null;
        updateInputMeta();
        updateOutputMeta();
        els.stats.hidden = true;
        els.copy.disabled = true;
        els.download.disabled = true;
        els.input.focus();
        toast('Cleared.', 'info');
    };

    // ---------- Copy ----------
    const copyOutput = async () => {
        const text = els.output.value;
        if (!text) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                els.output.select();
                els.output.setSelectionRange(0, text.length);
                document.execCommand('copy');
                els.output.setSelectionRange(0, 0);
            }
            toast('Copied to clipboard.', 'success');
        } catch (err) {
            console.error(err);
            toast('Copy failed.', 'error');
        }
    };

    // ---------- Download ----------
    const download = () => {
        const text = els.output.value;
        if (!text) return;
        const base = lastFileName
            ? lastFileName.replace(/(\.[^.]+)?$/, '.clean$1')
            : 'cleaned.txt';
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = base;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast(`Downloaded ${base}.`, 'success');
    };

    // ---------- File upload ----------
    const readFile = (file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast('File is too large (max 5 MB).', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            els.input.value = e.target.result || '';
            lastFileName = file.name;
            updateInputMeta();
            const detected = detectFromFilename(file.name);
            if (detected && els.language.value === 'auto') {
                toast(`Loaded ${file.name} — detected ${detected}.`, 'success');
            } else {
                toast(`Loaded ${file.name}.`, 'success');
            }
        };
        reader.onerror = () => toast('Failed to read file.', 'error');
        reader.readAsText(file);
    };

    // ---------- Drag & drop ----------
    const setupDragDrop = () => {
        const dz = els.dropzone;
        ['dragenter', 'dragover'].forEach((ev) =>
            dz.addEventListener(ev, (e) => {
                if (!e.dataTransfer?.types?.includes('Files')) return;
                e.preventDefault();
                dz.classList.add('is-dragover');
            }));
        ['dragleave', 'drop'].forEach((ev) =>
            dz.addEventListener(ev, (e) => {
                e.preventDefault();
                dz.classList.remove('is-dragover');
            }));
        dz.addEventListener('drop', (e) => {
            const file = e.dataTransfer?.files?.[0];
            if (file) readFile(file);
        });
    };

    // ---------- Keyboard shortcuts ----------
    const setupShortcuts = () => {
        document.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const key = e.key.toLowerCase();
            if (key === 'enter') { e.preventDefault(); process(); }
            else if (key === 'l' && !e.shiftKey) { e.preventDefault(); resetForm(); }
            else if (key === 'c' && e.shiftKey) { e.preventDefault(); copyOutput(); }
            else if (key === 's') { e.preventDefault(); download(); }
            else if (key === 'j') { e.preventDefault(); toggleTheme(); }
        });
    };

    // ---------- Wire-up ----------
    const init = () => {
        initTheme();
        loadPrefs();

        els.commit.addEventListener('click', process);
        els.reset.addEventListener('click', resetForm);
        els.copy.addEventListener('click', copyOutput);
        els.download.addEventListener('click', download);
        els.theme.addEventListener('click', toggleTheme);
        els.upload.addEventListener('click', () => els.file.click());
        els.file.addEventListener('change', (e) => readFile(e.target.files?.[0]));

        els.input.addEventListener('input', updateInputMeta);
        els.language.addEventListener('change', savePrefs);
        [els.optPreserveDocs, els.optPreserveLicense, els.optCollapseBlankLines, els.optTrimTrailing]
            .forEach((el) => el.addEventListener('change', savePrefs));

        setupDragDrop();
        setupShortcuts();

        updateInputMeta();
        updateOutputMeta();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
