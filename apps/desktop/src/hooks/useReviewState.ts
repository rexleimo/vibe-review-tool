import { useCallback, useEffect, useRef, useState } from "react";
import { LazyStore } from "@tauri-apps/plugin-store";
import {
  type CreateReviewItemInput,
  type ReviewItem,
  createReviewItemRecord,
} from "../lib/reviewItems";
import {
  createEmptyReviewState,
  type PersistedReviewState,
  normalizeStoredReviewState,
  reconcileStaleBatchRuns,
} from "../lib/reviewState";
import { type ReviewBatchRun } from "../lib/reviewBatchRuns";

const REVIEW_STATE_KEY = "review.state";
const LEGACY_REVIEW_ITEMS_KEY = "review.items";
const store = new LazyStore("review-editor.dat");

async function persistReviewState(nextState: PersistedReviewState): Promise<void> {
  await store.set(REVIEW_STATE_KEY, nextState);
  await store.save();
}

export function useReviewState() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [batchRuns, setBatchRuns] = useState<ReviewBatchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef<PersistedReviewState>(createEmptyReviewState());

  const syncState = useCallback((nextState: PersistedReviewState) => {
    stateRef.current = nextState;
    setItems(nextState.items);
    setBatchRuns(nextState.batchRuns);
  }, []);

  const loadState = useCallback(async () => {
    try {
      const rawState = await store.get(REVIEW_STATE_KEY);
      const legacyItems = await store.get(LEGACY_REVIEW_ITEMS_KEY);
      const normalizedState = normalizeStoredReviewState(rawState, legacyItems);
      const reconciled = reconcileStaleBatchRuns(normalizedState);
      syncState(reconciled.state);
      if (rawState === null || reconciled.changed) {
        await persistReviewState(reconciled.state);
      }
    } catch (error) {
      console.error("Failed to load review state:", error);
    } finally {
      setLoading(false);
    }
  }, [syncState]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const replaceState = useCallback(async (nextState: PersistedReviewState) => {
    syncState(nextState);
    await persistReviewState(nextState);
  }, [syncState]);

  const replaceReviewState = useCallback(async (
    nextStateOrMutator: PersistedReviewState | ((state: PersistedReviewState) => PersistedReviewState),
  ) => {
    const nextState = typeof nextStateOrMutator === "function"
      ? nextStateOrMutator(stateRef.current)
      : nextStateOrMutator;
    await replaceState(nextState);
    return nextState;
  }, [replaceState]);

  const createReviewItem = useCallback(async (input: CreateReviewItemInput) => {
    const created = createReviewItemRecord(input);
    await replaceReviewState((state) => ({
      ...state,
      items: [created, ...state.items],
    }));
    return created;
  }, [replaceReviewState]);

  const updateReviewItem = useCallback(async (id: string, patch: Partial<ReviewItem>) => {
    let updatedItem: ReviewItem | null = null;
    await replaceReviewState((state) => ({
      ...state,
      items: state.items.map((item) => {
        if (item.id !== id) return item;
        updatedItem = {
          ...item,
          ...patch,
          id: item.id,
          updatedAt: patch.updatedAt ?? new Date().toISOString(),
        };
        return updatedItem;
      }),
    }));
    return updatedItem;
  }, [replaceReviewState]);

  const deleteReviewItem = useCallback(async (id: string) => {
    await replaceReviewState((state) => ({
      ...state,
      items: state.items.filter((item) => item.id !== id),
    }));
  }, [replaceReviewState]);

  return {
    items,
    batchRuns,
    loading,
    createReviewItem,
    updateReviewItem,
    deleteReviewItem,
    replaceReviewState,
    reload: loadState,
  };
}
