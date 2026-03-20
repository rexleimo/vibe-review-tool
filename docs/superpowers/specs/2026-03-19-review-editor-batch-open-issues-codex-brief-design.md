# Review Editor Batch Open-Issue Codex Brief Design

Date: 2026-03-19  
Project: vibe-review-tool  
Scope: add a queue-level workflow that sends all visible `Open` review items as one newspaper-style brief to Codex CLI for a single batch workspace edit

## 1. Objective

Extend the comment-centric review MVP with a batch execution path.

The reviewer should be able to:

- collect multiple `Open` review items in the right-side queue
- send the current queue's `Open` items to Codex CLI with one action
- package those items as a readable newspaper-style brief instead of raw JSON
- let Codex CLI edit the workspace freely to address the brief
- return every sent item to a review-first state for human verification

This feature should reduce repetitive per-item dispatch without turning the product into a generic chat surface.

## 2. Problem Statement

The current workflow is still too manual for clustered review feedback.

Today the reviewer must:

1. create issue A
2. open issue A
3. click `Ask Codex CLI To Fix`
4. wait
5. repeat for issue B, C, and D

This is inefficient when the reviewer already knows a group of comments belongs to one editing pass.

The missing product capability is not better prompt wording.  
It is a queue-level dispatch model that treats a set of review items as one editorial task packet.

## 3. Chosen Direction

Add a queue-level action: `Send Open Issues To Codex CLI`.

This action should:

- collect all currently visible `Open` review items from the right-side queue
- group them by file
- render them into a newspaper-style editing brief
- send that brief to Codex CLI in a single `apply_review_batch` run
- allow Codex CLI to modify any files in the workspace needed to complete the request
- move all sent `Open` items to `Needs Review` if the batch run succeeds

This direction matches the user's preferred workflow:

- batch collection first
- one dispatch action
- direct workspace edits
- human review afterward

## 4. Product Principles

### 4.1 Review items remain the primary review unit

The batch run does not replace review items.

Each item still owns:

- its own title and note
- its own lifecycle
- its own timeline
- its own later human acceptance or reopening

The batch run is only a dispatch container around a group of items.

### 4.2 Batch execution is queue-scoped, not arbitrary multi-select

The MVP should not introduce checkbox selection yet.

The send action always targets:

- all visible `Open` items in the current right-side queue view

This keeps the mental model simple:

- what the reviewer sees in the queue is what gets sent

Selection must be frozen deterministically at click time.

For MVP, `visible queue` means the current `visibleReviewItems` application array after all existing repo/context/file prioritization has been applied.

It does not mean:

- only cards currently on screen
- scroll viewport contents
- DOM nodes that happen to be mounted

The frontend should:

- read the current `visibleReviewItems` array from application state
- filter that snapshot to `status === open`
- preserve that filtered array order as the dispatch order
- freeze exact `issueIds` and issue snapshots before starting any async work

Later queue mutations must not change the active batch payload.

### 4.3 AI edits remain review-mediated

Codex CLI may edit the whole workspace if needed, but the product remains review-first:

- AI does not auto-resolve issues
- all sent issues end in `Needs Review`
- the reviewer still decides whether each issue is resolved

## 5. Interaction Design

### 5.1 Queue footer actions

The right-side queue footer should expose two actions:

- `新建文件问题`
- `发送 Open Issues 到 Codex CLI`

Behavior:

- create action remains available as today
- send action is enabled only when the visible queue contains at least one `Open` item
- button text should include count, for example:
  - `发送 3 条 Open Issues`
  - `没有 Open Issues 可发送` when disabled

### 5.2 Dispatch flow

When the reviewer clicks the batch send action:

1. gather all visible `Open` queue items
2. build the newspaper-style brief
3. create a `batch run` record
4. switch the right pane from queue/detail to the batch run detail view
5. start Codex CLI execution

The product should feel like dispatching an editorial packet, not opening another modal wizard.

The batch run state machine is:

- `queued` after the frozen batch payload is persisted locally
- `running` after the local `queued -> running` persistence succeeds and before the backend invoke starts
- `completed` after provider success and the combined persistence write succeeds
- `failed` on any post-queue failure branch

### 5.3 Batch run detail view

The right pane should support a third state in addition to `queue` and `detail`:

- `batch_run`

This view should show:

- title like `Batch Run · 3 Open Issues`
- current provider
- batch status: `Queued`, `Running`, `Completed`, or `Failed`
- the list of included issue titles
- the generated newspaper-style brief text
- Codex CLI summary output
- changed files
- error message if the run fails

This view is an execution audit surface, not a replacement for later issue-by-issue review.

## 6. Data Model

### 6.1 Existing review item changes

No major schema rewrite is needed for review items.

On successful batch completion, every included `Open` item should be updated with:

- `status = needs_review`
- `lastRunSummary = batch summary string`
- `changedFiles = string[]`
- `lastRunAt = ISO 8601 completion timestamp`
- timeline append:
  - `ai_started`
  - `ai_completed`

On failed batch completion:

- included items remain `Open`
- `ai_started` remains only if the run had already reached `running`
- no `ai_completed` event is appended
- item-level `lastError` should remain unchanged in MVP

This avoids poisoning multiple items with the same operational failure state.

### 6.2 New batch run model

Add a persisted `review batch run` record.

Suggested fields:

- `id`
- `repoPath`
- `contextId`
- `provider`
- `status` (`queued` | `running` | `completed` | `failed`)
- `issueIds`
- `issueCount`
- `issueSnapshots`
- `briefText`
- `summary`
- `changedFiles`
- `lastError`
- `errorCode`
- `retryable`
- `startedAt`
- `completedAt`
- `createdAt`
- `updatedAt`

Responsibilities:

- capture what was dispatched
- capture provider execution outcome
- support the dedicated batch detail surface
- support reliable reload and audit without recomputing from mutated issue state

The batch run should not attempt to mirror all review-item state.  
It only records one execution pass.

`issueSnapshots` should store the exact issue title, note, scope, and file grouping that was dispatched, so the batch detail remains reproducible even if the original issues are later edited.

`changedFiles` should store normalized repo-relative paths, deduplicated while preserving first-returned order.

## 7. Newspaper-Style Brief Format

The brief sent to Codex CLI should be stable, human-readable text.

It should not be raw JSON.

### 7.1 Required structure

The generated brief should contain:

1. `REVIEW DESK` header
2. repo and review mode summary
3. issue count
4. editor instructions
5. file-grouped issue sections
6. deliverable requirements

### 7.2 Editor instructions

The brief must explicitly tell Codex CLI:

- modify the workspace directly
- you may change any related files needed to complete the requested fixes
- stay focused on the listed issues
- avoid unrelated refactors
- return changed files
- return a short summary
- list anything not fully resolved

### 7.3 File-grouped issue layout

Each file section should include:

- file path
- each issue under that file

Each issue entry should include:

- `Issue ID`
- `Title`
- `Scope`
- `Reviewer Note`

Serialization order must be deterministic:

- file sections are ordered by first appearance in the frozen open-issue array
- issues within each file are ordered by their appearance in that same frozen array

Example:

```text
REVIEW DESK
Repo: /path/to/repo
Mode: Workspace Review
Open Issues: 3

EDITOR NOTE
Apply code changes directly in the workspace.
You may modify any related files needed to complete the requested fixes.
Stay focused on the issues below and avoid unrelated refactors.

FILE: backend/src/api/handlers/admin_insight_review_handler.go
- Issue ID: ri_001
  Title: unify publish precheck responses
  Scope: Lines 301-336
  Reviewer Note: error branch shape is inconsistent

- Issue ID: ri_002
  Title: stabilize naming around precheck fields
  Scope: Whole File
  Reviewer Note: simplify naming and remove ambiguity

FILE: .env.example
- Issue ID: ri_003
  Title: verify this ID value
  Scope: Whole File
  Reviewer Note: confirm sample config key matches runtime usage

DELIVERABLE
- Modify the workspace directly
- Return changed files
- Return a short summary
- List any issues you could not fully resolve
```

## 8. Execution Model

### 8.1 Frontend flow

Frontend responsibilities:

- derive visible queue `Open` items from the current `visibleReviewItems` state snapshot
- build prompt preview text
- create and update batch run state
- switch right pane into batch detail view
- on success, update included items in one pass
- disable duplicate dispatch while a batch run is active

The send button should be disabled when either of these is true:

- there is already an active item-level AI edit for the same `repoPath + contextId`
- there is an active batch run with `status = queued` or `status = running` for the same `repoPath + contextId`

`queued` begins immediately on click, before the backend call starts, so rapid double-clicks are blocked in the same window.

Locally synthesized failure overlays with `status = failed` and `errorCode = orphaned_run` are not active runs and must not block re-dispatch in the current app session, even if stale persisted storage still contains the older `queued` or `running` record.

The initial freeze write must be atomic.

Required initial-write rule:

- persist `batchRun(status=queued)`, frozen `issueIds`, frozen `issueSnapshots`, and `briefText` in one successful write before the backend call starts

If that initial write fails:

- do not start backend execution
- do not append any item timeline events
- surface a local persistence error immediately

Required pre-invoke transition rule:

- persist `batchRun(status=running)` and all included `ai_started` item timeline writes in one successful write before invoking the backend

If this `queued -> running` write fails:

- do not start backend execution
- leave the previously persisted `queued` batch as `failed` with `persistence_failed` if that fallback write succeeds
- if the fallback fail-write also fails, immediately reload persisted review state, synthesize a local `failed/orphaned_run` overlay for that `batchRunId`, clear any in-memory active-run flag, and treat that run as non-blocking for all same-session active-run guard calculations
- rely on startup reconciliation to convert the stale persisted `queued` run into `failed` on the next app launch

### 8.2 Tauri backend flow

Add a new command, conceptually:

- `apply_review_batch`

Input must include:

- repo path
- provider (`codex` for MVP)
- current context anchor
- frozen included issue snapshots
- generated newspaper-style prompt text

Normative request schema:

```ts
type ApplyReviewBatchRequest = {
  repo: string;
  provider: "codex";
  contextId: string;
  contextMode: "commit" | "workspace";
  workspaceMode: "all" | "staged" | "unstaged" | null;
  commitSha: string | null;
  batchRunId: string;
  issueIds: string[];
  issueSnapshots: Array<{
    id: string;
    title: string;
    note: string;
    filePath: string;
    scopeType: "file" | "range";
    startLine: number | null;
    endLine: number | null;
  }>;
  briefText: string;
};
```

Success output must include:

- provider label
- summary
- changed files

Normative success schema:

```ts
type ApplyReviewBatchSuccess = {
  ok: true;
  provider: "codex";
  providerLabel: "Codex CLI";
  summary: string;
  changedFiles: string[];
};
```

Normative backend failure schema:

```ts
type ApplyReviewBatchBackendFailure = {
  ok: false;
  errorCode:
    | "empty_selection"
    | "invalid_payload"
    | "provider_unavailable"
    | "batch_already_running"
    | "brief_too_large"
    | "provider_context_limit"
    | "provider_execution_failed";
  message: string;
  retryable: boolean;
  providerStderr?: string;
};
```

Payload invariants:

- `issueIds.length === issueSnapshots.length`
- `issueIds[i] === issueSnapshots[i].id` for every index
- invariant violations fail with `invalid_payload`

Local lifecycle failure codes are separate from backend return codes:

- `persistence_failed`
- `orphaned_run`

These are produced by the desktop app's own persistence/reconciliation layer, not by `apply_review_batch`.

Normative local lifecycle failure shape:

```ts
type ApplyReviewBatchLocalFailure = {
  ok: false;
  source: "local";
  batchRunId: string;
  errorCode: "persistence_failed" | "orphaned_run";
  message: string;
  retryable: boolean;
};
```

The backend should call the existing provider execution path, but with one combined prompt instead of one issue payload.

The backend should also enforce one active workspace-edit run per `repoPath + contextId`.

This guard prevents duplicate dispatches from:

- rapid double-clicks
- multiple desktop windows
- stale frontend state

The guard must reject both of these overlaps:

- batch run vs. another batch run
- batch run vs. a single-item `AI Editing` run

The same `24_000` UTF-8 byte brief limit should be enforced in both frontend and backend.

Counting rule:

- `briefText` is valid when `utf8ByteLength <= 24_000`
- `briefText` fails with `brief_too_large` when `utf8ByteLength > 24_000`
- frontend must count with `TextEncoder().encode(briefText).length`
- backend must count with the Rust UTF-8 byte length of the exact received string

### 8.3 Provider scope

The user selected full workspace freedom for this batch flow.

Therefore the prompt should allow Codex CLI to:

- modify any files needed in the workspace

The product should not impose file/line write restrictions in MVP.

## 9. Status and Error Handling

### 9.1 Successful batch run

If Codex CLI returns success:

- batch run becomes `completed`
- every included `Open` item becomes `needs_review`
- every included item receives the shared changed files and summary
- queue refreshes against workspace mode
- right pane remains on batch detail until the reviewer exits

Persistence ownership must be explicit.

For MVP, batch runs and review items should be persisted through one shared review-state write path so the success transition is saved atomically.

Required success-write rule:

- do not mark the batch run `completed` unless the included issue updates and the batch-run update are written in the same successful persistence operation

If provider execution succeeds but the persistence write fails:

- treat the batch run as `failed`
- use a dedicated failure code such as `persistence_failed`
- keep included issues at their pre-run persisted state
- if the failure-state write succeeds, the current session should show that persisted failed state
- if the failure-state write also fails, immediately reload persisted review state, synthesize a local `failed/orphaned_run` overlay for that `batchRunId`, and treat that run as non-blocking for all same-session active-run guard calculations
- startup reconciliation must later rewrite the stale persisted `running` batch run to `failed` with `orphaned_run`

### 9.2 Failed batch run

If execution fails before a successful response:

- batch run becomes `failed`
- included issues stay `Open`
- batch detail shows the error
- item timelines keep their already-written `ai_started` event only if the run had already reached `running`
- no `ai_completed` event is appended

This keeps failure semantics clear and reversible.

On app startup, stale-run reconciliation must scan persisted batch runs.

Rule:

- any batch run still in `queued` or `running` from a previous app session is rewritten to `failed` with `errorCode = orphaned_run`

This prevents stale persisted runs from blocking future dispatch forever.

### 9.3 Partial success

The MVP should not attempt per-issue success detection.

If the batch execution returns successfully, all sent `Open` issues move to `Needs Review`.

Rationale:

- the workflow already expects a human review pass afterward
- fine-grained issue resolution inference is fragile
- trying to infer per-issue completion would add complexity without improving first-pass usability

## 10. Timeline Behavior

Included review items should still maintain individual audit history.

At dispatch start, after the local `queued -> running` persistence succeeds and before the backend invoke begins:

- append `ai_started`
  - summary example: `Codex CLI batch run started`
  - attach `batchRunId` in the event payload if timeline metadata is later extended

The `queued -> running` transition and the `ai_started` writes must be saved in the same successful persistence operation.

Failure timing rules:

- if failure happens before `running` is persisted, no item timeline events are appended
- if failure happens after `running` was persisted, `ai_started` remains as the evidence of accepted dispatch

On successful batch completion:

- append `ai_completed`
  - summary example: `Codex CLI batch run updated 5 files`

The dedicated batch run object is the detailed audit record.  
The per-item timeline should stay high-value and short.

Failure details belong on the batch run object, not on every item timeline entry.

## 11. MVP Boundaries

This version intentionally does not include:

- manual checkbox multi-select
- prompt editing before send
- partial per-issue success classification
- user-managed multiple concurrent batch runs
- non-Codex batch orchestration differences
- automatic batch splitting for long issue sets
- merging `Needs Review` items back into a new batch run

These are valid future directions but should not block the first professional batch workflow.

Oversized briefs are still handled explicitly:

- if the locally generated brief exceeds `24_000` UTF-8 bytes, fail fast with `brief_too_large`
- if Codex CLI rejects the prompt due to context/token limits, fail with `provider_context_limit`
- in both cases, do not auto-split; instruct the reviewer to reduce the open queue and retry

## 12. Why This Design Fits Review Editor

This feature makes the product feel closer to a real review desk:

- reviewers accumulate issues first
- they dispatch one editorial brief
- AI executes against that brief
- humans return for structured review

It avoids the two extremes:

- one issue per click, which is too tedious
- free-form AI chat, which loses review discipline

The result is a pragmatic middle path: structured review intent with efficient agentic execution.
