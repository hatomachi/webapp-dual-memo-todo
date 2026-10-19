import { HistorySnapshot, HistoryState } from '../types/history';

const STORAGE_KEY_HISTORY = 'dual_memo_history_v1';
export const MAX_HISTORY_SNAPSHOTS = 30;

export const loadHistoryState = (): HistoryState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (raw) {
      const parsed: HistoryState = JSON.parse(raw);
      if (Array.isArray(parsed.snapshots) && typeof parsed.currentIndex === 'number') {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load history state from localStorage', err);
  }
  return {
    snapshots: [],
    currentIndex: -1,
  };
};

export const persistHistoryState = (state: HistoryState): void => {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to persist history state', err);
  }
};

/**
 * Push a new snapshot to history. If the user was in the middle of undo/redo,
 * any forward redo history is pruned (standard undo/redo behavior).
 * Keeps at most MAX_HISTORY_SNAPSHOTS entries.
 */
export const addSnapshot = (
  prevState: HistoryState,
  label: string,
  categoryText: string,
  themeText: string
): HistoryState => {
  const { snapshots, currentIndex } = prevState;

  // Don't push duplicate if categoryText and themeText are identical to current
  if (currentIndex >= 0 && currentIndex < snapshots.length) {
    const current = snapshots[currentIndex];
    if (current.categoryText === categoryText && current.themeText === themeText) {
      return prevState;
    }
  }

  // Prune forward history if currentIndex is not at the end
  const validHistory = currentIndex >= 0 ? snapshots.slice(0, currentIndex + 1) : [];

  const newSnapshot: HistorySnapshot = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    label,
    categoryText,
    themeText,
  };

  const updatedSnapshots = [...validHistory, newSnapshot];
  if (updatedSnapshots.length > MAX_HISTORY_SNAPSHOTS) {
    updatedSnapshots.shift();
  }

  const newState: HistoryState = {
    snapshots: updatedSnapshots,
    currentIndex: updatedSnapshots.length - 1,
  };

  persistHistoryState(newState);
  return newState;
};
