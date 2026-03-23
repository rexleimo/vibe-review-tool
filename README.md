# review-editor

`review-editor` now ships with a desktop GUI (`Tauri + React + TypeScript`) backed by a Rust review engine.

The repository also includes a standalone marketing site in `apps/site` for the Signal Desk launch surface.

The current desktop shell includes:

- native macOS product menus
- an integrated Arc-inspired titlebar with review-context-first hierarchy

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
6. The other AI menu items currently remain product placeholders.
7. Inspect diffs in the split editor and switch files from the sidebar.
8. Use the integrated titlebar to keep current file / commit context visible while reviewing.

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

Site dev:

```bash
cd apps/site
npm install
npm run dev
```

Desktop build:

```bash
cd apps/desktop
npm run tauri build
```

Site verification:

```bash
cd apps/site
npm run test:site
npm run build
```

Note:

- `npm run tauri build` currently produces a working `.app`.
- The `.dmg` bundling step may fail separately even when the macOS app bundle succeeds.

## Engine Scope (P0)

The engine scans `git diff --cached` and applies:

- `line-too-long`
- `trailing-whitespace`
- `changed-source-without-changed-tests`
