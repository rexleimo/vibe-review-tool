# Review Editor Arc Titlebar Design

Date: 2026-03-16  
Project: review-editor  
Scope: integrated desktop titlebar redesign for the macOS Review Editor app

## 1. Objective

Redesign the top window area so Review Editor feels like a deliberate macOS review cockpit instead of a webview with a second header underneath the system titlebar.

This phase defines:

- integrated titlebar direction
- information hierarchy for the top area
- component layout and interaction boundaries
- implementation scope for the first shippable version

This phase does not implement new AI backend functionality.

## 2. Problem Statement

The current top experience feels visually split:

- native macOS titlebar sits above the app UI as a separate shell
- the app renders its own `TopBar` inside the content area
- the two layers do not share hierarchy, spacing, or purpose

The result is:

- the window looks generic
- the top area feels thin and unfinished
- the most important review context is not visually centered

## 3. Product Direction

The titlebar should feel like an Arc-inspired desktop surface, but with a quieter, more premium tone.

Desired characteristics:

- integrated rather than stacked
- calm rather than flashy
- review-context-first rather than repository-path-first

The top area should answer one question immediately:

> What am I reviewing right now?

## 4. Chosen Direction

Reference style:

- Arc-inspired integration
- simple and premium
- no loud brand shell

Chosen context hierarchy:

- emphasize current file path or current commit title
- de-emphasize raw repository path
- keep mode visible, but not as the dominant headline

Chosen layout direction:

- two-level central context block
- current review object owns the main visual center

## 5. Titlebar Architecture

The titlebar is divided into three zones.

### 5.1 Left Zone

Contents:

- macOS traffic lights
- light product mark
- project switcher entry

Purpose:

- preserve macOS window legitimacy
- make project identity available without dominating the layout

Behavior:

- project switcher is accessible from here
- project identity should be readable at a glance but treated as secondary information

### 5.2 Center Zone

This is the primary information block and the visual center of gravity.

Two-level structure:

- top line: review mode plus commit context
- bottom line: current file path

Examples:

- `Commit Review · orchestrate live ui shell`
- `apps/desktop/src/App.tsx`

Or in workspace mode:

- `Workspace Review · unstaged changes`
- `crates/review_engine/src/lib.rs`

Rules:

- top line is smaller and lower contrast
- bottom line is the main headline
- file path truncation must preserve useful path identity
- commit title should collapse gracefully when file context is unavailable

### 5.3 Right Zone

Contents:

- mode switch
- single AI primary entry
- at most one secondary action

Purpose:

- keep action density low
- support quick operation without turning the titlebar into a toolbar wall

Rules:

- do not mirror every menu action into the titlebar
- only highest-value actions belong here
- the AI entry should feel important, but not bright or noisy

## 6. Visual Principles

### 6.1 One integrated surface

The native titlebar and app header should visually merge into one surface.

This implies:

- no visible “double header” seam
- top area spacing is designed as one system
- background, border, and drag region cooperate rather than stack

### 6.2 Quiet premium tone

The titlebar should not look playful or marketing-heavy.

Avoid:

- loud gradients
- oversized badges
- too many pill buttons
- decorative chrome without functional value

Prefer:

- restrained contrast
- strong typography hierarchy
- subtle separators
- careful truncation behavior

### 6.3 Review object first

The user is here to inspect a file or commit, not to admire repository metadata.

Therefore:

- current file path or commit title is the dominant line
- repository path becomes supporting information or moves out of center

## 7. Interaction Design

### 7.1 Project switching

Project switching remains accessible from the left area.

V1 behavior:

- clicking the project switcher opens the existing project center / switcher flow

### 7.2 Mode switching

Mode switching remains directly accessible in the titlebar.

V1 behavior:

- switch between `Commit Review` and `Workspace Review`
- maintain current visual pill or a simplified variant if needed for the integrated titlebar

### 7.3 AI entry

The titlebar includes one primary AI trigger.

V1 behavior:

- this may open the same placeholder surface already introduced in the menu-system phase
- the label should be concise and product-like, not verbose

### 7.4 Context fallback behavior

When a file is selected:

- show current file path as the main line
- show review mode and commit/workspace context above it

When no file is selected but a commit is selected:

- show commit title as the main line
- show review mode above it

When no project is open:

- the titlebar should collapse into a lighter welcome-shell treatment or defer to welcome screen layout

## 8. Technical Direction

Expected implementation shape:

- adjust Tauri window configuration to support integrated macOS titlebar treatment
- move the top visual surface toward a draggable custom titlebar region
- refactor the current React `TopBar` into an integrated titlebar component
- ensure traffic light placement and drag behavior remain native-feeling on macOS

State ownership:

- React owns displayed review context and titlebar rendering
- Tauri owns window-level configuration required for custom titlebar integration

## 9. Scope Boundary

Included in this phase:

- integrated titlebar layout
- central two-line review context
- left project identity / switcher entry
- right-side mode and AI entry
- removal of the current double-header feel

Excluded from this phase:

- menu redesign beyond current completed menu work
- AI backend implementation
- large-scale redesign of sidebar or diff panel
- full command palette

## 10. Risks and Mitigations

### 10.1 Risk: custom titlebar feels fake or fragile

Mitigation:

- preserve native traffic lights
- keep window controls and drag regions simple
- avoid over-customizing macOS conventions

### 10.2 Risk: center block becomes visually busy

Mitigation:

- enforce two-line limit
- keep upper line low contrast
- truncate aggressively and consistently

### 10.3 Risk: titlebar becomes a toolbar dump

Mitigation:

- hard-limit right-side actions
- move secondary actions to menus, not the titlebar

## 11. Definition of Done

This design is satisfied when:

- the app no longer reads as “system titlebar + separate app topbar”
- the central title area clearly communicates current review context
- current file path or current commit title becomes the dominant headline
- project identity remains available but secondary
- the titlebar feels integrated, calm, and premium
- the right side remains action-light and intentional

