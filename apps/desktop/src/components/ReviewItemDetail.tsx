import { Fragment, type ReactNode } from "react";
import { type AiProvider } from "../hooks/useAiProvider";
import type { ReviewItemDetailAction, ReviewItemDetailActionKind } from "../lib/reviewItemActions";
import {
  resolveReviewItemDetailFooter,
  resolveReviewItemDetailSections,
  type ReviewItemDetailSectionKey,
} from "../lib/reviewItemDetailLayout";
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
  busyAction: ReviewItemDetailActionKind | null;
  busyBaseStatus: "open" | "needs_review" | null;
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
      return "待处理";
    case "ai_editing":
      return "AI 修改中";
    case "needs_review":
      return "待复审";
    case "resolved":
      return "已解决";
  }
}

function contextLabel(item: ReviewItem): string {
  if (item.contextMode === "commit") {
    return item.commitSha ? `Commit · ${item.commitSha.slice(0, 7)}` : "Commit Review";
  }

  switch (item.workspaceMode ?? "all") {
    case "staged":
      return "Workspace · staged";
    case "unstaged":
      return "Workspace · unstaged";
    default:
      return "Workspace · all";
  }
}

function formatTimelineAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderFooterActionLabel(action: { action: ReviewItemDetailActionKind; label: string; loading?: boolean }): string {
  if (!action.loading) return action.label;
  if (action.action === "ask_ai") return "继续处理中...";
  return "处理中...";
}

function buildSectionMap(item: ReviewItem, timeline: ReturnType<typeof getReviewItemTimeline>): Record<ReviewItemDetailSectionKey, ReactNode> {
  return {
    reviewer_note: (
      <div className="review-item-section">
        <div className="review-item-section-heading">
          <span className="review-item-section-label">Reviewer Note</span>
        </div>
        <div className="review-item-rich-block">
          <p className="review-item-note">{item.note}</p>
        </div>
      </div>
    ),
    last_error: (
      <div className="review-item-section review-item-section-warning">
        <div className="review-item-section-heading">
          <span className="review-item-section-label">Last Error</span>
          <span className="review-item-section-meta">需要先确认失败原因</span>
        </div>
        <pre className="review-item-warning-block">{item.lastError}</pre>
      </div>
    ),
    ai_summary: (
      <div className="review-item-section">
        <div className="review-item-section-heading">
          <span className="review-item-section-label">AI Summary</span>
        </div>
        <div className="review-item-rich-block">
          <pre>{item.lastRunSummary}</pre>
        </div>
      </div>
    ),
    changed_files: (
      <div className="review-item-section">
        <div className="review-item-section-heading">
          <span className="review-item-section-label">Changed Files</span>
          <span className="review-item-section-meta">{item.changedFiles.length} files</span>
        </div>
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
    ),
    timeline: (
      <div className="review-item-section">
        <div className="review-item-section-heading">
          <span className="review-item-section-label">Timeline</span>
        </div>
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
    ),
  };
}

export function ReviewItemDetail({
  item,
  provider,
  aiBusy,
  busyAction,
  busyBaseStatus,
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
  const currentProviderLabel = providerLabel(provider);
  const timeline = getReviewItemTimeline(item.history ?? []);
  const detailFooter = resolveReviewItemDetailFooter({
    status: currentItem.status,
    busyBaseStatus,
    providerLabel: currentProviderLabel,
    busy: aiBusy,
    busyAction,
  });
  const sectionOrder = resolveReviewItemDetailSections({
    status: currentItem.status,
    hasReviewerNote: currentItem.note.trim().length > 0,
    hasAiSummary: currentItem.lastRunSummary.trim().length > 0,
    hasChangedFiles: currentItem.changedFiles.length > 0 || currentItem.status !== "open",
    hasTimeline: true,
    hasLastError: currentItem.lastError.trim().length > 0,
  });
  const sectionMap = buildSectionMap(currentItem, timeline);

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
          <div className="review-item-detail-topbar-left">
            <button type="button" className="ghost small review-item-back" onClick={onBack}>
              返回队列
            </button>
            <span className={`review-item-status ${item.status}`}>{statusLabel(item.status)}</span>
          </div>
          <button type="button" className="ghost small review-item-jump" onClick={() => onJumpToFile(item)}>
            跳到代码
          </button>
        </div>

        <div className="review-item-title-block">
          <h3>{item.title}</h3>
          <div className="review-item-context-strip">
            <span className="review-item-context-path" title={item.filePath}>{item.filePath}</span>
            <span>{getReviewItemScopeLabel(item)}</span>
            <span>{contextLabel(item)}</span>
          </div>
        </div>
      </div>

      <div className="review-item-detail-body">
        {sectionOrder.map((key) => (
          <Fragment key={key}>{sectionMap[key]}</Fragment>
        ))}
      </div>

      <div className="review-item-detail-footer">
        <div className="review-item-footer-actions">
          <button
            type="button"
            className="primary review-item-footer-action review-item-footer-action-primary"
            disabled={detailFooter.primary.disabled}
            aria-busy={detailFooter.primary.loading === true}
            onClick={() => runAction(detailFooter.primary)}
          >
            {renderFooterActionLabel(detailFooter.primary)}
          </button>
          {detailFooter.secondary.map((action) => (
            <button
              key={action.action}
              type="button"
              className={`review-item-footer-action ${action.tone === "danger" ? "ghost danger" : "ghost"}`}
              disabled={action.disabled}
              aria-busy={action.loading === true}
              onClick={() => runAction(action)}
            >
              {renderFooterActionLabel(action)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
