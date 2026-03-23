# review-editor

`review-editor` now ships with a desktop GUI (`Tauri + React + TypeScript`) backed by a Rust review engine.

The current desktop shell includes:

- native macOS product menus
- an integrated Arc-inspired titlebar with review-context-first hierarchy
- a comment-centric review queue for file-level and range-level review items
- direct AI workspace edits routed through review items, then returned to `Needs Review`

## Final GUI Artifact

Built desktop deliverables:

- `target/release/bundle/macos/Review Editor.app`
- `target/release/bundle/dmg/Review Editor_0.1.0_aarch64.dmg`

## GUI Usage

1. Open `Review Editor.app`.
2. Open a repository from the `Project` menu or the welcome screen.
3. Use `Review` to switch between commit review and workspace review.
4. Open `Review Editor -> Settings...` to choose the default AI provider (`codex`, `claude`, `gemini`, or `opencode`).
5. Use `AI -> Generate Review Summary` or the titlebar AI entry to generate a real summary for the current commit/workspace context.
6. Create a file-level review item from the changed-files sidebar, or create a range-level item from a Monaco diff selection.
7. Select the item in the right-side `Review Queue` and run `Ask <provider> To Fix` to let the AI client edit the workspace directly.
8. After the run, the item moves to `Needs Review` and records the changed files and last AI summary.
9. Inspect diffs in the split editor and switch files from the sidebar.
10. Use the integrated titlebar to keep current file / commit context visible while reviewing.

## Dev Commands

Engine tests:

```bash
cargo test -p review_engine
```

Desktop dev:

```bash
cd apps/desktop
npm install
npm run tauri dev
```

Desktop build:

```bash
cd apps/desktop
npm run tauri build
```

Note:

- `npm run tauri build` currently produces a working `.app`.
- The `.dmg` bundling step may fail separately even when the macOS app bundle succeeds.

## Engine Scope (P0)

The engine scans `git diff --cached` and applies:

- `line-too-long`
- `trailing-whitespace`
- `changed-source-without-changed-tests`

## Legacy Markdown CLI Rules

The bootstrap CLI (`python3 -m review_editor.cli <markdown_file>`) analyzes markdown text with:

- `line-too-long`
- `trailing-whitespace`
- `heading-structure` (flags heading level jumps, such as `#` directly to `###`)
