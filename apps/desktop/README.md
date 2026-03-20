# Review Editor Desktop

Desktop GUI for `review_engine` built with `Tauri + React + TypeScript`.

## Features (Current)

- Open or switch repositories from the app shell
- Review commit history and workspace changes
- Inspect split diff views with Monaco
- Use native macOS menus for `Project`, `Review`, `AI`, `View`, `Window`, and `Help`
- Use an integrated Arc-inspired titlebar centered on current review context
- Choose a default AI provider from `Review Editor -> Settings...`
- Generate a real review summary through `AI -> Generate Review Summary` or the titlebar AI entry
- Create structured review items from the current file or selected diff range
- Use the right-side review queue to track `Open`, `AI Editing`, `Needs Review`, and `Resolved`
- Let the selected AI provider edit the workspace directly from a review item, then review the resulting diff

## Dev Run

```bash
cd apps/desktop
npm install
npm run tauri dev
```

## Build

```bash
cd apps/desktop
npm run tauri build
```

Build outputs are generated under:

- `target/release/bundle/macos/Review Editor.app`
- `target/release/bundle/dmg/Review Editor_0.1.0_aarch64.dmg`
