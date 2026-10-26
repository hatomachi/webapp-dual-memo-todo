import { TaskItem, StagingTaskItem, StagingData } from '../types/todo';
import { GitHubSettings } from '../types/github';
import { fetchCustomJsonFromGitHub, pushCustomJsonToGitHub } from './githubSync';

export const STORAGE_KEY_STAGING = 'dual_memo_staging_v1';
export const DEFAULT_STAGING_PATH = 'todo-staging.json';

export const createEmptyStagingData = (): StagingData => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  tasks: [],
});

export const loadStagingData = (): StagingData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STAGING);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version || 1,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      };
    }
  } catch (err) {
    console.warn('Failed to load staging data from localStorage:', err);
  }
  return createEmptyStagingData();
};

export const persistStagingData = (data: StagingData): void => {
  try {
    localStorage.setItem(STORAGE_KEY_STAGING, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to persist staging data:', err);
  }
};

/**
 * Check if category string means staging
 */
export const isStagingCategory = (category: string): boolean => {
  if (!category) return false;
  const lower = category.trim().toLowerCase();
  return lower === 'staging' || lower === 'ステージング';
};

/**
 * Separate all active tasks into main tasks (for todo-data.json) and staging tasks (for todo-staging.json).
 * Detects promotions (tasks moved from staging to other categories) and dismissals (staging tasks deleted by user).
 */
export const separateStagingTasks = (
  allTasks: TaskItem[],
  prevStaging: StagingData
): {
  mainTasks: TaskItem[];
  updatedStaging: StagingData;
  promotedTasks: TaskItem[];
  dismissedTasks: StagingTaskItem[];
  hasStagingChanged: boolean;
} => {
  const prevStagingMap = new Map<string, StagingTaskItem>();
  prevStaging.tasks.forEach((t) => prevStagingMap.set(t.id, t));

  const mainTasks: TaskItem[] = [];
  const remainingStagingTasks: StagingTaskItem[] = [];
  const promotedTasks: TaskItem[] = [];

  for (const task of allTasks) {
    if (isStagingCategory(task.category)) {
      // Still in staging
      const existing = prevStagingMap.get(task.id);
      remainingStagingTasks.push({
        ...task,
        source: existing?.source || 'mattermost',
        createdAt: existing?.createdAt || new Date().toISOString(),
        postUrl: existing?.postUrl,
        author: existing?.author,
      });
      // Remove from map to track which were consumed
      prevStagingMap.delete(task.id);
    } else {
      // In main category (e.g. inbox, work, etc.)
      mainTasks.push(task);
      if (prevStagingMap.has(task.id)) {
        // Was previously in staging! Promoted by user!
        promotedTasks.push(task);
        prevStagingMap.delete(task.id);
      }
    }
  }

  // Any remaining items in prevStagingMap were removed/dismissed by the user
  const dismissedTasks = Array.from(prevStagingMap.values());

  const hasStagingChanged =
    promotedTasks.length > 0 ||
    dismissedTasks.length > 0 ||
    remainingStagingTasks.length !== prevStaging.tasks.length ||
    JSON.stringify(remainingStagingTasks) !== JSON.stringify(prevStaging.tasks);

  const updatedStaging: StagingData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    tasks: remainingStagingTasks,
  };

  return {
    mainTasks,
    updatedStaging,
    promotedTasks,
    dismissedTasks,
    hasStagingChanged,
  };
};

/**
 * Fetch staging data from local Vite middleware API if available
 */
export const fetchStagingFromLocalApi = async (): Promise<StagingData | null> => {
  try {
    const res = await fetch('/api/local/staging', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.tasks)) {
        persistStagingData(data);
        return data as StagingData;
      }
    }
  } catch {
    // silently ignore if not running in local Vite dev server
  }
  return null;
};

/**
 * Save staging data to local Vite middleware API if available
 */
export const saveStagingToLocalApi = async (stagingData: StagingData): Promise<boolean> => {
  try {
    const res = await fetch('/api/local/staging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stagingData, null, 2),
    });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Sync staging data: prioritizes local dev API if available, falls back to GitHub settings
 */
export const fetchStagingData = async (
  settings: GitHubSettings | null
): Promise<StagingData | null> => {
  // 1. Try local dev server API first
  const localData = await fetchStagingFromLocalApi();
  if (localData) {
    return localData;
  }

  // 2. Fall back to GitHub
  if (settings && settings.token && settings.owner && settings.repo) {
    return fetchStagingFromGitHubRepo(settings);
  }

  return null;
};

/**
 * Save staging data: updates local dev server API if available, and pushes to GitHub if configured
 */
export const syncStagingSave = async (
  settings: GitHubSettings | null,
  stagingData: StagingData
): Promise<void> => {
  persistStagingData(stagingData);
  // Try local API
  saveStagingToLocalApi(stagingData).catch(() => {});

  // Try GitHub API
  if (settings && settings.token && settings.owner && settings.repo && settings.autoSyncOnSave) {
    pushStagingToGitHubRepo(settings, stagingData).catch((err) => {
      console.warn('Failed to push updated staging to GitHub:', err);
    });
  }
};

/**
 * Sync staging data with GitHub
 */
export const fetchStagingFromGitHubRepo = async (
  settings: GitHubSettings
): Promise<StagingData | null> => {
  const path = settings.stagingPath || DEFAULT_STAGING_PATH;
  try {
    const res = await fetchCustomJsonFromGitHub<StagingData>(settings, path);
    if (res && res.payload) {
      persistStagingData(res.payload);
      return res.payload;
    }
  } catch (err) {
    console.warn('Failed to fetch staging from GitHub:', err);
  }
  return null;
};

export const pushStagingToGitHubRepo = async (
  settings: GitHubSettings,
  stagingData: StagingData
): Promise<boolean> => {
  const path = settings.stagingPath || DEFAULT_STAGING_PATH;
  try {
    await pushCustomJsonToGitHub(settings, path, stagingData, 'chore: update todo-staging.json');
    return true;
  } catch (err) {
    console.error('Failed to push staging to GitHub:', err);
    return false;
  }
};
