export type ReviewItemDetailActionKind = "ask_ai" | "edit" | "delete" | "resolve" | "reopen";

export interface ReviewItemDetailAction {
  action: ReviewItemDetailActionKind;
  label: string;
  disabled: boolean;
  tone?: "danger";
}
