import type { ReviewItemDetailAction, ReviewItemDetailActionKind } from "./reviewItemActions.js";
import type { ReviewItemStatus } from "./reviewItems.js";

export type ReviewItemDetailSectionKey =
  | "reviewer_note"
  | "last_error"
  | "ai_summary"
  | "changed_files"
  | "timeline";

type ReviewItemDetailFooterBaseStatus = "open" | "needs_review";

export interface ResolveReviewItemDetailFooterInput {
  status: ReviewItemStatus;
  busyBaseStatus?: ReviewItemDetailFooterBaseStatus | null;
  providerLabel: string;
  busy: boolean;
  busyAction: ReviewItemDetailActionKind | null;
}

export interface ReviewItemDetailFooterAction extends ReviewItemDetailAction {
  loading?: boolean;
}

export interface ReviewItemDetailFooter {
  primary: ReviewItemDetailFooterAction;
  secondary: ReviewItemDetailFooterAction[];
}

export interface ResolveReviewItemDetailSectionsInput {
  status: ReviewItemStatus;
  hasReviewerNote: boolean;
  hasAiSummary: boolean;
  hasChangedFiles: boolean;
  hasTimeline: boolean;
  hasLastError: boolean;
}

export interface ReviewItemBusyActionOverlay {
  itemId: string;
  action: "ask_ai";
  baseStatus: ReviewItemDetailFooterBaseStatus;
}

export interface ResolveSelectedReviewItemBusyStateInput {
  selectedItemId: string | null;
  overlay: ReviewItemBusyActionOverlay | null;
}

function resolveFooterBaseStatus({
  status,
  busyBaseStatus,
}: Pick<ResolveReviewItemDetailFooterInput, "status" | "busyBaseStatus">): Exclude<ReviewItemStatus, "ai_editing"> {
  if (status !== "ai_editing") return status;
  if (busyBaseStatus === "open" || busyBaseStatus === "needs_review") {
    return busyBaseStatus;
  }
  throw new Error("missing busyBaseStatus for ai_editing detail footer");
}

function applyBusyState(
  action: ReviewItemDetailAction,
  busy: boolean,
  busyAction: ReviewItemDetailActionKind | null,
): ReviewItemDetailFooterAction {
  const nextAction: ReviewItemDetailFooterAction = {
    ...action,
    disabled: busy || action.disabled,
  };

  if (busy && busyAction === action.action) {
    nextAction.loading = true;
  }

  return nextAction;
}

function buildFooterForStatus(
  status: Exclude<ReviewItemStatus, "ai_editing">,
  providerLabel: string,
): ReviewItemDetailFooter {
  switch (status) {
    case "open":
      return {
        primary: {
          action: "ask_ai",
          label: `让 ${providerLabel} 修改`,
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
      };
    case "needs_review":
      return {
        primary: {
          action: "resolve",
          label: "接受并解决",
          disabled: false,
        },
        secondary: [
          {
            action: "ask_ai",
            label: `继续让 ${providerLabel} 修改`,
            disabled: false,
          },
          {
            action: "reopen",
            label: "重新打开",
            disabled: false,
          },
        ],
      };
    case "resolved":
      return {
        primary: {
          action: "reopen",
          label: "重新打开",
          disabled: false,
        },
        secondary: [],
      };
  }
}

export function resolveReviewItemDetailFooter(
  input: ResolveReviewItemDetailFooterInput,
): ReviewItemDetailFooter {
  const baseStatus = resolveFooterBaseStatus({
    status: input.status,
    busyBaseStatus: input.busyBaseStatus,
  });
  const footer = buildFooterForStatus(baseStatus, input.providerLabel);

  return {
    primary: applyBusyState(footer.primary, input.busy, input.busyAction),
    secondary: footer.secondary.map((action) => applyBusyState(action, input.busy, input.busyAction)),
  };
}

export function resolveReviewItemDetailSections(
  input: ResolveReviewItemDetailSectionsInput,
): ReviewItemDetailSectionKey[] {
  const sections: ReviewItemDetailSectionKey[] = [];
  const {
    hasReviewerNote,
    hasAiSummary,
    hasChangedFiles,
    hasTimeline,
    hasLastError,
  } = input;

  if (hasReviewerNote) {
    sections.push("reviewer_note");
  }

  if (hasLastError) {
    sections.push("last_error");
  }

  if (hasAiSummary) {
    sections.push("ai_summary");
  }

  if (hasChangedFiles) {
    sections.push("changed_files");
  }

  if (hasTimeline) {
    sections.push("timeline");
  }

  return sections;
}

export function resolveSelectedReviewItemBusyState(
  input: ResolveSelectedReviewItemBusyStateInput,
): {
  busyAction: ReviewItemDetailActionKind | null;
  busyBaseStatus: ReviewItemDetailFooterBaseStatus | null;
} {
  const { selectedItemId, overlay } = input;
  if (!selectedItemId || !overlay || overlay.itemId !== selectedItemId) {
    return {
      busyAction: null,
      busyBaseStatus: null,
    };
  }

  return {
    busyAction: overlay.action,
    busyBaseStatus: overlay.baseStatus,
  };
}
