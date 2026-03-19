import "./FileListItem.css";

interface FileListItemProps {
  path: string;
  status: "M" | "A" | "D" | "R" | "C" | "T" | "U";
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  M: "M",
  A: "A",
  D: "D",
  R: "R",
  C: "C",
  T: "T",
  U: "U",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  M: { bg: "rgba(88, 166, 255, 0.15)", text: "var(--accent-blue)" },
  A: { bg: "rgba(63, 185, 80, 0.15)", text: "var(--accent-green)" },
  D: { bg: "rgba(248, 81, 73, 0.15)", text: "var(--accent-red)" },
  R: { bg: "rgba(240, 154, 54, 0.15)", text: "var(--accent-yellow)" },
  C: { bg: "rgba(240, 154, 54, 0.15)", text: "var(--accent-yellow)" },
  T: { bg: "rgba(240, 154, 54, 0.15)", text: "var(--accent-yellow)" },
  U: { bg: "rgba(240, 154, 54, 0.15)", text: "var(--accent-yellow)" },
};

export function FileListItem({ path, status, isSelected, onClick }: FileListItemProps) {
  const fileName = path.split("/").pop() || path;
  const dirPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.U;

  return (
    <div
      className={`file-list-item ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span
        className="file-status"
        style={{ background: statusStyle.bg, color: statusStyle.text }}
      >
        {STATUS_LABELS[status] || "U"}
      </span>
      {dirPath && <span className="file-dir">{dirPath}/</span>}
      <span className="file-name">{fileName}</span>
    </div>
  );
}
