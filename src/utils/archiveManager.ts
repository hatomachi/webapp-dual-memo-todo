import { TaskItem, CompletedTaskItem, ArchivedTheme, ArchiveData } from '../types/todo';
import { GitHubSettings } from '../types/github';
import { fetchCustomJsonFromGitHub, pushCustomJsonToGitHub } from './githubSync';

export const STORAGE_KEY_ARCHIVE = 'dual_memo_archive_v1';
export const DEFAULT_ARCHIVE_PATH = 'todo-archive.json';

export const createEmptyArchiveData = (): ArchiveData => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  archivedThemes: [],
  archivedTasks: [],
});

export const loadArchiveData = (): ArchiveData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ARCHIVE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version || 1,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        archivedThemes: Array.isArray(parsed.archivedThemes) ? parsed.archivedThemes : [],
        archivedTasks: Array.isArray(parsed.archivedTasks) ? parsed.archivedTasks : [],
      };
    }
  } catch (err) {
    console.warn('Failed to load archive data from localStorage:', err);
  }
  return createEmptyArchiveData();
};

export const persistArchiveData = (data: ArchiveData): void => {
  try {
    localStorage.setItem(STORAGE_KEY_ARCHIVE, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to persist archive data:', err);
  }
};

/**
 * Archive an entire theme: moves all its active and completed tasks to archive.
 */
export const archiveTheme = (
  themeName: string,
  currentTasks: TaskItem[],
  currentCompletedTasks: CompletedTaskItem[],
  archiveData: ArchiveData,
  themeComments?: Record<string, string[]>
): {
  updatedTasks: TaskItem[];
  updatedCompletedTasks: CompletedTaskItem[];
  updatedThemes: (currentThemes: string[]) => string[];
  updatedArchive: ArchiveData;
  updatedThemeComments: Record<string, string[]>;
  archivedCount: number;
} => {
  const normTarget = themeName.trim().toLowerCase();

  // Find all active tasks matching this theme
  const matchingTasks = currentTasks.filter(
    (t) => (t.theme || 'Uncategorized').trim().toLowerCase() === normTarget
  );
  // Find all completed tasks matching this theme
  const matchingCompleted = currentCompletedTasks.filter(
    (t) => (t.theme || 'Uncategorized').trim().toLowerCase() === normTarget
  );

  const combinedTasks: CompletedTaskItem[] = [
    ...matchingCompleted,
    ...matchingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      theme: t.theme,
      dueDate: t.dueDate,
      comments: t.comments,
      completedAt: new Date().toISOString(),
    })),
  ];

  const matchedCommentsKey = themeComments
    ? Object.keys(themeComments).find((k) => k.trim().toLowerCase() === normTarget)
    : undefined;
  const existingComments = matchedCommentsKey ? themeComments![matchedCommentsKey] : [];

  const newArchivedTheme: ArchivedTheme = {
    theme: themeName,
    archivedAt: new Date().toISOString(),
    tasks: combinedTasks,
    comments: existingComments && existingComments.length > 0 ? existingComments : undefined,
  };

  // Remove existing entry for the same theme if any
  const filteredThemes = archiveData.archivedThemes.filter(
    (at) => at.theme.trim().toLowerCase() !== normTarget
  );

  const updatedArchive: ArchiveData = {
    ...archiveData,
    updatedAt: new Date().toISOString(),
    archivedThemes: [newArchivedTheme, ...filteredThemes],
  };

  persistArchiveData(updatedArchive);

  const remainingTasks = currentTasks.filter(
    (t) => (t.theme || 'Uncategorized').trim().toLowerCase() !== normTarget
  );
  const remainingCompleted = currentCompletedTasks.filter(
    (t) => (t.theme || 'Uncategorized').trim().toLowerCase() !== normTarget
  );

  const nextThemeComments: Record<string, string[]> = { ...(themeComments || {}) };
  if (matchedCommentsKey) {
    delete nextThemeComments[matchedCommentsKey];
  }

  return {
    updatedTasks: remainingTasks,
    updatedCompletedTasks: remainingCompleted,
    updatedThemes: (currentThemes: string[]) =>
      currentThemes.filter((th) => th.trim().toLowerCase() !== normTarget),
    updatedArchive,
    updatedThemeComments: nextThemeComments,
    archivedCount: combinedTasks.length,
  };
};

/**
 * Restore an archived theme back to active themes & tasks.
 */
export const restoreArchivedTheme = (
  themeName: string,
  archiveData: ArchiveData
): {
  restoredThemeName: string;
  restoredTasks: TaskItem[];
  restoredComments?: string[];
  updatedArchive: ArchiveData;
} => {
  const normTarget = themeName.trim().toLowerCase();
  const foundTheme = archiveData.archivedThemes.find(
    (at) => at.theme.trim().toLowerCase() === normTarget
  );

  if (!foundTheme) {
    throw new Error(`Archived theme "${themeName}" not found`);
  }

  const restoredTasks: TaskItem[] = foundTheme.tasks.map((t, idx) => ({
    id: t.id,
    title: t.title,
    category: t.category && t.category !== 'done' ? t.category : 'inbox',
    theme: foundTheme.theme,
    dueDate: t.dueDate,
    comments: t.comments,
    order: idx,
  }));

  const updatedArchive: ArchiveData = {
    ...archiveData,
    updatedAt: new Date().toISOString(),
    archivedThemes: archiveData.archivedThemes.filter(
      (at) => at.theme.trim().toLowerCase() !== normTarget
    ),
  };

  persistArchiveData(updatedArchive);

  return {
    restoredThemeName: foundTheme.theme,
    restoredTasks,
    restoredComments: foundTheme.comments,
    updatedArchive,
  };
};

/**
 * Sync archive data with GitHub
 */
export const fetchArchiveFromGitHubRepo = async (
  settings: GitHubSettings
): Promise<ArchiveData | null> => {
  const path = settings.archivePath || DEFAULT_ARCHIVE_PATH;
  try {
    const res = await fetchCustomJsonFromGitHub<ArchiveData>(settings, path);
    if (res && res.payload) {
      persistArchiveData(res.payload);
      return res.payload;
    }
  } catch (err) {
    console.warn('Failed to fetch archive from GitHub:', err);
  }
  return null;
};

export const pushArchiveToGitHubRepo = async (
  settings: GitHubSettings,
  archiveData: ArchiveData
): Promise<boolean> => {
  const path = settings.archivePath || DEFAULT_ARCHIVE_PATH;
  try {
    await pushCustomJsonToGitHub(settings, path, archiveData, 'chore: update todo-archive.json');
    return true;
  } catch (err) {
    console.error('Failed to push archive to GitHub:', err);
    return false;
  }
};
