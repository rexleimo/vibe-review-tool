import "@fontsource/manrope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DiffEditor } from "@monaco-editor/react";
import "./App.css";
import { AiActionPlaceholder } from "./components/AiActionPlaceholder";
import { AiSummarySheet } from "./components/AiSummarySheet";
import { ProviderSettingsSheet } from "./components/ProviderSettingsSheet";
import { ReviewBatchRunDetail } from "./components/ReviewBatchRunDetail";
import { ReviewItemComposer } from "./components/ReviewItemComposer";
import { ReviewItemDetail } from "./components/ReviewItemDetail";
import { ReviewQueue } from "./components/ReviewQueue";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { TopBar } from "./components/TopBar";
import { SideBar } from "./components/SideBar";
import { type AiProvider, useAiProvider } from "./hooks/useAiProvider";
import { type MenuAction, useMenuActions } from "./hooks/useMenuActions";
import { useReviewState } from "./hooks/useReviewState";
import { formatInvokeError } from "./lib/formatInvokeError";
import { buildReviewComposerSuccessFeedback } from "./lib/reviewComposer";
import {
  buildFailedBatchRunPatch,
  buildLocalOrphanedRunOverlay,
  buildReviewBatchBrief,
  buildReviewBatchIssueSnapshots,
  createQueuedBatchRun,
  isReviewBatchBriefTooLarge,
  planQueuedBatchWrite,
  planCompletedBatchWrite,
  planFailedBatchWrite,
  planRunningBatchWrite,
  resolveBatchRunBlockingState,
  type ReviewBatchRun,
  type ReviewBatchRunErrorCode,
  type ReviewBatchRunLocalOverlay,
} from "./lib/reviewBatchRuns";
import {
  type CreateReviewItemInput,
  type ReviewItem,
  buildReviewItemAiCompletedPatch,
  buildReviewItemAiFailedPatch,
  buildReviewItemAiStartedPatch,
  buildReviewContextId,
  buildReviewItemReopenedPatch,
  buildReviewItemResolvedPatch,
  getVisibleReviewItems,
  normalizeReviewRange,
} from "./lib/reviewItems";
import { applyReviewBatchWritePlan } from "./lib/reviewState";
import {
  resolveSelectedReviewItemBusyState,
  type ReviewItemBusyActionOverlay,
} from "./lib/reviewItemDetailLayout";
import {
  resolveReviewPaneMode,
  resolveReviewPanePrimaryAction,
  resolveQueueFooterActions,
  shouldClearSelectedReviewItem,
} from "./lib/reviewPane";

type Mode = "commit" | "workspace";
type WorkspaceMode = "all" | "staged" | "unstaged";
type Locale = "zh-CN" | "en-US";

type CommitNode = {
  sha: string;
  parents: string[];
  author: string;
  date: string;
  subject: string;
  refs: string;
};

type CommitGraphResponse = {
  commits: CommitNode[];
  hasMore: boolean;
};

type ChangedFile = {
  path: string;
  oldPath?: string;
  status: string;
  statusRaw: string;
};

type FileDiffResponse = {
  path: string;
  oldPath?: string;
  status: string;
  isBinary: boolean;
  tooLarge: boolean;
  tooLargeReason?: string;
  oldContent?: string;
  newContent?: string;
};

type SavedProject = {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
};

type PlaceholderState = {
  title: string;
  description: string;
  contextLabel: string;
};

type AiProviderStatus = {
  provider: AiProvider;
  label: string;
  command: string;
  available: boolean;
};

type GenerateSummaryResponse = {
  provider: AiProvider;
  providerLabel: string;
  summary: string;
  truncated: boolean;
};

type SummarySheetState = {
  status: "idle" | "loading" | "success" | "error";
  providerLabel: string;
  summary: string;
  error: string;
  truncated: boolean;
};

type ApplyReviewItemResponse = {
  provider: AiProvider;
  providerLabel: string;
  summary: string;
  changedFiles: string[];
};

type ApplyReviewBatchCommandResponse = {
  ok: boolean;
  provider?: AiProvider;
  providerLabel?: string;
  summary?: string;
  changedFiles?: string[];
  errorCode?: string;
  message?: string;
  retryable?: boolean;
  providerStderr?: string;
};

type LineSelection = {
  startLine: number;
  endLine: number;
};

type ReviewFeedbackToastState = {
  kind: "success" | "error";
  message: string;
};

const PAGE_SIZE = 200;
const DEFAULT_SIDEBAR_WIDTH = 420;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 760;
const DIFF_MIN_WIDTH = 360;
const REVIEW_PANE_WIDTH = 420;
const SIDEBAR_WIDTH_KEY = "review-editor.sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "review-editor.sidebar-collapsed";
const PROJECTS_KEY = "review-editor.projects";
const ACTIVE_PROJECT_KEY = "review-editor.active-project";
const LOCALE_KEY = "review-editor.locale";
const DEFAULT_REPO_PATH = "/Users/molei/review-editor";

const MESSAGES: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    appEyebrow: "REVIEW EDITOR",
    appTitle: "Git 代码评审工作台",
    repository: "仓库路径",
    project: "项目",
    adHocProject: "临时路径（未保存）",
    saveProject: "保存项目",
    updateProject: "更新项目",
    projectCenter: "项目中心",
    commitReview: "提交评审",
    workspaceReview: "工作区评审",
    all: "全部",
    staged: "staged",
    unstaged: "unstaged",
    openRepo: "打开仓库",
    refresh: "刷新",
    focusDiff: "聚焦 Diff",
    showSidebar: "显示侧栏",
    scanFailed: "扫描失败",
    commitsTab: "提交",
    filesTab: "文件",
    commitGraph: "提交图",
    changedFiles: "变更文件",
    loadMore: "加载 +200",
    noMore: "没有更多",
    loading: "加载中...",
    filesCount: "{count} 个文件",
    noCommits: "该仓库路径下没有可展示的提交。",
    noChangedFiles: "没有发现变更文件。",
    diffPreview: "差异预览",
    selectFileHint: "选择一个文件查看分栏 Diff。",
    loadingDiff: "正在加载 Diff...",
    binaryNotice: "这是二进制文件，文本 Diff 预览不可用。",
    forceOpen: "强制打开",
    close: "关闭",
    projectName: "项目名称",
    projectPath: "项目路径",
    open: "打开",
    remove: "移除",
    noProjects: "还没有保存项目。先输入仓库路径再点击“保存项目”。",
    lastOpened: "最近打开：{date}",
    langZh: "中文",
    langEn: "EN",
    choosePath: "选择路径",
    sidebarHiddenHint: "侧栏已隐藏，无法选择提交和文件。",
  },
  "en-US": {
    appEyebrow: "REVIEW EDITOR",
    appTitle: "Git Review Workbench",
    repository: "Repository",
    project: "Project",
    adHocProject: "Ad-hoc path",
    saveProject: "Save Project",
    updateProject: "Update Project",
    projectCenter: "Project Center",
    commitReview: "Commit Review",
    workspaceReview: "Workspace Review",
    all: "all",
    staged: "staged",
    unstaged: "unstaged",
    openRepo: "Open Repo",
    refresh: "Refresh",
    focusDiff: "Focus Diff",
    showSidebar: "Show Sidebar",
    scanFailed: "Scan Failed",
    commitsTab: "Commits",
    filesTab: "Files",
    commitGraph: "Commit Graph",
    changedFiles: "Changed Files",
    loadMore: "Load +200",
    noMore: "No More",
    loading: "Loading...",
    filesCount: "{count} files",
    noCommits: "No commits found for this repository path.",
    noChangedFiles: "No changed files found.",
    diffPreview: "Diff Preview",
    selectFileHint: "Select a file to view split diff.",
    loadingDiff: "Loading diff...",
    binaryNotice: "Binary file detected. Text diff preview is disabled.",
    forceOpen: "Force Open",
    close: "Close",
    projectName: "Project Name",
    projectPath: "Project Path",
    open: "Open",
    remove: "Remove",
    noProjects: "No saved projects yet. Enter a repo path and click Save Project.",
    lastOpened: "Last opened: {date}",
    langZh: "中文",
    langEn: "EN",
    choosePath: "Choose Path",
    sidebarHiddenHint: "Sidebar is hidden. Show it to pick commits and files.",
  },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function detectLanguage(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  return "plaintext";
}

function readSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;

  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_SIDEBAR_WIDTH;
    return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, parsed));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function readSavedProjects(): SavedProject[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SavedProject => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.path === "string" &&
        typeof item.lastOpenedAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function readActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
    return raw || null;
  } catch {
    return null;
  }
}

function readLocale(): Locale {
  if (typeof window === "undefined") return "zh-CN";

  try {
    const raw = window.localStorage.getItem(LOCALE_KEY);
    if (raw === "zh-CN" || raw === "en-US") return raw;
    return "zh-CN";
  } catch {
    return "zh-CN";
  }
}

function sortProjects(items: SavedProject[]): SavedProject[] {
  return [...items].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}

function projectNameFromPath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, "");
  if (!trimmed) return "repo";
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "repo";
}

function pathHintFromPath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, "");
  if (!trimmed) return "";
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return trimmed;
  return `.../${parts.slice(-2).join("/")}`;
}

function createProjectId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createBatchRunId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveInitialRepo(): string {
  const projects = readSavedProjects();
  const activeProjectId = readActiveProjectId();
  const active = projects.find((item) => item.id === activeProjectId);
  return active?.path ?? DEFAULT_REPO_PATH;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_matched, token: string) => {
    const value = vars[token];
    return value === undefined ? "" : String(value);
  });
}

function providerFallbackLabel(provider: AiProvider): string {
  switch (provider) {
    case "codex":
      return "Codex CLI";
    case "claude":
      return "Claude Code";
    case "gemini":
      return "Gemini CLI";
    case "opencode":
      return "OpenCode";
  }
}

function normalizeBatchRunErrorCode(
  errorCode: ApplyReviewBatchCommandResponse["errorCode"] | ReviewBatchRunErrorCode,
): ReviewBatchRunErrorCode {
  switch (errorCode) {
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
      return errorCode;
    default:
      return "provider_execution_failed";
  }
}

function App() {
  const { provider: aiProvider, setProvider: setAiProvider } = useAiProvider();
  const {
    items: reviewItems,
    batchRuns,
    createReviewItem,
    updateReviewItem,
    deleteReviewItem,
    replaceReviewState,
    reload: reloadReviewState,
  } = useReviewState();
  const [locale, _setLocale] = useState<Locale>(readLocale);
  const [projects, setProjects] = useState<SavedProject[]>(readSavedProjects);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(readActiveProjectId);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [showProjectCenter, setShowProjectCenter] = useState(false);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<AiProviderStatus[]>([]);
  const [providerStatusesLoading, setProviderStatusesLoading] = useState(false);

  const [repoDraft, setRepoDraft] = useState(resolveInitialRepo);
  const [repo, setRepo] = useState(resolveInitialRepo);
  const [mode, setMode] = useState<Mode>("commit");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("all");

  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [draggingSidebar, setDraggingSidebar] = useState(false);
  const workbenchRef = useRef<HTMLElement | null>(null);
  const diffPanelRef = useRef<HTMLElement | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const diffSelectionListenerRef = useRef<{ dispose: () => void } | null>(null);
  const pendingFocusFilePathRef = useRef<string | null>(null);

  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [_hasMoreCommits, setHasMoreCommits] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);

  const [diff, setDiff] = useState<FileDiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");
  const [forceOpen, setForceOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<LineSelection | null>(null);
  const [placeholder, setPlaceholder] = useState<PlaceholderState | null>(null);
  const [summarySheet, setSummarySheet] = useState<SummarySheetState | null>(null);
  const [reviewFeedbackToast, setReviewFeedbackToast] = useState<ReviewFeedbackToastState | null>(null);
  const [composerDraft, setComposerDraft] = useState<CreateReviewItemInput | null>(null);
  const [composerMode, setComposerMode] = useState<"create" | "edit">("create");
  const [editingReviewItemId, setEditingReviewItemId] = useState<string | null>(null);
  const [selectedReviewItemId, setSelectedReviewItemId] = useState<string | null>(null);
  const [selectedBatchRunId, setSelectedBatchRunId] = useState<string | null>(null);
  const [reviewItemBusyAction, setReviewItemBusyAction] = useState<ReviewItemBusyActionOverlay | null>(null);
  const [localBatchFailures, setLocalBatchFailures] = useState<ReviewBatchRunLocalOverlay[]>([]);
  const [localBatchRunDetails, setLocalBatchRunDetails] = useState<ReviewBatchRun[]>([]);

  useEffect(() => {
    if (!showProjectCenter) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setShowProjectCenter(false);
    };

    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => projectNameInputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showProjectCenter]);

  const activeProject = useMemo(
    () => projects.find((item) => item.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );
  const selectedCommitNode = useMemo(
    () => commits.find((item) => item.sha === selectedCommit) ?? null,
    [commits, selectedCommit],
  );

  const currentPathProject = useMemo(() => {
    const path = repoDraft.trim();
    return projects.find((item) => item.path === path) ?? null;
  }, [projects, repoDraft]);
  const currentProviderStatus = useMemo(
    () => providerStatuses.find((item) => item.provider === aiProvider) ?? null,
    [providerStatuses, aiProvider],
  );
  const currentReviewContextId = useMemo(
    () =>
      buildReviewContextId({
        repoPath: repo,
        contextMode: mode,
        commitSha: mode === "commit" ? selectedCommit : null,
        workspaceMode: mode === "workspace" ? workspaceMode : null,
      }),
    [repo, mode, selectedCommit, workspaceMode],
  );
  const visibleReviewItems = useMemo(
    () =>
      getVisibleReviewItems(reviewItems, {
        repoPath: repo,
        contextId: currentReviewContextId,
        selectedFilePath: selectedFile?.path ?? null,
      }),
    [currentReviewContextId, repo, reviewItems, selectedFile?.path],
  );
  const selectedReviewItem = useMemo(
    () => reviewItems.find((item) => item.id === selectedReviewItemId) ?? null,
    [reviewItems, selectedReviewItemId],
  );
  const selectedReviewItemBusyState = useMemo(
    () =>
      resolveSelectedReviewItemBusyState({
        selectedItemId: selectedReviewItemId,
        overlay: reviewItemBusyAction,
      }),
    [reviewItemBusyAction, selectedReviewItemId],
  );
  const visibleOpenItems = useMemo(
    () => visibleReviewItems.filter((item) => item.status === "open"),
    [visibleReviewItems],
  );
  const selectedBatchRun = useMemo(
    () => localBatchRunDetails.find((batchRun) => batchRun.id === selectedBatchRunId)
      ?? batchRuns.find((batchRun) => batchRun.id === selectedBatchRunId)
      ?? null,
    [batchRuns, localBatchRunDetails, selectedBatchRunId],
  );
  const editingReviewItem = useMemo(
    () => reviewItems.find((item) => item.id === editingReviewItemId) ?? null,
    [editingReviewItemId, reviewItems],
  );
  const currentContextBlockingState = useMemo(() => {
    if (!repo.trim()) {
      return {
        blocked: false,
        reason: "none" as const,
        activeItemId: null,
        activeBatchRunId: null,
      };
    }

    return resolveBatchRunBlockingState({
      repoPath: repo,
      contextId: currentReviewContextId,
      items: reviewItems,
      batchRuns,
      localFailures: localBatchFailures,
    });
  }, [batchRuns, currentReviewContextId, localBatchFailures, repo, reviewItems]);
  const selectedReviewItemBlockingState = useMemo(() => {
    if (!selectedReviewItem) {
      return {
        blocked: false,
        reason: "none" as const,
        activeItemId: null,
        activeBatchRunId: null,
      };
    }

    return resolveBatchRunBlockingState({
      repoPath: selectedReviewItem.repoPath,
      contextId: selectedReviewItem.contextId,
      items: reviewItems,
      batchRuns,
      localFailures: localBatchFailures,
    });
  }, [batchRuns, localBatchFailures, reviewItems, selectedReviewItem]);
  const reviewPaneMode = useMemo(
    () => resolveReviewPaneMode({
      selectedItemId: selectedReviewItemId,
      selectedBatchRunId,
    }),
    [selectedBatchRunId, selectedReviewItemId],
  );
  const reviewPrimaryAction = useMemo(
    () =>
      resolveReviewPanePrimaryAction({
        selectedItemId: selectedReviewItemId,
        selectedBatchRunId,
        selectedFilePath: selectedFile?.path ?? null,
        hasSelectedRange: selectedRange !== null,
      }),
    [selectedBatchRunId, selectedFile?.path, selectedRange, selectedReviewItemId],
  );
  const queueFooterActions = useMemo(
    () =>
      resolveQueueFooterActions({
        visibleOpenCount: visibleOpenItems.length,
        createDisabled: reviewPrimaryAction.disabled,
        batchBlocked: currentContextBlockingState.blocked,
      }),
    [currentContextBlockingState.blocked, reviewPrimaryAction.disabled, visibleOpenItems.length],
  );

  const hasProject = repo && repo.trim().length > 0;
  const titlebarMeta = useMemo(() => {
    if (!hasProject) return "Review Editor";
    if (mode === "workspace") {
      const workspaceLabel =
        workspaceMode === "unstaged"
          ? "unstaged changes"
          : workspaceMode === "staged"
            ? "staged changes"
            : "all changes";
      return `Workspace Review · ${workspaceLabel}`;
    }
    return selectedCommitNode
      ? `Commit Review · ${selectedCommitNode.subject}`
      : "Commit Review";
  }, [hasProject, mode, selectedCommitNode, workspaceMode]);

  const titlebarHeadline = useMemo(() => {
    if (!hasProject) return "Open a repository to start reviewing";
    if (selectedFile?.path) return selectedFile.path;
    if (selectedCommitNode?.subject) return selectedCommitNode.subject;
    return activeProject?.name ?? "Review Editor";
  }, [activeProject?.name, hasProject, selectedCommitNode, selectedFile?.path]);

  function choosePreferredFile(nextFiles: ChangedFile[]): ChangedFile | null {
    const preferredPath = pendingFocusFilePathRef.current ?? selectedFile?.path ?? null;
    pendingFocusFilePathRef.current = null;
    if (!preferredPath) return nextFiles[0] ?? null;
    return nextFiles.find((item) => item.path === preferredPath) ?? nextFiles[0] ?? null;
  }

  function makeReviewItemDraft(
    scopeType: CreateReviewItemInput["scopeType"],
    filePath: string,
    startLine: number | null,
    endLine: number | null,
  ): CreateReviewItemInput {
    return {
      repoPath: repo,
      contextMode: mode,
      commitSha: mode === "commit" ? selectedCommit : null,
      workspaceMode: mode === "workspace" ? workspaceMode : null,
      scopeType,
      filePath,
      startLine,
      endLine,
      title: "",
      note: "",
    };
  }

  function upsertLocalBatchRunDetail(batchRun: ReviewBatchRun): void {
    setLocalBatchRunDetails((prev) => [
      batchRun,
      ...prev.filter((entry) => entry.id !== batchRun.id),
    ]);
  }

  function upsertLocalBatchFailureOverlay(overlay: ReviewBatchRunLocalOverlay): void {
    setLocalBatchFailures((prev) => [
      overlay,
      ...prev.filter((entry) => entry.batchRunId !== overlay.batchRunId),
    ]);
  }

  function clearLocalBatchArtifacts(batchRunId: string): void {
    setLocalBatchFailures((prev) => prev.filter((entry) => entry.batchRunId !== batchRunId));
    setLocalBatchRunDetails((prev) => prev.filter((entry) => entry.id !== batchRunId));
  }

  function buildLocalBatchFailureOverlay(
    batchRun: ReviewBatchRun,
    {
      errorCode,
      message,
      retryable,
    }: {
      errorCode: ReviewBatchRunLocalOverlay["errorCode"];
      message: string;
      retryable: boolean;
    },
  ): ReviewBatchRunLocalOverlay {
    if (errorCode === "orphaned_run") {
      return buildLocalOrphanedRunOverlay({
        batchRunId: batchRun.id,
        repoPath: batchRun.repoPath,
        contextId: batchRun.contextId,
        message,
        retryable,
      });
    }

    return {
      ok: false,
      source: "local",
      batchRunId: batchRun.id,
      repoPath: batchRun.repoPath,
      contextId: batchRun.contextId,
      status: "failed",
      errorCode,
      message,
      retryable,
    };
  }

  function buildLocalFailedBatchRun(
    batchRun: ReviewBatchRun,
    {
      message,
      errorCode,
      retryable,
      at = new Date().toISOString(),
    }: {
      message: string;
      errorCode: ReviewBatchRunErrorCode | ApplyReviewBatchCommandResponse["errorCode"];
      retryable: boolean;
      at?: string;
    },
  ): ReviewBatchRun {
    return {
      ...batchRun,
      ...buildFailedBatchRunPatch({
        lastError: message,
        errorCode: normalizeBatchRunErrorCode(errorCode),
        retryable,
        at,
      }),
    };
  }

  async function persistBatchWritePlan(batchRun: ReviewBatchRun, writePlan: Parameters<typeof applyReviewBatchWritePlan>[1]): Promise<void> {
    clearLocalBatchArtifacts(batchRun.id);
    await replaceReviewState((state) => applyReviewBatchWritePlan(state, writePlan));
  }

  function handleProjectSelect(path: string, name: string): void {
    setRepoDraft(path);
    setRepo(path);
    setSidebarCollapsed(false);
    const matched = projects.find((item) => item.path === path);
    if (matched) {
      setActiveProjectId(matched.id);
    } else {
      const now = new Date().toISOString();
      const nextProject: SavedProject = {
        id: createProjectId(),
        name,
        path,
        lastOpenedAt: now,
      };
      setProjects((prev) => sortProjects([nextProject, ...prev]));
      setActiveProjectId(nextProject.id);
    }
  }

  function openPlaceholder(title: string, description: string): void {
    const contextValue = selectedFile?.path ?? selectedCommit ?? repo;
    const contextLabel = contextValue || "当前没有可用上下文";
    setSummarySheet(null);
    setPlaceholder({
      title,
      description,
      contextLabel,
    });
  }

  async function loadProviderStatuses(): Promise<AiProviderStatus[]> {
    setProviderStatusesLoading(true);
    try {
      const response = await invoke<AiProviderStatus[]>("get_ai_provider_statuses");
      setProviderStatuses(response);
      return response;
    } finally {
      setProviderStatusesLoading(false);
    }
  }

  async function openProviderSettings(): Promise<void> {
    setShowProviderSettings(true);
    try {
      await loadProviderStatuses();
    } catch (error) {
      console.error("Failed to load AI provider statuses:", error);
    }
  }

  async function handleProviderSelect(nextProvider: AiProvider): Promise<void> {
    try {
      await setAiProvider(nextProvider);
    } catch (error) {
      console.error("Failed to save AI provider:", error);
    }
  }

  function openFileReviewComposer(filePath = selectedFile?.path ?? null): void {
    if (!filePath) return;
    setComposerMode("create");
    setEditingReviewItemId(null);
    setComposerDraft(makeReviewItemDraft("file", filePath, null, null));
  }

  function openRangeReviewComposer(): void {
    if (!selectedFile || !selectedRange) return;
    setComposerMode("create");
    setEditingReviewItemId(null);
    setComposerDraft(
      makeReviewItemDraft(
        "range",
        selectedFile.path,
        selectedRange.startLine,
        selectedRange.endLine,
      ),
    );
  }

  function handlePrimaryCreateReviewItem(): void {
    if (reviewPrimaryAction.kind === "range") {
      openRangeReviewComposer();
      return;
    }

    if (reviewPrimaryAction.kind === "file") {
      openFileReviewComposer();
    }
  }

  function openEditReviewItem(item: ReviewItem): void {
    setComposerMode("edit");
    setEditingReviewItemId(item.id);
    setComposerDraft({
      repoPath: item.repoPath,
      contextMode: item.contextMode,
      commitSha: item.commitSha,
      workspaceMode: item.workspaceMode,
      scopeType: item.scopeType,
      filePath: item.filePath,
      startLine: item.startLine,
      endLine: item.endLine,
      title: item.title,
      note: item.note,
    });
  }

  function closeReviewComposer(): void {
    setComposerDraft(null);
    setEditingReviewItemId(null);
    setComposerMode("create");
  }

  async function handleSubmitReviewItem(payload: { title: string; note: string }): Promise<{
    selectedReviewItemId: string;
    toastMessage: string;
  }> {
    if (!composerDraft) {
      throw new Error("missing review item draft");
    }

    if (composerMode === "edit" && editingReviewItemId) {
      await updateReviewItem(editingReviewItemId, {
        title: payload.title,
        note: payload.note,
      });
      return buildReviewComposerSuccessFeedback({
        mode: "edit",
        itemId: editingReviewItemId,
        title: payload.title,
      });
    }

    const created = await createReviewItem({
      ...composerDraft,
      title: payload.title,
      note: payload.note,
    });

    return buildReviewComposerSuccessFeedback({
      mode: "create",
      itemId: created.id,
      title: payload.title,
    });
  }

  async function handleComposerSubmit(payload: { title: string; note: string }): Promise<void> {
    if (!composerDraft) return;

    const draftSnapshot = composerDraft;
    const modeSnapshot = composerMode;
    const editingReviewItemIdSnapshot = editingReviewItemId;

    try {
      const feedback = await handleSubmitReviewItem(payload);
      setSelectedBatchRunId(null);
      setSelectedReviewItemId(feedback.selectedReviewItemId);
      setReviewFeedbackToast({
        kind: "success",
        message: feedback.toastMessage,
      });
    } catch (error) {
      setComposerDraft({
        ...draftSnapshot,
        title: payload.title,
        note: payload.note,
      });
      setEditingReviewItemId(editingReviewItemIdSnapshot);
      setComposerMode(modeSnapshot);
      setReviewFeedbackToast({
        kind: "error",
        message: `保存 Review Item 失败：${formatInvokeError(error)}`,
      });
    }
  }

  async function generateReviewSummary(): Promise<void> {
    if (!repo.trim()) return;

    setPlaceholder(null);
    const initialLabel = currentProviderStatus?.label ?? providerFallbackLabel(aiProvider);
    setSummarySheet({
      status: "loading",
      providerLabel: initialLabel,
      summary: "",
      error: "",
      truncated: false,
    });

    try {
      const statuses = await loadProviderStatuses();
      const selectedStatus = statuses.find((item) => item.provider === aiProvider);
      const resolvedLabel = selectedStatus?.label ?? initialLabel;

      if (selectedStatus && !selectedStatus.available) {
        throw new Error(`${resolvedLabel} 当前不可用，请先在 Settings 里切换 provider。`);
      }

      const response = await invoke<GenerateSummaryResponse>("generate_review_summary", {
        req: {
          repo,
          provider: aiProvider,
          mode,
          workspaceMode: mode === "workspace" ? workspaceMode : null,
          selectedCommitSha: mode === "commit" ? selectedCommit : null,
        },
      });

      setSummarySheet({
        status: "success",
        providerLabel: response.providerLabel,
        summary: response.summary,
        error: "",
        truncated: response.truncated,
      });
    } catch (error) {
      setSummarySheet({
        status: "error",
        providerLabel: initialLabel,
        summary: "",
        error: error instanceof Error ? error.message : String(error),
        truncated: false,
      });
    }
  }

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const template = MESSAGES[locale][key] ?? MESSAGES["en-US"][key] ?? key;
    return interpolate(template, vars);
  };

  async function loadCommitGraph(offset: number, append: boolean): Promise<void> {
    setGraphLoading(true);
    setGraphError("");

    try {
      const response = await invoke<CommitGraphResponse>("get_commit_graph", {
        req: {
          repo,
          limit: PAGE_SIZE,
          offset,
        },
      });

      setHasMoreCommits(response.hasMore);
      if (append) {
        setCommits((prev) => [...prev, ...response.commits]);
      } else {
        setCommits(response.commits);
        setSelectedCommit(response.commits[0]?.sha ?? null);
      }
    } catch (err) {
      setGraphError(String(err));
      setCommits([]);
      setHasMoreCommits(false);
      setSelectedCommit(null);
      setFiles([]);
      setSelectedFile(null);
      setDiff(null);
    } finally {
      setGraphLoading(false);
    }
  }

  async function loadWorkspaceFiles(): Promise<void> {
    setFilesLoading(true);
    setDiff(null);
    setDiffError("");
    setGraphError("");

    try {
      const response = await invoke<ChangedFile[]>("get_workspace_files", {
        req: {
          repo,
          mode: workspaceMode,
        },
      });
      setFiles(response);
      setSelectedFile(choosePreferredFile(response));
    } catch (err) {
      setFiles([]);
      setSelectedFile(null);
      setDiff(null);
      setGraphError(String(err));
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadCommitFiles(commitSha: string): Promise<void> {
    setFilesLoading(true);
    setFiles([]);
    setSelectedFile(null);
    setDiff(null);
    setDiffError("");

    try {
      const response = await invoke<ChangedFile[]>("get_commit_files", {
        req: {
          repo,
          commitSha,
        },
      });
      setFiles(response);
      setSelectedFile(choosePreferredFile(response));
    } catch (err) {
      setFiles([]);
      setSelectedFile(null);
      setDiff(null);
      setDiffError(String(err));
    } finally {
      setFilesLoading(false);
    }
  }

  async function refreshCurrentContext(): Promise<void> {
    setForceOpen(false);
    setDiff(null);
    setDiffError("");

    if (mode === "commit") {
      if (selectedCommit) {
        await loadCommitFiles(selectedCommit);
      }
      return;
    }

    await loadWorkspaceFiles();
  }

  async function fetchDiffForFile(currentFile: ChangedFile, force: boolean): Promise<FileDiffResponse> {
    if (mode === "commit") {
      if (!selectedCommit) {
        throw new Error("missing selected commit");
      }

      return invoke<FileDiffResponse>("get_commit_file_diff", {
        req: {
          repo,
          commitSha: selectedCommit,
          path: currentFile.path,
          oldPath: currentFile.oldPath,
          status: currentFile.status,
          force,
        },
      });
    }

    return invoke<FileDiffResponse>("get_workspace_file_diff", {
      req: {
        repo,
        mode: workspaceMode,
        path: currentFile.path,
        oldPath: currentFile.oldPath,
        status: currentFile.status,
        force,
      },
    });
  }

  async function fetchReviewItemDiff(item: ReviewItem): Promise<{ file: ChangedFile; diff: FileDiffResponse }> {
    if (item.contextMode === "commit") {
      if (!item.commitSha) {
        throw new Error("This review item is missing its commit anchor.");
      }

      const itemFiles = await invoke<ChangedFile[]>("get_commit_files", {
        req: {
          repo,
          commitSha: item.commitSha,
        },
      });
      const currentFile = itemFiles.find((file) => file.path === item.filePath);
      if (!currentFile) {
        throw new Error("The review item file is no longer available in this commit context.");
      }

      const itemDiff = await invoke<FileDiffResponse>("get_commit_file_diff", {
        req: {
          repo,
          commitSha: item.commitSha,
          path: currentFile.path,
          oldPath: currentFile.oldPath,
          status: currentFile.status,
          force: false,
        },
      });

      return {
        file: currentFile,
        diff: itemDiff,
      };
    }

    const itemWorkspaceMode = item.workspaceMode ?? "all";
    const itemFiles = await invoke<ChangedFile[]>("get_workspace_files", {
      req: {
        repo,
        mode: itemWorkspaceMode,
      },
    });
    const currentFile = itemFiles.find((file) => file.path === item.filePath);
    if (!currentFile) {
      throw new Error("The review item file is no longer available in the workspace view.");
    }

    const itemDiff = await invoke<FileDiffResponse>("get_workspace_file_diff", {
      req: {
        repo,
        mode: itemWorkspaceMode,
        path: currentFile.path,
        oldPath: currentFile.oldPath,
        status: currentFile.status,
        force: false,
      },
    });

    return {
      file: currentFile,
      diff: itemDiff,
    };
  }

  async function loadDiff(currentFile: ChangedFile, force: boolean): Promise<void> {
    setDiffLoading(true);
    setDiffError("");

    try {
      const response = await fetchDiffForFile(currentFile, force);
      setDiff(response);
    } catch (err) {
      setDiff(null);
      setDiffError(String(err));
    } finally {
      setDiffLoading(false);
    }
  }

  function reloadCurrentMode(): void {
    setForceOpen(false);
    setDiff(null);
    setDiffError("");
    setFiles([]);
    setSelectedFile(null);
    setCommits([]);
    setHasMoreCommits(false);
    setSelectedCommit(null);

    if (mode === "commit") {
      void loadCommitGraph(0, false);
    } else {
      void loadWorkspaceFiles();
    }
  }

  function openProject(projectId: string): void {
    const target = projects.find((item) => item.id === projectId);
    if (!target) return;

    const now = new Date().toISOString();
    setProjects((prev) => {
      const next = prev.map((item) => {
        if (item.id === target.id) {
          return {
            ...item,
            lastOpenedAt: now,
          };
        }
        return item;
      });
      return sortProjects(next);
    });

    setActiveProjectId(target.id);
    setRepoDraft(target.path);
    setRepo(target.path);
    setSidebarCollapsed(false);
    setShowProjectCenter(false);
  }

  async function chooseRepoPath(): Promise<void> {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: repoDraft.trim() || undefined,
      });

      if (typeof selected !== "string" || !selected.trim()) return;
      setRepoDraft(selected);
      if (!projectNameDraft.trim()) {
        setProjectNameDraft(projectNameFromPath(selected));
      }
    } catch (err) {
      setGraphError(String(err));
    }
  }

  function saveCurrentProject(): void {
    const path = repoDraft.trim();
    if (!path) return;

    const now = new Date().toISOString();
    const byPath = projects.find((item) => item.path === path);
    const resolvedName =
      projectNameDraft.trim() || byPath?.name || projectNameFromPath(path);

    if (byPath) {
      setProjects((prev) => {
        const next = prev.map((item) => {
          if (item.id === byPath.id) {
            return {
              ...item,
              name: resolvedName,
              lastOpenedAt: now,
            };
          }
          return item;
        });
        return sortProjects(next);
      });
      setActiveProjectId(byPath.id);
    } else {
      const nextProject: SavedProject = {
        id: createProjectId(),
        name: resolvedName,
        path,
        lastOpenedAt: now,
      };
      setProjects((prev) => sortProjects([nextProject, ...prev]));
      setActiveProjectId(nextProject.id);
    }

    setRepo(path);
    setProjectNameDraft("");
  }

  async function openRepoDirectly(): Promise<void> {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: repoDraft.trim() || undefined,
        title: "选择 Git 仓库目录",
      });

      if (typeof selected !== "string" || !selected.trim()) return;
      handleProjectSelect(selected, projectNameFromPath(selected));
    } catch (err) {
      setGraphError(String(err));
    }
  }

  function closeProject(): void {
    setShowProjectCenter(false);
    setRepo("");
    setRepoDraft("");
    setActiveProjectId(null);
    setProjectNameDraft("");
    setCommits([]);
    setHasMoreCommits(false);
    setGraphError("");
    setSelectedCommit(null);
    setFiles([]);
    setFilesLoading(false);
    setSelectedFile(null);
    setDiff(null);
    setDiffError("");
    setForceOpen(false);
    setSelectedRange(null);
    setPlaceholder(null);
    setSummarySheet(null);
    setComposerDraft(null);
    setComposerMode("create");
    setEditingReviewItemId(null);
    setSelectedReviewItemId(null);
    setSelectedBatchRunId(null);
    setReviewItemBusyAction(null);
    setLocalBatchFailures([]);
    setLocalBatchRunDetails([]);
    setShowProviderSettings(false);
    setSidebarCollapsed(false);
  }

  function focusDiffPanel(): void {
    diffPanelRef.current?.scrollIntoView({ block: "nearest" });
    diffPanelRef.current?.focus();
  }

  function resetLayout(): void {
    setSidebarCollapsed(false);
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  }

  function moveFileSelection(direction: 1 | -1): void {
    if (files.length === 0) return;

    const currentIndex = selectedFile
      ? files.findIndex((item) => item.path === selectedFile.path)
      : -1;
    const baseIndex = currentIndex === -1 ? (direction > 0 ? 0 : files.length - 1) : currentIndex;
    const nextIndex = Math.max(0, Math.min(files.length - 1, baseIndex + direction));
    setForceOpen(false);
    setSelectedFile(files[nextIndex] ?? null);
  }

  function removeProject(projectId: string): void {
    setProjects((prev) => prev.filter((item) => item.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  }

  useEffect(() => {
    reloadCurrentMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, mode, workspaceMode]);

  useEffect(() => {
    setSidebarCollapsed(false);
  }, [mode]);

  useEffect(() => {
    if (mode !== "commit") return;
    if (!selectedCommit) {
      setFiles([]);
      setSelectedFile(null);
      return;
    }
    setForceOpen(false);
    void loadCommitFiles(selectedCommit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedCommit]);

  useEffect(() => {
    if (!selectedFile) {
      setDiff(null);
      setDiffError("");
      return;
    }
    void loadDiff(selectedFile, forceOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, forceOpen, mode, workspaceMode, selectedCommit]);

  useEffect(() => {
    setSelectedRange(null);
  }, [selectedFile?.path, diff?.path]);

  useEffect(() => {
    return () => {
      diffSelectionListenerRef.current?.dispose();
      diffSelectionListenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (shouldClearSelectedReviewItem(selectedReviewItemId, selectedReviewItem !== null)) {
      setSelectedReviewItemId(null);
    }
  }, [selectedReviewItem, selectedReviewItemId]);

  useEffect(() => {
    if (!reviewFeedbackToast) return;
    const timeoutId = window.setTimeout(() => {
      setReviewFeedbackToast(null);
    }, 2200);
    return () => window.clearTimeout(timeoutId);
  }, [reviewFeedbackToast]);

  useEffect(() => {
    if (selectedBatchRunId !== null && selectedBatchRun === null) {
      setSelectedBatchRunId(null);
    }
  }, [selectedBatchRun, selectedBatchRunId]);

  useEffect(() => {
    if (!selectedReviewItem || selectedReviewItem.scopeType !== "range") return;
    if (selectedFile?.path !== selectedReviewItem.filePath) return;

    const modifiedEditor = diffEditorRef.current?.getModifiedEditor();
    const model = modifiedEditor?.getModel();
    if (!modifiedEditor || !model) return;

    const normalizedRange = normalizeReviewRange(
      selectedReviewItem.startLine,
      selectedReviewItem.endLine,
    );
    if (!normalizedRange) return;

    const startLine = Math.min(normalizedRange.startLine, model.getLineCount());
    const endLine = Math.min(normalizedRange.endLine, model.getLineCount());
    modifiedEditor.setSelection({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: model.getLineMaxColumn(endLine),
    });
    modifiedEditor.revealLinesInCenter(startLine, endLine);
  }, [selectedFile?.path, selectedReviewItem, diff?.path]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // Ignore localStorage write failures in restricted environments.
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      // Ignore localStorage write failures in restricted environments.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch {
      // Ignore localStorage write failures in restricted environments.
    }
  }, [projects]);

  useEffect(() => {
    try {
      if (activeProjectId) {
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
      } else {
        window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch {
      // Ignore localStorage write failures in restricted environments.
    }
  }, [activeProjectId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      // Ignore localStorage write failures in restricted environments.
    }
  }, [locale]);

  useEffect(() => {
    if (!draggingSidebar || sidebarCollapsed) return;

    const onMouseMove = (event: MouseEvent) => {
      const container = workbenchRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const maxFromContainer = Math.max(
        MIN_SIDEBAR_WIDTH,
        rect.width - DIFF_MIN_WIDTH - REVIEW_PANE_WIDTH,
      );
      const maxWidth = Math.min(MAX_SIDEBAR_WIDTH, maxFromContainer);
      const relativeX = event.clientX - rect.left;
      const nextWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, relativeX));
      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      setDraggingSidebar(false);
    };

    document.body.classList.add("is-resizing");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [draggingSidebar, sidebarCollapsed]);

  function handleDiffEditorMount(editorInstance: editor.IStandaloneDiffEditor): void {
    diffEditorRef.current = editorInstance;
    diffSelectionListenerRef.current?.dispose();

    const modifiedEditor = editorInstance.getModifiedEditor();
    const syncSelection = () => {
      const selection = modifiedEditor.getSelection();
      if (!selection || selection.isEmpty()) {
        setSelectedRange(null);
        return;
      }

      const normalizedRange = normalizeReviewRange(
        selection.startLineNumber,
        selection.endLineNumber,
      );
      setSelectedRange(normalizedRange);
    };

    diffSelectionListenerRef.current = modifiedEditor.onDidChangeCursorSelection(() => {
      syncSelection();
    });
    syncSelection();
  }

  function handleJumpToReviewItem(item: ReviewItem): void {
    setSelectedReviewItemId(item.id);
    pendingFocusFilePathRef.current = item.filePath;

    if (item.contextMode === "commit" && item.commitSha) {
      if (mode === "commit" && selectedCommit === item.commitSha) {
        const nextFile = files.find((file) => file.path === item.filePath);
        if (nextFile) {
          setSelectedFile(nextFile);
        } else {
          void loadCommitFiles(item.commitSha);
        }
        return;
      }
      setMode("commit");
      setSelectedCommit(item.commitSha);
      setSidebarCollapsed(false);
      return;
    }

    if (mode === "workspace" && workspaceMode === (item.workspaceMode ?? "all")) {
      const nextFile = files.find((file) => file.path === item.filePath);
      if (nextFile) {
        setSelectedFile(nextFile);
      } else {
        void loadWorkspaceFiles();
      }
      return;
    }

    setWorkspaceMode(item.workspaceMode ?? "all");
    setMode("workspace");
    setSidebarCollapsed(false);
  }

  async function handleResolveReviewItem(item: ReviewItem): Promise<void> {
    if (item.status === "ai_editing" || item.status === "resolved") return;
    await updateReviewItem(item.id, buildReviewItemResolvedPatch(item));
  }

  async function handleReopenReviewItem(item: ReviewItem): Promise<void> {
    if (item.status === "ai_editing") return;
    await updateReviewItem(item.id, buildReviewItemReopenedPatch(item));
  }

  async function handleDeleteReviewItem(item: ReviewItem): Promise<void> {
    if (item.status === "ai_editing") return;
    await deleteReviewItem(item.id);
    if (editingReviewItemId === item.id) {
      setEditingReviewItemId(null);
      setComposerDraft(null);
      setComposerMode("create");
    }
    if (selectedReviewItemId === item.id) {
      setSelectedReviewItemId(null);
    }
  }

  async function handleSendOpenIssuesToCodex(): Promise<void> {
    if (!repo.trim() || visibleOpenItems.length === 0 || currentContextBlockingState.blocked) return;

    const includedItems = visibleOpenItems.filter((item) => item.status === "open");
    if (includedItems.length === 0) return;

    const issueSnapshots = buildReviewBatchIssueSnapshots(includedItems);
    const { briefText, byteLength } = buildReviewBatchBrief({
      repoPath: repo,
      contextMode: mode,
      workspaceMode: mode === "workspace" ? workspaceMode : null,
      commitSha: mode === "commit" ? selectedCommit : null,
      issueSnapshots,
    });
    const batchRun = createQueuedBatchRun({
      id: createBatchRunId(),
      repoPath: repo,
      contextId: currentReviewContextId,
      issueIds: includedItems.map((item) => item.id),
      issueSnapshots,
      briefText,
    });

    setSelectedReviewItemId(null);
    setSelectedBatchRunId(batchRun.id);

    if (isReviewBatchBriefTooLarge(briefText)) {
      upsertLocalBatchRunDetail(buildLocalFailedBatchRun(batchRun, {
        message: `当前 ${includedItems.length} 条 Open Issues 生成的 brief 超过 24000 bytes（当前 ${byteLength} bytes），请缩小范围后重试。`,
        errorCode: "brief_too_large",
        retryable: true,
      }));
      return;
    }

    let resolvedProviderLabel = providerFallbackLabel("codex");

    try {
      const statuses = await loadProviderStatuses();
      const codexStatus = statuses.find((status) => status.provider === "codex");
      resolvedProviderLabel = codexStatus?.label ?? resolvedProviderLabel;
      if (codexStatus && !codexStatus.available) {
        upsertLocalBatchRunDetail(buildLocalFailedBatchRun(batchRun, {
          message: `${resolvedProviderLabel} 当前不可用，请先检查系统安装或在 Settings 里修正 provider。`,
          errorCode: "provider_unavailable",
          retryable: true,
        }));
        return;
      }
    } catch (error) {
      upsertLocalBatchRunDetail(buildLocalFailedBatchRun(batchRun, {
        message: `无法确认 ${resolvedProviderLabel} 是否可用：${formatInvokeError(error)}`,
        errorCode: "provider_unavailable",
        retryable: true,
      }));
      return;
    }

    try {
      await persistBatchWritePlan(batchRun, planQueuedBatchWrite(batchRun));
    } catch (error) {
      await reloadReviewState();
      upsertLocalBatchRunDetail(buildLocalFailedBatchRun(batchRun, {
        message: `批量任务写入本地状态失败：${formatInvokeError(error)}`,
        errorCode: "persistence_failed",
        retryable: true,
      }));
      setSelectedBatchRunId(batchRun.id);
      return;
    }

    const runningPlan = planRunningBatchWrite({
      batchRun,
      items: includedItems,
      providerLabel: resolvedProviderLabel,
    });

    try {
      await persistBatchWritePlan(batchRun, runningPlan);
    } catch (error) {
      await reloadReviewState();
      const message = `批量任务开始前，本地状态写入失败：${formatInvokeError(error)}`;
      const overlay = buildLocalBatchFailureOverlay(batchRun, {
        errorCode: "persistence_failed",
        message,
        retryable: true,
      });
      upsertLocalBatchFailureOverlay(overlay);
      upsertLocalBatchRunDetail(buildLocalFailedBatchRun(runningPlan.batchRun, {
        message,
        errorCode: overlay.errorCode,
        retryable: overlay.retryable,
      }));
      setSelectedBatchRunId(batchRun.id);
      return;
    }

    let response: ApplyReviewBatchCommandResponse;

    try {
      response = await invoke<ApplyReviewBatchCommandResponse>("apply_review_batch", {
        req: {
          repo,
          provider: "codex",
          contextId: currentReviewContextId,
          contextMode: mode,
          workspaceMode: mode === "workspace" ? workspaceMode : null,
          commitSha: mode === "commit" ? selectedCommit : null,
          batchRunId: batchRun.id,
          issueIds: batchRun.issueIds,
          issueSnapshots: batchRun.issueSnapshots,
          briefText: batchRun.briefText,
        },
      });
    } catch (error) {
      response = {
        ok: false,
        errorCode: "provider_execution_failed",
        message: formatInvokeError(error),
        retryable: true,
      };
    }

    if (response.ok) {
      const changedFiles = response.changedFiles ?? [];
      const completedPlan = planCompletedBatchWrite({
        batchRun: runningPlan.batchRun,
        items: includedItems,
        providerLabel: response.providerLabel ?? resolvedProviderLabel,
        changedFiles,
        summary: response.summary ?? "",
      });

      try {
        await persistBatchWritePlan(batchRun, completedPlan);
      } catch (error) {
        await reloadReviewState();
        const message = `批量任务已经执行完成，但本地状态同步失败：${formatInvokeError(error)}`;
        const overlay = buildLocalBatchFailureOverlay(completedPlan.batchRun, {
          errorCode: "orphaned_run",
          message,
          retryable: true,
        });
        upsertLocalBatchFailureOverlay(overlay);
        upsertLocalBatchRunDetail(buildLocalFailedBatchRun(completedPlan.batchRun, {
          message,
          errorCode: overlay.errorCode,
          retryable: overlay.retryable,
        }));
        setSelectedBatchRunId(batchRun.id);
        return;
      }

      pendingFocusFilePathRef.current = changedFiles[0] ?? includedItems[0]?.filePath ?? null;
      setSelectedBatchRunId(batchRun.id);

      if (mode === "commit") {
        setWorkspaceMode("all");
        setMode("workspace");
      } else if (workspaceMode !== "all") {
        setWorkspaceMode("all");
      } else {
        await refreshCurrentContext();
      }
      return;
    }

    const failedPlan = planFailedBatchWrite({
      batchRun: runningPlan.batchRun,
      lastError: response.message?.trim() || response.providerStderr?.trim() || "Codex CLI 批量执行失败。",
      errorCode: normalizeBatchRunErrorCode(response.errorCode),
      retryable: response.retryable ?? true,
    });

    try {
      await persistBatchWritePlan(batchRun, failedPlan);
    } catch (error) {
      await reloadReviewState();
      const message = `批量任务已经返回失败，但本地状态同步失败：${formatInvokeError(error)}`;
      const overlay = buildLocalBatchFailureOverlay(failedPlan.batchRun, {
        errorCode: "orphaned_run",
        message,
        retryable: true,
      });
      upsertLocalBatchFailureOverlay(overlay);
      upsertLocalBatchRunDetail(buildLocalFailedBatchRun(failedPlan.batchRun, {
        message,
        errorCode: overlay.errorCode,
        retryable: overlay.retryable,
      }));
      setSelectedBatchRunId(batchRun.id);
      return;
    }

    setSelectedBatchRunId(batchRun.id);
  }

  async function handleAskAiToFix(item: ReviewItem): Promise<void> {
    if (item.status === "resolved" || item.status === "ai_editing") return;

    const blockingState = resolveBatchRunBlockingState({
      repoPath: item.repoPath,
      contextId: item.contextId,
      items: reviewItems,
      batchRuns,
      localFailures: localBatchFailures,
    });
    if (blockingState.blocked) return;

    const initialLabel = currentProviderStatus?.label ?? providerFallbackLabel(aiProvider);
    setReviewItemBusyAction({
      itemId: item.id,
      action: "ask_ai",
      baseStatus: item.status,
    });

    try {
      const statuses = await loadProviderStatuses();
      const selectedStatus = statuses.find((status) => status.provider === aiProvider);
      const resolvedLabel = selectedStatus?.label ?? initialLabel;

      if (selectedStatus && !selectedStatus.available) {
        throw new Error(`${resolvedLabel} 当前不可用，请先在 Settings 里切换 provider。`);
      }

      const { diff: reviewDiff } = await fetchReviewItemDiff(item);
      if (reviewDiff.isBinary) {
        throw new Error("Binary file review items are not supported for direct AI editing yet.");
      }

      setSelectedReviewItemId(item.id);
      await updateReviewItem(item.id, buildReviewItemAiStartedPatch(item));

      const response = await invoke<ApplyReviewItemResponse>("apply_review_item", {
        req: {
          repo,
          provider: aiProvider,
          contextMode: item.contextMode,
          workspaceMode: item.workspaceMode,
          commitSha: item.commitSha,
          itemId: item.id,
          filePath: item.filePath,
          scopeType: item.scopeType,
          startLine: item.startLine,
          endLine: item.endLine,
          title: item.title,
          note: item.note,
          fileOldContent: reviewDiff.oldContent ?? "",
          fileNewContent: reviewDiff.newContent ?? "",
        },
      });

      const changedFiles = response.changedFiles.length > 0 ? response.changedFiles : [item.filePath];
      const completedAt = new Date().toISOString();

      await updateReviewItem(item.id, buildReviewItemAiCompletedPatch(item, {
        providerLabel: response.providerLabel,
        changedFiles,
        summary: response.summary,
        at: completedAt,
      }));

      pendingFocusFilePathRef.current = changedFiles[0] ?? item.filePath;
      setSelectedReviewItemId(item.id);

      if (mode === "commit") {
        setWorkspaceMode("all");
        setMode("workspace");
      } else if (workspaceMode !== "all") {
        setWorkspaceMode("all");
      } else {
        await refreshCurrentContext();
      }
    } catch (error) {
      await updateReviewItem(
        item.id,
        buildReviewItemAiFailedPatch(item, formatInvokeError(error)),
      );
    } finally {
      setReviewItemBusyAction((current) => {
        if (!current || current.itemId !== item.id) {
          return current;
        }
        return null;
      });
    }
  }

  const handleMenuAction = useCallback(
    async (menuAction: MenuAction) => {
      switch (menuAction.action) {
        case "project.open":
          await openRepoDirectly();
          return;
        case "project.open_recent":
        case "project.switch":
          setShowProjectCenter(true);
          return;
        case "project.refresh_context":
        case "review.refresh":
          if (repo.trim()) {
            reloadCurrentMode();
          }
          return;
        case "project.close":
        case "help.welcome":
          closeProject();
          return;
        case "review.commit":
          setMode("commit");
          setSidebarCollapsed(false);
          return;
        case "review.workspace":
          setMode("workspace");
          setSidebarCollapsed(false);
          return;
        case "review.next_file":
          moveFileSelection(1);
          return;
        case "review.previous_file":
          moveFileSelection(-1);
          return;
        case "view.toggle_sidebar":
          setSidebarCollapsed((prev) => !prev);
          return;
        case "view.focus_diff":
          focusDiffPanel();
          return;
        case "view.reset_layout":
          resetLayout();
          return;
        case "window.bring_all_to_front":
          await getCurrentWindow().setFocus();
          return;
        case "ai.summary":
          await generateReviewSummary();
          return;
        case "ai.explain_diff":
          openPlaceholder("Explain Selected Diff", "解释当前选中的 diff、文件或提交在做什么，以及它的影响范围。");
          return;
        case "ai.surface_risks":
          openPlaceholder("Surface Risks", "提取当前改动里最值得优先关注的风险点与潜在回归。");
          return;
        case "ai.suggest_fix":
          if (selectedFile && selectedRange) {
            openRangeReviewComposer();
          } else if (selectedFile) {
            openFileReviewComposer();
          } else {
            openPlaceholder("Suggest Fix", "请先选择一个文件，或者在 diff 里框选行范围后再创建 review item。");
          }
          return;
        case "ai.draft_comment":
          openPlaceholder("Draft Review Comment", "把当前问题整理成可直接使用的 review comment 草稿。");
          return;
        case "app.settings":
          await openProviderSettings();
          return;
        case "help.shortcuts":
          openPlaceholder("Keyboard Shortcuts", "快捷键说明还没整理完，菜单入口已经预留。");
          return;
        case "help.about":
          openPlaceholder("About Review Editor", "Review Editor 是一个面向 AI 审查流的桌面评审工作台。");
          return;
      }
    },
    [aiProvider, currentProviderStatus, mode, repo, selectedCommit, selectedFile, workspaceMode],
  );

  useMenuActions(handleMenuAction);

  return (
    <main className="screen">
      {!hasProject ? (
        <WelcomeScreen onProjectSelect={handleProjectSelect} />
      ) : (
        <>
      <TopBar
        projectName={activeProject?.name}
        projectPathHint={pathHintFromPath(repo)}
        contextMeta={titlebarMeta}
        contextHeadline={titlebarHeadline}
        mode={mode}
        onModeChange={setMode}
        onRefresh={reloadCurrentMode}
        onSwitchProject={() => setShowProjectCenter(true)}
        onPrimaryAiAction={() => void generateReviewSummary()}
      />

      {showProjectCenter && (
        <section className="project-center-backdrop">
          <div
            className="project-center"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="project-center-head">
              <h2>{t("projectCenter")}</h2>
              <button
                type="button"
                className="ghost small"
                onClick={() => setShowProjectCenter(false)}
              >
                {t("close")}
              </button>
            </div>

            <div className="project-center-content">
              <label className="project-name-editor">
                <span>{t("projectName")}</span>
                <input
                  ref={projectNameInputRef}
                  value={projectNameDraft}
                  onChange={(event) => setProjectNameDraft(event.currentTarget.value)}
                  placeholder={projectNameFromPath(repoDraft)}
                />
              </label>

              <label className="project-path-editor">
                <span>{t("projectPath")}</span>
                <div className="path-row">
                  <input
                    value={repoDraft}
                    onChange={(event) => setRepoDraft(event.currentTarget.value)}
                    placeholder="/absolute/path/to/repository"
                  />
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void chooseRepoPath()}
                  >
                    {t("choosePath")}
                  </button>
                </div>
              </label>

              <ul className="project-list">
                {projects.map((item) => (
                  <li
                    key={item.id}
                    className={activeProject?.id === item.id ? "project-item active" : "project-item"}
                  >
                    <div className="project-item-meta">
                      <p className="project-item-name">{item.name}</p>
                      <p className="project-item-path" title={item.path}>
                        {item.path}
                      </p>
                      <p className="project-item-time">
                        {t("lastOpened", { date: formatDate(item.lastOpenedAt) })}
                      </p>
                    </div>
                    <div className="project-item-actions">
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => openProject(item.id)}
                      >
                        {t("open")}
                      </button>
                      <button
                        type="button"
                        className="ghost small danger"
                        onClick={() => removeProject(item.id)}
                      >
                        {t("remove")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {projects.length === 0 && <p className="hint">{t("noProjects")}</p>}
            </div>

            <div className="project-center-foot">
              <button
                type="button"
                className="ghost"
                onClick={() => setShowProjectCenter(false)}
              >
                {t("close")}
              </button>
              <div className="project-center-foot-actions">
                <button type="button" className="primary" onClick={saveCurrentProject}>
                  {currentPathProject ? t("updateProject") : t("saveProject")}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {graphError && (
        <section className="error-banner">
          <strong>{t("scanFailed")}:</strong> {graphError}
        </section>
      )}

      <section
        ref={workbenchRef}
        className={sidebarCollapsed ? "workbench sidebar-collapsed" : "workbench"}
      >
        {!sidebarCollapsed && (
        <SideBar
          mode={mode}
          style={{ width: sidebarWidth }}
          commits={commits}
          selectedCommit={selectedCommit}
          onCommitSelect={(sha) => {
            setSelectedCommit(sha);
          }}
          files={files as { path: string; status: string }[]}
          selectedFile={selectedFile as { path: string; status: string } | null}
          onFileSelect={(file) => {
            setForceOpen(false);
            setSelectedFile(file as ChangedFile);
          }}
          loading={graphLoading || filesLoading}
        />
        )}

        <div
          className={draggingSidebar ? "sidebar-resizer active" : "sidebar-resizer"}
          onMouseDown={() => {
            if (!sidebarCollapsed) setDraggingSidebar(true);
          }}
          onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
        />

        <section ref={diffPanelRef} className="panel diff-panel" tabIndex={-1}>
          <div className="panel-head">
            <h2>
              {t("diffPreview")}
              {selectedFile && <span className="muted"> - {selectedFile.path}</span>}
            </h2>
            <div className="diff-head-actions">
              {selectedRange && (
                <span className="diff-selection-chip">
                  已选 {selectedRange.startLine}-{selectedRange.endLine} 行
                </span>
              )}
            </div>
          </div>

          {sidebarCollapsed && (
            <div className="notice">
              <p>{t("sidebarHiddenHint")}</p>
              <button
                type="button"
                className="primary"
                onClick={() => setSidebarCollapsed(false)}
              >
                {t("showSidebar")}
              </button>
            </div>
          )}

          {!selectedFile && <p className="hint">{t("selectFileHint")}</p>}
          {diffLoading && <p className="hint">{t("loadingDiff")}</p>}
          {diffError && <p className="hint error-text">{diffError}</p>}

          {!diffLoading && diff && diff.isBinary && (
            <div className="notice">
              <p>{t("binaryNotice")}</p>
            </div>
          )}

          {!diffLoading && diff && !diff.isBinary && diff.tooLarge && (
            <div className="notice">
              <p>{diff.tooLargeReason}</p>
              <button type="button" className="primary" onClick={() => setForceOpen(true)}>
                {t("forceOpen")}
              </button>
            </div>
          )}

          {!diffLoading && diff && !diff.isBinary && !diff.tooLarge && (
            <div className="editor-wrap">
              <DiffEditor
                height="100%"
                language={detectLanguage(diff.path)}
                original={diff.oldContent ?? ""}
                modified={diff.newContent ?? ""}
                theme="vs-dark"
                onMount={handleDiffEditorMount}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  automaticLayout: true,
                  minimap: { enabled: false },
                  wordWrap: "off",
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineNumbers: 'on',
                  glyphMargin: false,
                  folding: true,
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    useShadows: false,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                  renderOverviewRuler: false,
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                }}
              />
            </div>
          )}
        </section>

        <aside className="review-pane">
          {reviewPaneMode === "queue" ? (
            <ReviewQueue
              items={visibleReviewItems}
              selectedFilePath={selectedFile?.path ?? null}
              onSelectItem={(itemId) => {
                setSelectedBatchRunId(null);
                setSelectedReviewItemId(itemId);
              }}
              onCreateItem={() => {
                setSelectedBatchRunId(null);
                handlePrimaryCreateReviewItem();
              }}
              onSendOpenItems={() => void handleSendOpenIssuesToCodex()}
              createActionLabel={queueFooterActions.create.label}
              createActionDisabled={queueFooterActions.create.disabled}
              sendOpenItemsLabel={queueFooterActions.sendOpen.label}
              sendOpenItemsDisabled={queueFooterActions.sendOpen.disabled}
            />
          ) : reviewPaneMode === "detail" ? (
            <ReviewItemDetail
              item={selectedReviewItem}
              provider={aiProvider}
              aiBusy={
                selectedReviewItemBlockingState.blocked
                || selectedReviewItemBusyState.busyAction !== null
              }
              busyAction={selectedReviewItemBusyState.busyAction}
              busyBaseStatus={selectedReviewItemBusyState.busyBaseStatus}
              onBack={() => setSelectedReviewItemId(null)}
              onAskAiToFix={(item) => void handleAskAiToFix(item)}
              onEdit={openEditReviewItem}
              onResolve={(item) => void handleResolveReviewItem(item)}
              onReopen={(item) => void handleReopenReviewItem(item)}
              onDelete={(item) => void handleDeleteReviewItem(item)}
              onJumpToFile={handleJumpToReviewItem}
            />
          ) : (
            <ReviewBatchRunDetail
              batchRun={selectedBatchRun}
              onBack={() => setSelectedBatchRunId(null)}
              onJumpToIssue={(issueId) => {
                setSelectedBatchRunId(null);
                setSelectedReviewItemId(issueId);
              }}
            />
          )}
        </aside>
      </section>
      {placeholder && (
        <AiActionPlaceholder
          title={placeholder.title}
          description={placeholder.description}
          contextLabel={placeholder.contextLabel}
          onClose={() => setPlaceholder(null)}
        />
      )}
      {summarySheet && (
        <AiSummarySheet
          status={summarySheet.status}
          provider={aiProvider}
          providerLabel={summarySheet.providerLabel}
          truncated={summarySheet.truncated}
          summary={summarySheet.summary}
          error={summarySheet.error}
          onClose={() => setSummarySheet(null)}
          onRetry={() => void generateReviewSummary()}
          onOpenSettings={() => void openProviderSettings()}
        />
      )}
      {showProviderSettings && (
        <ProviderSettingsSheet
          provider={aiProvider}
          statuses={providerStatuses}
          loading={providerStatusesLoading}
          onClose={() => setShowProviderSettings(false)}
          onSelect={(provider) => void handleProviderSelect(provider)}
        />
      )}
      <ReviewItemComposer
        draft={composerDraft}
        mode={composerMode}
        initialTitle={composerDraft?.title ?? editingReviewItem?.title ?? ""}
        initialNote={composerDraft?.note ?? editingReviewItem?.note ?? ""}
        onClose={closeReviewComposer}
        onSubmit={handleComposerSubmit}
      />
      {reviewFeedbackToast && (
        <div
          className={`review-feedback-toast ${reviewFeedbackToast.kind}`}
          role="status"
          aria-live="polite"
        >
          {reviewFeedbackToast.message}
        </div>
      )}
        </>
      )}
    </main>
  );
}

export default App;
