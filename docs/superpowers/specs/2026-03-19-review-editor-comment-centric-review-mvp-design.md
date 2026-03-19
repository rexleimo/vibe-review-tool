# Review Editor Comment-Centric Review MVP Design

Date: 2026-03-19  
Project: review-editor  
Scope: first review-centric workflow that lets the reviewer create issue items from diffs and let an AI client edit the workspace against those items

## 1. Objective

Reframe Review Editor from a collection of independent AI buttons into a review workbench centered on explicit review items.

The MVP should let the reviewer:

- inspect commits or workspace diffs
- create a `review item` against either a specific line range or an entire file
- send that review item to an AI client to modify the workspace directly
- return to a review state where the reviewer checks the resulting code changes

The system should stay review-first.  
AI is an execution tool attached to a review item, not a separate free-form chat surface.

## 2. Problem Statement

Current AI behavior is action-centric:

- `Generate Review Summary` is a global summary action
- `Suggest Fix` is a single-file prompt box
- `Draft Review Comment` and `Surface Risks` are placeholders

This creates three problems:

1. reviewer intent is not captured as a first-class product object
2. AI actions are disconnected from code-review state
3. after AI edits happen, the product has no structured way to return the user to review

The result is a tool that can call AI, but does not yet feel like a professional review environment.

## 3. Chosen Direction

Adopt a comment-centric review model with explicit review items.

Core workflow:

1. reviewer inspects a diff
2. reviewer creates a `review item`
3. reviewer asks AI to fix that item
4. AI edits the workspace
5. the item moves into a `Needs Review` state
6. reviewer verifies the resulting changes and either resolves or keeps iterating

This direction intentionally prioritizes review structure over generic AI conversation.

## 4. Primary Product Model

### 4.1 Review item as the core unit

Each AI-assisted edit must originate from a `review item`.

The product should not expose "send arbitrary prompt to Codex" as the core workflow in this phase.  
Instead, all direct workspace edits should be tied to:

- a concrete issue statement
- a concrete review context
- a traceable item lifecycle

### 4.2 Two scope types

The MVP supports two review item scopes:

- `range`
- `file`

`range` item:

- created from selected diff lines
- used for precise comments like "this branch ignores nil handling"

`file` item:

- created from the current file without a selected range
- used for broader concerns like "this handler should be simplified"

The UI should prefer `range` items when a line-range selection exists, but both types are valid first-class inputs.

## 5. Review Item Data Model

The MVP data model should stay intentionally small.

Suggested fields:

- `id`
- `repo_path`
- `context_id`
- `context_mode`
- `commit_sha`
- `workspace_mode`
- `scope_type` (`range` | `file`)
- `file_path`
- `start_line` (`null` for file scope)
- `end_line` (`null` for file scope)
- `title`
- `note`
- `status`
- `changed_files`
- `last_error`
- `last_run_summary`
- `last_run_at`
- `created_at`
- `updated_at`

`context_id` anchors the item to the repo plus its current review context.  
For commit review this is `repo + commit sha`; for workspace review this is `repo + workspace mode`.

`changed_files` records what the latest successful AI run touched.  
It is cleared when a new AI run starts and refreshed on success.

## 6. Status Model

The MVP should use four states only:

- `Open`
- `AI Editing`
- `Needs Review`
- `Resolved`

Behavior:

- new items start as `Open`
- when the user runs AI edit, the item becomes `AI Editing`
- after the command returns and files refresh, the item becomes `Needs Review`
- the reviewer manually marks it `Resolved` only after inspecting the result

The key principle is that AI never auto-resolves a review item.

## 7. UI Architecture

### 7.1 Three-pane workspace

The workspace should be conceptually organized as:

- left: files / commits / navigation
- center: diff viewer
- right: review queue

The current left and center structure can remain largely intact for the MVP.  
The main new surface is the right-side `Review Queue`.

### 7.2 Review Queue

The `Review Queue` should list review items relevant to the current context.

V1 recommendation:

- if a file is selected, prioritize showing items for that file
- otherwise prioritize items for the current commit or current workspace session
- still allow browsing other items from the same repo so the queue does not disappear when context switches

Each queue row should show:

- title
- scope label (`Lines 42-58` or `Whole File`)
- status

Selecting a row opens an item detail panel.

### 7.3 Review item detail

The detail surface should show:

- item title
- item note
- bound file and line range
- current status
- changed files from the latest AI run

Actions:

- `Ask AI To Fix`
- `Mark Resolved`
- `Delete`

This is enough for MVP without introducing threaded conversation yet.

### 7.4 Item creation entry points

Two entry paths should exist:

1. `range` item creation from diff selection
2. `file` item creation from the current file header or file action area

The creation flow should stay lightweight:

- title
- optional note
- scope prefilled from current context

For MVP, `range` items are created from the real Monaco diff selection on the modified side.  
Manual line entry is not the primary interaction.

## 8. AI Execution Model

### 8.1 Direct workspace editing

The MVP should allow AI to modify workspace code directly.

This matches the user's preferred workflow and keeps the tool competitive with agentic editors.  
However, those edits must remain review-mediated:

- edits always originate from a review item
- edits always return to a `Needs Review` state
- only one review item may be in `AI Editing` at a time

### 8.2 Context sent to AI

For `range` items, send:

- repo path
- file path
- selected line range
- relevant diff hunk or bounded local diff context
- reviewer title/note

For `file` items, send:

- repo path
- file path
- current file diff
- reviewer title/note

The AI may edit additional files if necessary, but the product must surface that explicitly afterward.

### 8.3 Return path after edit

After AI completes:

- reload workspace or commit file state
- refresh the visible diff
- store changed file list on the review item
- mark the item `Needs Review`

If the item started from commit review, move it into workspace review after success so the reviewer can inspect the real workspace diff that AI just changed.

This closes the loop back into reviewer control.

## 9. Why This Is Better Than the Current Fix Sheet

The current `Suggest Fix` sheet is prompt-centric:

- it starts from free-form text
- it is tied to a single file rather than a structured review issue
- it does not create review history

The proposed MVP is review-centric:

- AI work is attached to explicit issues
- review state survives after edits
- the reviewer can track what changed because of each item

The old prompt-centric `Suggest Fix` entry should no longer be the primary editing workflow.  
That menu entry may remain, but it should open review-item creation instead of sending arbitrary free-form fix prompts directly.

This is the minimum shape that starts to feel like a professional review workflow rather than a utility panel.

## 10. Scope Boundary

Included in MVP:

- local review item creation
- `range` and `file` scopes
- right-side review queue
- direct AI edit from a review item
- status transitions back into review

Excluded from MVP:

- remote PR/GitHub comment sync
- patch preview / patch merge UI
- multi-turn threaded conversation per item
- bulk auto-generated review items
- provider orchestration across multiple AI clients
- automatic resolution heuristics

## 11. Success Criteria

The MVP succeeds if a reviewer can:

1. open a repository and inspect diffs
2. create a review item on a specific code range or whole file
3. ask AI to apply a fix directly to the workspace
4. immediately see that the item now requires review
5. inspect the resulting diff and mark the item resolved manually

If those five steps feel coherent, the product has successfully crossed from "AI buttons in a review UI" to "an AI-assisted review workbench."
