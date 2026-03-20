# Review Editor Comment-Centric Review MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review-item-driven workflow to the desktop app so reviewers can create file-level or line-range review items, ask AI to edit the workspace against those items, and then return to a `Needs Review` state to verify the result.

**Architecture:** Keep the existing left navigation and center diff viewer, and add a right-side review queue as the new review control surface. Store review items locally in the desktop app, route AI edits through Tauri commands keyed off a review item instead of a free-form fix prompt, then refresh workspace state and item status after execution.

**Locked MVP decisions:**
- Review items are anchored by `repo_path + context_id`, not a single global session bucket.
- Queue ordering is `current file -> current context -> other repo items`, not hard filtering.
- Range items come from Monaco diff selection on the modified side.
- Only one item may be `ai_editing` at a time.
- A successful AI run from commit review moves the item into workspace review so the user can inspect the actual workspace diff afterward.

**Tech Stack:** Tauri 2 (Rust commands/process spawning), React 19, TypeScript, `@tauri-apps/plugin-store`, existing Monaco diff viewer

---

## File Map

- Modify: `apps/desktop/src/App.tsx`
  - Add review queue state, selected review item state, and wire new surfaces into the main workbench.
- Modify: `apps/desktop/src/App.css`
  - Add layout styling for the new right-side review queue and review item detail panel.
- Create: `apps/desktop/src/hooks/useReviewItems.ts`
  - Persist, query, create, update, and delete local review items using the existing store pattern.
- Create: `apps/desktop/src/components/ReviewQueue.tsx`
  - Render the list of review items relevant to the selected file / current context.
- Create: `apps/desktop/src/components/ReviewQueue.css`
  - Style the queue list and item state badges.
- Create: `apps/desktop/src/components/ReviewItemComposer.tsx`
  - Minimal item creation sheet/modal for both file-scope and range-scope items.
- Create: `apps/desktop/src/components/ReviewItemComposer.css`
  - Style the composer surface.
- Create: `apps/desktop/src/components/ReviewItemDetail.tsx`
  - Render the selected item’s title, note, scope, status, changed files, and actions.
- Create: `apps/desktop/src/components/ReviewItemDetail.css`
  - Style the item detail panel.
- Modify: `apps/desktop/src/components/FixSheet.tsx`
  - Either remove it from the primary flow or reduce it to an internal detail surface reused by review-item actions.
- Modify: `apps/desktop/src/components/SideBar.tsx`
  - Add entry point for file-level review items from the current file context.
- Modify: `apps/desktop/src-tauri/src/lib.rs`
  - Add or adapt command(s) that execute AI edits from a structured review item request and return changed file metadata.
- Modify: `README.md`
- Modify: `apps/desktop/README.md`

## Chunk 1: Local Review Item Domain

### Task 1: Define the local review item shape and persistence

**Files:**
- Create: `apps/desktop/src/hooks/useReviewItems.ts`
- Reference: `apps/desktop/src/hooks/useRecentProjects.ts`
- Reference: `apps/desktop/src/hooks/useAiProvider.ts`

- [ ] **Step 1: Write the failing test-equivalent checklist**

Document the expected hook API before implementation:

```ts
type ReviewItemScope = "file" | "range";
type ReviewItemStatus = "open" | "ai_editing" | "needs_review" | "resolved";

interface ReviewItem {
  id: string;
  repoPath: string;
  contextId: string;
  contextMode: "commit" | "workspace";
  commitSha: string | null;
  workspaceMode: "all" | "staged" | "unstaged" | null;
  scopeType: ReviewItemScope;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  title: string;
  note: string;
  status: ReviewItemStatus;
  changedFiles: string[];
  lastError: string;
  lastRunSummary: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Expected: The data model is fixed before UI code depends on it.

- [ ] **Step 2: Implement minimal local persistence**

Store review items in `review-editor.dat` with a dedicated key such as `review.items`.

Expected: The hook can load and save review items across app restarts.

- [ ] **Step 3: Expose focused operations**

Implement:

```ts
createReviewItem(input)
updateReviewItem(id, patch)
deleteReviewItem(id)
listReviewItems()
```

Expected: UI layers do not manipulate raw store payloads directly.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`  
Expected: PASS.

## Chunk 2: Review Queue UI

### Task 2: Add the right-side review queue shell

**Files:**
- Create: `apps/desktop/src/components/ReviewQueue.tsx`
- Create: `apps/desktop/src/components/ReviewQueue.css`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/App.css`

- [ ] **Step 1: Define queue props**

The queue should receive:

```ts
items
selectedItemId
selectedFilePath
onSelectItem
onCreateFileItem
```

- [ ] **Step 2: Filter queue items by current file first**

If a file is selected, show matching review items first.  
If no file is selected, show all items for the current review session.

- [ ] **Step 3: Render minimal item cards**

Each card shows:

- title
- scope label
- status

Expected: The reviewer can see the current review workload at a glance.

- [ ] **Step 4: Add the queue to the main workspace layout**

Place the queue as the right-side pane without replacing the current diff experience.

- [ ] **Step 5: Run frontend build**

Run: `cd apps/desktop && npm run build`  
Expected: PASS.

### Task 3: Add review item detail surface

**Files:**
- Create: `apps/desktop/src/components/ReviewItemDetail.tsx`
- Create: `apps/desktop/src/components/ReviewItemDetail.css`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Render the selected item detail**

Show:

- title
- note
- file path
- line range or file label
- status
- changed file list

- [ ] **Step 2: Add action buttons**

Add:

- `Ask AI To Fix`
- `Mark Resolved`
- `Delete`

- [ ] **Step 3: Wire selection from queue to detail**

Expected: Clicking a queue card updates the detail panel.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`  
Expected: PASS.

## Chunk 3: Review Item Creation

### Task 4: Add file-scope review item creation

**Files:**
- Create: `apps/desktop/src/components/ReviewItemComposer.tsx`
- Create: `apps/desktop/src/components/ReviewItemComposer.css`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/SideBar.tsx`

- [ ] **Step 1: Build a minimal composer**

Fields:

- title
- optional note
- scope summary (prefilled)

- [ ] **Step 2: Add file-level creation entry**

Place a clear `New File Review Item` action in the current file context area.

- [ ] **Step 3: Persist created items**

New items should start in `open` state.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`  
Expected: PASS.

### Task 5: Add range-scope review item creation

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Possibly modify: `apps/desktop/src/components/FileListItem.tsx` or diff action area if needed

- [ ] **Step 1: Choose the MVP source of line-range context**

Use actual Monaco selection on the modified side.

Expected: The scope is explicit and stored on the review item.

- [ ] **Step 2: Add range item creation flow**

If line-range selection exists, the composer should default to `range`.

- [ ] **Step 3: Store range metadata**

Expected: The queue shows `Lines X-Y` for these items.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`  
Expected: PASS.

## Chunk 4: AI Edit Execution From Review Items

### Task 6: Replace prompt-centric fix execution with item-centric execution

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/FixSheet.tsx` or remove from primary path

- [ ] **Step 1: Define a structured Tauri request**

Create a request shape that includes:

- repo
- item id
- file path
- scope type
- start/end lines if present
- title
- note

- [ ] **Step 2: Build AI prompt from the review item**

For file scope:

- include current file diff
- include reviewer title/note

For range scope:

- include bound line range
- include the relevant diff hunk or bounded local context
- include reviewer title/note

- [ ] **Step 3: Keep direct workspace editing**

The AI client should still modify the workspace directly.  
Do not force patch preview in MVP.

- only one item may be running at once
- failures return the item to `open` with `lastError`
- `changedFiles` is overwritten by the latest successful run

- [ ] **Step 4: Return changed file metadata**

Backend response should include:

- changed files after execution
- optional textual summary

- [ ] **Step 5: Re-run Rust checks**

Run: `cargo check -p review_editor_desktop`  
Expected: PASS.

### Task 7: Wire item status transitions around AI execution

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/ReviewItemDetail.tsx`
- Modify: `apps/desktop/src/hooks/useReviewItems.ts`

- [ ] **Step 1: Set status to `ai_editing` before invoke**

Expected: The user sees that the item is actively running.

- [ ] **Step 2: Refresh workspace data after invoke**

Reload:

- file list
- diff content for selected file
- any queue metadata derived from changed files

- [ ] **Step 3: Set status to `needs_review` after success**

Also save returned `changedFiles`.

- [ ] **Step 4: Preserve failure state without losing the item**

If AI execution fails:

- keep the item
- return to `open`
- show the error in the item detail

- [ ] **Step 5: Run frontend build and Rust checks**

Run:

```bash
cd apps/desktop && npm run build
cd /Users/rex/cool.cnb/vibe-review-tool && cargo check -p review_editor_desktop
```

Expected: PASS.

## Chunk 5: Review Closure and Documentation

### Task 8: Resolve flow and visual polish

**Files:**
- Modify: `apps/desktop/src/components/ReviewItemDetail.tsx`
- Modify: `apps/desktop/src/components/ReviewQueue.css`
- Modify: `apps/desktop/src/App.css`

- [ ] **Step 1: Implement `Mark Resolved`**

This should only update item state, not mutate code.

- [ ] **Step 2: Make status visually obvious**

Use distinct visual treatment for:

- `Open`
- `AI Editing`
- `Needs Review`
- `Resolved`

- [ ] **Step 3: Keep layout readable on desktop and smaller widths**

Expected: The new queue does not collapse the diff viewer into unusable space.

- [ ] **Step 4: Run frontend build**

Run: `cd apps/desktop && npm run build`  
Expected: PASS.

### Task 9: Document the MVP workflow

**Files:**
- Modify: `README.md`
- Modify: `apps/desktop/README.md`

- [ ] **Step 1: Add user-facing workflow docs**

Describe:

- creating file review items
- creating range review items
- asking AI to fix
- re-reviewing and resolving

- [ ] **Step 2: Add any MVP limitations**

Document exclusions such as:

- no remote PR sync
- no patch preview
- no threaded conversation

- [ ] **Step 3: Run final verification**

Run:

```bash
cd apps/desktop && npm run build
cd /Users/rex/cool.cnb/vibe-review-tool && cargo check -p review_editor_desktop
```

Expected: PASS.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9

## Verification Notes

When the MVP is ready, validate this end-to-end flow manually:

1. open a repository in the desktop app
2. select a changed file
3. create a file-scope review item
4. create a range-scope review item
5. run `Ask AI To Fix` on one item
6. verify the workspace diff refreshes
7. verify the item transitions to `Needs Review`
8. inspect the changed files
9. mark the item `Resolved`

Plan complete and saved to `docs/superpowers/plans/2026-03-19-review-editor-comment-centric-review-mvp.md`. Ready to execute?
