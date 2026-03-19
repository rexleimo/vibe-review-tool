# Review Editor Menu System Design

Date: 2026-03-16  
Project: review-editor  
Scope: macOS desktop menu system for the AI-native review workbench

## 1. Objective

Replace the current near-default macOS app menu experience with a product-shaped menu system that feels like an AI review tool, not a generic editor shell.

This phase defines:

- top-level menu architecture
- first-version menu item set
- action mapping to current app behavior
- explicit placeholders for future AI actions

This phase does not redesign the window chrome or title bar integration.

## 2. Problem Statement

Current menu behavior is effectively default platform behavior:

- the visible `File` menu only exposes a window close action
- menu structure does not reflect the product's review workflow
- the app feels unfinished because the desktop shell does not match the product UI

The result is a mismatch:

- the app body communicates "review workbench"
- the system menu communicates "unconfigured wrapper"

## 3. Product Direction

Review Editor should present itself as an AI-native review cabinet:

- project context is a first-class concept
- review flow is a first-class concept
- AI actions are first-class concepts, not hidden utilities

The menu system should therefore be product-led rather than editor-led.

However, the app still runs as a macOS desktop application, so it must retain enough native structure to feel legitimate and predictable.

## 4. Design Principles

### 4.1 Product-first naming

Use menu names that reflect the actual review workflow:

- `Project`
- `Review`
- `AI`

Do not force the app into a generic `File / Edit / Go` mental model as the main information architecture.

### 4.2 Native enough to feel stable

Preserve standard macOS app behavior where users expect it:

- application menu
- `Window`
- `Help`

This keeps the product opinionated without making it feel improvised.

### 4.3 Real actions before full AI implementation

For V1:

- `Project` and `Review` actions should map to real working behavior
- `AI` actions may initially route to a placeholder sheet, modal, or notice when backend behavior is not yet wired

This is acceptable because the menu system itself is a product contract and navigational skeleton, not only a backend reflection.

### 4.4 Avoid half-IDE ambiguity

Do not ship a menu that looks like an editor but behaves like a narrow review app.  
That would create the wrong expectation set and make the product feel incomplete.

## 5. Top-Level Menu Architecture

Recommended V1 menu bar:

- `Review Editor`
- `Project`
- `Review`
- `AI`
- `View`
- `Window`
- `Help`

This is primarily Option A from exploration, with a small amount of Option B desktop standardization.

Explicitly excluded from V1 as top-level menus:

- `File`
- `Edit`
- `Go`

Reason:

- `File` would imply a document-oriented application
- `Edit` is low-value in the current app surface
- `Go` is better expressed through review-oriented navigation naming

## 6. Menu Definitions

### 6.1 `Review Editor`

Purpose:
- standard macOS application menu

Items:
- `About Review Editor`
- `Settings...`
- `Hide Review Editor`
- `Hide Others`
- `Show All`
- `Quit Review Editor`

Notes:
- This should behave like a normal app menu on macOS.
- `Settings...` should become the future home for product-level configuration, even if the first version is a placeholder.

### 6.2 `Project`

Purpose:
- manage repository context and project selection

Items:
- `Open Project...`
- `Open Recent`
- `Switch Project...`
- `Refresh Project Context`
- `Close Project`

Behavior:
- `Open Project...` launches the existing directory chooser flow
- `Open Recent` lists saved projects from current persisted project storage
- `Switch Project...` opens the same project center / switcher surface already present in the UI
- `Refresh Project Context` reloads repository metadata, commit graph, and changed-file state for the active project
- `Close Project` returns the app to the welcome screen without quitting the application

### 6.3 `Review`

Purpose:
- control the current review mode and review navigation

Items:
- `Review Current Commit`
- `Review Workspace Changes`
- `Refresh Review`
- `Next File`
- `Previous File`

Behavior:
- `Review Current Commit` switches to commit review mode and focuses the current commit context
- `Review Workspace Changes` switches to workspace review mode
- `Refresh Review` reloads the currently active review surface
- `Next File` selects the next reviewable file in the current list
- `Previous File` selects the previous reviewable file in the current list

Notes:
- If no project is open, these actions should be disabled.
- File navigation actions should reflect current selection state and disable at list edges where appropriate.

### 6.4 `AI`

Purpose:
- surface AI-native review assistance as a primary product capability

Items:
- `Generate Review Summary`
- `Explain Selected Diff`
- `Surface Risks`
- `Suggest Fix`
- `Draft Review Comment`

Behavior contract:
- These actions operate on the current review context
- Context may be:
  - current commit
  - workspace changes
  - current file
  - current selection in diff view

V1 implementation boundary:
- If AI backend behavior is not ready, actions may open a product-owned placeholder surface that clearly states:
  - what the action will do
  - what context it would use
  - whether the action is not yet available

This is preferable to omitting the menu because it establishes the product shape.

### 6.5 `View`

Purpose:
- control layout and screen focus

Items:
- `Toggle Sidebar`
- `Focus Diff`
- `Reset Layout`
- `Enter Full Screen`

Behavior:
- `Toggle Sidebar` shows or hides the left review/navigation pane
- `Focus Diff` moves attention to the diff editor area
- `Reset Layout` restores default sidebar visibility and width
- `Enter Full Screen` uses native macOS full-screen behavior

### 6.6 `Window`

Purpose:
- preserve standard macOS window management

Items:
- `Minimize`
- `Zoom`
- `Bring All to Front`

Notes:
- Use standard platform roles where possible rather than inventing custom behavior.

### 6.7 `Help`

Purpose:
- provide orientation and product help

Items:
- `Welcome`
- `Keyboard Shortcuts`
- `About Review Editor`

Notes:
- `Welcome` should return the user to an orientation surface or onboarding entry point
- `Keyboard Shortcuts` may be placeholder content in V1 if the shortcut map is still evolving

## 7. Interaction Rules

### 7.1 Enabled and disabled states

Menu items must reflect app state:

- if no project is active, `Project` actions that require an active repo should disable appropriately
- if no file is selected, file-specific `AI` actions should disable or degrade gracefully
- if no next or previous file exists, navigation actions should disable

### 7.2 Label clarity

Use explicit verbs. Avoid vague labels such as:

- `Run`
- `Analyze`
- `Do AI`

The user should know what each action intends to produce.

### 7.3 No duplicate conceptual entry points

Avoid naming collisions between menus and top-bar controls.

For example:

- top bar may still expose project switch and review mode controls
- menu entries should mirror those actions rather than introduce alternate terminology

## 8. Technical Direction

Expected implementation shape in Tauri:

- define a real application menu in the Rust/Tauri layer
- assign native menu roles where appropriate for macOS behavior
- emit application events or invoke shared commands for product actions
- have the React app subscribe to those action events and translate them into existing UI behavior

Preferred event boundary:

- Rust owns native menu declaration
- React owns product state transitions and UI execution

This keeps menu structure native while preserving UI logic in the frontend.

## 9. Implementation Scope Boundary

Included in this menu-system phase:

- new top-level menu structure
- V1 menu item definitions
- event wiring for real `Project`, `Review`, and `View` actions
- placeholders for not-yet-implemented AI actions

Excluded from this phase:

- title bar redesign
- full keyboard shortcut system
- AI backend implementation
- major top-bar redesign beyond terminology alignment

## 10. Risks and Mitigations

### 10.1 Risk: menu feels aspirational rather than functional

Mitigation:
- ensure `Project`, `Review`, and `View` mostly work end-to-end in V1
- make AI placeholders explicit and product-owned rather than dead clicks

### 10.2 Risk: product language becomes too custom

Mitigation:
- keep names concrete and workflow-based
- preserve standard `Window` and app menu behavior

### 10.3 Risk: app still feels visually split after menu improvements

Mitigation:
- treat menu system as a shell-level fix only
- defer title-bar integration to a separate follow-up design

## 11. Definition of Done

This design is satisfied when:

- the app no longer shows the near-empty default menu experience
- the top-level menu structure matches the approved product architecture
- core `Project`, `Review`, and `View` actions are wired and usable
- `AI` appears as a first-class top-level menu
- AI entries either work or fail with clear owned placeholder behavior
- the app feels like a deliberate macOS product shell rather than a wrapped webview

