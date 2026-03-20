import { type ReviewItem, normalizeStoredReviewItems } from "./reviewItems.js";
import {
  type ReviewBatchRun,
  type ReviewBatchWritePlan,
  buildFailedBatchRunPatch,
  normalizeStoredBatchRuns,
} from "./reviewBatchRuns.js";

export interface PersistedReviewState {
  version: 2;
  items: ReviewItem[];
  batchRuns: ReviewBatchRun[];
}

interface PersistedReviewStateShape {
  version: unknown;
  items: unknown;
  batchRuns: unknown;
}

export function createEmptyReviewState(): PersistedReviewState {
  return {
    version: 2,
    items: [],
    batchRuns: [],
  };
}

export function isPersistedReviewState(value: unknown): value is PersistedReviewStateShape {
  return typeof value === "object"
    && value !== null
    && "version" in value
    && "items" in value
    && "batchRuns" in value;
}

export function normalizeStoredReviewState(
  rawState: unknown,
  legacyItems: unknown,
): PersistedReviewState {
  if (isPersistedReviewState(rawState)) {
    return {
      version: 2,
      items: normalizeStoredReviewItems(rawState.items as ReviewItem[]),
      batchRuns: normalizeStoredBatchRuns(rawState.batchRuns),
    };
  }

  return {
    version: 2,
    items: normalizeStoredReviewItems(legacyItems as ReviewItem[]),
    batchRuns: [],
  };
}

export function reconcileStaleBatchRuns(
  state: PersistedReviewState,
  at = new Date().toISOString(),
): {
  state: PersistedReviewState;
  changed: boolean;
} {
  let changed = false;

  const batchRuns = state.batchRuns.map((batchRun) => {
    if (batchRun.status !== "queued" && batchRun.status !== "running") {
      return batchRun;
    }

    changed = true;
    return {
      ...batchRun,
      ...buildFailedBatchRunPatch({
        lastError: "Batch run was interrupted before the previous session completed.",
        errorCode: "orphaned_run",
        retryable: true,
        at,
      }),
    };
  });

  if (!changed) {
    return {
      state,
      changed: false,
    };
  }

  return {
    state: {
      ...state,
      batchRuns,
    },
    changed: true,
  };
}

export function applyReviewBatchWritePlan(
  state: PersistedReviewState,
  plan: ReviewBatchWritePlan,
): PersistedReviewState {
  const itemPatchMap = new Map(plan.itemPatches.map((entry) => [entry.id, entry.patch]));
  const nextItems = itemPatchMap.size === 0
    ? state.items
    : state.items.map((item) => {
      const patch = itemPatchMap.get(item.id);
      return patch ? { ...item, ...patch, id: item.id } : item;
    });

  const existingIndex = state.batchRuns.findIndex((batchRun) => batchRun.id === plan.batchRun.id);
  const nextBatchRuns = existingIndex === -1
    ? [plan.batchRun, ...state.batchRuns]
    : state.batchRuns.map((batchRun, index) => (
      index === existingIndex ? plan.batchRun : batchRun
    ));

  return {
    ...state,
    items: nextItems,
    batchRuns: nextBatchRuns,
  };
}
