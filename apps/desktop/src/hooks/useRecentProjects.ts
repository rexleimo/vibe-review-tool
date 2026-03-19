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
