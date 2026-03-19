import { type ReviewItem, getReviewItemScopeLabel } from "../lib/reviewItems";
import { resolveReviewQueueCreateActionLayout } from "../lib/reviewPane";
import "./ReviewQueue.css";

interface ReviewQueueProps {
  items: ReviewItem[];
  selectedFilePath: string | null;
  onSelectItem: (id: string) => void;
  onCreateItem: () => void;
  onSendOpenItems: () => void;
  createActionLabel: string;
  createActionDisabled: boolean;
  sendOpenItemsLabel: string;
  sendOpenItemsDisabled: boolean;
}

function statusLabel(status: ReviewItem["status"]): string {
  switch (status) {
    case "open":
      return "Open";
    case "ai_editing":
      return "AI Editing";
    case "needs_review":
      return "Needs Review";
    case "resolved":
      return "Resolved";
  }
}

export function ReviewQueue({
  items,
  selectedFilePath,
  onSelectItem,
  onCreateItem,
  onSendOpenItems,
  createActionLabel,
  createActionDisabled,
  sendOpenItemsLabel,
  sendOpenItemsDisabled,
}: ReviewQueueProps) {
  const createActionLayout = resolveReviewQueueCreateActionLayout();
  const counts = items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    {
      open: 0,
      ai_editing: 0,
      needs_review: 0,
      resolved: 0,
    } as Record<ReviewItem["status"], number>,
  );

  return (
    <section className="review-queue">
      <div className="review-queue-head">
        <div className="review-queue-head-main">
          <p className="review-queue-kicker">Review Queue</p>
          <div className="review-queue-title-row">
            <h2>{items.length} items</h2>
            {selectedFilePath && <span className="review-queue-focus">Current file first</span>}
          </div>
        </div>
        {createActionLayout.showHeaderAction && (
          <button
            type="button"
            className="primary review-queue-create"
            disabled={createActionDisabled}
            onClick={onCreateItem}
          >
            {createActionLabel}
          </button>
        )}
      </div>

      <div className="review-queue-stats">
        <span className="review-queue-stat">
          <strong>{counts.open}</strong>
          <span>Open</span>
        </span>
        <span className="review-queue-stat">
          <strong>{counts.needs_review}</strong>
          <span>Needs Review</span>
        </span>
        <span className="review-queue-stat muted">
          <strong>{counts.resolved}</strong>
          <span>Resolved</span>
        </span>
      </div>

      <div className="review-queue-list">
        {items.length === 0 && (
          <div className="review-queue-empty">
            <p>还没有 review item。</p>
            <span>从当前文件或选区创建一个，AI 编辑才会进入正式 review 流程。</span>
            {createActionLayout.showEmptyAction && (
              <button
                type="button"
                className="primary"
                disabled={createActionDisabled}
                onClick={onCreateItem}
              >
                {createActionLabel}
              </button>
            )}
          </div>
        )}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="review-queue-card"
            onClick={() => onSelectItem(item.id)}
          >
            <div className="review-queue-card-top">
              <strong>{item.title}</strong>
              <span className={`review-item-status ${item.status}`}>{statusLabel(item.status)}</span>
            </div>
            <div className="review-queue-meta-row">
              <span className="review-queue-scope">{getReviewItemScopeLabel(item)}</span>
              <span className="review-queue-context">
                {item.contextMode === "commit" ? "Commit" : "Workspace"}
              </span>
            </div>
            <span className="review-queue-path" title={item.filePath}>
              {item.filePath}
            </span>
            <span className="review-queue-preview">
              {item.note || item.lastRunSummary || "还没有补充 reviewer note。"}
            </span>
          </button>
        ))}
      </div>

      {createActionLayout.showFooterAction && (
        <div className="review-queue-footer">
          <button
            type="button"
            className="ghost review-queue-footer-create"
            disabled={createActionDisabled}
            onClick={onCreateItem}
          >
            {createActionLabel}
          </button>
          <button
            type="button"
            className={sendOpenItemsDisabled ? "ghost review-queue-footer-send" : "primary review-queue-footer-send"}
            disabled={sendOpenItemsDisabled}
            onClick={onSendOpenItems}
          >
            {sendOpenItemsLabel}
          </button>
        </div>
      )}
    </section>
  );
}
