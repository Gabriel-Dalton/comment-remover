# Comment Remover

**Comment Remover** is a fast, offline, privacy-friendly web tool that strips
comments from source code. Everything runs in your browser — no code ever
leaves your device.

<img width="1918" height="866" alt="image" src="https://github.com/user-attachments/assets/9c1a3f7c-07e4-41ec-b15a-ccd565c9bb7d" />


## Features

- **Multi-language support** with string-aware parsing — comment markers inside
  string literals are never mistaken for comments:
  - JavaScript / TypeScript (incl. template literals and `${...}`)
  - Python (triple-quoted strings preserved)
  - HTML / XML / Vue / Svelte
  - CSS / SCSS / LESS
  - C / C++ / Java / Go / Rust / Swift / Kotlin / PHP / Scala / Dart
  - SQL
  - Shell / Bash / Ruby / YAML / TOML / Perl / R
  - Lua
- **Auto-detect language** from file extension or content.
- **Removal options:**
  - Preserve docstrings & JSDoc (`/** ... */`)
  - Preserve license / copyright headers and shebangs (`#!`)
  - Collapse consecutive blank lines
  - Trim trailing whitespace
- **File upload** via button or drag-and-drop (up to 5 MB).
- **Download** the cleaned output with a sensible filename.
- **Copy** to clipboard using the modern Clipboard API.
- **Statistics** showing comments removed, lines removed, characters saved, and
  percentage reduction.
- **Light & dark themes** with system-preference detection and persistence.
- **Toast notifications** instead of intrusive `alert()` dialogs.
- **Keyboard shortcuts:**
  - `Ctrl/Cmd + Enter` — remove comments
  - `Ctrl/Cmd + L` — reset
  - `Ctrl/Cmd + Shift + C` — copy output
  - `Ctrl/Cmd + S` — download output
  - `Ctrl/Cmd + J` — toggle theme
- **Responsive layout** that works on phones, tablets, and desktops.
- **Persistent preferences** — language and option choices are remembered.

## Usage

1. Paste your code (or drag-and-drop a file) into the input panel.
2. Pick the language, or leave it on **Auto-detect**.
3. Tick the options you want.
4. Click **Remove Comments** (or press `Ctrl/Cmd + Enter`).
5. **Copy** or **Download** the cleaned output.

## Installation

No build step required. Clone the repo and open `index.html` in your browser,
or serve the directory with any static file server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

- `index.html` — Markup for the interface.
- `styles.css` — Themeable design system (CSS variables for dark/light).
- `script.js` — Comment removers, file I/O, shortcuts, toasts.

## Example

Input:

```js
// Bootstraps the app
import { start } from './app.js';

/**
 * Entry point.
 */
start(); // kick things off
```

Output (with **Preserve docstrings & JSDoc** enabled):

```js
import { start } from './app.js';

/**
 * Entry point.
 */
start();
```

## License

MIT.

## Contributing

Pull requests welcome. Please include a short description of the change and,
where possible, a test snippet that exercises any new parser branch.
