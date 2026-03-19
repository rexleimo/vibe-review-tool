# Review Editor Menu System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native macOS menu system for Review Editor that reflects the approved AI review product architecture and wires core menu actions into the existing desktop UI.

**Architecture:** Declare the application menu in the Tauri/Rust layer so macOS gets a real native menu bar, then forward product menu selections into the React app through typed window events. Keep `Project`, `Review`, and `View` actions wired to real UI behavior, while `AI` actions initially route to clear product-owned placeholder UI until backend functionality exists.

**Tech Stack:** Tauri 2 (Rust menu API + events), React 19, TypeScript, existing desktop state in `apps/desktop/src/App.tsx`

---

## File Map

- Modify: `apps/desktop/src-tauri/src/lib.rs`
  - Add native menu construction, menu item identifiers, and event emission into the webview.
- Modify: `apps/desktop/src-tauri/src/main.rs`
  - Only if bootstrapping needs to change; otherwise leave untouched.
- Modify: `apps/desktop/src/App.tsx`
  - Centralize handling for menu-driven product actions and AI placeholder state.
- Modify: `apps/desktop/src/components/TopBar.tsx`
  - Align top-bar control names with menu terminology where needed.
- Modify: `apps/desktop/src/components/WelcomeScreen.tsx`
  - Support `Close Project` and `Welcome` flows cleanly.
- Modify: `apps/desktop/src/hooks/useRecentProjects.ts`
  - Expose helpers needed by `Open Recent` / project switching semantics if current API is insufficient.
- Create: `apps/desktop/src/hooks/useMenuActions.ts`
  - Subscribe to Tauri menu events and translate them into typed callbacks for React.
- Create: `apps/desktop/src/components/AiActionPlaceholder.tsx`
  - Render a lightweight modal/sheet for not-yet-wired AI actions.
- Modify: `apps/desktop/src/App.css`
  - Add placeholder modal styles and any layout-reset affordances.
- Test: `apps/desktop/src/hooks/useMenuActions.test.ts` or `apps/desktop/src/App.test.tsx`
  - Add focused tests if the current toolchain supports them; otherwise add a plan note and rely on manual verification.

## Chunk 1: Native Menu Skeleton

### Task 1: Add menu action identifiers in Rust

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Inspect existing Tauri setup and locate `run()`**

Run: `rg -n "fn run|Builder::default|invoke_handler" apps/desktop/src-tauri/src/lib.rs`
Expected: Find the existing Tauri builder entrypoint and command registration block.

- [ ] **Step 2: Define stable menu action IDs**

Add a focused enum or string constants for:

```rust
const MENU_PROJECT_OPEN: &str = "project.open";
const MENU_PROJECT_OPEN_RECENT_PREFIX: &str = "project.open_recent.";
const MENU_REVIEW_COMMIT: &str = "review.commit";
const MENU_AI_SUMMARY: &str = "ai.summary";
```

Expected: IDs are grouped by domain (`project.*`, `review.*`, `ai.*`, `view.*`, `help.*`) so React can switch on them predictably.

- [ ] **Step 3: Build the top-level menu structure**

Add a helper such as:

```rust
fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<Wry>> {
    // build Review Editor / Project / Review / AI / View / Window / Help
}
```

Expected: The menu uses native roles for standard app/window/help behavior where Tauri provides them, and custom IDs for product actions.

- [ ] **Step 4: Run desktop Rust checks**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS without menu API type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add native desktop menu skeleton"
```

Expected: Commit contains only Rust menu declaration work.

### Task 2: Emit menu actions from Rust into the webview

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing integration behavior mentally and capture it as a manual check note**

Behavior to prove after implementation:
- Clicking `Review -> Review Workspace Changes` changes the current mode in the UI.
- Clicking `AI -> Explain Selected Diff` opens an app-owned placeholder.

Expected: The target behavior is explicit before wiring events.

- [ ] **Step 2: Add a typed payload for menu events**

Add a serializable struct like:

```rust
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MenuActionPayload {
    action: String,
    value: Option<String>,
}
```

- [ ] **Step 3: Register menu event handling on the builder**

Handle menu events and emit a frontend event:

```rust
window.emit("menu-action", MenuActionPayload {
    action: action_id.to_string(),
    value: recent_path,
})?;
```

Expected: Custom product actions are forwarded into the main window; native role items remain native.

- [ ] **Step 4: Re-run Rust checks**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: emit menu actions to desktop frontend"
```

## Chunk 2: React Action Wiring

### Task 3: Create a focused menu-event hook

**Files:**
- Create: `apps/desktop/src/hooks/useMenuActions.ts`

- [ ] **Step 1: Write the failing hook contract**

Target API:

```ts
export type MenuAction =
  | { action: "project.open" }
  | { action: "project.open_recent"; value: string }
  | { action: "review.commit" };

export function useMenuActions(onAction: (action: MenuAction) => void) {}
```

Expected: The hook boundary is typed and isolated from `App.tsx`.

- [ ] **Step 2: Implement minimal listener setup**

Use Tauri event listening in the hook, parse the payload, and forward valid actions to the callback.

- [ ] **Step 3: Add a small test if the frontend test harness exists**

Run: `rg -n "vitest|jest|@testing-library" apps/desktop package.json apps/desktop/package.json`
Expected: If a supported harness exists, add one test around payload parsing; otherwise document "no existing frontend test harness" inside the implementation PR notes and continue.

- [ ] **Step 4: Run TypeScript validation**

Run: `cd apps/desktop && npm run build`
Expected: PASS or fail only on unrelated pre-existing issues.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/hooks/useMenuActions.ts apps/desktop/package.json
git commit -m "feat: add desktop menu action hook"
```

### Task 4: Connect product menu actions in `App.tsx`

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/WelcomeScreen.tsx`
- Modify: `apps/desktop/src/hooks/useRecentProjects.ts`

- [ ] **Step 1: Identify existing app actions**

Run: `rg -n "onSwitchProject|onRefresh|setMode|selectedFile|sidebar|repoPath|savedProjects" apps/desktop/src/App.tsx`
Expected: Find the existing state and callbacks that should back `Project`, `Review`, and `View`.

- [ ] **Step 2: Write the mapping table before code**

Create an inline object or switch mapping:

```ts
switch (action.action) {
  case "project.open":
  case "project.switch":
  case "review.workspace":
  case "view.toggle_sidebar":
}
```

Expected: One centralized action dispatcher instead of scattering menu behavior across components.

- [ ] **Step 3: Implement real actions**

Wire these to existing behavior:
- `project.open`
- `project.switch`
- `project.refresh_context`
- `project.close`
- `review.commit`
- `review.workspace`
- `review.refresh`
- `review.next_file`
- `review.previous_file`
- `view.toggle_sidebar`
- `view.focus_diff`
- `view.reset_layout`

Expected: These actions work without adding backend features.

- [ ] **Step 4: Support `Open Recent`**

Expose whatever `useRecentProjects` helper is needed so the Rust menu can populate recent items and the React app can open them by path or ID.

Expected: Recent project behavior matches the welcome screen’s saved-project model.

- [ ] **Step 5: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/components/WelcomeScreen.tsx apps/desktop/src/hooks/useRecentProjects.ts apps/desktop/src/hooks/useMenuActions.ts
git commit -m "feat: wire project and review menu actions"
```

## Chunk 3: AI Placeholder UX and Verification

### Task 5: Add a product-owned AI placeholder surface

**Files:**
- Create: `apps/desktop/src/components/AiActionPlaceholder.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/App.css`

- [ ] **Step 1: Define the placeholder component contract**

Example:

```tsx
interface AiActionPlaceholderProps {
  actionLabel: string;
  contextLabel: string;
  onClose: () => void;
}
```

Expected: Placeholder text can explain the action and current review context.

- [ ] **Step 2: Render minimal owned UI**

The placeholder should state:
- what the selected AI action is
- what repo/review/file context it would run on
- that the backend is not yet wired

Expected: No dead clicks; the product owns the gap clearly.

- [ ] **Step 3: Route all V1 AI menu actions to the placeholder**

Actions:
- `ai.summary`
- `ai.explain_diff`
- `ai.surface_risks`
- `ai.suggest_fix`
- `ai.draft_comment`

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/AiActionPlaceholder.tsx apps/desktop/src/App.tsx apps/desktop/src/App.css
git commit -m "feat: add ai menu placeholders"
```

### Task 6: Verify the complete menu experience manually

**Files:**
- Modify: `README.md`
- Modify: `apps/desktop/README.md`

- [ ] **Step 1: Build the desktop app**

Run: `cd apps/desktop && npm run tauri build`
Expected: PASS and produce a fresh `.app`.

- [ ] **Step 2: Manually verify menu behavior on macOS**

Check:
- the app menu bar shows `Review Editor / Project / Review / AI / View / Window / Help`
- `Project` and `Review` actions drive real UI changes
- `View -> Toggle Sidebar` and `View -> Reset Layout` behave correctly
- `AI` actions open the placeholder UI instead of doing nothing
- no project state correctly disables or degrades menu actions

Expected: All checks pass with the built app.

- [ ] **Step 3: Update docs**

Document:
- the new menu architecture
- any placeholder AI behavior
- how to access project/review actions from the menu bar

- [ ] **Step 4: Final verification**

Run:
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `cd apps/desktop && npm run build`
- `cd apps/desktop && npm run tauri build`

Expected: All commands pass.

- [ ] **Step 5: Commit**

```bash
git add README.md apps/desktop/README.md
git commit -m "docs: describe desktop menu system"
```

