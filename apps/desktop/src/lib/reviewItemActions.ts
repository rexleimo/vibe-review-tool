import type { ReviewItemStatus } from "./reviewItems.js";

export type ReviewItemDetailActionKind = "ask_ai" | "edit" | "delete" | "resolve" | "reopen";

export interface ReviewItemDetailAction {
  action: ReviewItemDetailActionKind;
  label: string;
  disabled: boolean;
  tone?: "danger";
}

export interface ReviewItemDetailActions {
  primary: ReviewItemDetailAction;
  secondary: ReviewItemDetailAction[];
}

export interface ResolveReviewItemDetailActionsInput {
  status: ReviewItemStatus;
  aiBusy: boolean;
  providerLabel: string;
}

export function resolveReviewItemDetailActions({
  status,
  aiBusy,
  providerLabel,
}: ResolveReviewItemDetailActionsInput): ReviewItemDetailActions {
  if (status === "open") {
    return {
      primary: {
        action: "ask_ai",
        label: `Ask ${providerLabel} To Fix`,
        disabled: aiBusy,
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
  }

  if (status === "needs_review") {
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
          disabled: aiBusy,
        },
        {
          action: "reopen",
          label: "重新打开",
          disabled: false,
        },
      ],
    };
  }

  if (status === "resolved") {
    return {
      primary: {
        action: "reopen",
        label: "重新打开",
        disabled: false,
      },
      secondary: [],
    };
  }

  return {
    primary: {
      action: "ask_ai",
      label: `${providerLabel} Working...`,
      disabled: true,
    },
    secondary: [],
  };
}
