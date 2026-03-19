import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBatchCompletedItemPatch,
  buildBatchStartedItemPatch,
  buildReviewContextId,
  buildReviewItemAiCompletedPatch,
  buildReviewItemAiStartedPatch,
  buildReviewItemHistoryEntry,
  buildReviewItemResolvedPatch,
  buildReviewItemReopenedPatch,
  createReviewItemRecord,
  getReviewItemScopeLabel,
  getReviewItemTimeline,
  getVisibleReviewItems,
  normalizeStoredReviewItems,
  withAppendedReviewItemHistory,
} from "../.tmp-tests/reviewItems.js";
import {
  buildLocalOrphanedRunOverlay,
  buildReviewBatchBrief,
  countReviewBatchBriefBytes,
  isReviewBatchBriefTooLarge,
  resolveBatchRunBlockingState,
} from "../.tmp-tests/reviewBatchRuns.js";
import {
  resolveReviewPaneMode,
  resolveReviewPanePrimaryAction,
  resolveQueueFooterActions,
  resolveReviewQueueCreateActionLayout,
  shouldClearSelectedReviewItem,
} from "../.tmp-tests/reviewPane.js";
import {
  resolveReviewItemDetailActions,
} from "../.tmp-tests/reviewItemActions.js";
import {
  applyReviewBatchWritePlan,
  normalizeStoredReviewState,
  reconcileStaleBatchRuns,
} from "../.tmp-tests/reviewState.js";

function createOpenItem(overrides = {}) {
  return {
    ...createReviewItemRecord(
      {
        repoPath: "/tmp/repo",
        contextMode: "workspace",
        workspaceMode: "all",
        commitSha: null,
        scopeType: "file",
        filePath: "src/app.tsx",
        startLine: null,
        endLine: null,
        title: "Open issue",
        note: "Check the empty state",
      },
      "2026-03-19T05:00:00.000Z",
    ),
    ...overrides,
  };
}

test("buildReviewContextId anchors commit review to repo and sha", () => {
  assert.equal(
    buildReviewContextId({
      repoPath: "/tmp/repo",
      contextMode: "commit",
      commitSha: "abc123",
      workspaceMode: null,
    }),
    "/tmp/repo::commit::abc123",
  );
});

test("createReviewItemRecord stamps repo context and resets AI metadata", () => {
  const createdAt = "2026-03-19T03:00:00.000Z";
  const item = createReviewItemRecord(
    {
      repoPath: "/tmp/repo",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "range",
      filePath: "src/app.tsx",
      startLine: 10,
      endLine: 18,
      title: "Handle empty title",
      note: "Guard empty input before submit",
    },
    createdAt,
  );

  assert.equal(item.repoPath, "/tmp/repo");
  assert.equal(item.contextId, "/tmp/repo::workspace::all");
  assert.equal(item.status, "open");
  assert.deepEqual(item.changedFiles, []);
  assert.equal(item.lastError, "");
  assert.equal(item.lastRunSummary, "");
  assert.equal(item.lastRunAt, null);
  assert.equal(item.createdAt, createdAt);
  assert.equal(item.updatedAt, createdAt);
});

test("getVisibleReviewItems prioritizes current file, current context, and unresolved work", () => {
  const items = [
    {
      id: "resolved-current-file",
      repoPath: "/tmp/repo",
      contextId: "/tmp/repo::workspace::all",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "file",
      filePath: "src/App.tsx",
      startLine: null,
      endLine: null,
      title: "Resolved item",
      note: "",
      status: "resolved",
      changedFiles: [],
      lastError: "",
      lastRunSummary: "",
      lastRunAt: null,
      createdAt: "2026-03-19T01:00:00.000Z",
      updatedAt: "2026-03-19T01:00:00.000Z",
    },
    {
      id: "open-other-file",
      repoPath: "/tmp/repo",
      contextId: "/tmp/repo::workspace::all",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "file",
      filePath: "src/lib.ts",
      startLine: null,
      endLine: null,
      title: "Other file",
      note: "",
      status: "open",
      changedFiles: [],
      lastError: "",
      lastRunSummary: "",
      lastRunAt: null,
      createdAt: "2026-03-19T02:00:00.000Z",
      updatedAt: "2026-03-19T02:00:00.000Z",
    },
    {
      id: "needs-review-current-file",
      repoPath: "/tmp/repo",
      contextId: "/tmp/repo::commit::abc123",
      contextMode: "commit",
      workspaceMode: null,
      commitSha: "abc123",
      scopeType: "range",
      filePath: "src/App.tsx",
      startLine: 42,
      endLine: 58,
      title: "Current file first",
      note: "",
      status: "needs_review",
      changedFiles: ["src/App.tsx"],
      lastError: "",
      lastRunSummary: "",
      lastRunAt: "2026-03-19T03:00:00.000Z",
      createdAt: "2026-03-19T03:00:00.000Z",
      updatedAt: "2026-03-19T03:05:00.000Z",
    },
  ];

  const visible = getVisibleReviewItems(items, {
    repoPath: "/tmp/repo",
    contextId: "/tmp/repo::workspace::all",
    selectedFilePath: "src/App.tsx",
  });

  assert.deepEqual(visible.map((item) => item.id), [
    "needs-review-current-file",
    "resolved-current-file",
    "open-other-file",
  ]);
});

test("getReviewItemScopeLabel renders file and line range scopes", () => {
  assert.equal(
    getReviewItemScopeLabel({
      scopeType: "file",
      startLine: null,
      endLine: null,
    }),
    "Whole File",
  );
  assert.equal(
    getReviewItemScopeLabel({
      scopeType: "range",
      startLine: 42,
      endLine: 58,
    }),
    "Lines 42-58",
  );
});

test("resolveReviewPaneMode keeps queue as the default state", () => {
  assert.equal(resolveReviewPaneMode(null), "queue");
  assert.equal(resolveReviewPaneMode("item-1"), "detail");
  assert.equal(
    resolveReviewPaneMode({
      selectedItemId: null,
      selectedBatchRunId: "batch-1",
    }),
    "batch_run",
  );
});

test("resolveReviewPanePrimaryAction prioritizes selected range over file action", () => {
  assert.deepEqual(
    resolveReviewPanePrimaryAction({
      selectedItemId: null,
      selectedFilePath: "src/App.tsx",
      hasSelectedRange: true,
    }),
    {
      disabled: false,
      kind: "range",
      label: "基于选区创建",
    },
  );

  assert.deepEqual(
    resolveReviewPanePrimaryAction({
      selectedItemId: null,
      selectedFilePath: "src/App.tsx",
      hasSelectedRange: false,
    }),
    {
      disabled: false,
      kind: "file",
      label: "新建文件问题",
    },
  );

  assert.deepEqual(
    resolveReviewPanePrimaryAction({
      selectedItemId: null,
      selectedFilePath: null,
      hasSelectedRange: false,
    }),
    {
      disabled: true,
      kind: "none",
      label: "先选择文件",
    },
  );
});

test("resolveReviewQueueCreateActionLayout keeps a single pinned footer action", () => {
  assert.deepEqual(
    resolveReviewQueueCreateActionLayout(),
    {
      showHeaderAction: false,
      showEmptyAction: false,
      showFooterAction: true,
    },
  );
});

test("resolveQueueFooterActions shows enabled send copy when open items exist", () => {
  assert.deepEqual(
    resolveQueueFooterActions({
      visibleOpenCount: 3,
      createDisabled: false,
      batchBlocked: false,
    }),
    {
      create: {
        label: "新建文件问题",
        disabled: false,
      },
      sendOpen: {
        label: "发送 3 条 Open Issues",
        disabled: false,
      },
    },
  );
});

test("resolveQueueFooterActions uses no-open disabled copy", () => {
  assert.deepEqual(
    resolveQueueFooterActions({
      visibleOpenCount: 0,
      createDisabled: false,
      batchBlocked: false,
    }),
    {
      create: {
        label: "新建文件问题",
        disabled: false,
      },
      sendOpen: {
        label: "没有 Open Issues 可发送",
        disabled: true,
      },
    },
  );
});

test("resolveQueueFooterActions uses active-run disabled copy", () => {
  assert.deepEqual(
    resolveQueueFooterActions({
      visibleOpenCount: 2,
      createDisabled: false,
      batchBlocked: true,
    }),
    {
      create: {
        label: "新建文件问题",
        disabled: false,
      },
      sendOpen: {
        label: "当前上下文已有 AI 任务执行中",
        disabled: true,
      },
    },
  );
});

test("shouldClearSelectedReviewItem only clears when item truly no longer exists", () => {
  assert.equal(shouldClearSelectedReviewItem("item-1", true), false);
  assert.equal(shouldClearSelectedReviewItem("item-1", false), true);
  assert.equal(shouldClearSelectedReviewItem(null, false), false);
});

test("resolveReviewItemDetailActions exposes review-first actions for open items", () => {
  assert.deepEqual(
    resolveReviewItemDetailActions({
      status: "open",
      aiBusy: false,
      providerLabel: "Codex CLI",
    }),
    {
      primary: {
        action: "ask_ai",
        label: "Ask Codex CLI To Fix",
        disabled: false,
      },
      secondary: [
        {
          action: "edit",
          label: "编辑建议",
          disabled: false,
        },
        {
          action: "delete",
          label: "删除",
          disabled: false,
          tone: "danger",
        },
      ],
    },
  );
});

test("resolveReviewItemDetailActions exposes accept-continue-reopen actions for needs review", () => {
  assert.deepEqual(
    resolveReviewItemDetailActions({
      status: "needs_review",
      aiBusy: false,
      providerLabel: "Codex CLI",
    }),
    {
      primary: {
        action: "resolve",
        label: "接受并解决",
        disabled: false,
      },
      secondary: [
        {
          action: "ask_ai",
          label: "继续让 Codex CLI 修改",
          disabled: false,
        },
        {
          action: "reopen",
          label: "重新打开",
          disabled: false,
        },
      ],
    },
  );
});

test("resolveReviewItemDetailActions reduces resolved items to reopen only", () => {
  assert.deepEqual(
    resolveReviewItemDetailActions({
      status: "resolved",
      aiBusy: false,
      providerLabel: "Codex CLI",
    }),
    {
      primary: {
        action: "reopen",
        label: "重新打开",
        disabled: false,
      },
      secondary: [],
    },
  );
});

test("createReviewItemRecord starts history with created event", () => {
  const createdAt = "2026-03-19T05:00:00.000Z";
  const item = createReviewItemRecord(
    {
      repoPath: "/tmp/repo",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "file",
      filePath: "src/app.tsx",
      startLine: null,
      endLine: null,
      title: "New item",
      note: "",
    },
    createdAt,
  );

  assert.equal(item.history.length, 1);
  assert.equal(item.history[0].type, "created");
  assert.equal(item.history[0].at, createdAt);
  assert.equal(item.history[0].summary, "Created review item");
});

test("withAppendedReviewItemHistory appends new timeline entries", () => {
  const createdAt = "2026-03-19T05:00:00.000Z";
  const item = createReviewItemRecord(
    {
      repoPath: "/tmp/repo",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "file",
      filePath: "src/app.tsx",
      startLine: null,
      endLine: null,
      title: "New item",
      note: "",
    },
    createdAt,
  );

  const updated = withAppendedReviewItemHistory(
    item,
    buildReviewItemHistoryEntry("resolved", "2026-03-19T06:00:00.000Z"),
  );

  assert.deepEqual(updated.history.map((entry) => entry.type), ["created", "resolved"]);
});

test("getReviewItemTimeline returns newest events first", () => {
  const timeline = getReviewItemTimeline([
    buildReviewItemHistoryEntry("resolved", "2026-03-19T07:00:00.000Z"),
    buildReviewItemHistoryEntry("created", "2026-03-19T05:00:00.000Z"),
    buildReviewItemHistoryEntry("ai_completed", "2026-03-19T06:00:00.000Z", "AI updated 3 files"),
  ]);

  assert.deepEqual(timeline.map((entry) => entry.type), ["resolved", "ai_completed", "created"]);
  assert.equal(timeline[1].summary, "AI updated 3 files");
});

test("buildReviewItemResolvedPatch marks item resolved and appends timeline entry", () => {
  const createdAt = "2026-03-19T05:00:00.000Z";
  const item = createReviewItemRecord(
    {
      repoPath: "/tmp/repo",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "file",
      filePath: "src/app.tsx",
      startLine: null,
      endLine: null,
      title: "Resolve me",
      note: "",
    },
    createdAt,
  );

  const patch = buildReviewItemResolvedPatch(item, "2026-03-19T08:00:00.000Z");

  assert.equal(patch.status, "resolved");
  assert.equal(patch.history.at(-1)?.type, "resolved");
  assert.equal(patch.history.at(-1)?.summary, "Marked resolved");
});

test("buildReviewItemReopenedPatch reopens item and appends timeline entry", () => {
  const createdAt = "2026-03-19T05:00:00.000Z";
  const item = createReviewItemRecord(
    {
      repoPath: "/tmp/repo",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "file",
      filePath: "src/app.tsx",
      startLine: null,
      endLine: null,
      title: "Reopen me",
      note: "",
    },
    createdAt,
  );

  const patch = buildReviewItemReopenedPatch(item, "2026-03-19T09:00:00.000Z");

  assert.equal(patch.status, "open");
  assert.equal(patch.history.at(-1)?.type, "reopened");
  assert.equal(patch.history.at(-1)?.summary, "Reopened review item");
});

test("buildReviewItemAiStartedPatch keeps prior file context and appends start event", () => {
  const createdAt = "2026-03-19T05:00:00.000Z";
  const item = {
    ...createReviewItemRecord(
      {
        repoPath: "/tmp/repo",
        contextMode: "workspace",
        workspaceMode: "all",
        commitSha: null,
        scopeType: "file",
        filePath: "src/app.tsx",
        startLine: null,
        endLine: null,
        title: "Run AI",
        note: "",
      },
      createdAt,
    ),
    changedFiles: ["src/app.tsx"],
    lastRunSummary: "Old summary",
    lastError: "Old error",
    status: "needs_review",
  };

  const patch = buildReviewItemAiStartedPatch(item, "2026-03-19T10:00:00.000Z");

  assert.equal(patch.status, "ai_editing");
  assert.equal(patch.lastError, "");
  assert.deepEqual(patch.changedFiles, ["src/app.tsx"]);
  assert.equal(patch.lastRunSummary, "Old summary");
  assert.equal(patch.history.at(-1)?.type, "ai_started");
});

test("buildReviewItemAiCompletedPatch switches item into workspace review and records summary", () => {
  const createdAt = "2026-03-19T05:00:00.000Z";
  const item = createReviewItemRecord(
    {
      repoPath: "/tmp/repo",
      contextMode: "commit",
      workspaceMode: null,
      commitSha: "abc123",
      scopeType: "range",
      filePath: "src/app.tsx",
      startLine: 10,
      endLine: 18,
      title: "Apply fix",
      note: "",
    },
    createdAt,
  );

  const patch = buildReviewItemAiCompletedPatch(item, {
    providerLabel: "Codex CLI",
    changedFiles: ["src/app.tsx", "src/lib.ts"],
    summary: "Updated validation and tests",
    at: "2026-03-19T11:00:00.000Z",
  });

  assert.equal(patch.status, "needs_review");
  assert.equal(patch.contextMode, "workspace");
  assert.equal(patch.contextId, "/tmp/repo::workspace::all");
  assert.equal(patch.workspaceMode, "all");
  assert.equal(patch.commitSha, null);
  assert.deepEqual(patch.changedFiles, ["src/app.tsx", "src/lib.ts"]);
  assert.equal(patch.lastRunSummary, "Updated validation and tests");
  assert.equal(patch.lastRunAt, "2026-03-19T11:00:00.000Z");
  assert.equal(patch.history.at(-1)?.type, "ai_completed");
  assert.equal(patch.history.at(-1)?.summary, "Codex CLI updated 2 files");
});

test("buildReviewBatchBrief groups issue sections by first file appearance", () => {
  const result = buildReviewBatchBrief({
    repoPath: "/tmp/repo",
    contextMode: "workspace",
    workspaceMode: "all",
    commitSha: null,
    issueSnapshots: [
      {
        id: "ri_2",
        title: "Second file first issue",
        note: "",
        filePath: "src/b.ts",
        scopeType: "file",
        startLine: null,
        endLine: null,
      },
      {
        id: "ri_1",
        title: "First file issue",
        note: "",
        filePath: "src/a.ts",
        scopeType: "range",
        startLine: 4,
        endLine: 8,
      },
      {
        id: "ri_3",
        title: "Second file second issue",
        note: "",
        filePath: "src/b.ts",
        scopeType: "file",
        startLine: null,
        endLine: null,
      },
    ],
  });

  const secondFileIndex = result.briefText.indexOf("FILE: src/b.ts");
  const firstFileIndex = result.briefText.indexOf("FILE: src/a.ts");
  const firstIssueIndex = result.briefText.indexOf("Issue ID: ri_2");
  const repeatedIssueIndex = result.briefText.indexOf("Issue ID: ri_3");

  assert.ok(secondFileIndex >= 0);
  assert.ok(firstFileIndex > secondFileIndex);
  assert.ok(firstIssueIndex >= 0);
  assert.ok(repeatedIssueIndex > firstIssueIndex);
});

test("buildReviewBatchBrief includes the required REVIEW DESK contract blocks", () => {
  const result = buildReviewBatchBrief({
    repoPath: "/tmp/repo",
    contextMode: "commit",
    workspaceMode: null,
    commitSha: "abc123",
    issueSnapshots: [
      {
        id: "ri_1",
        title: "Guard empty state",
        note: "Check the loading branch",
        filePath: "src/app.tsx",
        scopeType: "file",
        startLine: null,
        endLine: null,
      },
    ],
  });

  assert.match(result.briefText, /^REVIEW DESK/m);
  assert.match(result.briefText, /Repo: \/tmp\/repo/);
  assert.match(result.briefText, /Mode: Commit Review/);
  assert.match(result.briefText, /Open Issues: 1/);
  assert.match(result.briefText, /EDITOR NOTE/);
  assert.match(result.briefText, /DELIVERABLE/);
});

test("countReviewBatchBriefBytes measures UTF-8 size and flags overflow", () => {
  assert.equal(countReviewBatchBriefBytes("a".repeat(24_000)), 24_000);
  assert.equal(isReviewBatchBriefTooLarge("a".repeat(24_000)), false);
  assert.equal(isReviewBatchBriefTooLarge("中".repeat(8_001)), true);
});

test("resolveBatchRunBlockingState lets same-session orphan overlays unblock dispatch", () => {
  const result = resolveBatchRunBlockingState({
    repoPath: "/tmp/repo",
    contextId: "/tmp/repo::workspace::all",
    items: [],
    batchRuns: [
      {
        id: "batch-1",
        repoPath: "/tmp/repo",
        contextId: "/tmp/repo::workspace::all",
        provider: "codex",
        status: "queued",
        issueIds: ["ri_1"],
        issueCount: 1,
        issueSnapshots: [],
        briefText: "REVIEW DESK",
        summary: "",
        changedFiles: [],
        lastError: "",
        errorCode: "",
        retryable: false,
        startedAt: null,
        completedAt: null,
        createdAt: "2026-03-19T12:00:00.000Z",
        updatedAt: "2026-03-19T12:00:00.000Z",
      },
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

test("buildBatchStartedItemPatch keeps the item open and preserves previous run metadata", () => {
  const item = createOpenItem({
    lastError: "Old error",
    lastRunSummary: "Old summary",
  });

  const patch = buildBatchStartedItemPatch(item, {
    providerLabel: "Codex CLI",
    at: "2026-03-19T13:00:00.000Z",
  });

  assert.equal(patch.status, "open");
  assert.equal(patch.lastError, "Old error");
  assert.equal(patch.lastRunSummary, "Old summary");
  assert.equal(patch.history.at(-1)?.type, "ai_started");
  assert.equal(patch.history.at(-1)?.summary, "Codex CLI batch run started");
});

test("buildBatchCompletedItemPatch moves the item into needs review with shared run output", () => {
  const item = createOpenItem();

  const patch = buildBatchCompletedItemPatch(item, {
    providerLabel: "Codex CLI",
    changedFiles: ["src/app.tsx", "src/lib.ts"],
    summary: "Updated validation and state flow",
    at: "2026-03-19T14:00:00.000Z",
  });

  assert.equal(patch.status, "needs_review");
  assert.deepEqual(patch.changedFiles, ["src/app.tsx", "src/lib.ts"]);
  assert.equal(patch.lastRunSummary, "Updated validation and state flow");
  assert.equal(patch.lastRunAt, "2026-03-19T14:00:00.000Z");
  assert.equal(patch.history.at(-1)?.type, "ai_completed");
});

test("normalizeStoredReviewState migrates legacy review items into versioned state", () => {
  const legacyItem = createOpenItem({ id: "legacy-1" });

  const state = normalizeStoredReviewState(null, [legacyItem]);

  assert.equal(state.version, 2);
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].id, "legacy-1");
  assert.deepEqual(state.batchRuns, []);
});

test("applyReviewBatchWritePlan upserts the batch run and patches only included items", () => {
  const includedItem = createOpenItem({ id: "ri_1" });
  const untouchedItem = createOpenItem({
    id: "ri_2",
    filePath: "src/other.ts",
    title: "Keep untouched",
  });

  const nextState = applyReviewBatchWritePlan(
    {
      version: 2,
      items: [includedItem, untouchedItem],
      batchRuns: [],
    },
    {
      batchRun: {
        id: "batch-1",
        repoPath: "/tmp/repo",
        contextId: "/tmp/repo::workspace::all",
        provider: "codex",
        status: "running",
        issueIds: ["ri_1"],
        issueCount: 1,
        issueSnapshots: [],
        briefText: "REVIEW DESK",
        summary: "",
        changedFiles: [],
        lastError: "",
        errorCode: "",
        retryable: false,
        startedAt: "2026-03-19T16:00:00.000Z",
        completedAt: null,
        createdAt: "2026-03-19T15:59:00.000Z",
        updatedAt: "2026-03-19T16:00:00.000Z",
      },
      itemPatches: [
        {
          id: "ri_1",
          patch: {
            status: "needs_review",
            lastRunSummary: "Updated review flow",
            changedFiles: ["src/app.tsx"],
          },
        },
      ],
    },
  );

  assert.equal(nextState.batchRuns.length, 1);
  assert.equal(nextState.batchRuns[0].id, "batch-1");
  assert.equal(nextState.items[0].status, "needs_review");
  assert.equal(nextState.items[0].lastRunSummary, "Updated review flow");
  assert.deepEqual(nextState.items[0].changedFiles, ["src/app.tsx"]);
  assert.equal(nextState.items[1].status, untouchedItem.status);
  assert.equal(nextState.items[1].lastRunSummary, untouchedItem.lastRunSummary);
});

test("reconcileStaleBatchRuns rewrites queued and running batches to orphaned failures", () => {
  const { state, changed } = reconcileStaleBatchRuns({
    version: 2,
    items: [],
    batchRuns: [
      {
        id: "batch-queued",
        repoPath: "/tmp/repo",
        contextId: "/tmp/repo::workspace::all",
        provider: "codex",
        status: "queued",
        issueIds: ["ri_1"],
        issueCount: 1,
        issueSnapshots: [],
        briefText: "REVIEW DESK",
        summary: "",
        changedFiles: [],
        lastError: "",
        errorCode: "",
        retryable: false,
        startedAt: null,
        completedAt: null,
        createdAt: "2026-03-19T10:00:00.000Z",
        updatedAt: "2026-03-19T10:00:00.000Z",
      },
      {
        id: "batch-completed",
        repoPath: "/tmp/repo",
        contextId: "/tmp/repo::workspace::all",
        provider: "codex",
        status: "completed",
        issueIds: ["ri_2"],
        issueCount: 1,
        issueSnapshots: [],
        briefText: "REVIEW DESK",
        summary: "Done",
        changedFiles: ["src/app.tsx"],
        lastError: "",
        errorCode: "",
        retryable: false,
        startedAt: "2026-03-19T10:05:00.000Z",
        completedAt: "2026-03-19T10:06:00.000Z",
        createdAt: "2026-03-19T10:00:00.000Z",
        updatedAt: "2026-03-19T10:06:00.000Z",
      },
    ],
  }, "2026-03-19T15:00:00.000Z");

  assert.equal(changed, true);
  assert.equal(state.batchRuns[0].status, "failed");
  assert.equal(state.batchRuns[0].errorCode, "orphaned_run");
  assert.equal(state.batchRuns[0].retryable, true);
  assert.equal(state.batchRuns[0].completedAt, "2026-03-19T15:00:00.000Z");
  assert.equal(state.batchRuns[1].status, "completed");
});

test("buildBatchStartedItemPatch keeps item open and preserves prior run metadata", () => {
  const item = createOpenItem({
    status: "open",
    lastError: "Previous provider error",
    lastRunSummary: "Previous summary",
  });

  const patch = buildBatchStartedItemPatch(item, {
    providerLabel: "Codex CLI",
    at: "2026-03-19T12:00:00.000Z",
  });

  assert.equal(patch.status, "open");
  assert.equal(patch.lastError, item.lastError);
  assert.equal(patch.lastRunSummary, item.lastRunSummary);
  assert.equal(patch.history.at(-1)?.type, "ai_started");
  assert.equal(patch.history.at(-1)?.summary, "Codex CLI batch run started");
});

test("buildBatchCompletedItemPatch moves included items to needs review without clearing prior errors", () => {
  const item = createOpenItem({
    status: "open",
    lastError: "Keep me",
  });

  const patch = buildBatchCompletedItemPatch(item, {
    providerLabel: "Codex CLI",
    changedFiles: ["src/app.tsx", "src/lib.ts"],
    summary: "Updated validation and tests",
    at: "2026-03-19T13:00:00.000Z",
  });

  assert.equal(patch.status, "needs_review");
  assert.deepEqual(patch.changedFiles, ["src/app.tsx", "src/lib.ts"]);
  assert.equal(patch.lastRunSummary, "Updated validation and tests");
  assert.equal(patch.lastRunAt, "2026-03-19T13:00:00.000Z");
  assert.equal(patch.lastError, item.lastError);
  assert.equal(patch.history.at(-1)?.type, "ai_completed");
  assert.equal(patch.history.at(-1)?.summary, "Codex CLI batch run updated 2 files");
});

test("buildReviewBatchBrief groups visible open issues by first file appearance", () => {
  const result = buildReviewBatchBrief({
    repoPath: "/tmp/repo",
    contextMode: "workspace",
    workspaceMode: "all",
    commitSha: null,
    issueSnapshots: [
      {
        id: "ri_2",
        filePath: "b.ts",
        title: "Second file",
        note: "",
        scopeType: "file",
        startLine: null,
        endLine: null,
      },
      {
        id: "ri_1",
        filePath: "a.ts",
        title: "First file",
        note: "",
        scopeType: "range",
        startLine: 4,
        endLine: 8,
      },
      {
        id: "ri_3",
        filePath: "b.ts",
        title: "Back to second file",
        note: "",
        scopeType: "file",
        startLine: null,
        endLine: null,
      },
    ],
  });

  assert.match(
    result.briefText,
    /FILE: b\.ts[\s\S]*Issue ID: ri_2[\s\S]*Issue ID: ri_3/,
  );
  assert.match(result.briefText, /FILE: a\.ts/);
});

test("buildReviewBatchBrief includes required REVIEW DESK contract blocks", () => {
  const result = buildReviewBatchBrief({
    repoPath: "/tmp/repo",
    contextMode: "commit",
    workspaceMode: null,
    commitSha: "abc123",
    issueSnapshots: [
      {
        id: "ri_1",
        filePath: "a.ts",
        title: "First file",
        note: "Guard empty state",
        scopeType: "file",
        startLine: null,
        endLine: null,
      },
    ],
  });

  assert.match(result.briefText, /^REVIEW DESK/m);
  assert.match(result.briefText, /^Repo: \/tmp\/repo$/m);
  assert.match(result.briefText, /^Mode: Commit Review$/m);
  assert.match(result.briefText, /^Open Issues: 1$/m);
  assert.match(result.briefText, /^EDITOR NOTE$/m);
  assert.match(result.briefText, /^DELIVERABLE$/m);
  assert.match(result.briefText, /Modify the workspace directly\./);
  assert.match(result.briefText, /Return changed files/);
  assert.match(result.briefText, /List any issues you could not fully resolve/);
});

test("countReviewBatchBriefBytes and size guard enforce the 24000-byte limit", () => {
  assert.equal(countReviewBatchBriefBytes("abc"), 3);
  assert.equal(countReviewBatchBriefBytes("中".repeat(2)), 6);
  assert.equal(isReviewBatchBriefTooLarge("a".repeat(24000)), false);
  assert.equal(isReviewBatchBriefTooLarge("中".repeat(8001)), true);
});

test("resolveBatchRunBlockingState lets same-session orphan overlays unblock dispatch", () => {
  const result = resolveBatchRunBlockingState({
    repoPath: "/tmp/repo",
    contextId: "/tmp/repo::workspace::all",
    items: [],
    batchRuns: [
      {
        id: "batch-1",
        repoPath: "/tmp/repo",
        contextId: "/tmp/repo::workspace::all",
        provider: "codex",
        status: "queued",
        issueIds: [],
        issueCount: 0,
        issueSnapshots: [],
        briefText: "REVIEW DESK",
        summary: "",
        changedFiles: [],
        lastError: "",
        errorCode: "",
        retryable: false,
        startedAt: null,
        completedAt: null,
        createdAt: "2026-03-19T12:00:00.000Z",
        updatedAt: "2026-03-19T12:00:00.000Z",
      },
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

test("normalizeStoredReviewItems backfills missing history arrays", () => {
  const normalized = normalizeStoredReviewItems([
    {
      id: "legacy-item",
      repoPath: "/tmp/repo",
      contextId: "/tmp/repo::workspace::all",
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
      scopeType: "file",
      filePath: "src/App.tsx",
      startLine: null,
      endLine: null,
      title: "Legacy",
      note: "",
      status: "open",
      changedFiles: [],
      lastError: "",
      lastRunSummary: "",
      lastRunAt: null,
      createdAt: "2026-03-19T03:00:00.000Z",
      updatedAt: "2026-03-19T03:00:00.000Z",
    },
  ]);

  assert.deepEqual(normalized[0].history, []);
});

test("normalizeStoredReviewState migrates legacy review.items into versioned state", () => {
  const openItem = createOpenItem();

  const result = normalizeStoredReviewState(null, [openItem]);

  assert.equal(result.version, 2);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], openItem);
  assert.deepEqual(result.batchRuns, []);
});
