export interface ReviewItemComposerSubmitPayload {
  title: string;
  note: string;
}

export interface ReviewComposerSuccessFeedback {
  selectedReviewItemId: string;
  toastMessage: string;
}

export function buildReviewComposerSuccessFeedback({
  mode,
  itemId,
  title,
}: {
  mode: "create" | "edit";
  itemId: string;
  title: string;
}): ReviewComposerSuccessFeedback {
  return {
    selectedReviewItemId: itemId,
    toastMessage: mode === "edit"
      ? `已更新 Review Item：${title}`
      : `已创建 Review Item：${title}`,
  };
}

export interface SubmitReviewItemComposerInput {
  title: string;
  note: string;
  onClose: () => void;
  onSubmit: (payload: ReviewItemComposerSubmitPayload) => Promise<void> | void;
}

export async function submitReviewItemComposer({
  title,
  note,
  onClose,
  onSubmit,
}: SubmitReviewItemComposerInput): Promise<boolean> {
  const nextTitle = title.trim();
  if (!nextTitle) return false;

  onClose();
  await onSubmit({
    title: nextTitle,
    note: note.trim(),
  });
  return true;
}
