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
    <header className="topbar" data-tauri-drag-region>
      <div className="topbar-left" data-tauri-drag-region>
        <div className="topbar-project-indicator" onClick={onSwitchProject}>
          <div className="topbar-logo" />
          <span className="topbar-project-name">{displayName}</span>
          {displayPathHint && (
            <span className="tiny" style={{ opacity: 0.5, marginLeft: 4 }}>
              {displayPathHint}
            </span>
          )}
        </div>
      </div>

      <div className="topbar-center" data-tauri-drag-region>
        <p className="topbar-meta">{contextMeta}</p>
        <h1 className="topbar-headline" title={contextHeadline}>
          {contextHeadline}
        </h1>
      </div>

      <div className="topbar-right">
        <div className="topbar-controls">
          <ModePill mode={mode} onModeChange={onModeChange} />
          <button
            type="button"
            className="topbar-refresh-btn"
            onClick={onRefresh}
            title="Refresh"
          >
            ↻
          </button>
          <button
            type="button"
            className="topbar-ai-btn"
            onClick={onPrimaryAiAction}
          >
            ✦ Summary
          </button>
        </div>
      </div>
    </header>
  );
}
