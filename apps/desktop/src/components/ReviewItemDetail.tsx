import { type AiProvider } from "../hooks/useAiProvider";
import {
  resolveReviewItemDetailActions,
  type ReviewItemDetailAction,
} from "../lib/reviewItemActions";
import {
  type ReviewItem,
  getReviewItemScopeLabel,
  getReviewItemTimeline,
} from "../lib/reviewItems";
import "./ReviewItemDetail.css";

interface ReviewItemDetailProps {
  item: ReviewItem | null;
  provider: AiProvider;
  aiBusy: boolean;
  onBack: () => void;
  onAskAiToFix: (item: ReviewItem) => void;
  onEdit: (item: ReviewItem) => void;
  onResolve: (item: ReviewItem) => void;
  onReopen: (item: ReviewItem) => void;
  onDelete: (item: ReviewItem) => void;
  onJumpToFile: (item: ReviewItem) => void;
}

function providerLabel(provider: AiProvider): string {
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

function formatTimelineAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ReviewItemDetail({
  item,
  provider,
  aiBusy,
  onBack,
  onAskAiToFix,
  onEdit,
  onResolve,
  onReopen,
  onDelete,
  onJumpToFile,
}: ReviewItemDetailProps) {
  if (!item) {
    return (
      <section className="review-item-detail empty">
        <p>选择一个 review item 查看详情。</p>
        <span>右侧会保留 item 的状态、变更文件和 AI 执行结果，避免“点完就丢”。</span>
      </section>
    );
  }

  const currentItem = item;
  const isItemEditing = item.status === "ai_editing";
  const timeline = getReviewItemTimeline(item.history ?? []);
  const detailActions = resolveReviewItemDetailActions({
    status: currentItem.status,
    aiBusy,
    providerLabel: providerLabel(provider),
  });

  function runAction(action: ReviewItemDetailAction): void {
    switch (action.action) {
      case "ask_ai":
        onAskAiToFix(currentItem);
        return;
      case "edit":
        onEdit(currentItem);
        return;
      case "resolve":
        onResolve(currentItem);
        return;
      case "reopen":
        onReopen(currentItem);
        return;
      case "delete":
        onDelete(currentItem);
        return;
    }
  }

  return (
    <section className="review-item-detail">
      <div className="review-item-detail-head">
        <div className="review-item-detail-topbar">
          <button type="button" className="ghost small review-item-back" onClick={onBack}>
            返回队列
          </button>
          <span className={`review-item-status ${item.status}`}>{statusLabel(item.status)}</span>
        </div>
        <h3>{item.title}</h3>
        <div className="review-item-detail-actions-inline">
          <button type="button" className="ghost small" onClick={() => onJumpToFile(item)}>
            跳到代码
          </button>
        </div>
      </div>

      <div className="review-item-detail-body">
        <div className="review-item-meta-grid">
          <div className="review-item-meta-card">
            <span>Scope</span>
            <strong>{getReviewItemScopeLabel(item)}</strong>
          </div>
          <div className="review-item-meta-card">
            <span>Status</span>
            <strong>{statusLabel(item.status)}</strong>
          </div>
          <div className="review-item-meta-card">
            <span>Context</span>
            <strong>{item.contextMode === "commit" ? "Commit Review" : "Workspace Review"}</strong>
          </div>
        </div>

        <div className="review-item-section">
          <span className="review-item-section-label">File</span>
          <button
            type="button"
            className="review-item-file-link"
            title={item.filePath}
            onClick={() => onJumpToFile(item)}
          >
            {item.filePath}
          </button>
        </div>

        {item.note && (
          <div className="review-item-section">
            <span className="review-item-section-label">Reviewer Note</span>
            <div className="review-item-rich-block">
              <p className="review-item-note">{item.note}</p>
            </div>
          </div>
        )}

        {item.lastError && (
          <div className="review-item-section danger">
            <span className="review-item-section-label">Last Error</span>
            <pre>{item.lastError}</pre>
          </div>
        )}

        {item.lastRunSummary && (
          <div className="review-item-section">
            <span className="review-item-section-label">Last AI Summary</span>
            <div className="review-item-rich-block">
              <pre>{item.lastRunSummary}</pre>
            </div>
          </div>
        )}

        <div className="review-item-section">
          <span className="review-item-section-label">Changed Files</span>
          {item.changedFiles.length === 0 ? (
            <p className="review-item-empty">最近一次执行还没有记录变更文件。</p>
          ) : (
            <ul className="review-item-file-pills">
              {item.changedFiles.map((changedFile) => (
                <li key={changedFile}>{changedFile}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="review-item-section">
          <span className="review-item-section-label">Timeline</span>
          {timeline.length === 0 ? (
            <p className="review-item-empty">这个 item 还没有可展示的关键事件。</p>
          ) : (
            <ol className="review-item-timeline">
              {timeline.map((entry) => (
                <li key={entry.id} className="review-item-timeline-entry">
                  <div className="review-item-timeline-dot" aria-hidden="true" />
                  <div className="review-item-timeline-content">
                    <strong>{entry.summary}</strong>
                    <time dateTime={entry.at}>{formatTimelineAt(entry.at)}</time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="review-item-actions">
        <button
          type="button"
          className="primary"
          disabled={isItemEditing ? true : detailActions.primary.disabled}
          onClick={() => runAction(detailActions.primary)}
        >
          {isItemEditing ? `${providerLabel(provider)} Working...` : detailActions.primary.label}
        </button>
        {detailActions.secondary.map((action) => (
          <button
            key={action.action}
            type="button"
            className={action.tone === "danger" ? "ghost danger" : "ghost"}
            disabled={isItemEditing ? true : action.disabled}
            onClick={() => runAction(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
