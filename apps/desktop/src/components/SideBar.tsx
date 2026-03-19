import { useMemo, useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { FileListItem } from "./FileListItem";
import "./SideBar.css";

interface CommitNode {
  sha: string;
  subject: string;
  author: string;
  date: string;
}

interface ChangedFile {
  path: string;
  status: string;
}

interface SideBarProps {
  mode: "commit" | "workspace";
  style?: CSSProperties;
  commits: CommitNode[];
  selectedCommit: string | null;
  onCommitSelect: (sha: string) => void;
  files: ChangedFile[];
  selectedFile: ChangedFile | null;
  onFileSelect: (file: ChangedFile) => void;
  loading: boolean;
}

type FileViewMode = "tree" | "flat";

// ─── File tree types ──────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: ChangedFile;
}

function buildFileTree(files: ChangedFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      if (isLast) {
        const existing = current.find((n) => n.name === part && !n.isDir);
        if (!existing) {
          current.push({ name: part, path: currentPath, isDir: false, children: [], file });
        }
      } else {
        let node = current.find((n) => n.name === part && n.isDir);
        if (!node) {
          node = { name: part, path: currentPath, isDir: true, children: [] };
          current.push(node);
        }
        current = node.children;
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => { if (n.isDir) sortNodes(n.children); });
  };
  sortNodes(root);
  return root;
}

const STATUS_COLORS: Record<string, string> = {
  M: "#f5a623", A: "#7ed321", D: "#d0021b",
  R: "#9013fe", C: "#4a90d9", T: "#f5a623", U: "#999",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status[0]] ?? "#999";
}

interface FileTreeRowProps {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (file: ChangedFile) => void;
}

function FileTreeRow({ node, depth, expandedPaths, onToggle, selectedPath, onSelect }: FileTreeRowProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const indent = depth * 16;

  if (node.isDir) {
    return (
      <>
        <div className="tree-row tree-dir" style={{ paddingLeft: 12 + indent }} onClick={() => onToggle(node.path)} title={node.path}>
          <span className="tree-chevron">
            {isExpanded ? (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 1.5L5 4L2 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </span>
          <span className="tree-icon">
            {isExpanded ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 3h4.5v10H2z" fill="#c4a000" stroke="#c4a000" strokeWidth="0.5"/><path d="M6.5 5h7.5v8H6.5z" fill="#e8c34a" stroke="#c4a000" strokeWidth="0.5"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 3h4.5v10H2z" fill="#c4a000" stroke="#c4a000" strokeWidth="0.5"/><path d="M6.5 5h7.5v8H6.5z" fill="#e8c34a" stroke="#c4a000" strokeWidth="0.5"/></svg>
            )}
          </span>
          <span className="tree-name">{node.name}</span>
          <span className="tree-count">{node.children.length}</span>
        </div>
        {isExpanded && node.children.map((child) => (
          <FileTreeRow key={child.path} node={child} depth={depth + 1} expandedPaths={expandedPaths} onToggle={onToggle} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </>
    );
  }

  return (
    <div className={`tree-row tree-file ${isSelected ? "selected" : ""}`} style={{ paddingLeft: 12 + indent }} onClick={() => node.file && onSelect(node.file)} title={node.path}>
      <span className="tree-chevron" />
      <span className="tree-status" style={{ color: node.file ? getStatusColor(node.file.status) : undefined }}>{node.file?.status ?? "?"}</span>
      <span className="tree-icon">
        <svg width="11" height="13" viewBox="0 0 14 16" fill="none">
          <path d="M2 1h7.5L13 4.5v10.5H2z" fill="#e8e8e8" stroke="#999" strokeWidth="0.8"/>
          <path d="M9 1v4h4" fill="none" stroke="#999" strokeWidth="0.8"/>
          <line x1="4" y1="8" x2="11" y2="8" stroke="#999" strokeWidth="0.8"/>
          <line x1="4" y1="10.5" x2="11" y2="10.5" stroke="#999" strokeWidth="0.8"/>
          <line x1="4" y1="13" x2="8" y2="13" stroke="#999" strokeWidth="0.8"/>
        </svg>
      </span>
      <span className="tree-name">{node.name}</span>
    </div>
  );
}

// ─── Main SideBar ──────────────────────────────────────────────────────────────

export function SideBar({
  mode, style, commits, selectedCommit, onCommitSelect,
  files, selectedFile, onFileSelect, loading,
}: SideBarProps) {
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>("flat");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [showViewMenu, setShowViewMenu] = useState(false);
  const viewMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  const viewMenuFirstItemRef = useRef<HTMLButtonElement | null>(null);

  const statusCounts = useMemo(() => {
    const counts = { add: 0, mod: 0, del: 0 };
    files.forEach((f) => {
      const s = f.status[0];
      if (s === "A" || s === "?") counts.add++;
      else if (s === "M" || s === "T") counts.mod++;
      else if (s === "D") counts.del++;
    });
    return counts;
  }, [files]);

  const selectedCommitNode = useMemo(
    () => commits.find((c) => c.sha === selectedCommit) ?? null,
    [commits, selectedCommit],
  );

  const tree = useMemo(() => buildFileTree(files), [files]);

  // Collect all directory paths when tree changes
  useEffect(() => {
    const allDirs = new Set<string>();
    const collectDirs = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isDir) { allDirs.add(node.path); collectDirs(node.children); }
      }
    };
    collectDirs(tree);
    setExpandedPaths(allDirs);
  }, [files]);

  useEffect(() => {
    if (!showViewMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (viewMenuRef.current?.contains(target)) return;
      if (viewMenuButtonRef.current?.contains(target)) return;
      setShowViewMenu(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setShowViewMenu(false);
      viewMenuButtonRef.current?.focus();
    };

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => viewMenuFirstItemRef.current?.focus());

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showViewMenu]);

  function selectFileViewMode(next: FileViewMode): void {
    setFileViewMode(next);
    setShowViewMenu(false);
    viewMenuButtonRef.current?.focus();
  }

  const toggleDir = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderFileContent = () => {
    if (mode === "commit" && !selectedCommit) {
      return <div className="sidebar-loading">选择一个 commit 查看文件</div>;
    }
    if (loading) return <div className="sidebar-loading">加载文件中...</div>;
    if (files.length === 0) return <div className="sidebar-loading">无变更文件</div>;

    if (fileViewMode === "tree") {
      return (
        <div className="file-tree">
          {tree.map((node) => (
            <FileTreeRow key={node.path} node={node} depth={0}
              expandedPaths={expandedPaths} onToggle={toggleDir}
              selectedPath={selectedFile?.path ?? null} onSelect={onFileSelect} />
          ))}
        </div>
      );
    }

    return (
      <div className="file-list">
        {files.map((file) => (
          <FileListItem
            key={file.path}
            path={file.path}
            status={file.status[0] as "M" | "A" | "D" | "R" | "C" | "T" | "U"}
            isSelected={selectedFile?.path === file.path}
            onClick={() => onFileSelect(file)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="sidebar" style={style}>
      {/* Top panel: commit list */}
      <div className="sb-top-panel">
        <div className="sb-panel-header">
          <span className="sb-panel-title">COMMITS</span>
        </div>
        <div className="sb-panel-content">
          {loading ? (
            <div className="sidebar-loading">加载中...</div>
          ) : (
            <div className="commit-list">
              {commits.length === 0 && <div className="sidebar-loading">暂无提交</div>}
              {commits.map((commit) => (
                <div key={commit.sha}
                  className={`sb-commit-row ${selectedCommit === commit.sha ? "selected" : ""}`}
                  onClick={() => onCommitSelect(commit.sha)}
                  title={`${commit.subject}\n${commit.author} · ${commit.date}`}
                >
                  <div className="sb-commit-info">
                    <div className="sb-commit-subject">{commit.subject}</div>
                    <div className="sb-commit-meta">{commit.author} · {commit.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="sb-panel-divider" />

      {/* Bottom panel: file list */}
      <div className="sb-bottom-panel">
        <div className="sb-panel-header">
          <span className="sb-panel-title">CHANGED FILES</span>
          {mode === "commit" && selectedCommitNode && (
            <span className="sb-panel-subtitle" title={selectedCommitNode.subject}>{selectedCommitNode.subject}</span>
          )}
          {files.length > 0 && (
            <>
              <span className="stat-add">+{statusCounts.add + statusCounts.mod}</span>
              <span className="stat-del">-{statusCounts.del}</span>
            </>
          )}
          <div className="sb-view-menu-wrap">
            <button
              ref={viewMenuButtonRef}
              type="button"
              className={showViewMenu ? "sb-view-menu-button active" : "sb-view-menu-button"}
              aria-haspopup="menu"
              aria-expanded={showViewMenu}
              title="查看方式"
              onClick={() => setShowViewMenu((prev) => !prev)}
            >
              {fileViewMode === "flat" ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor" opacity="0.8" />
                  <rect x="1" y="6.5" width="14" height="3" rx="1" fill="currentColor" opacity="0.8" />
                  <rect x="1" y="11" width="14" height="3" rx="1" fill="currentColor" opacity="0.8" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="3" cy="3" r="1.5" fill="currentColor" />
                  <circle cx="3" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="3" cy="13" r="1.5" fill="currentColor" />
                  <line x1="5" y1="3" x2="9" y2="3" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="5" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="5" y1="13" x2="9" y2="13" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" opacity="0.6" />
                  <rect x="9" y="6" width="6" height="4" rx="1" fill="currentColor" opacity="0.6" />
                  <rect x="9" y="11" width="6" height="4" rx="1" fill="currentColor" opacity="0.6" />
                </svg>
              )}
            </button>

            {showViewMenu && (
              <div ref={viewMenuRef} className="sb-view-menu" role="menu" aria-label="查看方式">
                <button
                  ref={viewMenuFirstItemRef}
                  type="button"
                  className={fileViewMode === "flat" ? "sb-view-menu-item checked" : "sb-view-menu-item"}
                  role="menuitemradio"
                  aria-checked={fileViewMode === "flat"}
                  onClick={() => selectFileViewMode("flat")}
                >
                  <span className="sb-view-menu-label">以列表形式查看</span>
                  <span className="sb-view-menu-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
                <button
                  type="button"
                  className={fileViewMode === "tree" ? "sb-view-menu-item checked" : "sb-view-menu-item"}
                  role="menuitemradio"
                  aria-checked={fileViewMode === "tree"}
                  onClick={() => selectFileViewMode("tree")}
                >
                  <span className="sb-view-menu-label">以树形式查看</span>
                  <span className="sb-view-menu-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="sb-panel-content">
          {renderFileContent()}
        </div>
      </div>
    </div>
  );
}
