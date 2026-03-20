# Review Item Detail Decision-First Design

## Goal

Refine the `Review Item` detail pane so it feels like a professional review surface instead of a generic record viewer. The pane should help users make review decisions quickly, especially in the `needs_review` state, while keeping evidence and navigation easy to reach.

## Problem

The current detail pane mixes review decisions, navigation, history, and metadata in one undifferentiated flow:

- `needs_review` items do not foreground the three core review decisions
- the page reads like an audit log before it reads like a review workspace
- `jump to code` competes with status chips and metadata instead of feeling like a quick escape hatch
- low-frequency actions and high-frequency review actions share the same visual tier

This makes the pane feel heavier than the actual work users are trying to do.

## Decision

The detail pane will adopt a decision-first layout:

- all item states use a bottom sticky action bar
- `needs_review` uses the full three-action decision bar:
  - `接受并解决`
  - `继续让 AI 修改`
  - `重新打开`
- `跳到代码` lives in the title area on the right side
- the body prioritizes review intent and review evidence over timeline/audit detail

## Layout

### Header

The header contains:

- back to queue
- status chip
- review item title
- `跳到代码` action aligned to the right

This keeps the fastest navigation path visible without polluting the decision bar.

### Body Order

The detail body is ordered by review value:

Default body order:

1. `Reviewer Note`
2. `AI Summary`
3. `Changed Files`
4. `Timeline`

Error override:

- if `lastError` exists, insert `Last Error` directly below `Reviewer Note`
- do not render an empty `Last Error` section
- `Last Error` does not move into the footer

Rationale:

- `Reviewer Note` explains why the item exists
- `AI Summary` explains what the tool actually changed
- `Changed Files` defines scope and impact
- `Timeline` remains useful but should not dominate first-screen attention

### Sticky Footer

The sticky footer is reserved for state-relevant actions only. It should never become a mixed toolbar.

Rules:

- keep review decisions together
- do not place `跳到代码` in the sticky footer
- do not place `编辑建议` or `删除` in the `needs_review` footer

## State Model

### Open

`open` is a pre-review execution state, so the footer supports starting or adjusting work:

- primary: `让 AI 修改`
- secondary: `编辑建议`
- secondary: `删除`

The body emphasizes `Reviewer Note`. Empty AI/result sections should stay hidden.

Action semantics:

- `让 AI 修改`: keeps the item in its existing open-flow semantics and starts the AI edit request
- `编辑建议`: opens the existing edit composer without changing item state
- `删除`: removes the item using the current delete semantics

### Needs Review

`needs_review` is the core review decision state and the only state that always shows three visible footer actions:

- primary: `接受并解决`
- secondary: `继续让 AI 修改`
- secondary: `重新打开`

The first screen should show enough evidence to decide without scrolling when possible:

- `Reviewer Note`
- `AI Summary`
- `Changed Files`

Action semantics:

- `接受并解决`: changes state from `needs_review` to `resolved`
- `继续让 AI 修改`: starts another AI edit run using current existing semantics for continuing from `needs_review`
- `重新打开`: changes state from `needs_review` to `open`

### Resolved

`resolved` is a historical/recovery state:

- primary: `重新打开`

The body keeps note, summary, changed files, and timeline for reference, but the overall visual emphasis is lower than `needs_review`.

Action semantics:

- `重新打开`: changes state from `resolved` to `open`

### AI Editing / Busy

When an AI action is currently running:

- the sticky bar stays in place to avoid layout jump
- the action that initiated the in-flight request shows loading state, whether it is primary or secondary
- other footer actions are disabled
- the status chip clearly communicates in-progress state
- `返回队列` remains enabled
- `跳到代码` remains enabled
- switching away from the pane is allowed; the detail pane should not trap navigation

## Interaction Rules

### Jump To Code

`跳到代码` is always available in the header for all states. It is a navigation action, not a review decision, so it should remain outside the sticky footer.

### Feedback

Action feedback should stay lightweight:

- success uses the existing toast pattern
- errors surface in two places:
  - inline `Last Error` card near the top when relevant
  - lightweight toast for immediate acknowledgement

No modal success states should interrupt review flow.

### Long Content

The body must reserve enough bottom padding so content is never hidden behind the sticky footer.

### Narrow Widths

When width is limited:

- the three footer actions may wrap
- the primary action should remain visually strongest through size/tone, not through reordering
- touch/click target size must not be reduced for density

## Non-Goals

This change does not:

- redesign the queue itself
- redesign batch run detail
- add new review actions
- change the semantics of item states
- introduce inline diff review inside the detail pane

## Implementation Notes

Expected implementation shape:

- update `ReviewItemDetail.tsx` structure to separate navigation, evidence, and decision zones
- update `reviewItemActions.ts` so state-specific action groups map cleanly to the new footer layout
- adjust `ReviewItemDetail.css` to support:
  - sticky footer
  - evidence-first content grouping
  - header right-side `跳到代码`
  - safe bottom padding
- keep existing callbacks and state semantics where possible

## Testing

Add or update tests for:

- action mapping by item state
- `needs_review` footer action ordering
- `resolved` reduced action set
- busy-state disabling behavior
- `跳到代码` rendered in header, not footer
- section order by state, including conditional hiding of empty sections
- `lastError` promotion directly below `Reviewer Note`
- sticky footer does not cover long content
- wrapped footer layout preserves usable button targets on narrow widths

Manual verification should confirm:

- `needs_review` first screen supports fast decision-making
- `跳到代码` is reachable without competing with footer decisions
- long timeline content does not disappear behind the sticky bar
- mobile/narrow desktop widths keep the footer usable

## Success Criteria

This design is successful if:

- `needs_review` renders all three review decisions in the sticky footer without opening any overflow menu
- `跳到代码` is visible in the header in all item states
- `Reviewer Note`, `AI Summary`, and `Changed Files` appear before `Timeline` for `needs_review`
- empty result sections are hidden for `open`
- `resolved` exposes only `重新打开` in the footer
