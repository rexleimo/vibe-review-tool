# Review Editor AI Summary Provider Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Generate Review Summary` the first real AI action by letting the user select a default CLI provider in-app and invoking that provider against the current review context.

**Architecture:** Keep provider detection and process execution in Tauri/Rust, with a small provider abstraction for `codex`, `claude`, `gemini`, and `opencode`. Keep provider selection, loading state, and result rendering in React, reusing the existing AI overlay pattern but turning the summary path into a real request/response flow.

**Tech Stack:** Tauri 2 (Rust commands/process spawning), React 19, TypeScript, `@tauri-apps/plugin-store`

---

## File Map

- Modify: `apps/desktop/src-tauri/src/lib.rs`
  - Add provider types, provider detection, summary context command, and CLI invocation command.
- Modify: `apps/desktop/src/App.tsx`
  - Add provider settings state, summary request flow, and result overlay wiring.
- Create: `apps/desktop/src/components/AiSummarySheet.tsx`
  - Display summary loading, result, provider label, and failure state.
- Create: `apps/desktop/src/components/AiSummarySheet.css`
  - Style the summary result surface.
- Create: `apps/desktop/src/components/ProviderSettingsSheet.tsx`
  - Let the user choose a default provider and see availability.
- Create: `apps/desktop/src/components/ProviderSettingsSheet.css`
  - Style the provider settings surface.
- Create: `apps/desktop/src/hooks/useAiProvider.ts`
  - Persist and load the selected provider using the existing store approach.
- Modify: `apps/desktop/src/components/TopBar.tsx`
  - Keep titlebar AI action routed to summary.
- Modify: `apps/desktop/src/App.css`
  - Remove or adapt generic placeholder styles as needed.
- Modify: `README.md`
- Modify: `apps/desktop/README.md`

## Chunk 1: Rust Provider and Summary Backend

### Task 1: Add provider enum and availability detection

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Locate the Tauri command section and supporting types**

Run: `rg -n "tauri::command|struct .*Request|pub fn run" apps/desktop/src-tauri/src/lib.rs`
Expected: Identify where new AI provider commands and response types should live.

- [ ] **Step 2: Add provider and response types**

Create focused Rust types for:
- provider identifier enum
- provider availability response
- summary request
- summary result

Expected: Backend interfaces are typed and do not leak raw shell details to the frontend.

- [ ] **Step 3: Implement provider executable detection**

Use a small helper that checks whether each CLI is callable from the current environment.

Expected: The frontend can ask which providers are currently available.

- [ ] **Step 4: Run Rust checks**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS.

## Chunk 2: Summary Context and CLI Invocation

### Task 2: Build current review context for summary

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Define summary request inputs**

Inputs should include:
- repo path
- mode
- workspace mode if applicable
- selected commit SHA/title if applicable

- [ ] **Step 2: Reuse existing diff/file commands where practical**

Assemble:
- file list summary always
- diff content for a bounded subset of files
- truncation note when limits are exceeded

Expected: The prompt context is useful without exploding command size.

- [ ] **Step 3: Add a prompt builder helper**

Return a prompt string that tells the CLI provider to produce a concise review summary based on the included context.

- [ ] **Step 4: Re-run Rust checks**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS.

### Task 3: Invoke the selected CLI provider

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Implement one command to generate a summary**

Add a Tauri command like:

```rust
#[tauri::command]
fn generate_review_summary(req: GenerateSummaryRequest) -> Result<GenerateSummaryResponse, String>
```

- [ ] **Step 2: Implement provider-specific command shapes**

Support:
- `codex`
- `claude`
- `gemini`
- `opencode`

Expected: Each provider maps to a controlled command shape, even if exact flags differ.

- [ ] **Step 3: Capture stdout/stderr and normalize failures**

Handle:
- missing executable
- non-zero exit
- empty output

- [ ] **Step 4: Register new commands**

Add both provider availability and summary generation to the Tauri command handler.

- [ ] **Step 5: Re-run Rust checks**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS.

## Chunk 3: Frontend Provider Selection and Summary UI

### Task 4: Persist the default provider in the frontend

**Files:**
- Create: `apps/desktop/src/hooks/useAiProvider.ts`

- [ ] **Step 1: Mirror the existing persistence style**

Use `LazyStore` like `useRecentProjects.ts` to store the selected provider.

- [ ] **Step 2: Expose a focused hook API**

Example:

```ts
const { provider, setProvider } = useAiProvider();
```

- [ ] **Step 3: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

### Task 5: Add provider settings UI

**Files:**
- Create: `apps/desktop/src/components/ProviderSettingsSheet.tsx`
- Create: `apps/desktop/src/components/ProviderSettingsSheet.css`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Render provider list and availability**

Show:
- provider label
- available / unavailable status
- selected state

- [ ] **Step 2: Wire the app settings menu to this sheet**

Repurpose the current `Settings` placeholder into provider configuration for V1.

- [ ] **Step 3: Persist provider changes**

Expected: Provider selection survives app restarts.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

### Task 6: Replace summary placeholder with real result flow

**Files:**
- Create: `apps/desktop/src/components/AiSummarySheet.tsx`
- Create: `apps/desktop/src/components/AiSummarySheet.css`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Add summary state to `App.tsx`**

Track:
- idle/loading/success/error
- selected provider
- provider availability
- summary text

- [ ] **Step 2: Trigger summary generation from both entry points**

Use the same flow for:
- menu `AI -> Generate Review Summary`
- titlebar `AI` button

- [ ] **Step 3: Replace only the summary action**

Keep other AI actions on the existing placeholder path.

- [ ] **Step 4: Render summary results in an app-owned sheet**

The sheet must show:
- provider used
- loading state
- result text
- rerun button
- clear failure message

- [ ] **Step 5: Run frontend build**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

## Chunk 4: Verification and Delivery

### Task 7: Build, install, and verify the desktop app

**Files:**
- Modify: `README.md`
- Modify: `apps/desktop/README.md`

- [ ] **Step 1: Build the app**

Run: `cd apps/desktop && npm run tauri build`
Expected: `.app` bundle produced successfully even if `.dmg` still fails separately.

- [ ] **Step 2: Install the new `.app`**

Copy `/Users/molei/review-editor/target/release/bundle/macos/Review Editor.app` to `/Applications`.

- [ ] **Step 3: Manually verify**

Check:
- provider settings sheet opens
- default provider can be changed
- unavailable provider shows clear status
- `Generate Review Summary` runs against the selected provider
- result appears in-app
- other AI actions still show placeholders

- [ ] **Step 4: Update docs**

Document:
- supported providers
- requirement that the provider CLI be installed locally
- where to choose the default provider

- [ ] **Step 5: Final verification**

Run:
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `cd apps/desktop && npm run build`
- `cd apps/desktop && npm run tauri build`

Expected: checks pass and `.app` bundle is produced.

