# Review Editor UI/UX 改造设计

**Date:** 2026-03-16
**Project:** review-editor
**Scope:** 视觉 + UX 流程改造（P0，不涉及后端功能变更）

---

## 1. 背景与目标

### 1.1 当前问题

用户反馈的主要痛点：
1. **视觉平淡**：深蓝色调看起来像默认 Tailwind 启动器，缺乏个性
2. **UX 流程混乱**：打开项目流程、模式切换、文件导航、加载刷新全部需要改善
3. **侧边栏难用**：Commits 和 Files 混在 tab 里切换，缺少统计信息，选中状态不明显

### 1.2 改造目标

- 建立清晰的视觉层次，使用深色专业风格（GitHub/VS Code 感）
- 改善整体 UX 流程：欢迎屏引导、模式切换清晰、文件导航直观
- 保持现有功能不变，只改 UI 层

---

## 2. 视觉设计

### 2.1 配色方案

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-primary` | `#0d1117` | 主背景色 |
| `--bg-secondary` | `#161b22` | 面板、顶栏背景 |
| `--bg-tertiary` | `#21262d` | 输入框、按钮背景 |
| `--border` | `#30363d` | 边框、分隔线 |
| `--text-primary` | `#e6edf3` | 主要文字 |
| `--text-secondary` | `#8b949e` | 次要文字、描述 |
| `--accent-blue` | `#58a6ff` | 蓝色强调（选中态、链接） |
| `--accent-green` | `#3fb950` | 绿色强调（新增、成功） |
| `--accent-red` | `#f85149` | 红色强调（删除、错误） |
| `--accent-yellow` | `#d29922` | 黄色强调（警告） |
| `--border-light` | `#484f58` | 次级边框（hover 态） |
| `--text-muted` | `#484f58` | 极弱文字（时间戳等） |

### 2.2 字体系统

- **主字体**: `"Manrope", "Segoe UI", system-ui, sans-serif`
  - Manrope 字体文件需要打包到 `apps/desktop/src/assets/fonts/` 并通过 `@font-face` 加载（见 5.1）
- **等宽字体**: `"SFMono-Regular", Menlo, Consolas, monospace`
- **字号**:
  - 标题: 16px / 14px
  - 正文: 13px
  - 小字: 11px / 10px

### 2.3 间距系统

- 基础单位: 4px
- 内边距: 8px, 10px, 12px, 16px
- 间距: 4px, 8px, 12px, 16px
- 圆角: 4px (按钮), 6px (卡片), 8px (面板)

### 2.4 视觉效果

- 去掉渐变背景噪音，改用纯色 + 边框建立层次
- 阴影: 轻量使用，仅在浮层/弹窗使用 `0 8px 24px rgba(0,0,0,0.4)`
- 过渡: `0.15s ease` 用于 hover/active 状态

---

## 3. 组件设计

### 3.1 Topbar（顶栏）

**结构**（从左到右）:
```
[Logo] [项目名] › [路径] [切换项目按钮] — — — [模式 Pill] [刷新按钮]
```

**样式**:
- 高度: 48px
- 背景: `--bg-secondary`
- 底部边框: 1px `--border`

**模式切换 Pill**:
```html
<div class="mode-pill">
  <button class="active">Commits</button>
  <button>Workspace</button>
</div>
```
- 背景: `--bg-tertiary`
- 选中态: `--accent-blue` 背景 + 深色文字
- 圆角: 20px（整个 pill）

### 3.2 侧边栏

> ⚠️ **注意**：模式切换已移至顶栏 Pill（见 3.1），侧边栏不再有独立的 tab。侧边栏内容会根据顶栏模式自动切换显示提交列表或文件列表。

**结构**:
```
┌─────────────────────┐
│ +24  -8  6 files   │  ← 统计栏（固定）
├─────────────────────┤
│ M src/engine/mod.rs │  ← 文件列表
│ A src/rules/new.rs  │     （选中左边框蓝）
│ D old/file.rs       │
│ M Cargo.toml        │
└─────────────────────┘
```

**样式**:
- 宽度: 260px（可调）
- 统计栏: 固定在顶部，始终可见
- 文件项: 左边框 2px 高亮当前选中
- 状态徽章: 更大更易读（10px → 12px padding）

### 3.3 欢迎屏

**结构**:
```
┌─────────────────────────────────────┐
│ [Logo] review-editor                │
├─────────────────────────────────────┤
│                                     │
│           ⬡                        │
│      打开一个 Git 仓库               │
│   选择本地仓库目录开始查看 diff      │
│                                     │
│        [ ＋ 打开仓库 ]              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 最近打开                     │   │
│  ├─────────────────────────────┤   │
│  │ review-editor  ~/proj/...  │   │
│  │ my-app         ~/proj/...  │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**交互**:
- 点击「打开仓库」→ 触发 Tauri 文件选择 dialog
- 点击最近项目 → 直接加载该项目
- 持久化：使用 Tauri store plugin (`@tauri-apps/plugin-store`) 存储最近项目列表，确保跨会话持久化且不受 webview 清理影响

### 3.4 Diff 面板

**结构**:
```
┌─────────────────────────────────────┐
│ src/engine/mod.rs      +18  -4     │  ← 文件头
├─────────────────────────────────────┤
│ @@ -42,7 +42,19 @@                │  ← diff hunk
│   fn run_scan(...) → Result<...> { │
│ -   let diff = load_diff()?;       │  ← 删除行（红底）
│ +   let diff = load_staged...;     │  ← 添加行（绿底）
│ +   let findings = apply...        │  ← 添加行（绿底）
└─────────────────────────────────────┘
```

**样式**:
- 文件头: `--bg-secondary` 背景，底部边框
- diff 行号: `--text-secondary`，固定宽度
- 添加行: `rgba(63,185,80,0.1)` 背景 + `#7ee787` 文字
- 删除行: `rgba(248,81,73,0.1)` 背景 + `#ffa198` 文字

---

## 4. UX 改进

### 4.1 打开项目流程

**之前**: 用户打开 App 后显示空白主界面，不知道要干什么
**之后**:
1. App 启动 → 检查是否有记住的项目
2. 有项目 → 自动加载，显示主界面
3. 无项目 → 显示欢迎屏，引导「打开仓库」或「选择最近项目」

### 4.2 模式切换

**之前**: 「Commit 模式」和「Workspace 模式」用分散的 seg 按钮，切换时不知道当前看的是什么
**之后**:
- 顶栏右侧显示「Commits / Workspace」pill，一目了然当前模式
- 侧边栏顶部显示当前模式的统计信息

### 4.3 文件导航

**之前**: Commits 和 Files 在 tab 里切换，选中状态不明显
**之后**:
- 侧边栏同时显示统计（additions/deletions/file count）
- 选中文件有左边框 2px 蓝色高亮
- 文件按修改状态排序（M/A/D），易于发现变更

### 4.4 加载状态

**之前**: 没有明确的加载反馈
**之后**:
- 顶栏添加「刷新」按钮，点击后显示 spinner
- 数据加载期间侧边栏显示 skeleton 或 loading 状态

---

## 5. 技术实现

### 5.1 文件变更

```
apps/desktop/src/
├── assets/
│   └── fonts/
│       └── Manrope-VariableFont.ttf  # 新增：Manrope 字体文件
├── components/
│   ├── WelcomeScreen.tsx      # 新增：欢迎屏组件
│   ├── TopBar.tsx             # 重构：精简顶栏
│   ├── SideBar.tsx            # 重构：统计栏 + 文件列表
│   ├── ModePill.tsx           # 新增：模式切换 pill 组件
│   └── FileListItem.tsx       # 新增：文件列表项组件
├── hooks/
│   └── useRecentProjects.ts   # 新增：使用 Tauri store 持久化
├── App.tsx                    # 修改：整合欢迎屏 + 路由逻辑
└── App.css                    # 重写：CSS 变量 + 新样式
```

### 5.2 CSS 变量与字体加载

在 `App.css` 中定义完整 token 系统：

```css
@font-face {
  font-family: 'Manrope';
  src: url('./assets/fonts/Manrope-VariableFont.ttf') format('truetype');
  font-weight: 100 900;
  font-display: swap;
}

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
}
```

### 5.3 组件层级

```
<App>
  {hasProject ? (
    <div class="screen">
      <TopBar />
      <div class="workbench">
        <SideBar />
        <DiffPanel />
      </div>
    </div>
  ) : (
    <WelcomeScreen />
  )}
</App>
```

---

## 6. 验收标准

### 6.1 视觉

- [ ] 整体配色符合配色方案表
- [ ] 去掉渐变背景，改用纯色 + 边框
- [ ] 字体层级清晰，主标题/正文/小字区分明显
- [ ] 状态徽章（M/A/D）清晰易读

### 6.2 UX

- [ ] 无项目时显示欢迎屏，不显示空白主界面
- [ ] 欢迎屏有「打开仓库」主按钮
- [ ] 欢迎屏显示最近项目列表
- [ ] 模式切换 pill 在顶栏右侧，当前模式高亮
- [ ] 侧边栏顶部始终显示统计信息
- [ ] 选中文件有明显的左边框高亮

### 6.3 功能

- [ ] 点击「打开仓库」能触发 Tauri 文件选择
- [ ] 点击最近项目能加载对应仓库
- [ ] 切换 Commits/Workspace 模式正常切换视图
- [ ] 点击刷新按钮能重新加载数据
- [ ] 现有 diff 查看功能不受影响

---

## 7. 后续扩展（超出 P0）

- 双主题系统（浅色/深色可切换）
- 文件树层级展开/折叠
- 搜索/过滤文件
- 分屏查看多个文件 diff
