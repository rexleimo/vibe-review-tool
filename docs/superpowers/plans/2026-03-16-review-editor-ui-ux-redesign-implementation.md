# Review Editor UI/UX 改造实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 review-editor 桌面应用从当前的深蓝色调 + 混乱 UX 改造成现代深色专业风格 + 清晰 UX 流程，包括欢迎屏、精简顶栏、侧边栏改进。

**Architecture:** 分阶段实施 — CSS 变量系统 → 欢迎屏组件 → 顶栏重构 → 侧边栏改进 → 整合测试。先建立设计系统，再逐步替换 UI 组件。

**Tech Stack:** React + TypeScript + Tauri + CSS Modules/Tokens

---

## 阶段概览

| 阶段 | 内容 | 文件变更 |
|------|------|----------|
| 1 | CSS 变量系统 + 字体加载 | App.css |
| 2 | 欢迎屏组件 | WelcomeScreen.tsx, useRecentProjects.ts |
| 3 | 顶栏重构 | TopBar.tsx, ModePill.tsx |
| 4 | 侧边栏改进 | SideBar.tsx, FileListItem.tsx |
| 5 | App 整合 + 测试 | App.tsx |

---

## Chunk 1: CSS 变量系统与字体加载

**目标:** 建立完整的设计 token 系统，替换现有的硬编码颜色值。

### Task 1.1: 备份并重写 App.css

**Files:**
- Modify: `apps/desktop/src/App.css:1-50`
- Test: Visual inspection in dev mode

- [ ] **Step 1: 备份现有 App.css**

```bash
cp apps/desktop/src/App.css apps/desktop/src/App.css.backup
```

- [ ] **Step 2: 在 App.css 开头添加 CSS 变量**

> **注意**: 使用 @fontsource/manrope npm 包后，不需要手动定义 @font-face。

```css
:root {
  /* Backgrounds */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;

  /* Borders */
  --border: #30363d;
  --border-light: #484f58;

  /* Text */
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;

  /* Accents */
  --accent-blue: #58a6ff;
  --accent-green: #3fb950;
  --accent-red: #f85149;
  --accent-yellow: #d29922;

  /* Diff colors */
  --diff-add-bg: rgba(63, 185, 80, 0.1);
  --diff-add-text: #7ee787;
  --diff-del-bg: rgba(248, 81, 73, 0.1);
  --diff-del-text: #ffa198;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 20px;

  /* Transitions */
  --transition: 0.15s ease;
}
```

- [ ] **Step 3: 替换 body 样式使用新变量**

```css
body {
  font-family: "Manrope", "Segoe UI", system-ui, sans-serif;
  color: var(--text-primary);
  background: var(--bg-primary);
}
```

- [ ] **Step 4: 安装 Manrope 字体 npm 包**

```bash
cd apps/desktop
npm install @fontsource/manrope
```

- [ ] **Step 5: 在 App.tsx 中导入字体**

在 App.tsx 顶部添加：
```typescript
import "@fontsource/manrope";
```

然后更新 App.css 中的 font-family：
```css
body {
  font-family: "Manrope", "Segoe UI", system-ui, sans-serif;
  color: var(--text-primary);
  background: var(--bg-primary);
}
```

- [ ] **Step 6: 验证开发服务器启动**

Run: `cd apps/desktop && npm run dev`
Expected: 页面加载无报错，字体正常显示

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/App.css apps/desktop/src/assets/
git commit -m "feat: add CSS design token system and Manrope font"
```

---

### Task 1.2: 更新现有组件使用 CSS 变量

**Files:**
- Modify: `apps/desktop/src/App.css` (继续添加兼容样式)

- [ ] **Step 1: 保留向后兼容的颜色映射（渐进式迁移）**

在 App.css 底部添加兼容层，将旧类名映射到新变量：

```css
/* Legacy color mappings for backward compatibility */
.bg { background: var(--bg-secondary); }
.bg-2 { background: var(--bg-tertiary); }
.line { border-color: var(--border); }
.text { color: var(--text-primary); }
.muted { color: var(--text-secondary); }
.accent { color: var(--accent-blue); }
.accent-2 { color: var(--accent-green); }
.danger { color: var(--accent-red); }
```

- [ ] **Step 2: 验证主要 UI 元素仍然正常显示**

Run: `cd apps/desktop && npm run dev`
检查：顶栏、侧边栏、diff 面板基本可读

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/App.css
git commit -m "chore: add legacy color mappings for compatibility"
```

---

## Chunk 2: 欢迎屏组件

**目标:** 创建欢迎屏组件，处理无项目时的 UI，展示最近项目和打开仓库入口。

### Task 2.1: 创建 useRecentProjects Hook

**Files:**
- Create: `apps/desktop/src/hooks/useRecentProjects.ts`
- Test: `apps/desktop/src/hooks/useRecentProjects.test.ts` (可选)

- [ ] **Step 1: 创建 hooks 目录结构**

```bash
mkdir -p apps/desktop/src/hooks
```

- [ ] **Step 2: 编写 useRecentProjects Hook**

> **注意**: 根据设计规范 3.3，使用 `@tauri-apps/plugin-store` 持久化存储。

```typescript
import { useState, useEffect, useCallback } from "react";
import { LazyStore } from "@tauri-apps/plugin-store";

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
}

const STORE_KEY = "recent-projects";
const MAX_RECENT = 5;

// 生成唯一 ID（使用时间戳 + 随机数）
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const store = new LazyStore("review-editor.dat");

export function useRecentProjects() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);

  // 从 Tauri store 加载
  const loadProjects = useCallback(async () => {
    try {
      const stored = await store.get<RecentProject[]>(STORE_KEY);
      if (stored) {
        setRecentProjects(stored);
      }
    } catch (e) {
      console.error("Failed to load recent projects:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 添加项目并保存（ID 由 hook 内部生成）
  const addRecentProject = async (project: Omit<RecentProject, "id" | "lastOpenedAt">) => {
    const now = new Date().toISOString();
    const newProject: RecentProject = {
      ...project,
      id: generateId(),
      lastOpenedAt: now,
    };

    const updated = [newProject, ...recentProjects.filter((p) => p.path !== project.path)].slice(
      0,
      MAX_RECENT,
    );
    setRecentProjects(updated);
    await store.set(STORE_KEY, updated);
    await store.save();
  };

  // 删除项目
  const removeRecentProject = async (id: string) => {
    const updated = recentProjects.filter((p) => p.id !== id);
    setRecentProjects(updated);
    await store.set(STORE_KEY, updated);
    await store.save();
  };

  return {
    recentProjects,
    loading,
    addRecentProject,
    removeRecentProject,
  };
}
```

- [ ] **Step 3: 安装 Tauri store plugin**

```bash
cd apps/desktop
npm install @tauri-apps/plugin-store
```

- [ ] **Step 4: 验证 Hook 编译通过**

Run: `cd apps/desktop && npx tsc --noEmit src/hooks/useRecentProjects.ts`
Expected: 无编译错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/hooks/useRecentProjects.ts
git commit -m "feat: add useRecentProjects hook for recent projects management"
```

---

### Task 2.2: 创建 WelcomeScreen 组件

**Files:**
- Create: `apps/desktop/src/components/WelcomeScreen.tsx`
- Create: `apps/desktop/src/components/WelcomeScreen.css`

- [ ] **Step 1: 创建 WelcomeScreen 组件结构**

```typescript
import React from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useRecentProjects, RecentProject } from "../hooks/useRecentProjects";
import "./WelcomeScreen.css";

interface WelcomeScreenProps {
  onProjectSelect: (path: string, name: string) => void;
}

export function WelcomeScreen({ onProjectSelect }: WelcomeScreenProps) {
  const { recentProjects, addRecentProject } = useRecentProjects();

  const handleOpenRepo = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "选择 Git 仓库目录",
      });

      if (selected) {
        const path = selected as string;
        const name = path.split("/").pop() || "Untitled";
        // Hook 内部生成 ID
        addRecentProject({ name, path });
        onProjectSelect(path, name);
      }
    } catch (e) {
      console.error("Failed to open dialog:", e);
    }
  };

  const handleProjectClick = (project: RecentProject) => {
    // 更新最近打开时间
    addRecentProject({ name: project.name, path: project.path });
    onProjectSelect(project.path, project.name);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-hero">
          <div className="welcome-logo">⬡</div>
          <h2>打开一个 Git 仓库</h2>
          <p>选择本地仓库目录开始查看 diff 和提交历史</p>
        </div>

        <button className="welcome-open-btn" onClick={handleOpenRepo}>
          ＋ 打开仓库
        </button>

        {recentProjects.length > 0 && (
          <div className="recent-projects">
            <div className="recent-header">最近打开</div>
            <div className="recent-list">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="recent-item"
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="recent-item-info">
                    <div className="recent-item-name">{project.name}</div>
                    <div className="recent-item-path">{project.path}</div>
                  </div>
                  <div className="recent-item-time">
                    {formatTime(project.lastOpenedAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 WelcomeScreen CSS**

```css
.welcome-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 40px 24px;
}

.welcome-content {
  width: 100%;
  max-width: 560px;
}

.welcome-hero {
  text-align: center;
  margin-bottom: 36px;
}

.welcome-logo {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-green));
  border-radius: 12px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.welcome-hero h2 {
  color: var(--text-primary);
  font-size: 20px;
  margin: 0 0 8px;
}

.welcome-hero p {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0;
}

.welcome-open-btn {
  display: block;
  width: 100%;
  max-width: 200px;
  margin: 0 auto 32px;
  background: #238636;
  border: 1px solid #2ea043;
  border-radius: var(--radius-md);
  padding: 9px 20px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition);
}

.welcome-open-btn:hover {
  background: #2ea043;
}

.recent-projects {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.recent-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.recent-item {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background var(--transition);
}

.recent-item:hover {
  background: var(--bg-tertiary);
}

.recent-item:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.recent-item-info {
  min-width: 0;
}

.recent-item-name {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.recent-item-path {
  color: var(--text-secondary);
  font-size: 11px;
  margin-top: 2px;
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-item-time {
  color: var(--text-muted);
  font-size: 11px;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 验证组件编译通过**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/WelcomeScreen.tsx apps/desktop/src/components/WelcomeScreen.css
git commit -m "feat: add WelcomeScreen component"
```

---

## Chunk 3: 顶栏重构

**目标:** 精简顶栏，将模式切换改为 pill 组件。

### Task 3.1: 创建 ModePill 组件

**Files:**
- Create: `apps/desktop/src/components/ModePill.tsx`
- Create: `apps/desktop/src/components/ModePill.css`

- [ ] **Step 1: 创建 ModePill 组件**

```typescript
import React from "react";
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
```

- [ ] **Step 2: 创建 ModePill CSS**

```css
.mode-pill {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 3px;
  display: flex;
  gap: 2px;
}

.mode-pill-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--transition);
}

.mode-pill-btn:hover {
  color: var(--text-primary);
}

.mode-pill-btn.active {
  background: var(--accent-blue);
  color: var(--bg-primary);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/ModePill.tsx apps/desktop/src/components/ModePill.css
git commit -m "feat: add ModePill component for mode switching"
```

---

### Task 3.2: 创建精简版 TopBar 组件

**Files:**
- Create: `apps/desktop/src/components/TopBar.tsx`
- Create: `apps/desktop/src/components/TopBar.css`

- [ ] **Step 1: 分析现有 App.tsx 中的顶栏逻辑**

关键 state：
- `repo`: 当前仓库路径
- `mode`: "commit" | "workspace"
- `activeProject`: 当前激活的项目

- [ ] **Step 2: 创建 TopBar 组件**

```typescript
import React from "react";
import { ModePill } from "./ModePill";
import "./TopBar.css";

type Mode = "commit" | "workspace";

interface TopBarProps {
  repo: string;
  projectName?: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onRefresh: () => void;
  onSwitchProject: () => void;
}

export function TopBar({
  repo,
  projectName,
  mode,
  onModeChange,
  onRefresh,
  onSwitchProject,
}: TopBarProps) {
  const displayPath = repo || "未选择仓库";
  const displayName = projectName || "review-editor";

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo" />
        <span className="topbar-name">{displayName}</span>
        <span className="topbar-separator">›</span>
        <span className="topbar-path">{displayPath}</span>
        <button className="topbar-switch-btn" onClick={onSwitchProject}>
          切换项目
        </button>
      </div>
      <div className="topbar-right">
        <ModePill mode={mode} onModeChange={onModeChange} />
        <button className="topbar-refresh-btn" onClick={onRefresh}>
          ↻ 刷新
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 TopBar CSS**

```css
.topbar {
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.topbar-logo {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-green));
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.topbar-name {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.topbar-separator {
  color: var(--text-muted);
  font-size: 12px;
}

.topbar-path {
  color: var(--text-secondary);
  font-size: 12px;
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-switch-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}

.topbar-switch-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.topbar-refresh-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition);
}

.topbar-refresh-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/TopBar.tsx apps/desktop/src/components/TopBar.css
git commit -m "feat: add TopBar component"
```

---

## Chunk 4: 侧边栏改进

**目标:** 改进侧边栏，添加统计栏，优化文件列表项样式。

### Task 4.1: 创建 FileListItem 组件

**Files:**
- Create: `apps/desktop/src/components/FileListItem.tsx`
- Create: `apps/desktop/src/components/FileListItem.css`

- [ ] **Step 1: 创建 FileListItem 组件**

```typescript
import React from "react";
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
```

- [ ] **Step 2: 创建 FileListItem CSS**

```css
.file-list-item {
  padding: 7px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background var(--transition);
  border-left: 2px solid transparent;
}

.file-list-item:hover {
  background: var(--bg-tertiary);
}

.file-list-item.selected {
  background: var(--bg-tertiary);
  border-left-color: var(--accent-blue);
}

.file-status {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  min-width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.file-dir {
  color: var(--text-secondary);
  font-size: 11px;
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-name {
  color: var(--text-primary);
  font-size: 12px;
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-list-item.selected .file-name {
  color: var(--text-primary);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/FileListItem.tsx apps/desktop/src/components/FileListItem.css
git commit -m "feat: add FileListItem component"
```

---

### Task 4.2: 重构 SideBar 组件

**Files:**
- Create: `apps/desktop/src/components/SideBar.tsx` (替换内联实现)
- Create: `apps/desktop/src/components/SideBar.css`

- [ ] **Step 1: 分析现有 App.tsx 中的侧边栏逻辑**

关键 state：
- `commits`: 提交列表
- `files`: 文件列表
- `selectedCommit`: 选中的提交
- `selectedFile`: 选中的文件
- `activeSidebarTab`: "commits" | "files"
- `graphLoading`, `filesLoading`: 加载状态
- 统计计算: additions, deletions

- [ ] **Step 2: 创建 SideBar 组件**

```typescript
import React, { useMemo } from "react";
import { FileListItem } from "./FileListItem";
import "./SideBar.css";

interface SideBarProps {
  mode: "commit" | "workspace";
  // Commits
  commits: CommitNode[];
  selectedCommit: string | null;
  onCommitSelect: (sha: string) => void;
  // Files
  files: ChangedFile[];
  selectedFile: ChangedFile | null;
  onFileSelect: (file: ChangedFile) => void;
  // Loading states
  loading: boolean;
}

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

export function SideBar({
  mode,
  commits,
  selectedCommit,
  onCommitSelect,
  files,
  selectedFile,
  onFileSelect,
  loading,
}: SideBarProps) {
  // 计算统计
  const stats = useMemo(() => {
    if (mode === "workspace") {
      let additions = 0;
      let deletions = 0;
      // 需要后端提供准确统计，暂时显示文件数
      return { additions: 0, deletions: 0, fileCount: files.length };
    }
    return { additions: 0, deletions: 0, fileCount: files.length };
  }, [mode, files]);

  const statusCounts = useMemo(() => {
    const counts = { M: 0, A: 0, D: 0 };
    files.forEach((f) => {
      const status = f.status[0] as "M" | "A" | "D";
      if (status in counts) counts[status]++;
    });
    return counts;
  }, [files]);

  return (
    <div className="sidebar">
      <div className="sidebar-stats">
        <span className="stat-add">+{statusCounts.A + statusCounts.M}</span>
        <span className="stat-del">-{statusCounts.D}</span>
        <span className="stat-files">{files.length} files</span>
      </div>

      <div className="sidebar-content">
        {loading ? (
          <div className="sidebar-loading">加载中...</div>
        ) : mode === "commit" ? (
          <div className="commit-list">
            {commits.map((commit) => (
              <div
                key={commit.sha}
                className={`commit-row ${selectedCommit === commit.sha ? "selected" : ""}`}
                onClick={() => onCommitSelect(commit.sha)}
              >
                <div className="commit-info">
                  <div className="commit-subject">{commit.subject}</div>
                  <div className="commit-meta">
                    {commit.author} · {commit.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="file-list">
            {files.map((file) => (
              <FileListItem
                key={file.path}
                path={file.path}
                status={file.status[0] as "M" | "A" | "D"}
                isSelected={selectedFile?.path === file.path}
                onClick={() => onFileSelect(file)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 SideBar CSS**

```css
.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.sidebar-stats {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  display: flex;
  gap: 14px;
  align-items: center;
}

.stat-add {
  color: var(--accent-green);
  font-size: 11px;
  font-weight: 700;
}

.stat-del {
  color: var(--accent-red);
  font-size: 11px;
  font-weight: 700;
}

.stat-files {
  color: var(--text-secondary);
  font-size: 11px;
}

.sidebar-content {
  flex: 1;
  overflow: auto;
  padding: 4px 0;
}

.sidebar-loading {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

/* Commit list styles */
.commit-row {
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background var(--transition);
}

.commit-row:hover {
  background: var(--bg-tertiary);
}

.commit-row.selected {
  background: var(--bg-tertiary);
  border-left-color: var(--accent-blue);
}

.commit-info {
  min-width: 0;
}

.commit-subject {
  color: var(--text-primary);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commit-meta {
  color: var(--text-secondary);
  font-size: 10px;
  margin-top: 2px;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/SideBar.tsx apps/desktop/src/components/SideBar.css
git commit -m "feat: add SideBar component with stats bar"
```

---

## Chunk 5: App 整合

**目标:** 将所有新组件整合到 App.tsx，移除旧的顶栏和侧边栏实现。

### Task 5.1: 整合 WelcomeScreen 到 App

**Files:**
- Modify: `apps/desktop/src/App.tsx:515-600`

- [ ] **Step 1: 在 App.tsx 顶部添加 WelcomeScreen 导入**

```typescript
import { WelcomeScreen } from "./components/WelcomeScreen";
```

- [ ] **Step 2: 添加 hasProject 状态**

在 App 函数中添加：
```typescript
const hasProject = repo && repo.trim().length > 0;
```

- [ ] **Step 3: 替换主渲染逻辑**

> **注意**: TopBar, SideBar, DiffPanel 的具体 props 在 Task 5.2 中定义。此步骤先保留占位符，Task 5.2 会补全。

找到现有的 return 语句，添加条件渲染：
```typescript
return (
  <div className="screen">
    {hasProject ? (
      <>
        {/* TopBar 和 SideBar 在 Task 5.2 中整合 */}
        {/* 暂时保留现有的顶栏和侧边栏实现 */}
        <div className="topbar">...</div>
        <div className="workbench">
          <div className="sidebar">...</div>
          <div className="diff-panel">...</div>
        </div>
      </>
    ) : (
      <WelcomeScreen
        onProjectSelect={(path, name) => {
          setRepo(path);
          setRepoDraft(path);
          // 触发数据加载
          loadCommits();
          loadFiles();
        }}
      />
    )}
  </div>
);
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: 无编译错误

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/App.tsx
git commit -m "feat: integrate WelcomeScreen to App"
```

---

### Task 5.2: 整合 TopBar 和 SideBar

**Files:**
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: 导入新组件**

```typescript
import { TopBar } from "./components/TopBar";
import { SideBar } from "./components/SideBar";
```

- [ ] **Step 2: 替换顶栏渲染**

> **注意**: `activeProject`, `setShowProjectCenter`, `loadCommits`, `loadFiles` 是 App.tsx 中已存在的 state 和函数。

找到顶栏相关的 JSX，替换为：
```typescript
<TopBar
  repo={repo}
  projectName={activeProject?.name}
  mode={mode}
  onModeChange={setMode}
  onRefresh={() => {
    // 这些函数已存在于 App.tsx 中
    if (mode === "commit") {
      loadCommits();
    } else {
      loadFiles();
    }
  }}
  onSwitchProject={() => setShowProjectCenter(true)}
/>
```

- [ ] **Step 3: 替换侧边栏渲染**

找到侧边栏相关的 JSX，替换为：
```typescript
<SideBar
  mode={mode}
  commits={commits}
  selectedCommit={selectedCommit}
  onCommitSelect={setSelectedCommit}
  files={files}
  selectedFile={selectedFile}
  onFileSelect={setSelectedFile}
  loading={graphLoading || filesLoading}
/>
```

- [ ] **Step 4: 删除不再需要的旧状态**

可以删除：
- `sidebarTab` (不再需要)
- `setSidebarTab`

- [ ] **Step 5: 验证编译和运行**

Run: `cd apps/desktop && npm run dev`
Expected: 应用正常启动，新 UI 显示

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/App.tsx
git commit -m "feat: integrate TopBar and SideBar components"
```

---

### Task 5.3: 最终验证与清理

- [ ] **Step 1: 删除备份文件**

```bash
rm apps/desktop/src/App.css.backup
```

- [ ] **Step 2: 运行完整测试**

Run: `cd apps/desktop && npm run build`
Expected: 构建成功

- [ ] **Step 3: 手动测试验收标准**

对照设计文档 6.1-6.3 验收标准逐项检查：
- [ ] 整体配色符合配色方案表
- [ ] 去掉渐变背景，改用纯色 + 边框
- [ ] 无项目时显示欢迎屏
- [ ] 欢迎屏有「打开仓库」主按钮
- [ ] 欢迎屏显示最近项目列表
- [ ] 模式切换 pill 在顶栏右侧
- [ ] 侧边栏顶部显示统计信息
- [ ] 选中文件有左边框高亮
- [ ] 现有 diff 查看功能不受影响

- [ ] **Step 4: Commit 清理**

```bash
git add -A
git commit -m "feat: complete UI/UX redesign - welcome screen, topbar, sidebar"
```

---

## 实施注意事项

1. **渐进式迁移**: 不要一次性删除所有旧代码，先添加新组件，确认工作后再逐步移除旧实现
2. **类型兼容**: 确保 TypeScript 类型正确，特别是 `ChangedFile` 和 `CommitNode` 类型
3. **Tauri 集成**: 确认 `openDialog` 等 Tauri API 在新组件中正常工作
4. **响应式**: 新 CSS 需要在不同窗口尺寸下正常工作

## 后续工作（超出 P0）

- 双主题系统（浅色/深色切换）
- 文件树层级展开/折叠
- 搜索/过滤文件
- 分屏查看多个文件 diff
