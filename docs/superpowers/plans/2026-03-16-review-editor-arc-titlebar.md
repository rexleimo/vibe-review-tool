# Review Editor Arc Titlebar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current stacked top area with an integrated Arc-inspired macOS titlebar that centers current review context and preserves a calm, premium desktop feel.

**Architecture:** Move window-level titlebar behavior into Tauri configuration, then refactor the current React `TopBar` into an integrated titlebar surface with left, center, and right zones. The center block becomes a two-line review-context display derived from existing app state, while the right side keeps only mode switching and one AI entry. Existing menu actions remain intact and complementary.

**Tech Stack:** Tauri 2 window configuration, React 19, TypeScript, CSS, existing desktop app state in `apps/desktop/src/App.tsx`

---

## File Map

- Modify: `apps/desktop/src-tauri/tauri.conf.json`
  - Enable the macOS titlebar configuration required for an integrated custom titlebar surface.
- Modify: `apps/desktop/src/App.tsx`
  - Derive titlebar context strings from current project, mode, commit, and file state.
- Modify: `apps/desktop/src/components/TopBar.tsx`
  - Replace the current repo-path-first header with the integrated titlebar layout.
- Modify: `apps/desktop/src/components/TopBar.css`
  - Redesign spacing, drag-safe regions, hierarchy, and premium surface styling.
- Modify: `apps/desktop/src/components/ModePill.tsx`
  - Adjust if needed so it fits the integrated titlebar without looking bulky.
- Modify: `apps/desktop/src/components/ModePill.css`
  - Tighten styling for the integrated titlebar.
- Modify: `apps/desktop/src/App.css`
  - Remove the old stacked-header assumptions and add any titlebar-wide layout rules.
- Test: manual desktop verification using the built `.app`
  - Validate drag behavior, context hierarchy, and visual integration on macOS.

## Chunk 1: Window Integration

### Task 1: Enable integrated macOS titlebar behavior

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Confirm supported Tauri window titlebar options**

Run: `rg -n "titleBarStyle|hiddenTitle|trafficLightPosition|decorations" apps/desktop/src-tauri/gen/schemas apps/desktop/src-tauri/tauri.conf.json -S`
Expected: Identify the supported config keys for the current Tauri version.

- [ ] **Step 2: Update the main window configuration**

Set the titlebar-related options needed for an integrated macOS surface, for example:

```json
{
  "titleBarStyle": "Overlay",
  "hiddenTitle": true
}
```

Expected: The native title text no longer competes with the custom titlebar UI.

- [ ] **Step 3: Run Rust-side config validation through a desktop build check**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS, confirming config/schema compatibility at build time.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/tauri.conf.json
git commit -m "feat: enable integrated macos titlebar"
```

## Chunk 2: Titlebar Component Refactor

### Task 2: Define the titlebar context contract in React

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/TopBar.tsx`

- [ ] **Step 1: Identify the existing state needed by the new titlebar**

Run: `rg -n "selectedCommit|selectedFile|mode|activeProject|repo|files" apps/desktop/src/App.tsx`
Expected: Confirm all context inputs already exist in app state.

- [ ] **Step 2: Add derived titlebar strings in `App.tsx`**

Create focused derived values such as:

```ts
const titlebarMeta = "Commit Review · orchestrate live ui shell";
const titlebarHeadline = selectedFile?.path ?? selectedCommitTitle ?? activeProject?.name;
```

Expected: Titlebar rendering consumes simple strings rather than duplicating app logic inside the component.

- [ ] **Step 3: Expand `TopBar` props to accept the new context model**

Target shape:

```ts
interface TopBarProps {
  projectName?: string;
  contextMeta: string;
  contextHeadline: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onSwitchProject: () => void;
  onPrimaryAiAction: () => void;
}
```

Expected: The titlebar component has a clear responsibility boundary.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/components/TopBar.tsx
git commit -m "refactor: derive integrated titlebar context"
```

### Task 3: Rebuild `TopBar` into left / center / right zones

**Files:**
- Modify: `apps/desktop/src/components/TopBar.tsx`
- Modify: `apps/desktop/src/components/TopBar.css`

- [ ] **Step 1: Replace the current repo-path-first markup**

Build the layout with:
- left zone: product mark + project switcher
- center zone: two-line review context
- right zone: mode switch + AI primary action

Expected: No raw repository path dominates the center anymore.

- [ ] **Step 2: Add drag-safe structure**

Mark non-interactive titlebar regions as draggable and keep buttons/controls non-draggable.

Expected: The top area feels like a real titlebar, not just a styled header.

- [ ] **Step 3: Tighten typography hierarchy**

Apply:
- low-contrast, smaller top line for mode/context
- stronger bottom line for current file path or commit title
- stable truncation for long paths and commit titles

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/TopBar.tsx apps/desktop/src/components/TopBar.css
git commit -m "feat: add arc-style integrated titlebar"
```

## Chunk 3: Supporting Styling and Interaction Polish

### Task 4: Tune supporting components for the integrated titlebar

**Files:**
- Modify: `apps/desktop/src/components/ModePill.tsx`
- Modify: `apps/desktop/src/components/ModePill.css`
- Modify: `apps/desktop/src/App.css`

- [ ] **Step 1: Reduce mode switch visual weight**

Adjust the mode pill so it fits the titlebar without looking like a large toolbar control.

- [ ] **Step 2: Remove old stacked-header assumptions**

Update `App.css` to ensure:
- no extra top seam
- workbench begins naturally under the integrated titlebar
- spacing works on both desktop and smaller widths

- [ ] **Step 3: Keep AI entry restrained**

Make the right-side AI button present and clear, but not bright, oversized, or marketing-heavy.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ModePill.tsx apps/desktop/src/components/ModePill.css apps/desktop/src/App.css
git commit -m "style: polish integrated titlebar controls"
```

### Task 5: Verify the titlebar end-to-end on macOS

**Files:**
- Modify: `README.md`
- Modify: `apps/desktop/README.md`

- [ ] **Step 1: Build the desktop app**

Run: `cd apps/desktop && npm run tauri build`
Expected: PASS for the `.app` bundle, even if `.dmg` bundling still fails separately.

- [ ] **Step 2: Install and launch the fresh `.app`**

Copy the new app bundle into `/Applications` and open it.

Expected: The app launches with the integrated titlebar visible.

- [ ] **Step 3: Manually verify titlebar behavior**

Check:
- the old double-header feeling is gone
- the center block shows two levels of context
- current file path or commit title owns the visual center
- project identity is still available but secondary
- titlebar controls remain clickable and drag behavior feels correct
- right-side actions stay minimal and uncluttered

- [ ] **Step 4: Update docs**

Document:
- the integrated titlebar direction
- the review-context-first hierarchy
- any known build limitations such as separate `.dmg` failure

- [ ] **Step 5: Final verification**

Run:
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `cd apps/desktop && npm run build`
- `cd apps/desktop && npm run tauri build`

Expected: Rust and frontend checks pass; `.app` bundle is produced successfully.

- [ ] **Step 6: Commit**

```bash
git add README.md apps/desktop/README.md
git commit -m "docs: describe integrated arc titlebar"
```

