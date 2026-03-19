import { useCallback, useEffect, useState } from "react";
import { LazyStore } from "@tauri-apps/plugin-store";

export type AiProvider = "codex" | "claude" | "gemini" | "opencode";

const STORE_KEY = "ai.default-provider";
const DEFAULT_PROVIDER: AiProvider = "codex";
const store = new LazyStore("review-editor.dat");

export function useAiProvider() {
  const [provider, setProviderState] = useState<AiProvider>(DEFAULT_PROVIDER);
  const [loading, setLoading] = useState(true);

  const loadProvider = useCallback(async () => {
    try {
      const stored = await store.get<AiProvider>(STORE_KEY);
      if (stored === "codex" || stored === "claude" || stored === "gemini" || stored === "opencode") {
        setProviderState(stored);
      }
    } catch (error) {
      console.error("Failed to load AI provider:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProvider();
  }, [loadProvider]);

  const setProvider = useCallback(async (nextProvider: AiProvider) => {
    setProviderState(nextProvider);
    await store.set(STORE_KEY, nextProvider);
    await store.save();
  }, []);

  return {
    provider,
    loading,
    setProvider,
  };
}
