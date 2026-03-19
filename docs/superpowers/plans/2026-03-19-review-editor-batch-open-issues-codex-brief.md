# Review Editor Batch Open-Issue Codex Brief Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a queue-level workflow that sends all visible `Open` review items to Codex CLI as one newspaper-style brief, persists a dedicated batch run audit record, and returns the items to `Needs Review` after a successful workspace edit.

**Architecture:** Keep review items as the primary unit, but introduce a separate persisted `review batch run` domain plus a shared review-state store so item and batch-run transitions can be written atomically. Implement the frontend flow as pure TypeScript helpers plus a dedicated right-pane `batch_run` detail surface, and refactor the Tauri backend so both single-item and batch commands share the same active-run guard keyed by `repoPath + contextId`.

**Tech Stack:** Tauri 2, React 19, TypeScript, `@tauri-apps/plugin-store`, Node `node:test`, Rust unit tests

---

## File Map

- Create: `apps/desktop/src/lib/reviewBatchRuns.ts`
  - Own batch-run types, frozen issue snapshots, newspaper-brief builder, UTF-8 byte counting, local-failure overlays, scoped blocking helpers, and pure transition planners that `App.tsx` can execute atomically.
- Create: `apps/desktop/src/lib/reviewState.ts`
  - Own the persisted review-state schema (`items + batchRuns`) and migration from legacy `review.items` storage.
- Create: `apps/desktop/src/hooks/useReviewState.ts`
  - Load, replace, and mutate the shared review state through one atomic persistence path.
- Create: `apps/desktop/src/components/ReviewBatchRunDetail.tsx`
  - Render the new right-pane audit view for batch status, included issues, brief text, summary, changed files, and failures.
- Create: `apps/desktop/src/components/ReviewBatchRunDetail.css`
  - Style the batch detail surface without disturbing the existing item-detail layout.
- Modify: `apps/desktop/src/lib/reviewItems.ts`
  - Keep review-item-specific helpers focused on item state and history; add batch-safe history/status patch builders where item semantics differ from single-item AI editing.
- Modify: `apps/desktop/src/lib/reviewPane.ts`
  - Extend pane mode resolution and queue footer action modeling to support `batch_run` and the new send CTA.
- Modify: `apps/desktop/src/App.tsx`
  - Replace hook usage with shared review state, freeze visible open items, drive the queued/running/completed/failed lifecycle, and keep the right pane on the active batch run.
- Modify: `apps/desktop/src/components/ReviewQueue.tsx`
  - Add the queue-level `发送 Open Issues 到 Codex CLI` CTA and batch status affordances.
- Modify: `apps/desktop/src/components/ReviewQueue.css`
  - Fit the second footer action and keep the footer pinned and stable.
- Modify: `apps/desktop/src-tauri/src/lib.rs`
  - Add `apply_review_batch`, shared active-run locking, prompt building, payload validation, changed-file normalization, and Rust tests.
- Modify: `apps/desktop/tests/reviewItems.test.mjs`
  - Extend the existing pure-domain test suite to cover batch-run selection, brief formatting, byte limits, migration, and pane-state helpers.
- Delete: `apps/desktop/src/hooks/useReviewItems.ts`
  - Remove the superseded item-only hook after `App.tsx` fully migrates to `useReviewState.ts`.

## Chunk 1: Shared Review State And Batch Domain

### Task 1: Define batch-run types, deterministic brief building, and local failure helpers

**Files:**
- Create: `apps/desktop/src/lib/reviewBatchRuns.ts`
- Create: `apps/desktop/src/lib/reviewState.ts`
- Modify: `apps/desktop/src/lib/reviewItems.ts`
- Test: `apps/desktop/tests/reviewItems.test.mjs`

- [ ] **Step 1: Write the failing domain tests first**

Add test cases for the new pure helpers before adding implementation:

```js
test("buildReviewBatchBrief groups visible open issues by first file appearance", () => {
  const result = buildReviewBatchBrief({
    repoPath: "/tmp/repo",
    contextMode: "workspace",
    issueSnapshots: [
      { id: "ri_2", filePath: "b.ts", title: "Second file", note: "", scopeType: "file", startLine: null, endLine: null },
      { id: "ri_1", filePath: "a.ts", title: "First file", note: "", scopeType: "range", startLine: 4, endLine: 8 },
      { id: "ri_3", filePath: "b.ts", title: "Back to second file", note: "", scopeType: "file", startLine: null, endLine: null },
    ],
  });

  assert.match(result.briefText, /FILE: b\.ts[\s\S]*Issue ID: ri_2[\s\S]*Issue ID: ri_3/);
  assert.match(result.briefText, /FILE: a\.ts/);
});

test("buildReviewBatchBrief includes the required REVIEW DESK contract blocks", () => {
  const result = buildReviewBatchBrief({
    repoPath: "/tmp/repo",
    contextMode: "commit",
    commitSha: "abc123",
    issueSnapshots: [
      { id: "ri_1", filePath: "a.ts", title: "First file", note: "Guard empty state", scopeType: "file", startLine: null, endLine: null },
    ],
  });

  assert.match(result.briefText, /^REVIEW DESK/m);
  assert.match(result.briefText, /Mode: Commit Review/m);
  assert.match(result.briefText, /EDITOR NOTE/m);
  assert.match(result.briefText, /DELIVERABLE/m);
});

test("countReviewBatchBriefBytes rejects payloads above 24000 bytes", () => {
  assert.equal(isReviewBatchBriefTooLarge("a".repeat(24000)), false);
  assert.equal(isReviewBatchBriefTooLarge("中".repeat(8001)), true);
});

test("resolveBatchRunBlockingState lets same-session orphan overlays unblock dispatch", () => {
  const result = resolveBatchRunBlockingState({
    repoPath: "/tmp/repo",
    contextId: "/tmp/repo::workspace::all",
    items: [],
    batchRuns: [
      { id: "batch-1", repoPath: "/tmp/repo", contextId: "/tmp/repo::workspace::all", status: "queued" },
    ],
    localFailures: [
      buildLocalOrphanedRunOverlay({
        batchRunId: "batch-1",
        repoPath: "/tmp/repo",
        contextId: "/tmp/repo::workspace::all",
      }),
    ],
  });

  assert.equal(result.blocked, false);
});

test("buildBatchStartedItemPatch appends history without switching item status to ai_editing", () => {
  const patch = buildBatchStartedItemPatch(openItem, { providerLabel: "Codex CLI", at: now });
  assert.equal(patch.status, "open");
  assert.equal(patch.history.at(-1)?.type, "ai_started");
  assert.equal(patch.lastError, openItem.lastError);
  assert.equal(patch.lastRunSummary, openItem.lastRunSummary);
});

test("normalizeStoredReviewState migrates legacy review.items into versioned state", () => {
  const result = normalizeStoredReviewState(null, [openItem]);
  assert.equal(result.version, 2);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.batchRuns, []);
});
```

Run: `cd apps/desktop && npm run test:review-items`
Expected: FAIL with missing exports for the new batch helpers.

- [ ] **Step 2: Implement the batch-run domain module**

Create the batch-run types and helper signatures in `reviewBatchRuns.ts`:

```ts
export type ReviewBatchRunStatus = "queued" | "running" | "completed" | "failed";

export interface ReviewBatchIssueSnapshot {
  id: string;
  title: string;
  note: string;
  filePath: string;
  scopeType: "file" | "range";
  startLine: number | null;
  endLine: number | null;
}

export interface ReviewBatchRun {
  id: string;
  repoPath: string;
  contextId: string;
  provider: "codex";
  status: ReviewBatchRunStatus;
  issueIds: string[];
  issueCount: number;
  issueSnapshots: ReviewBatchIssueSnapshot[];
  briefText: string;
  summary: string;
  changedFiles: string[];
  lastError: string;
  errorCode: ReviewBatchRunErrorCode;
  retryable: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyReviewBatchLocalFailure {
  ok: false;
  source: "local";
  batchRunId: string;
  errorCode: "persistence_failed" | "orphaned_run";
  message: string;
  retryable: boolean;
}

export type ReviewBatchRunErrorCode =
  | ""
  | "empty_selection"
  | "invalid_payload"
  | "provider_unavailable"
  | "batch_already_running"
  | "brief_too_large"
  | "provider_context_limit"
  | "provider_execution_failed"
  | "persistence_failed"
  | "orphaned_run";
```

Implement:

- `buildReviewBatchIssueSnapshots(items)`
- `buildReviewBatchBrief({ repoPath, contextMode, workspaceMode, commitSha, issueSnapshots })`
- `countReviewBatchBriefBytes(briefText)`
- `isReviewBatchBriefTooLarge(briefText)`
- `createQueuedBatchRun(...)`
- `buildRunningBatchRunPatch(...)`
- `buildCompletedBatchRunPatch(...)`
- `buildFailedBatchRunPatch(...)`
- `buildLocalOrphanedRunOverlay(...)`
- `resolveBatchRunBlockingState(...)`
- `planQueuedBatchWrite(...)`
- `planRunningBatchWrite(...)`
- `planCompletedBatchWrite(...)`
- `planFailedBatchWrite(...)`

Keep file grouping deterministic by first appearance in the frozen issue snapshot array.

- [ ] **Step 3: Add batch-safe review-item patch builders**

Extend `reviewItems.ts` with helpers that preserve item semantics during batch runs instead of reusing the single-item `ai_editing` patch:

```ts
export function buildBatchStartedItemPatch(item: ReviewItem, options: { providerLabel: string; at: string }): Partial<ReviewItem> {
  return {
    status: "open",
    history: appendHistoryEntry(item, "ai_started", options.at, `${options.providerLabel} batch run started`),
    updatedAt: options.at,
  };
}

export function buildBatchCompletedItemPatch(item: ReviewItem, options: { providerLabel: string; changedFiles: string[]; summary: string; at: string }): Partial<ReviewItem> {
  return {
    status: "needs_review",
    changedFiles: options.changedFiles,
    lastRunSummary: options.summary,
    lastRunAt: options.at,
    history: appendHistoryEntry(item, "ai_completed", options.at, `${options.providerLabel} updated ${formatFileCount(options.changedFiles.length)}`),
    updatedAt: options.at,
  };
}
```

Do not mutate `lastError` on batch failure; failed batch items stay `open` and only retain `ai_started` if the batch had reached `running`.

- [ ] **Step 4: Make shared review-state persistence versioned and migratable**

Create `reviewState.ts` with one persisted object instead of writing items in isolation:

```ts
export interface PersistedReviewState {
  version: 2;
  items: ReviewItem[];
  batchRuns: ReviewBatchRun[];
}

export function normalizeStoredReviewState(rawState: unknown, legacyItems: unknown): PersistedReviewState {
  if (isPersistedReviewState(rawState)) return { ...rawState, batchRuns: normalizeStoredBatchRuns(rawState.batchRuns) };
  return {
    version: 2,
    items: normalizeStoredReviewItems(legacyItems as ReviewItem[]),
    batchRuns: [],
  };
}
```

This migration keeps existing local review items intact the first time the new code opens `review-editor.dat`.

- [ ] **Step 5: Re-run the domain tests**

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS with the new batch-run test cases covering deterministic order, byte counting, migration, and batch-specific item history semantics.

## Chunk 2: Queue Footer And Batch Detail Surface

### Task 2: Extend pane-state helpers and queue footer actions

**Files:**
- Modify: `apps/desktop/src/lib/reviewPane.ts`
- Modify: `apps/desktop/src/components/ReviewQueue.tsx`
- Modify: `apps/desktop/src/components/ReviewQueue.css`
- Test: `apps/desktop/tests/reviewItems.test.mjs`

- [ ] **Step 1: Add failing pane-state tests**

Cover the new right-pane mode and CTA rules in the existing Node test file:

```js
test("resolveReviewPaneMode prefers batch_run when a batch run is selected", () => {
  assert.equal(resolveReviewPaneMode({ selectedItemId: null, selectedBatchRunId: "batch-1" }), "batch_run");
});

test("resolveQueueFooterActions shows send label and disabled copy from visible open count", () => {
  assert.deepEqual(resolveQueueFooterActions({ visibleOpenCount: 3, createDisabled: false, batchBlocked: false }), {
    create: { label: "新建文件问题", disabled: false },
    sendOpen: { label: "发送 3 条 Open Issues", disabled: false },
  });
});

test("resolveQueueFooterActions uses disabled copy when there are no open issues", () => {
  assert.deepEqual(resolveQueueFooterActions({ visibleOpenCount: 0, createDisabled: false, batchBlocked: false }), {
    create: { label: "新建文件问题", disabled: false },
    sendOpen: { label: "没有 Open Issues 可发送", disabled: true },
  });
});

test("resolveQueueFooterActions uses blocking copy when the current context already has an active AI run", () => {
  assert.deepEqual(resolveQueueFooterActions({ visibleOpenCount: 2, createDisabled: false, batchBlocked: true }), {
    create: { label: "新建文件问题", disabled: false },
    sendOpen: { label: "当前上下文已有 AI 任务执行中", disabled: true },
  });
});
```

Run: `cd apps/desktop && npm run test:review-items`
Expected: FAIL because `batch_run` and queue-footer action helpers do not exist yet.

- [ ] **Step 2: Implement pure pane-state helpers**

Refactor `reviewPane.ts` so `App.tsx` can stay declarative:

```ts
export type ReviewPaneMode = "queue" | "detail" | "batch_run";

export interface ReviewPaneStateInput {
  selectedItemId: string | null;
  selectedBatchRunId: string | null;
  selectedFilePath: string | null;
  hasSelectedRange: boolean;
}

export function resolveQueueFooterActions(input: {
  visibleOpenCount: number;
  createDisabled: boolean;
  batchBlocked: boolean;
}): {
  create: { label: string; disabled: boolean };
  sendOpen: { label: string; disabled: boolean };
} { /* ... */ }
```

Keep `resolveReviewPaneMode` deterministic: `batch_run` wins over `detail`, `detail` wins over `queue`.
Keep disabled-state labels deterministic:

- `visibleOpenCount === 0` -> `没有 Open Issues 可发送`
- `visibleOpenCount > 0 && batchBlocked === true` -> `当前上下文已有 AI 任务执行中`
- otherwise -> `发送 {count} 条 Open Issues`

- [ ] **Step 3: Update the queue component to render both footer actions**

Extend `ReviewQueue.tsx` props and footer layout:

```tsx
interface ReviewQueueProps {
  items: ReviewItem[];
  selectedFilePath: string | null;
  onSelectItem: (id: string) => void;
  onCreateItem: () => void;
  onSendOpenItems: () => void;
  createActionLabel: string;
  createActionDisabled: boolean;
  sendOpenItemsLabel: string;
  sendOpenItemsDisabled: boolean;
}
```

Render the footer as two stable buttons, with the send CTA visually primary only when it is enabled and count-bearing.

- [ ] **Step 4: Adjust queue CSS so the dual-footer layout stays pinned and balanced**

Update `ReviewQueue.css` to support:

- a two-button footer row
- consistent widths on mobile and desktop
- no yellow warning-style button treatment
- no layout jump when the send label changes from disabled copy to `发送 {count} 条 Open Issues`

- [ ] **Step 5: Re-run the footer-action tests**

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS.

### Task 3: Build the dedicated batch-run detail view

**Files:**
- Create: `apps/desktop/src/components/ReviewBatchRunDetail.tsx`
- Create: `apps/desktop/src/components/ReviewBatchRunDetail.css`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Add the new detail component shell**

Start with a focused props contract:

```tsx
interface ReviewBatchRunDetailProps {
  batchRun: ReviewBatchRun | null;
  onBack: () => void;
  onJumpToIssue: (issueId: string) => void;
}
```

Render these sections in order:

- batch title + provider + status
- included issue list
- brief text
- summary
- changed files
- last error

Render included issues from `batchRun.issueSnapshots` in stored dispatch order. Do not recompute sorting from live review items.

- [ ] **Step 2: Style the batch detail as an audit surface, not a modal clone**

The CSS should emphasize readable text blocks and status visibility:

- monospaced brief block with wrapping
- compact issue list with file/scope labels
- changed-file pill list matching current review-item styling
- clear failed-state treatment without shifting the layout

- [ ] **Step 3: Mount the component behind the new `batch_run` mode**

In `App.tsx`, branch the right-pane render tree so:

- `queue` shows `ReviewQueue`
- `detail` shows `ReviewItemDetail`
- `batch_run` shows `ReviewBatchRunDetail`

Do not remove existing item detail behavior.

- [ ] **Step 4: Verify pane routing and required sections**

Before launching the app, seed one deterministic `previewBatchRun` fixture in `App.tsx` behind a temporary local constant so the new route can be exercised even before Chunk 3 persistence wiring lands. Remove the temporary fixture before closing the task.

Run: `cd apps/desktop && npm run build`
Expected: PASS.

Run: `cd apps/desktop && npm run tauri dev`
Expected: Selecting a stubbed or real batch run routes the right pane to `batch_run` and shows status, provider, ordered issue titles, brief text, summary, changed files, and error state without layout breakage.

## Chunk 3: Shared Hook And Frontend Batch Lifecycle

### Task 4: Replace item-only persistence with a shared review-state hook

**Files:**
- Create: `apps/desktop/src/hooks/useReviewState.ts`
- Delete: `apps/desktop/src/hooks/useReviewItems.ts`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Build the new hook around one persisted state object**

Implement the hook against `review-editor.dat` using a single key such as `review.state`:

```ts
export function useReviewState() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [batchRuns, setBatchRuns] = useState<ReviewBatchRun[]>([]);
  const [loading, setLoading] = useState(true);

  async function replaceState(nextState: PersistedReviewState): Promise<void> { /* set state + save once */ }
  async function updateItems(mutator: (items: ReviewItem[]) => ReviewItem[]): Promise<void> { /* ... */ }
  async function updateBatchRuns(mutator: (batchRuns: ReviewBatchRun[]) => ReviewBatchRun[]): Promise<void> { /* ... */ }
  async function replaceReviewState(mutator: (state: PersistedReviewState) => PersistedReviewState): Promise<void> { /* ... */ }
}
```

Every multi-entity transition in later tasks must flow through `replaceReviewState` so item and batch-run updates share one persistence write.

During initial load, reconcile stale persisted batch runs before exposing state to `App.tsx`:

```ts
const normalized = normalizeStoredReviewState(rawState, legacyItems);
const reconciled = reconcileStaleBatchRuns(normalized, now);
if (reconciled.changed) {
  await persistReviewState(reconciled.state);
}
```

Any persisted `queued` or `running` batch run from a previous app session must be rewritten to `failed/orphaned_run`.

- [ ] **Step 2: Migrate `App.tsx` to the new hook without changing user-visible behavior yet**

Swap the import and destructuring so existing review-item flows keep working before batch wiring lands:

```ts
const {
  items: reviewItems,
  batchRuns,
  loading: reviewStateLoading,
  createReviewItem,
  updateReviewItem,
  deleteReviewItem,
  replaceReviewState,
  reload,
} = useReviewState();
```

Keep all existing single-item create/edit/delete behavior intact after the hook migration.

- [ ] **Step 3: Remove the superseded hook file**

Delete `useReviewItems.ts` only after the app builds successfully with `useReviewState.ts` as the sole source of truth.

- [ ] **Step 4: Verify migration safety**

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS.

Run: `cd apps/desktop && npm run build`
Expected: PASS.

### Task 5: Wire the batch-send lifecycle in `App.tsx`

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/lib/reviewBatchRuns.ts`
- Modify: `apps/desktop/src/lib/reviewPane.ts`

- [ ] **Step 1: Add batch selection and scoped active-run derivation**

Introduce local state and derived values in `App.tsx`:

```ts
const [selectedBatchRunId, setSelectedBatchRunId] = useState<string | null>(null);
const selectedBatchRun = useMemo(
  () => resolveSelectedBatchRun(batchRuns, selectedBatchRunId),
  [batchRuns, selectedBatchRunId],
);
const visibleOpenItems = useMemo(
  () => visibleReviewItems.filter((item) => item.status === "open"),
  [visibleReviewItems],
);
const batchGuard = useMemo(
  () => resolveBatchRunBlockingState({ repoPath: repo, contextId: currentReviewContextId, items: reviewItems, batchRuns }),
  [repo, currentReviewContextId, reviewItems, batchRuns],
);
```

Make `batchGuard` honor same-session `failed/orphaned_run` overlays as non-blocking.

- [ ] **Step 2: Implement the initial queued write and fail-fast guard path**

Write one handler, `handleSendOpenIssuesToCodex`, with explicit phases:

```ts
async function handleSendOpenIssuesToCodex(): Promise<void> {
  const frozenItems = visibleReviewItems.filter((item) => item.status === "open");
  const issueSnapshots = buildReviewBatchIssueSnapshots(frozenItems);
  const { briefText, byteLength } = buildReviewBatchBrief({ /* current context */ });
  if (byteLength > 24_000) { /* local fail fast */ }

  // 1. persist queued batch + frozen payload atomically
  // 2. immediately set selectedBatchRunId and switch the pane to batch_run
  // 3. if queued persistence fails: do not invoke backend and do not append timeline events
}
```

Use `replaceReviewState` for each persistence boundary so the spec’s atomicity rules remain enforceable in one place.

- [ ] **Step 3: Implement the running, success, and backend-failure branches**

Continue the same handler with explicit persistence boundaries:

- persist `running` batch state plus `ai_started` item history atomically
- invoke `apply_review_batch` with `provider: "codex"` regardless of the currently selected single-item provider
- let backend/provider availability failures come back through the normal `ok: false` failure path after the queued + running transitions
- on `ok: true`, atomically persist the completed batch plus all included item `needs_review` updates
- on `ok: false`, atomically persist the failed batch while leaving included items `open`

Frontend invoke typing for this chunk belongs in `App.tsx`; do not defer it to the backend chunk.

- [ ] **Step 4: Implement same-session persistence-failure fallback behavior**

When queued->running or completed persistence fails and the follow-up fail-write also fails:

- reload persisted state
- synthesize a local `failed/orphaned_run` overlay for the affected `batchRunId`
- clear any in-memory active-run flag
- keep that overlay visible in the batch detail view
- exclude the overlay from same-session active-run blocking

Do not append `ai_started` if the batch never reached the persisted `running` phase.

- [ ] **Step 5: Keep the right pane anchored on batch detail and refresh the workspace on success**

On success:

- set `selectedBatchRunId`
- keep `reviewPaneMode` on `batch_run`
- refresh the workspace context (or switch commit review to workspace review, matching the existing single-item post-edit behavior)
- set included items to `needs_review`

On failure:

- leave included items `open`
- keep the batch detail visible with its error state

- [ ] **Step 6: Re-run lifecycle-focused tests and frontend build**

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS, including queued-write fail-fast behavior, `ai_started` timing, stale-run reconciliation, and same-session orphan overlay unblocking.

Run: `cd apps/desktop && npm run build`
Expected: PASS.

## Chunk 4: Backend Batch Command And Shared Run Guard

### Task 6: Add a shared active-run guard for single-item and batch edits

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Test: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add failing Rust tests for scope locking and payload validation helpers**

Add unit tests near the existing `#[cfg(test)]` module:

```rust
#[test]
fn review_run_scope_key_normalizes_repo_and_context() {
    assert_eq!(review_run_scope_key("/tmp/repo/", "/tmp/repo::workspace::all"), "/tmp/repo::/tmp/repo::workspace::all");
}

#[test]
fn active_review_run_guard_rejects_batch_vs_batch_contention() {
    let first = ActiveReviewRunGuard::acquire(review_run_scope_key("/tmp/repo", "/tmp/repo::workspace::all")).unwrap();
    let second = ActiveReviewRunGuard::acquire(review_run_scope_key("/tmp/repo", "/tmp/repo::workspace::all"));
    assert!(second.is_err());
    drop(first);
}

#[test]
fn active_review_run_guard_rejects_batch_vs_item_contention() {
    let item_guard = ActiveReviewRunGuard::acquire(review_run_scope_key("/tmp/repo", "/tmp/repo::workspace::all")).unwrap();
    let second = ActiveReviewRunGuard::acquire(review_run_scope_key("/tmp/repo", "/tmp/repo::workspace::all"));
    assert!(matches!(second, Err(ReviewRunLockError::AlreadyRunning)));
    drop(item_guard);
}

#[test]
fn validate_batch_payload_rejects_mismatched_issue_ids() {
    let err = validate_review_batch_payload(&ApplyReviewBatchRequest { /* mismatched ids */ }).unwrap_err();
    assert_eq!(err.error_code, "invalid_payload");
}

#[test]
fn validate_batch_payload_rejects_empty_selection() {
    let err = validate_review_batch_payload(&ApplyReviewBatchRequest { /* empty ids and snapshots */ }).unwrap_err();
    assert_eq!(err.error_code, "empty_selection");
}
```

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: FAIL because the lock and validation helpers do not exist yet.

- [ ] **Step 2: Introduce one shared guard path for AI workspace edits**

Implement a small guard type used by both `apply_review_item` and `apply_review_batch`:

```rust
fn review_run_scope_key(repo: &str, context_id: &str) -> String { /* normalize repo + join context */ }

enum ReviewRunLockError {
    AlreadyRunning,
}

struct ActiveReviewRunGuard {
    key: String,
}

impl ActiveReviewRunGuard {
    fn acquire(key: String) -> Result<Self, ReviewRunLockError> { /* reject overlaps */ }
}
```

Map `ReviewRunLockError` separately in each command:

- `apply_review_item` keeps its current string-based error contract
- `apply_review_batch` maps the lock failure to structured `batch_already_running`

Refactor `apply_review_item` so it acquires the same `repoPath + contextId` lock before calling `run_provider_edit`, then releases it automatically on drop.

- [ ] **Step 3: Keep single-item behavior unchanged after the refactor**

Do not change the existing `apply_review_item` payload or frontend contract beyond the shared locking behavior. The goal is parity, not a second protocol migration.

- [ ] **Step 4: Re-run Rust tests**

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: PASS with the new guard and validation coverage.

### Task 7: Implement `apply_review_batch`, prompt rendering, and changed-file normalization

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Test: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add failing Rust tests for size limits, prompt preservation, and changed-file normalization**

Add tests before the command implementation:

```rust
#[test]
fn validate_review_batch_brief_size_rejects_oversized_prompts() {
    let err = validate_review_batch_brief_size(&"a".repeat(24_001)).unwrap_err();
    assert_eq!(err.error_code, "brief_too_large");
}

#[test]
fn build_review_batch_prompt_preserves_brief_text() {
    let prompt = build_review_batch_prompt("REVIEW DESK\nFILE: src/app.tsx");
    assert!(prompt.contains("REVIEW DESK"));
    assert!(prompt.contains("FILE: src/app.tsx"));
}

#[test]
fn normalize_changed_files_dedupes_repo_relative_paths_in_order() {
    let normalized = normalize_changed_files(Path::new("/tmp/repo"), vec![
        "/tmp/repo/src/app.tsx".into(),
        "src/app.tsx".into(),
        "/tmp/repo/src/lib.rs".into(),
    ]);
    assert_eq!(normalized, vec!["src/app.tsx", "src/lib.rs"]);
}

#[test]
fn classify_provider_failure_maps_unavailable_and_context_limit_errors() {
    assert_eq!(
        classify_provider_failure("codex command not found", "codex command not found").error_code,
        "provider_unavailable"
    );
    assert_eq!(
        classify_provider_failure("context window exceeded", "context window exceeded").error_code,
        "provider_context_limit"
    );
}
```

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: FAIL because the new validation and normalization helpers do not exist yet.

- [ ] **Step 2: Add the batch request/response types and structured backend failures**

Define the transport contract in Rust so the frontend can branch on `ok` without losing error detail through Tauri stringification:

```rust
#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum BatchAiProvider {
    Codex,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyReviewBatchRequest {
    repo: String,
    provider: BatchAiProvider,
    context_id: String,
    context_mode: String,
    workspace_mode: Option<WorkspaceMode>,
    commit_sha: Option<String>,
    batch_run_id: String,
    issue_ids: Vec<String>,
    issue_snapshots: Vec<ReviewBatchIssueSnapshot>,
    brief_text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyReviewBatchCommandResponse {
    ok: bool,
    provider: Option<AiProvider>,
    provider_label: Option<String>,
    summary: Option<String>,
    changed_files: Option<Vec<String>>,
    error_code: Option<String>,
    message: Option<String>,
    retryable: Option<bool>,
    provider_stderr: Option<String>,
}
```

Use `Err(String)` only for unexpected transport/runtime crashes; use the structured `ok: false` response for expected backend failures.

- [ ] **Step 3: Implement prompt validation and newspaper-brief execution**

Add helper functions for:

- `validate_review_batch_payload(&req)`
- `validate_review_batch_brief_size(&req.brief_text)`
- `build_review_batch_prompt(brief_text: &str)`
- `normalize_changed_files(repo: &Path, changed_files: Vec<String>)`
- `classify_provider_failure(message: &str, stderr: &str)`

`build_review_batch_prompt` should preserve the already-built `brief_text` and only prepend provider-execution framing if needed; do not rebuild file ordering in Rust.
`classify_provider_failure` must map failures deterministically:

- missing/unlaunchable Codex CLI -> `provider_unavailable`
- provider context/token limit rejection -> `provider_context_limit`
- any other non-success provider execution -> `provider_execution_failed`

Always populate `provider_stderr` from the captured provider error text when returning these failures.

- [ ] **Step 4: Implement the new command and wire it into Tauri**

Add `apply_review_batch` alongside `apply_review_item`:

```rust
#[tauri::command]
async fn apply_review_batch(req: ApplyReviewBatchRequest) -> Result<ApplyReviewBatchCommandResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(err) = validate_review_batch_payload(&req) {
            return Ok(failure_response(err));
        }
        if let Err(err) = validate_review_batch_brief_size(&req.brief_text) {
            return Ok(failure_response(err));
        }
        let repo = normalize_repo(&req.repo);
        ensure_git_repo(&repo)?;
        let _guard = match ActiveReviewRunGuard::acquire(review_run_scope_key(&req.repo, &req.context_id)) {
            Ok(guard) => guard,
            Err(err) => return Ok(failure_response(map_lock_error_for_batch(err))),
        };
        let prompt = build_review_batch_prompt(&req.brief_text);
        let before_snapshot = snapshot_workspace_state(&repo)?;
        let summary = match run_provider_edit(AiProvider::Codex, &repo, &prompt) {
            Ok(summary) => summary,
            Err(message) => return Ok(failure_response(classify_provider_failure(&message, &message))),
        };
        let after_snapshot = snapshot_workspace_state(&repo)?;
        Ok(success_response(summary, normalize_changed_files(&repo, diff_workspace_snapshots(&before_snapshot, &after_snapshot))))
    })
    .await
    .map_err(|err| format!("failed to apply review batch in background: {err}"))?
}
```

Register the command in `invoke_handler!` and keep the transport shape aligned with the frontend typing added in Chunk 3.

- [ ] **Step 5: Verify Rust, frontend, and manual smoke behavior**

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: PASS.

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS.

Run: `cd apps/desktop && npm run build`
Expected: PASS.

Run: `cd apps/desktop && npm run tauri dev`
Expected: The app starts, the queue footer shows the new batch CTA, clicking it with multiple `Open` items opens the batch detail surface, and Codex CLI receives one batch brief instead of per-item prompts.
