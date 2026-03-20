import { resolveReviewItemDetailFooter, type ReviewItemDetailFooter } from "./reviewItemDetailLayout.js";
import type { ReviewItemStatus } from "./reviewItems.js";

export type ReviewItemDetailActionKind = "ask_ai" | "edit" | "delete" | "resolve" | "reopen";

export interface ReviewItemDetailAction {
  action: ReviewItemDetailActionKind;
  label: string;
  disabled: boolean;
  tone?: "danger";
}

export interface ResolveReviewItemDetailActionsInput {
  status: ReviewItemStatus;
  aiBusy: boolean;
  providerLabel: string;
}

export type ReviewItemDetailActions = ReviewItemDetailFooter;

export function resolveReviewItemDetailActions({
  status,
  aiBusy,
  providerLabel,
}: ResolveReviewItemDetailActionsInput): ReviewItemDetailActions {
  return resolveReviewItemDetailFooter({
    status,
    busyBaseStatus: null,
    providerLabel,
    busy: aiBusy,
    busyAction: aiBusy ? "ask_ai" : null,
  });
}
