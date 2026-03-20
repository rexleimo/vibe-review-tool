# Review Item Detail Decision-First Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `Review Item` detail pane into a decision-first review surface with state-specific sticky footer actions, header-level `跳到代码`, evidence-first content ordering, and stable busy/error feedback.

**Architecture:** Keep render logic thin by moving footer-action modeling and body-section ordering into pure TypeScript helpers that are easy to TDD in the existing `node:test` suite. Then wire those helpers into `ReviewItemDetail.tsx`, add the minimum `App.tsx` state needed to preserve sticky-footer behavior during in-flight AI actions, and finish with CSS/manual verification for sticky layout and narrow-width behavior.

**Tech Stack:** Tauri 2, React 19, TypeScript, Node `node:test`, existing desktop CSS modules

---

## File Map

- Create: `apps/desktop/src/lib/reviewItemDetailLayout.ts`
  - Own pure section-order resolution, section visibility rules, sticky-footer modeling, and busy-action mapping so JSX stays declarative.
- Modify: `apps/desktop/src/lib/reviewItemActions.ts`
  - Reduce it to action-label/tone primitives or merge its remaining responsibilities into the new layout helper.
- Modify: `apps/desktop/src/components/ReviewItemDetail.tsx`
  - Rebuild the pane structure around the new header/body/footer model without changing existing callback contracts more than necessary.
- Modify: `apps/desktop/src/components/ReviewItemDetail.css`
  - Add sticky footer, header `跳到代码` placement, evidence-first spacing, error-card prominence, and safe bottom padding.
- Modify: `apps/desktop/src/App.tsx`
  - Pass the extra detail-pane state needed for in-flight AI actions so the footer can keep its state-specific layout while one action shows loading.
- Modify: `apps/desktop/tests/reviewItems.test.mjs`
  - Add failing tests first for layout/section/footer helpers and update existing action tests to match the new decision-first contract.

## Chunk 1: Pure Detail-State Contract

### Task 1: Define a pure layout model for footer actions, section order, and busy overlays

**Files:**
- Create: `apps/desktop/src/lib/reviewItemDetailLayout.ts`
- Modify: `apps/desktop/src/lib/reviewItemActions.ts`
- Test: `apps/desktop/tests/reviewItems.test.mjs`

- [ ] **Step 1: Write the failing tests first**

Extend `apps/desktop/tests/reviewItems.test.mjs` before adding any implementation. Cover:

```js
test("resolveReviewItemDetailFooter keeps three visible decisions for needs_review", () => {
  assert.deepEqual(
    resolveReviewItemDetailFooter({
      status: "needs_review",
      providerLabel: "Codex CLI",
      busy: false,
      busyAction: null,
    }),
    {
      primary: { action: "resolve", label: "接受并解决", disabled: false },
      secondary: [
        { action: "ask_ai", label: "继续让 Codex CLI 修改", disabled: false },
        { action: "reopen", label: "重新打开", disabled: false },
      ],
    },
  );
});

test("resolveReviewItemDetailFooter returns open actions for open items", () => {
  assert.deepEqual(
    resolveReviewItemDetailFooter({
      status: "open",
      busyBaseStatus: null,
      providerLabel: "Codex CLI",
      busy: false,
      busyAction: null,
    }),
    {
      primary: { action: "ask_ai", label: "让 Codex CLI 修改", disabled: false },
      secondary: [
        { action: "edit", label: "编辑建议", disabled: false },
        { action: "delete", label: "删除", disabled: false, tone: "danger" },
      ],
    },
  );
});

test("resolveReviewItemDetailFooter reduces resolved items to reopen only", () => {
  assert.deepEqual(
    resolveReviewItemDetailFooter({
      status: "resolved",
      busyBaseStatus: null,
      providerLabel: "Codex CLI",
      busy: false,
      busyAction: null,
    }),
    {
      primary: { action: "reopen", label: "重新打开", disabled: false },
      secondary: [],
    },
  );
});

test("resolveReviewItemDetailFooter keeps needs_review layout while ask_ai is busy", () => {
  const footer = resolveReviewItemDetailFooter({
    status: "needs_review",
    providerLabel: "Codex CLI",
    busy: true,
    busyAction: "ask_ai",
  });

  assert.equal(footer.primary.label, "接受并解决");
  assert.equal(footer.primary.disabled, true);
  assert.equal(footer.secondary[0].loading, true);
  assert.equal(footer.secondary[1].disabled, true);
});

test("resolveReviewItemDetailFooter keeps open layout while primary ask_ai is busy", () => {
  const footer = resolveReviewItemDetailFooter({
    status: "ai_editing",
    busyBaseStatus: "open",
    providerLabel: "Codex CLI",
    busy: true,
    busyAction: "ask_ai",
  });

  assert.equal(footer.primary.label, "让 Codex CLI 修改");
  assert.equal(footer.primary.loading, true);
  assert.equal(footer.secondary[0].label, "编辑建议");
  assert.equal(footer.secondary[0].disabled, true);
  assert.equal(footer.secondary[1].label, "删除");
  assert.equal(footer.secondary[1].disabled, true);
});

test("resolveReviewItemDetailSections promotes lastError directly below reviewer note", () => {
  assert.deepEqual(
    resolveReviewItemDetailSections({
      status: "needs_review",
      hasReviewerNote: true,
      hasAiSummary: true,
      hasChangedFiles: true,
      hasTimeline: true,
      hasLastError: true,
    }),
    ["reviewer_note", "last_error", "ai_summary", "changed_files", "timeline"],
  );
});

test("resolveReviewItemDetailSections hides empty AI/result blocks for open items", () => {
  assert.deepEqual(
    resolveReviewItemDetailSections({
      status: "open",
      hasReviewerNote: true,
      hasAiSummary: false,
      hasChangedFiles: false,
      hasTimeline: true,
      hasLastError: false,
    }),
    ["reviewer_note", "timeline"],
  );
});
```

Run: `cd apps/desktop && npm run test:review-items`
Expected: FAIL with missing exports for the new detail-layout helpers and/or outdated action expectations.

- [ ] **Step 2: Implement the pure footer/section helpers**

Create `apps/desktop/src/lib/reviewItemDetailLayout.ts` with focused helpers:

```ts
import type { ReviewItemStatus } from "./reviewItems.js";
import type { ReviewItemDetailActionKind, ReviewItemDetailAction } from "./reviewItemActions.js";

export type ReviewItemDetailSectionKey =
  | "reviewer_note"
  | "last_error"
  | "ai_summary"
  | "changed_files"
  | "timeline";

export interface ResolveReviewItemDetailFooterInput {
  status: ReviewItemStatus;
  busyBaseStatus?: "open" | "needs_review" | null;
  providerLabel: string;
  busy: boolean;
  busyAction: ReviewItemDetailActionKind | null;
}

export interface ReviewItemDetailFooterAction extends ReviewItemDetailAction {
  loading?: boolean;
}

export function resolveReviewItemDetailFooter(input: ResolveReviewItemDetailFooterInput): {
  primary: ReviewItemDetailFooterAction;
  secondary: ReviewItemDetailFooterAction[];
} { /* deterministic mapping */ }

export function resolveReviewItemDetailSections(input: {
  status: ReviewItemStatus;
  hasReviewerNote: boolean;
  hasAiSummary: boolean;
  hasChangedFiles: boolean;
  hasTimeline: boolean;
  hasLastError: boolean;
}): ReviewItemDetailSectionKey[] { /* deterministic ordering */ }
```

Rules to encode:

- `needs_review` keeps all three visible footer actions
- `resolved` only exposes `重新打开`
- `open` exposes `让 AI 修改 / 编辑建议 / 删除`
- if `status === "ai_editing"`, resolve the footer from `busyBaseStatus`; never fall back to a one-button generic busy layout
- if `status === "ai_editing"` and `busyBaseStatus === null`, throw a deterministic error such as `missing busyBaseStatus for ai_editing detail footer` so the bug is caught during development/testing
- when `busy === true`, the action matching `busyAction` gets `loading: true`
- when `busy === true`, every footer action is disabled
- `last_error` is inserted immediately after `reviewer_note` when present
- empty `ai_summary` and `changed_files` blocks stay hidden for `open`

- [ ] **Step 3: Refactor or narrow `reviewItemActions.ts` so responsibilities do not overlap**

Make `reviewItemDetailLayout.ts` the single owner of the footer label/order/loading contract.

Keep `reviewItemActions.ts` only if it still provides shared exported action types used by multiple modules. If it does not add real reuse after the refactor, remove the old footer-resolution logic from it entirely.

Acceptance criterion:

- after this step, there is exactly one function in the codebase responsible for mapping review-item state into detail-footer actions
- no stale tests remain pointed at the old footer-resolution API

- [ ] **Step 4: Update the existing pure tests to the new contract**

Adjust any old tests that still expect:

- `needs_review` to be primarily modeled as `accept + continue + reopen` without busy-action loading metadata
- `ai_editing` to collapse into a one-button footer model

Keep the test file centered on pure helpers only. Do not add DOM tests in this step.

- [ ] **Step 5: Re-run the pure test suite**

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS with the new detail-layout contract covered by deterministic unit tests.

- [ ] **Step 6: Commit the pure-contract chunk**

```bash
git add apps/desktop/src/lib/reviewItemDetailLayout.ts apps/desktop/src/lib/reviewItemActions.ts apps/desktop/tests/reviewItems.test.mjs
git commit -m "refactor(desktop): define review item detail layout contract"
```

## Chunk 2: Component Structure, App Wiring, And Sticky Layout

### Task 2: Rebuild the detail component around the decision-first layout

**Files:**
- Modify: `apps/desktop/src/lib/reviewItemDetailLayout.ts`
- Modify: `apps/desktop/src/components/ReviewItemDetail.tsx`
- Modify: `apps/desktop/src/components/ReviewItemDetail.css`
- Modify: `apps/desktop/src/App.tsx`
- Test: `apps/desktop/tests/reviewItems.test.mjs`

- [ ] **Step 1: Write the failing busy-overlay tests first**

Before changing `App.tsx`, add tests for a pure helper that derives the selected detail pane's busy props from local overlay state:

```js
test("resolveSelectedReviewItemBusyState returns ask_ai overlay for the selected item", () => {
  assert.deepEqual(
    resolveSelectedReviewItemBusyState({
      selectedItemId: "ri_1",
      overlay: {
        itemId: "ri_1",
        action: "ask_ai",
        baseStatus: "needs_review",
      },
    }),
    {
      busyAction: "ask_ai",
      busyBaseStatus: "needs_review",
    },
  );
});

test("resolveSelectedReviewItemBusyState ignores overlays for other items", () => {
  assert.deepEqual(
    resolveSelectedReviewItemBusyState({
      selectedItemId: "ri_2",
      overlay: {
        itemId: "ri_1",
        action: "ask_ai",
        baseStatus: "open",
      },
    }),
    {
      busyAction: null,
      busyBaseStatus: null,
    },
  );
});
```

Run: `cd apps/desktop && npm run test:review-items`
Expected: FAIL with missing helper export and/or outdated expectations.

- [ ] **Step 2: Add the minimal App-level busy-action overlay**

`ReviewItemDetail.tsx` cannot infer which footer action started an in-flight AI request from `item.status === "ai_editing"` alone. Add the smallest explicit overlay in `App.tsx`:

```ts
const [reviewItemBusyAction, setReviewItemBusyAction] = useState<{
  itemId: string;
  action: "ask_ai";
  baseStatus: "open" | "needs_review";
} | null>(null);
```

Implement a pure helper in `apps/desktop/src/lib/reviewItemDetailLayout.ts` so `App.tsx` only passes derived props:

```ts
export function resolveSelectedReviewItemBusyState(input: {
  selectedItemId: string | null;
  overlay: {
    itemId: string;
    action: "ask_ai";
    baseStatus: "open" | "needs_review";
  } | null;
}): {
  busyAction: ReviewItemDetailActionKind | null;
  busyBaseStatus: "open" | "needs_review" | null;
} { /* deterministic selection */ }
```

Rules:

- set it immediately before invoking `handleAskAiToFix(item)`
- clear it on success and failure paths
- only keep one overlay at a time, since the current app already blocks concurrent AI edits in-context

- [ ] **Step 3: Re-run the pure test suite for the busy-overlay helper**

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS with the new busy-overlay helper covered before JSX/App wiring starts.

- [ ] **Step 4: Thread the new footer-state props into `ReviewItemDetail`**

Extend the props contract just enough:

```tsx
interface ReviewItemDetailProps {
  item: ReviewItem | null;
  provider: AiProvider;
  aiBusy: boolean;
  busyAction: ReviewItemDetailActionKind | null;
  busyBaseStatus: "open" | "needs_review" | null;
  onBack: () => void;
  onAskAiToFix: (item: ReviewItem) => void;
  // existing callbacks unchanged
}
```

At the call site in `App.tsx`:

- derive `busyAction` and `busyBaseStatus` through `resolveSelectedReviewItemBusyState(...)`
- pass the derived values so the footer can stay in its pre-busy layout

- [ ] **Step 5: Rebuild the component body around the pure layout helpers**

Update `ReviewItemDetail.tsx` so it:

- keeps `返回队列`, status chip, title, and header-right `跳到代码`
- derives footer actions from `resolveReviewItemDetailFooter(...)`
- derives body order from `resolveReviewItemDetailSections(...)`
- renders sections in the resolved order instead of hardcoding the current note/error/summary/files/timeline sequence

Use a render map pattern to keep JSX readable:

```tsx
const sections = {
  reviewer_note: <ReviewerNoteSection ... />,
  last_error: <LastErrorSection ... />,
  ai_summary: <AiSummarySection ... />,
  changed_files: <ChangedFilesSection ... />,
  timeline: <TimelineSection ... />,
};

{sectionOrder.map((key) => <Fragment key={key}>{sections[key]}</Fragment>)}
```

Do not pull `跳到代码` back into the file card or sticky footer.

- [ ] **Step 6: Update CSS for sticky-footer safety and decision-first hierarchy**

Change `ReviewItemDetail.css` so:

- header spacing leaves room for the right-side `跳到代码`
- body content has bottom padding large enough to clear the sticky footer
- sticky footer is visually pinned and uses stable height/spacing
- three footer buttons can wrap on narrow widths without shrinking hit targets below current standards
- `last_error` reads as an early warning block, not as a generic rich-text section

Concrete targets:

- keep footer buttons at least current height or larger
- preserve readable first-screen density for `needs_review`
- avoid layout jump when `ask_ai` enters loading

- [ ] **Step 7: Build and manually verify the detail pane states**

Run: `cd apps/desktop && npm run build`
Expected: PASS.

Run: `cd apps/desktop && npm run tauri dev`
Manual verification checklist:

- `open`: footer shows `让 AI 修改 / 编辑建议 / 删除`
- `needs_review`: footer shows `接受并解决 / 继续让 AI 修改 / 重新打开`
- `resolved`: footer shows only `重新打开`
- `跳到代码` is in the header in all states
- `lastError` appears directly below `Reviewer Note` when present
- long body content is not covered by the sticky footer
- narrowing the pane wraps footer actions without making them hard to click
- while `继续让 AI 修改` is running from a `needs_review` item, the same three-button footer stays visible and the ask-AI button is the one showing loading

- [ ] **Step 8: Commit the component-wiring chunk**

```bash
git add apps/desktop/src/lib/reviewItemDetailLayout.ts apps/desktop/src/App.tsx apps/desktop/src/components/ReviewItemDetail.tsx apps/desktop/src/components/ReviewItemDetail.css apps/desktop/tests/reviewItems.test.mjs
git commit -m "feat(desktop): redesign review item detail pane"
```

## Chunk 3: Final Verification And Cleanup

### Task 3: Verify the complete detail-pane redesign end to end

**Files:**
- Verify only: `apps/desktop/src/lib/reviewItemDetailLayout.ts`
- Verify only: `apps/desktop/src/lib/reviewItemActions.ts`
- Verify only: `apps/desktop/src/components/ReviewItemDetail.tsx`
- Verify only: `apps/desktop/src/components/ReviewItemDetail.css`
- Verify only: `apps/desktop/src/App.tsx`
- Verify only: `apps/desktop/tests/reviewItems.test.mjs`

- [ ] **Step 1: Run the pure test suite again**

Run: `cd apps/desktop && npm run test:review-items`
Expected: PASS with updated footer/section-order assertions.

- [ ] **Step 2: Run the production build again**

Run: `cd apps/desktop && npm run build`
Expected: PASS with no new TypeScript errors.

- [ ] **Step 3: Smoke-test the desktop app**

Run: `cd apps/desktop && npm run tauri dev`
Expected: The detail pane supports decision-first review without regressing current create/edit/delete/AI flows.

- [ ] **Step 4: Review the diff before claiming completion**

Use `git diff --stat` and `git diff -- apps/desktop/src/components/ReviewItemDetail.tsx apps/desktop/src/components/ReviewItemDetail.css apps/desktop/src/lib/reviewItemDetailLayout.ts apps/desktop/src/lib/reviewItemActions.ts apps/desktop/src/App.tsx apps/desktop/tests/reviewItems.test.mjs` to confirm the change stayed scoped to the planned files.

- [ ] **Step 5: Do not create an empty verification commit**

If verification uncovered no new code changes, stop after reporting the verification evidence. Only create another commit if manual verification forced additional scoped fixes.

Plan complete and saved to `docs/superpowers/plans/2026-03-20-review-item-detail-decision-first.md`. Ready to execute?
