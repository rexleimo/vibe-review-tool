import { useEffect, useMemo, useState } from "react";
import { type CreateReviewItemInput, getReviewItemScopeLabel } from "../lib/reviewItems";
import { submitReviewItemComposer } from "../lib/reviewComposer";
import "./ReviewItemComposer.css";

interface ReviewItemComposerProps {
  draft: CreateReviewItemInput | null;
  mode: "create" | "edit";
  initialTitle: string;
  initialNote: string;
  onClose: () => void;
  onSubmit: (payload: { title: string; note: string }) => Promise<void> | void;
}

export function ReviewItemComposer({
  draft,
  mode,
  initialTitle,
  initialNote,
  onClose,
  onSubmit,
}: ReviewItemComposerProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!draft) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void handleSubmit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, onClose, title, note]);

  useEffect(() => {
    if (!draft) return;
    setTitle(initialTitle);
    setNote(initialNote);
    setSubmitting(false);
  }, [draft, initialNote, initialTitle, mode]);

  const scopeLabel = useMemo(() => {
    if (!draft) return "";
    return getReviewItemScopeLabel(draft);
  }, [draft]);

  if (!draft) return null;

  async function handleSubmit(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    try {
      const submitted = await submitReviewItemComposer({
        title,
        note,
        onClose,
        onSubmit,
      });
      if (!submitted) {
        setSubmitting(false);
      }
    } finally {
      // The composer usually unmounts immediately after a valid submit.
    }
  }

  return (
    <section className="review-item-composer-backdrop" onClick={onClose}>
      <div
        className="review-item-composer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="review-item-composer-head">
          <div>
            <p className="review-item-composer-kicker">{mode === "edit" ? "Edit Review Item" : "New Review Item"}</p>
            <h2>
              {mode === "edit"
                ? "调整 review 建议"
                : draft.scopeType === "range"
                  ? "基于选区创建问题"
                  : "基于文件创建问题"}
            </h2>
            <p className="review-item-composer-subtitle">
              Esc 关闭，Cmd/Ctrl + Enter {mode === "edit" ? "保存" : "创建"}
            </p>
          </div>
          <button type="button" className="ghost small review-item-composer-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="review-item-composer-context">
          <div>
            <span>Scope</span>
            <strong>{scopeLabel}</strong>
          </div>
          <div>
            <span>File</span>
            <strong>{draft.filePath}</strong>
          </div>
          <div>
            <span>Review Mode</span>
            <strong>{draft.contextMode === "commit" ? "Commit Review" : "Workspace Review"}</strong>
          </div>
        </div>

        <label className="review-item-composer-field">
          <span>Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="例如：补上空状态保护，避免点击后无反馈"
            autoFocus
          />
        </label>

        <label className="review-item-composer-field">
          <span>Reviewer Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            placeholder="补充你希望 AI 关注的风险、边界或实现方向。"
            rows={5}
          />
        </label>

        <div className="review-item-composer-actions">
          <button type="button" className="ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={!title.trim() || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (mode === "edit" ? "保存中..." : "创建中...") : mode === "edit" ? "保存修改" : "创建 Review Item"}
          </button>
        </div>
      </div>
    </section>
  );
}
