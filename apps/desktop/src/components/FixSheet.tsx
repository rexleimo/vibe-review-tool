import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./FixSheet.css";
import { formatInvokeError } from "../lib/formatInvokeError";

type FixStatus = "idle" | "loading" | "success" | "error";

interface FixSheetProps {
  repo: string;
  mode: "commit" | "workspace";
  commitSha: string | null;
  filePath: string;
  fileOldContent: string;
  fileNewContent: string;
  onClose: () => void;
}

interface SuggestFixResponse {
  suggestion: string;
  truncated: boolean;
}

export function FixSheet({
  repo,
  mode,
  commitSha,
  filePath,
  fileOldContent,
  fileNewContent,
  onClose,
}: FixSheetProps) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<FixStatus>("idle");
  const [suggestion, setSuggestion] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedError, setCopiedError] = useState(false);

  async function handleSend() {
    if (!prompt.trim()) return;

    setStatus("loading");
    setError("");
    setSuggestion("");

    try {
      const response = await invoke<SuggestFixResponse>("suggest_fix", {
        req: {
          repo,
          mode,
          commitSha,
          filePath,
          fileOldContent,
          fileNewContent,
          prompt: prompt.trim(),
        },
      });
      setSuggestion(response.suggestion);
      setTruncated(response.truncated);
      setStatus("success");
    } catch (err) {
      setError(formatInvokeError(err));
      setStatus("error");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(suggestion).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyError() {
    if (!error.trim()) return;
    navigator.clipboard.writeText(error).then(() => {
      setCopiedError(true);
      setTimeout(() => setCopiedError(false), 2000);
    });
  }

  function handleRetry() {
    setSuggestion("");
    setStatus("idle");
    setError("");
  }

  return (
    <section className="fix-backdrop" onClick={onClose}>
      <div className="fix-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="fix-head">
          <div>
            <p className="fix-kicker">AI / SUGGEST FIX</p>
            <h2>修复建议</h2>
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            关闭
          </button>
        </div>

        {/* File context */}
        <div className="fix-context">
          <span>当前文件</span>
          <strong>{filePath}</strong>
        </div>

        {/* Input area */}
        <div className="fix-input-area">
          <textarea
            className="fix-textarea"
            placeholder="描述你想要如何修复这个问题…例如：'这个函数没有处理空字符串的情况，请加上非空校验'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void handleSend();
              }
            }}
            disabled={status === "loading"}
            rows={3}
          />
          <div className="fix-input-actions">
            <span className="fix-hint">⌘ + Enter 发送</span>
            <button
              type="button"
              className="primary"
              onClick={() => void handleSend()}
              disabled={!prompt.trim() || status === "loading"}
            >
              {status === "loading" ? "分析中..." : "发送到 Codex CLI"}
            </button>
          </div>
        </div>

        {/* Response area */}
        {status === "loading" && (
          <div className="fix-response">
            <div className="fix-loading">
              <div className="fix-spinner" />
              <p>Codex CLI 正在分析代码并生成修复建议…</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="fix-response">
            <div className="fix-error">
              <pre className="fix-error-msg">{error}</pre>
              <div className="fix-response-actions">
                <button type="button" className="ghost" onClick={handleRetry}>
                  重试
                </button>
                <button type="button" className="ghost" onClick={handleCopyError}>
                  {copiedError ? "已复制 ✓" : "复制错误详情"}
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="fix-response">
            {truncated && (
              <div className="fix-note">
                上下文已按 diff 大小限制截断，修复建议基于截断后的上下文生成。
              </div>
            )}
            <pre className="fix-suggestion">{suggestion}</pre>
            <div className="fix-response-actions">
              <button type="button" className="ghost" onClick={handleCopy}>
                {copied ? "已复制 ✓" : "复制"}
              </button>
              <button type="button" className="ghost" onClick={handleRetry}>
                重新提问
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
