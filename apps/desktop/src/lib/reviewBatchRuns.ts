import {
  type ReviewContextMode,
  type ReviewItem,
  type ReviewItemStatus,
  type ReviewWorkspaceMode,
  buildBatchCompletedItemPatch,
  buildBatchStartedItemPatch,
} from "./reviewItems.js";

export type ReviewBatchRunStatus = "queued" | "running" | "completed" | "failed";

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

export interface ReviewBatchRunLocalOverlay extends ApplyReviewBatchLocalFailure {
  repoPath: string;
  contextId: string;
  status: "failed";
}

export interface BuildReviewBatchBriefInput {
  repoPath: string;
  contextMode: ReviewContextMode;
  workspaceMode?: ReviewWorkspaceMode | null;
  commitSha?: string | null;
  issueSnapshots: ReviewBatchIssueSnapshot[];
}

export interface BuildReviewBatchBriefResult {
  briefText: string;
  byteLength: number;
}

export interface ReviewBatchItemPatchPlan {
  id: string;
  patch: Partial<ReviewItem>;
}

export interface ReviewBatchWritePlan {
  batchRun: ReviewBatchRun;
  itemPatches: ReviewBatchItemPatchPlan[];
}

export interface ResolveBatchRunBlockingStateInput {
  repoPath: string;
  contextId: string;
  items: Array<Pick<ReviewItem, "id" | "repoPath" | "contextId" | "status">>;
  batchRuns: ReviewBatchRun[];
  localFailures?: ReviewBatchRunLocalOverlay[];
}

export interface ResolveBatchRunBlockingStateResult {
  blocked: boolean;
  reason: "none" | "item_ai_editing" | "batch_active";
  activeItemId: string | null;
  activeBatchRunId: string | null;
}

export interface CreateQueuedBatchRunInput {
  id: string;
  repoPath: string;
  contextId: string;
  issueIds: string[];
  issueSnapshots: ReviewBatchIssueSnapshot[];
  briefText: string;
  provider?: "codex";
  createdAt?: string;
}

interface BuildBatchRunPatchOptions {
  at?: string;
}

interface BuildCompletedBatchRunPatchOptions extends BuildBatchRunPatchOptions {
  summary: string;
  changedFiles: string[];
}

interface BuildFailedBatchRunPatchOptions extends BuildBatchRunPatchOptions {
  lastError: string;
  errorCode: ReviewBatchRunErrorCode;
  retryable: boolean;
}

interface BuildLocalOrphanedRunOverlayInput {
  batchRunId: string;
  repoPath: string;
  contextId: string;
  message?: string;
  retryable?: boolean;
}

interface PlanRunningBatchWriteInput {
  batchRun: ReviewBatchRun;
  items: ReviewItem[];
  providerLabel: string;
  at?: string;
}

interface PlanCompletedBatchWriteInput extends PlanRunningBatchWriteInput {
  summary: string;
  changedFiles: string[];
}

interface PlanFailedBatchWriteInput {
  batchRun: ReviewBatchRun;
  lastError: string;
  errorCode: ReviewBatchRunErrorCode;
  retryable: boolean;
  at?: string;
}

const MAX_BATCH_BRIEF_BYTES = 24_000;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRepoPath(repoPath: string): string {
  return repoPath.trim().replace(/\\/g, "/").replace(/\/+$/g, "") || ".";
}

function formatModeLine(contextMode: ReviewContextMode): string {
  return contextMode === "commit" ? "Commit Review" : "Workspace Review";
}

function formatScope(snapshot: ReviewBatchIssueSnapshot): string {
  if (snapshot.scopeType === "file") return "Whole File";
  if (snapshot.startLine === null || snapshot.endLine === null) return "Range";
  if (snapshot.startLine === snapshot.endLine) return `Line ${snapshot.startLine}`;
  return `Lines ${snapshot.startLine}-${snapshot.endLine}`;
}

function appendIssueLines(lines: string[], snapshot: ReviewBatchIssueSnapshot): void {
  lines.push(`- Issue ID: ${snapshot.id}`);
  lines.push(`  Title: ${snapshot.title}`);
  lines.push(`  Scope: ${formatScope(snapshot)}`);
  lines.push(`  Reviewer Note: ${snapshot.note || "(none)"}`);
  lines.push("");
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const nextValues: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    nextValues.push(value);
  }
  return nextValues;
}

export function buildReviewBatchIssueSnapshots(items: ReviewItem[]): ReviewBatchIssueSnapshot[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    note: item.note,
    filePath: item.filePath,
    scopeType: item.scopeType,
    startLine: item.startLine,
    endLine: item.endLine,
  }));
}

export function countReviewBatchBriefBytes(briefText: string): number {
  return new TextEncoder().encode(briefText).length;
}

export function isReviewBatchBriefTooLarge(briefText: string): boolean {
  return countReviewBatchBriefBytes(briefText) > MAX_BATCH_BRIEF_BYTES;
}

export function buildReviewBatchBrief({
  repoPath,
  contextMode,
  workspaceMode,
  commitSha,
  issueSnapshots,
}: BuildReviewBatchBriefInput): BuildReviewBatchBriefResult {
  const groupedSnapshots = new Map<string, ReviewBatchIssueSnapshot[]>();

  for (const snapshot of issueSnapshots) {
    const group = groupedSnapshots.get(snapshot.filePath);
    if (group) {
      group.push(snapshot);
      continue;
    }
    groupedSnapshots.set(snapshot.filePath, [snapshot]);
  }

  const lines = [
    "REVIEW DESK",
    `Repo: ${normalizeRepoPath(repoPath)}`,
    `Mode: ${formatModeLine(contextMode)}`,
    `Open Issues: ${issueSnapshots.length}`,
  ];

  if (contextMode === "commit") {
    lines.push(`Commit: ${commitSha ?? "unknown"}`);
  } else {
    lines.push(`Workspace Mode: ${workspaceMode ?? "all"}`);
  }

  lines.push(
    "",
    "EDITOR NOTE",
    "Apply code changes directly in the workspace.",
    "You may modify any related files needed to complete the requested fixes.",
    "Stay focused on the issues below and avoid unrelated refactors.",
    "Return changed files.",
    "Return a short summary.",
    "List any issues you could not fully resolve.",
    "",
  );

  for (const [filePath, snapshots] of groupedSnapshots) {
    lines.push(`FILE: ${filePath}`);
    for (const snapshot of snapshots) {
      appendIssueLines(lines, snapshot);
    }
  }

  lines.push(
    "DELIVERABLE",
    "- Modify the workspace directly.",
    "- Return changed files",
    "- Return a short summary",
    "- List any issues you could not fully resolve",
  );

  const briefText = lines.join("\n").trim();
  return {
    briefText,
    byteLength: countReviewBatchBriefBytes(briefText),
  };
}

export function createQueuedBatchRun({
  id,
  repoPath,
  contextId,
  issueIds,
  issueSnapshots,
  briefText,
  provider = "codex",
  createdAt = new Date().toISOString(),
}: CreateQueuedBatchRunInput): ReviewBatchRun {
  return {
    id,
    repoPath: normalizeRepoPath(repoPath),
    contextId,
    provider,
    status: "queued",
    issueIds: [...issueIds],
    issueCount: issueIds.length,
    issueSnapshots: issueSnapshots.map((snapshot) => ({ ...snapshot })),
    briefText,
    summary: "",
    changedFiles: [],
    lastError: "",
    errorCode: "",
    retryable: false,
    startedAt: null,
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildRunningBatchRunPatch({ at = new Date().toISOString() }: BuildBatchRunPatchOptions = {}): Partial<ReviewBatchRun> {
  return {
    status: "running",
    startedAt: at,
    updatedAt: at,
  };
}

export function buildCompletedBatchRunPatch({
  summary,
  changedFiles,
  at = new Date().toISOString(),
}: BuildCompletedBatchRunPatchOptions): Partial<ReviewBatchRun> {
  return {
    status: "completed",
    summary,
    changedFiles: dedupeStrings(changedFiles),
    lastError: "",
    errorCode: "",
    retryable: false,
    completedAt: at,
    updatedAt: at,
  };
}

export function buildFailedBatchRunPatch({
  lastError,
  errorCode,
  retryable,
  at = new Date().toISOString(),
}: BuildFailedBatchRunPatchOptions): Partial<ReviewBatchRun> {
  return {
    status: "failed",
    lastError,
    errorCode,
    retryable,
    completedAt: at,
    updatedAt: at,
  };
}

export function buildLocalOrphanedRunOverlay({
  batchRunId,
  repoPath,
  contextId,
  message = "Batch run could not be persisted and is treated as failed in this session.",
  retryable = true,
}: BuildLocalOrphanedRunOverlayInput): ReviewBatchRunLocalOverlay {
  return {
    ok: false,
    source: "local",
    batchRunId,
    repoPath: normalizeRepoPath(repoPath),
    contextId,
    status: "failed",
    errorCode: "orphaned_run",
    message,
    retryable,
  };
}

export function resolveBatchRunBlockingState({
  repoPath,
  contextId,
  items,
  batchRuns,
  localFailures = [],
}: ResolveBatchRunBlockingStateInput): ResolveBatchRunBlockingStateResult {
  const normalizedRepoPath = normalizeRepoPath(repoPath);
  const localFailureIds = new Set(
    localFailures
      .filter((failure) => failure.repoPath === normalizedRepoPath && failure.contextId === contextId)
      .map((failure) => failure.batchRunId),
  );

  const activeItem = items.find((item) => (
    item.repoPath === normalizedRepoPath
    && item.contextId === contextId
    && item.status === "ai_editing"
  ));

  if (activeItem) {
    return {
      blocked: true,
      reason: "item_ai_editing",
      activeItemId: activeItem.id,
      activeBatchRunId: null,
    };
  }

  const activeBatchRun = batchRuns.find((batchRun) => (
    batchRun.repoPath === normalizedRepoPath
    && batchRun.contextId === contextId
    && (batchRun.status === "queued" || batchRun.status === "running")
    && !localFailureIds.has(batchRun.id)
  ));

  if (activeBatchRun) {
    return {
      blocked: true,
      reason: "batch_active",
      activeItemId: null,
      activeBatchRunId: activeBatchRun.id,
    };
  }

  return {
    blocked: false,
    reason: "none",
    activeItemId: null,
    activeBatchRunId: null,
  };
}

export function planQueuedBatchWrite(batchRun: ReviewBatchRun): ReviewBatchWritePlan {
  return {
    batchRun,
    itemPatches: [],
  };
}

export function planRunningBatchWrite({
  batchRun,
  items,
  providerLabel,
  at = new Date().toISOString(),
}: PlanRunningBatchWriteInput): ReviewBatchWritePlan {
  return {
    batchRun: {
      ...batchRun,
      ...buildRunningBatchRunPatch({ at }),
    },
    itemPatches: items.map((item) => ({
      id: item.id,
      patch: buildBatchStartedItemPatch(item, {
        providerLabel,
        at,
      }),
    })),
  };
}

export function planCompletedBatchWrite({
  batchRun,
  items,
  providerLabel,
  changedFiles,
  summary,
  at = new Date().toISOString(),
}: PlanCompletedBatchWriteInput): ReviewBatchWritePlan {
  return {
    batchRun: {
      ...batchRun,
      ...buildCompletedBatchRunPatch({
        summary,
        changedFiles,
        at,
      }),
    },
    itemPatches: items.map((item) => ({
      id: item.id,
      patch: buildBatchCompletedItemPatch(item, {
        providerLabel,
        changedFiles,
        summary,
        at,
      }),
    })),
  };
}

export function planFailedBatchWrite({
  batchRun,
  lastError,
  errorCode,
  retryable,
  at = new Date().toISOString(),
}: PlanFailedBatchWriteInput): ReviewBatchWritePlan {
  return {
    batchRun: {
      ...batchRun,
      ...buildFailedBatchRunPatch({
        lastError,
        errorCode,
        retryable,
        at,
      }),
    },
    itemPatches: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(value: unknown): ReviewBatchRunStatus {
  return value === "queued" || value === "running" || value === "completed" || value === "failed"
    ? value
    : "failed";
}

function normalizeErrorCode(value: unknown): ReviewBatchRunErrorCode {
  const nextValue = typeof value === "string" ? value : "";
  switch (nextValue) {
    case "":
    case "empty_selection":
    case "invalid_payload":
    case "provider_unavailable":
    case "batch_already_running":
    case "brief_too_large":
    case "provider_context_limit":
    case "provider_execution_failed":
    case "persistence_failed":
    case "orphaned_run":
      return nextValue;
    default:
      return "provider_execution_failed";
  }
}

function normalizeIssueSnapshot(value: unknown): ReviewBatchIssueSnapshot | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.filePath !== "string") return null;

  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "",
    note: typeof value.note === "string" ? value.note : "",
    filePath: value.filePath,
    scopeType: value.scopeType === "range" ? "range" : "file",
    startLine: Number.isFinite(value.startLine) ? Number(value.startLine) : null,
    endLine: Number.isFinite(value.endLine) ? Number(value.endLine) : null,
  };
}

export function normalizeStoredBatchRuns(batchRuns: unknown): ReviewBatchRun[] {
  if (!Array.isArray(batchRuns)) return [];

  return batchRuns
    .map((value, index) => {
      if (!isRecord(value)) return null;
      const id = typeof value.id === "string" && value.id.length > 0 ? value.id : `batch-${index}-${createId()}`;
      const repoPath = typeof value.repoPath === "string" ? normalizeRepoPath(value.repoPath) : ".";
      const issueSnapshots = Array.isArray(value.issueSnapshots)
        ? value.issueSnapshots.map(normalizeIssueSnapshot).filter((snapshot) => snapshot !== null)
        : [];
      const issueIds = Array.isArray(value.issueIds)
        ? value.issueIds.filter((issueId): issueId is string => typeof issueId === "string")
        : issueSnapshots.map((snapshot) => snapshot.id);

      return {
        id,
        repoPath,
        contextId: typeof value.contextId === "string" ? value.contextId : `${repoPath}::workspace::all`,
        provider: "codex",
        status: normalizeStatus(value.status),
        issueIds,
        issueCount: Number.isFinite(value.issueCount) ? Number(value.issueCount) : issueIds.length,
        issueSnapshots,
        briefText: typeof value.briefText === "string" ? value.briefText : "",
        summary: typeof value.summary === "string" ? value.summary : "",
        changedFiles: Array.isArray(value.changedFiles)
          ? dedupeStrings(value.changedFiles.filter((entry): entry is string => typeof entry === "string"))
          : [],
        lastError: typeof value.lastError === "string" ? value.lastError : "",
        errorCode: normalizeErrorCode(value.errorCode),
        retryable: value.retryable === true,
        startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
        completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
        createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
      } satisfies ReviewBatchRun;
    })
    .filter((value): value is ReviewBatchRun => value !== null);
}

export function isBatchItemEligibleForTimelineRetention(status: ReviewItemStatus): boolean {
  return status === "open" || status === "needs_review" || status === "resolved" || status === "ai_editing";
}
