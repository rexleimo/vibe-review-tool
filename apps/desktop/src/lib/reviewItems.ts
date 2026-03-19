export type ReviewContextMode = "commit" | "workspace";
export type ReviewWorkspaceMode = "all" | "staged" | "unstaged";
export type ReviewItemScope = "file" | "range";
export type ReviewItemStatus = "open" | "ai_editing" | "needs_review" | "resolved";
export type ReviewItemHistoryType =
  | "created"
  | "ai_started"
  | "ai_completed"
  | "reopened"
  | "resolved";

export interface ReviewItemHistoryEntry {
  id: string;
  type: ReviewItemHistoryType;
  at: string;
  summary: string;
}

export interface ReviewContextAnchor {
  repoPath: string;
  contextMode: ReviewContextMode;
  workspaceMode?: ReviewWorkspaceMode | null;
  commitSha?: string | null;
}

export interface ReviewItem extends ReviewContextAnchor {
  id: string;
  contextId: string;
  scopeType: ReviewItemScope;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  title: string;
  note: string;
  status: ReviewItemStatus;
  changedFiles: string[];
  lastError: string;
  lastRunSummary: string;
  lastRunAt: string | null;
  history: ReviewItemHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewItemInput extends ReviewContextAnchor {
  scopeType: ReviewItemScope;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  title: string;
  note: string;
}

export interface ReviewItemVisibilityOptions {
  repoPath: string;
  contextId: string;
  selectedFilePath: string | null;
}

interface BuildReviewItemAiCompletedPatchOptions {
  providerLabel: string;
  changedFiles: string[];
  summary: string;
  at?: string;
}

interface BuildBatchReviewItemPatchOptions {
  providerLabel: string;
  at?: string;
}

interface BuildBatchReviewItemCompletedPatchOptions extends BuildBatchReviewItemPatchOptions {
  changedFiles: string[];
  summary: string;
}

function normalizeRepoPath(repoPath: string): string {
  return repoPath.trim().replace(/\\/g, "/").replace(/\/+$/g, "") || ".";
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isUnresolved(status: ReviewItemStatus): boolean {
  return status !== "resolved";
}

function compareIsoDescending(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

export function buildReviewContextId({
  repoPath,
  contextMode,
  commitSha,
  workspaceMode,
}: ReviewContextAnchor): string {
  const repo = normalizeRepoPath(repoPath);
  if (contextMode === "commit") {
    return `${repo}::commit::${commitSha ?? "unknown"}`;
  }
  return `${repo}::workspace::${workspaceMode ?? "all"}`;
}

export function normalizeReviewRange(startLine: number | null, endLine: number | null): {
  startLine: number;
  endLine: number;
} | null {
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return null;
  const start = Math.max(1, Math.floor(Number(startLine)));
  const end = Math.max(1, Math.floor(Number(endLine)));
  return {
    startLine: Math.min(start, end),
    endLine: Math.max(start, end),
  };
}

export function createReviewItemRecord(
  input: CreateReviewItemInput,
  now = new Date().toISOString(),
): ReviewItem {
  const normalizedRange = input.scopeType === "range"
    ? normalizeReviewRange(input.startLine, input.endLine)
    : null;

  return {
    id: createId(),
    repoPath: normalizeRepoPath(input.repoPath),
    contextMode: input.contextMode,
    contextId: buildReviewContextId(input),
    workspaceMode: input.contextMode === "workspace" ? input.workspaceMode ?? "all" : null,
    commitSha: input.contextMode === "commit" ? input.commitSha ?? null : null,
    scopeType: input.scopeType,
    filePath: input.filePath,
    startLine: normalizedRange?.startLine ?? null,
    endLine: normalizedRange?.endLine ?? null,
    title: input.title.trim(),
    note: input.note.trim(),
    status: "open",
    changedFiles: [],
    lastError: "",
    lastRunSummary: "",
    lastRunAt: null,
    history: [buildReviewItemHistoryEntry("created", now)],
    createdAt: now,
    updatedAt: now,
  };
}

export function buildReviewItemHistoryEntry(
  type: ReviewItemHistoryType,
  at = new Date().toISOString(),
  summary?: string,
): ReviewItemHistoryEntry {
  return {
    id: createId(),
    type,
    at,
    summary: summary ?? defaultHistorySummary(type),
  };
}

export function withAppendedReviewItemHistory(
  item: ReviewItem,
  entry: ReviewItemHistoryEntry,
): ReviewItem {
  return {
    ...item,
    history: [...(item.history ?? []), entry],
  };
}

export function buildReviewItemResolvedPatch(
  item: ReviewItem,
  at = new Date().toISOString(),
): Partial<ReviewItem> {
  return {
    status: "resolved",
    history: appendHistoryEntry(item, "resolved", at),
    updatedAt: at,
  };
}

export function buildReviewItemReopenedPatch(
  item: ReviewItem,
  at = new Date().toISOString(),
): Partial<ReviewItem> {
  return {
    status: "open",
    history: appendHistoryEntry(item, "reopened", at),
    updatedAt: at,
  };
}

export function buildReviewItemAiStartedPatch(
  item: ReviewItem,
  at = new Date().toISOString(),
): Partial<ReviewItem> {
  return {
    status: "ai_editing",
    changedFiles: item.changedFiles,
    lastError: "",
    lastRunSummary: item.lastRunSummary,
    history: appendHistoryEntry(item, "ai_started", at),
    updatedAt: at,
  };
}

export function buildReviewItemAiCompletedPatch(
  item: ReviewItem,
  {
    providerLabel,
    changedFiles,
    summary,
    at = new Date().toISOString(),
  }: BuildReviewItemAiCompletedPatchOptions,
): Partial<ReviewItem> {
  const nextChangedFiles = changedFiles.length > 0 ? changedFiles : [item.filePath];
  return {
    status: "needs_review",
    changedFiles: nextChangedFiles,
    lastError: "",
    lastRunSummary: summary,
    lastRunAt: at,
    contextMode: "workspace",
    contextId: buildReviewContextId({
      repoPath: item.repoPath,
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
    }),
    workspaceMode: "all",
    commitSha: null,
    history: appendHistoryEntry(
      item,
      "ai_completed",
      at,
      `${providerLabel} updated ${formatFileCount(nextChangedFiles.length)}`,
    ),
    updatedAt: at,
  };
}

export function buildReviewItemAiFailedPatch(
  item: ReviewItem,
  error: string,
  at = new Date().toISOString(),
): Partial<ReviewItem> {
  return {
    status: item.status,
    lastError: error,
    lastRunAt: at,
    updatedAt: at,
  };
}

export function buildBatchStartedItemPatch(
  item: ReviewItem,
  {
    providerLabel,
    at = new Date().toISOString(),
  }: BuildBatchReviewItemPatchOptions,
): Partial<ReviewItem> {
  return {
    status: "open",
    changedFiles: item.changedFiles,
    lastError: item.lastError,
    lastRunSummary: item.lastRunSummary,
    lastRunAt: item.lastRunAt,
    history: appendHistoryEntry(item, "ai_started", at, `${providerLabel} batch run started`),
    updatedAt: at,
  };
}

export function buildBatchCompletedItemPatch(
  item: ReviewItem,
  {
    providerLabel,
    changedFiles,
    summary,
    at = new Date().toISOString(),
  }: BuildBatchReviewItemCompletedPatchOptions,
): Partial<ReviewItem> {
  const nextChangedFiles = changedFiles.length > 0 ? changedFiles : [item.filePath];
  return {
    status: "needs_review",
    changedFiles: nextChangedFiles,
    lastError: item.lastError,
    lastRunSummary: summary,
    lastRunAt: at,
    contextMode: "workspace",
    contextId: buildReviewContextId({
      repoPath: item.repoPath,
      contextMode: "workspace",
      workspaceMode: "all",
      commitSha: null,
    }),
    workspaceMode: "all",
    commitSha: null,
    history: appendHistoryEntry(
      item,
      "ai_completed",
      at,
      `${providerLabel} batch run updated ${formatFileCount(nextChangedFiles.length)}`,
    ),
    updatedAt: at,
  };
}

export function normalizeStoredReviewItems(
  items: Array<Omit<ReviewItem, "history"> & { history?: ReviewItemHistoryEntry[] | null }> | null | undefined,
): ReviewItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    history: Array.isArray(item.history) ? item.history : [],
  }));
}

export function getReviewItemTimeline(history: ReviewItemHistoryEntry[]): ReviewItemHistoryEntry[] {
  return [...history].sort((left, right) => right.at.localeCompare(left.at));
}

export function getVisibleReviewItems(
  items: ReviewItem[],
  { repoPath, contextId, selectedFilePath }: ReviewItemVisibilityOptions,
): ReviewItem[] {
  const normalizedRepoPath = normalizeRepoPath(repoPath);

  return [...items]
    .filter((item) => item.repoPath === normalizedRepoPath)
    .sort((left, right) => {
      const leftMatchesFile = selectedFilePath !== null && left.filePath === selectedFilePath;
      const rightMatchesFile = selectedFilePath !== null && right.filePath === selectedFilePath;
      if (leftMatchesFile !== rightMatchesFile) {
        return leftMatchesFile ? -1 : 1;
      }

      const leftUnresolved = isUnresolved(left.status);
      const rightUnresolved = isUnresolved(right.status);
      if (leftUnresolved !== rightUnresolved) {
        return leftUnresolved ? -1 : 1;
      }

      const leftMatchesContext = left.contextId === contextId;
      const rightMatchesContext = right.contextId === contextId;
      if (leftMatchesContext !== rightMatchesContext) {
        return leftMatchesContext ? -1 : 1;
      }

      const byUpdatedAt = compareIsoDescending(left.updatedAt, right.updatedAt);
      if (byUpdatedAt !== 0) return byUpdatedAt;

      return compareIsoDescending(left.createdAt, right.createdAt);
    });
}

export function getReviewItemScopeLabel(item: Pick<ReviewItem, "scopeType" | "startLine" | "endLine">): string {
  if (item.scopeType === "file") return "Whole File";
  if (item.startLine === null || item.endLine === null) return "Range";
  if (item.startLine === item.endLine) return `Line ${item.startLine}`;
  return `Lines ${item.startLine}-${item.endLine}`;
}

function defaultHistorySummary(type: ReviewItemHistoryType): string {
  switch (type) {
    case "created":
      return "Created review item";
    case "ai_started":
      return "Started AI edit";
    case "ai_completed":
      return "AI completed workspace update";
    case "reopened":
      return "Reopened review item";
    case "resolved":
      return "Marked resolved";
  }
}

function appendHistoryEntry(
  item: ReviewItem,
  type: ReviewItemHistoryType,
  at: string,
  summary?: string,
): ReviewItemHistoryEntry[] {
  return [...(item.history ?? []), buildReviewItemHistoryEntry(type, at, summary)];
}

function formatFileCount(count: number): string {
  return `${count} ${count === 1 ? "file" : "files"}`;
}
