# Review Editor AI Summary Provider Design

Date: 2026-03-17  
Project: review-editor  
Scope: first real AI action for `Generate Review Summary` using user-installed CLI agent providers

## 1. Objective

Implement the first non-placeholder AI action in Review Editor by wiring `Generate Review Summary` to real agent provider CLIs installed on the user's machine.

The app should:

- let the user choose a default provider inside the app
- collect current review context
- invoke the selected CLI provider
- show the generated summary inside the desktop UI

## 2. Problem Statement

Current AI actions are product-owned placeholders only.

This is useful for shell shaping, but not enough for real review flow.  
The first AI action should become functional without forcing the app into a single-model architecture.

## 3. Chosen Direction

Use external CLI agent providers as the execution layer.

Initial provider targets:

- `codex`
- `claude`
- `gemini`
- `opencode`

The app does not embed model logic directly.  
Instead, it acts as:

- context assembler
- provider selector
- process runner
- result presenter

## 4. Product Behavior

### 4.1 Supported action in V1

Only one AI action becomes real in this phase:

- `Generate Review Summary`

Other AI actions remain placeholders:

- `Explain Selected Diff`
- `Surface Risks`
- `Suggest Fix`
- `Draft Review Comment`

### 4.2 Provider selection

The user must explicitly choose a default provider in-app.

V1 requirements:

- show provider selector in a user-facing settings surface or lightweight config flow
- persist the selected provider locally
- make the current provider visible enough that summary results are explainable

### 4.3 Provider availability

The app should verify whether the selected CLI is callable on the user's machine.

If unavailable:

- fail clearly
- explain which CLI is missing
- keep the app usable

### 4.4 Summary invocation

When the user triggers `Generate Review Summary`:

1. collect current review context
2. build a provider prompt payload
3. invoke the selected CLI
4. capture stdout/stderr and exit status
5. display the result or failure state

## 5. Context Model

The summary action should operate on the current review context, not on arbitrary global repository state.

### 5.1 Commit review mode

Provide:

- repository path
- selected commit SHA
- selected commit title
- changed files in the commit
- diff content for included files

### 5.2 Workspace review mode

Provide:

- repository path
- workspace mode (`all`, `staged`, `unstaged`)
- changed file list
- diff content for included files

### 5.3 Scope limits

V1 must impose practical size limits so CLI invocation stays reliable.

Suggested approach:

- include file list summary always
- include diff content up to a byte or file-count cap
- if truncated, state clearly in the prompt that context was truncated

## 6. Provider Contract

The desktop app should define one internal provider interface even if implementations differ per CLI.

Each provider implementation should answer:

- executable name to check
- command shape to run
- prompt injection method
- output parsing strategy

V1 assumption:

- free-form natural language output is acceptable
- a strict structured JSON schema is not required yet

## 7. UI Flow

### 7.1 Trigger points

The real summary action should be reachable from:

- `AI -> Generate Review Summary`
- titlebar `AI` entry, if mapped to summary in V1

### 7.2 Result surface

The summary should appear in an app-owned UI surface, not a system dialog.

V1 can use:

- modal
- side panel
- overlay sheet

Requirements:

- show loading state
- show which provider generated the result
- show failure state with actionable message
- allow rerun

### 7.3 Provider settings

V1 can use a simple settings sheet rather than a full settings page.

At minimum:

- choose default provider
- show detected availability

## 8. Technical Direction

### 8.1 Backend ownership

Tauri/Rust should own:

- executable detection
- process spawning
- stdout/stderr capture
- timeout and failure handling

### 8.2 Frontend ownership

React should own:

- provider selection UI
- loading state
- result display
- action trigger wiring

### 8.3 Persistence

The selected provider should be stored locally using the app’s existing local persistence approach.

## 9. Failure Handling

The app must handle:

- provider CLI not installed
- provider executable returns non-zero
- provider times out
- provider returns empty output
- context too large and gets truncated

Failure messaging must be explicit and human-readable.

## 10. Scope Boundary

Included in this phase:

- one real AI action: `Generate Review Summary`
- in-app default provider selection
- provider detection and invocation
- result display

Excluded from this phase:

- multi-provider compare mode
- streaming partial output
- structured JSON response format
- real implementations for other AI actions
- remote hosted provider management

## 11. Definition of Done

This phase is complete when:

- the user can choose a default provider inside the app
- `Generate Review Summary` invokes that provider successfully when installed
- the app shows summary results in-app
- missing CLI or failed execution surfaces a clear error
- other AI actions remain explicit placeholders rather than pretending to work

