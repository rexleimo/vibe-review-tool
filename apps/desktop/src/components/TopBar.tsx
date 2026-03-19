import { ModePill } from "./ModePill";
import "./TopBar.css";

type Mode = "commit" | "workspace";

interface TopBarProps {
  projectName?: string;
  projectPathHint?: string;
  contextMeta: string;
  contextHeadline: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onRefresh: () => void;
  onSwitchProject: () => void;
  onPrimaryAiAction: () => void;
}

export function TopBar({
  projectName,
  projectPathHint,
  contextMeta,
  contextHeadline,
  mode,
  onModeChange,
  onRefresh,
  onSwitchProject,
  onPrimaryAiAction,
}: TopBarProps) {
  const displayName = projectName || "Review Editor";
  const displayPathHint = projectPathHint || "";

  return (
    <header className="topbar">
      <div className="topbar-left" data-tauri-drag-region>
        <div className="topbar-logo" />
        <button className="topbar-switcher" onClick={onSwitchProject}>
          <span className="topbar-switcher-main">{displayName}</span>
          {displayPathHint && (
            <span className="topbar-switcher-sub" title={displayPathHint}>
              {displayPathHint}
            </span>
          )}
          <span className="topbar-switcher-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>

      <div className="topbar-center" data-tauri-drag-region>
        <p className="topbar-meta">{contextMeta}</p>
        <h1 className="topbar-headline" title={contextHeadline}>
          {contextHeadline}
        </h1>
      </div>

      <div className="topbar-right">
        <div className="topbar-controls">
          <button className="topbar-ai-btn" onClick={onPrimaryAiAction}>
            AI
          </button>
          <button className="topbar-refresh-btn" onClick={onRefresh}>
            刷新
          </button>
          <div className="topbar-controls-divider" aria-hidden="true" />
          <ModePill mode={mode} onModeChange={onModeChange} />
        </div>
      </div>
    </header>
  );
}
