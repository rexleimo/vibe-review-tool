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
