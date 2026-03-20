import { type ReviewBatchIssueSnapshot, type ReviewBatchRun } from "../lib/reviewBatchRuns.js";
import "./ReviewBatchRunDetail.css";

interface ReviewBatchRunDetailProps {
  batchRun: ReviewBatchRun | null;
  onBack: () => void;
  onJumpToIssue: (issueId: string) => void;
}

function statusLabel(status: ReviewBatchRun["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}

function formatScope(snapshot: ReviewBatchIssueSnapshot): string {
  if (snapshot.scopeType === "file") return "Whole File";
  if (snapshot.startLine === null || snapshot.endLine === null) return "Range";
  if (snapshot.startLine === snapshot.endLine) return `Line ${snapshot.startLine}`;
  return `Lines ${snapshot.startLine}-${snapshot.endLine}`;
}

export function ReviewBatchRunDetail({
  batchRun,
  onBack,
  onJumpToIssue,
}: ReviewBatchRunDetailProps) {
  if (!batchRun) {
    return (
      <section className="review-batch-run-detail empty">
        <p>还没有 batch run 可展示。</p>
        <span>发送 Open Issues 后，右侧会显示本次批量任务的执行档案。</span>
      </section>
    );
  }

  return (
    <section className="review-batch-run-detail">
      <div className="review-batch-run-head">
        <div className="review-batch-run-topbar">
          <button type="button" className="ghost small" onClick={onBack}>
            返回队列
          </button>
          <span className={`review-batch-run-status ${batchRun.status}`}>{statusLabel(batchRun.status)}</span>
        </div>
        <h3>{`Batch Run · ${batchRun.issueCount} Open Issues`}</h3>
        <p>{batchRun.provider === "codex" ? "Codex CLI" : batchRun.provider}</p>
      </div>

      <div className="review-batch-run-body">
        <div className="review-batch-run-section">
          <span className="review-batch-run-section-label">Included Issues</span>
          <ol className="review-batch-run-issues">
            {batchRun.issueSnapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <button type="button" className="review-batch-run-issue" onClick={() => onJumpToIssue(snapshot.id)}>
                  <strong>{snapshot.title}</strong>
                  <span>{snapshot.filePath}</span>
                  <span>{formatScope(snapshot)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="review-batch-run-section">
          <span className="review-batch-run-section-label">Brief</span>
          <pre className="review-batch-run-pre">{batchRun.briefText || "(empty)"}</pre>
        </div>

        <div className="review-batch-run-section">
          <span className="review-batch-run-section-label">Summary</span>
          <pre className="review-batch-run-pre">{batchRun.summary || "No provider summary yet."}</pre>
        </div>

        <div className="review-batch-run-section">
          <span className="review-batch-run-section-label">Changed Files</span>
          {batchRun.changedFiles.length === 0 ? (
            <p className="review-batch-run-empty">还没有记录变更文件。</p>
          ) : (
            <ul className="review-batch-run-files">
              {batchRun.changedFiles.map((changedFile) => (
                <li key={changedFile}>{changedFile}</li>
              ))}
            </ul>
          )}
        </div>

        {batchRun.lastError && (
          <div className="review-batch-run-section danger">
            <span className="review-batch-run-section-label">Last Error</span>
            <pre className="review-batch-run-pre">{batchRun.lastError}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
