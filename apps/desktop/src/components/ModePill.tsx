import "./ModePill.css";

type Mode = "commit" | "workspace";

interface ModePillProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function ModePill({ mode, onModeChange }: ModePillProps) {
  return (
    <div className="mode-pill">
      <button
        className={`mode-pill-btn ${mode === "commit" ? "active" : ""}`}
        onClick={() => onModeChange("commit")}
      >
        Commits
      </button>
      <button
        className={`mode-pill-btn ${mode === "workspace" ? "active" : ""}`}
        onClick={() => onModeChange("workspace")}
      >
        Workspace
      </button>
    </div>
  );
}
