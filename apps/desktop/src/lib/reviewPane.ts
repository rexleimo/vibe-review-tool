export type ReviewPaneMode = "queue" | "detail" | "batch_run";

export interface ReviewPaneStateInput {
  selectedItemId: string | null;
  selectedBatchRunId?: string | null;
  selectedFilePath: string | null;
  hasSelectedRange: boolean;
}

export interface ReviewPanePrimaryAction {
  disabled: boolean;
  kind: "range" | "file" | "none";
  label: string;
}

export interface ReviewQueueCreateActionLayout {
  showHeaderAction: boolean;
  showEmptyAction: boolean;
  showFooterAction: boolean;
}

export interface ReviewPaneModeSelection {
  selectedItemId: string | null;
  selectedBatchRunId?: string | null;
}

export interface ReviewQueueFooterActions {
  create: {
    label: string;
    disabled: boolean;
  };
  sendOpen: {
    label: string;
    disabled: boolean;
  };
}

export function resolveReviewPaneMode(selection: ReviewPaneModeSelection | string | null): ReviewPaneMode {
  if (typeof selection === "string") return "detail";
  if (selection && typeof selection === "object") {
    if (selection.selectedBatchRunId) return "batch_run";
    return selection.selectedItemId ? "detail" : "queue";
  }
  return "queue";
}

export function resolveReviewPanePrimaryAction({
  selectedItemId: _selectedItemId,
  selectedFilePath,
  hasSelectedRange,
}: ReviewPaneStateInput): ReviewPanePrimaryAction {
  if (hasSelectedRange) {
    return {
      disabled: false,
      kind: "range",
      label: "基于选区创建",
    };
  }

  if (selectedFilePath) {
    return {
      disabled: false,
      kind: "file",
      label: "新建文件问题",
    };
  }

  return {
    disabled: true,
    kind: "none",
    label: "先选择文件",
  };
}

export function resolveReviewQueueCreateActionLayout(): ReviewQueueCreateActionLayout {
  return {
    showHeaderAction: false,
    showEmptyAction: false,
    showFooterAction: true,
  };
}

export function resolveQueueFooterActions({
  visibleOpenCount,
  createDisabled,
  batchBlocked,
}: {
  visibleOpenCount: number;
  createDisabled: boolean;
  batchBlocked: boolean;
}): ReviewQueueFooterActions {
  if (visibleOpenCount === 0) {
    return {
      create: {
        label: "新建文件问题",
        disabled: createDisabled,
      },
      sendOpen: {
        label: "没有 Open Issues 可发送",
        disabled: true,
      },
    };
  }

  if (batchBlocked) {
    return {
      create: {
        label: "新建文件问题",
        disabled: createDisabled,
      },
      sendOpen: {
        label: "当前上下文已有 AI 任务执行中",
        disabled: true,
      },
    };
  }

  return {
    create: {
      label: "新建文件问题",
      disabled: createDisabled,
    },
    sendOpen: {
      label: `发送 ${visibleOpenCount} 条 Open Issues`,
      disabled: false,
    },
  };
}

export function shouldClearSelectedReviewItem(
  selectedItemId: string | null,
  selectedItemExists: boolean,
): boolean {
  return selectedItemId !== null && !selectedItemExists;
}
