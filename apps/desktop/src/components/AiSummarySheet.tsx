import { type AiProvider } from "../hooks/useAiProvider";
import "./AiSummarySheet.css";

type SummaryStatus = "idle" | "loading" | "success" | "error";

interface AiSummarySheetProps {
  status: SummaryStatus;
  provider: AiProvider;
  providerLabel: string;
  truncated: boolean;
  summary: string;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
}

export function AiSummarySheet({
  status,
  provider,
  providerLabel,
  truncated,
  summary,
  error,
  onClose,
  onRetry,
  onOpenSettings,
}: AiSummarySheetProps) {
  return (
    <section className="ai-summary-backdrop" onClick={onClose}>
      <div
        className="ai-summary"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="ai-summary-head">
          <div>
            <p className="ai-summary-kicker">AI / REVIEW SUMMARY</p>
            <h2>Generate Review Summary</h2>
          </div>
          <div className="ai-summary-head-actions">
            <button type="button" className="ghost small" onClick={onOpenSettings}>
              Provider
            </button>
            <button type="button" className="ghost small" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="ai-summary-body">
          <div className="ai-summary-meta">
            <span>当前 Provider</span>
            <strong>{providerLabel || provider}</strong>
          </div>

          {status === "loading" && (
            <div className="ai-summary-panel">
              <p className="ai-summary-state">正在调用 {providerLabel || provider} 生成当前评审总结...</p>
            </div>
          )}

          {status === "error" && (
            <div className="ai-summary-panel">
              <p className="ai-summary-state error">{error}</p>
              <div className="ai-summary-actions">
                <button type="button" className="primary" onClick={onRetry}>
                  重新生成
                </button>
                <button type="button" className="ghost" onClick={onOpenSettings}>
                  切换 Provider
                </button>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="ai-summary-panel">
              {truncated && (
                <div className="ai-summary-note">
                  上下文已按文件数和 diff 大小限制截断，结果基于当前截断后的评审上下文生成。
                </div>
              )}
              <pre className="ai-summary-content">{summary}</pre>
              <div className="ai-summary-actions">
                <button type="button" className="primary" onClick={onRetry}>
                  重新生成
                </button>
                <button type="button" className="ghost" onClick={onOpenSettings}>
                  切换 Provider
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
