import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PaneType, TaskItem, CompletedTaskItem, ArchiveData } from './types/todo';
import {
  parseCategoryText,
  parseThemeText,
  parseCategoryTextWithCompleted,
  parseThemeTextWithCompleted,
  formatTasksToCategoryText,
  formatTasksToThemeText,
  sortTasksByDueDate,
  extractCategorySections,
  extractThemeSections,
  cleanTaskTitle,
  generateId,
  DUE_DATE_REGEX,
} from './utils/parser';
import {
  InlineTagInfo,
  SuggestionTrigger,
  extractHierarchicalOptions,
} from './utils/tagHelper';
import { INITIAL_CATEGORY_TEXT } from './data/sampleData';
import { Header } from './components/Header';
import { MemoPane, MemoPaneHandle } from './components/MemoPane';
import { HelpModal } from './components/HelpModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { CalendarPickerModal } from './components/CalendarPickerModal';
import { CompletedTasksDrawer } from './components/CompletedTasksDrawer';
import { ArchiveModal } from './components/ArchiveModal';
import { QuickToolbar } from './components/QuickToolbar';
import { useVisualViewport } from './hooks/useVisualViewport';
import { HistoryState } from './types/history';
import {
  loadHistoryState,
  addSnapshot,
  persistHistoryState,
} from './utils/historyManager';
import {
  loadArchiveData,
  archiveTheme,
  restoreArchivedTheme,
  fetchArchiveFromGitHubRepo,
  pushArchiveToGitHubRepo,
} from './utils/archiveManager';
import { GitHubSettings, SyncStatus, RemotePayload } from './types/github';
import {
  loadGitHubSettings,
  persistGitHubSettings,
  loadLastSyncedAt,
  persistLastSyncedAt,
  fetchFromGitHub,
  pushToGitHub,
} from './utils/githubSync';
import { checkForServiceWorkerUpdate } from './utils/pwaUpdate';

const STORAGE_KEY_TASKS = 'dual_memo_tasks_v3';
const STORAGE_KEY_COMPLETED_TASKS = 'dual_memo_completed_tasks_v1';
const STORAGE_KEY_CAT_TEXT = 'dual_memo_category_text_v3';
const STORAGE_KEY_THM_TEXT = 'dual_memo_theme_text_v3';
const STORAGE_KEY_CATEGORIES = 'dual_memo_categories_v3';
const STORAGE_KEY_THEMES = 'dual_memo_themes_v3';
const STORAGE_KEY_ACTIVE_MOBILE_PANE = 'dual_memo_active_mobile_pane_v1';

const getInitialMobilePane = (): PaneType => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_MOBILE_PANE);
    if (saved === 'category' || saved === 'theme') {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'category';
};

export const App: React.FC = () => {
  const [, setTasks] = useState<TaskItem[]>([]);
  const [categoryText, setCategoryText] = useState<string>('');
  const [themeText, setThemeText] = useState<string>('');
  const [, setCategories] = useState<string[]>([]);
  const [, setThemes] = useState<string[]>([]);
  const [activeMobilePane, setActiveMobilePaneState] = useState<PaneType>(getInitialMobilePane);
  const [focusedPane, setFocusedPane] = useState<PaneType | null>(null);
  const [dirtyPane, setDirtyPane] = useState<PaneType | null>(null);
  const dirtyPaneRef = useRef<PaneType | null>(null);

  const setActiveMobilePane = (pane: PaneType) => {
    setActiveMobilePaneState(pane);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_MOBILE_PANE, pane);
    } catch {
      // ignore
    }
  };

  const updateDirtyPane = (pane: PaneType | null) => {
    dirtyPaneRef.current = pane;
    setDirtyPane(pane);
  };

  // Active line tags and suggestion trigger state
  const [activeLineTags, setActiveLineTags] = useState<InlineTagInfo[]>([]);
  const [suggestionTrigger, setSuggestionTrigger] = useState<SuggestionTrigger | null>(null);

  // Modals state
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isCompletedDrawerOpen, setIsCompletedDrawerOpen] = useState<boolean>(false);
  const [selectedThemeForCompletedDrawer, setSelectedThemeForCompletedDrawer] = useState<string | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastCompletedTaskForUndo, setLastCompletedTaskForUndo] = useState<CompletedTaskItem | null>(null);

  // Archive data (frozen storage in todo-archive.json)
  const [archiveData, setArchiveData] = useState<ArchiveData>(loadArchiveData);

  // History state (30 generations undo/redo)
  const [historyState, setHistoryState] = useState<HistoryState>({
    snapshots: [],
    currentIndex: -1,
  });

  // GitHub Settings & Sync state
  const [gitHubSettings, setGitHubSettings] = useState<GitHubSettings | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(loadLastSyncedAt());
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | undefined>(undefined);

  // Refs to always hold the exact latest text without closure staleness
  const categoryTextRef = useRef<string>('');
  const themeTextRef = useRef<string>('');
  const categoriesRef = useRef<string[]>([]);
  const themesRef = useRef<string[]>([]);
  const tasksRef = useRef<TaskItem[]>([]);
  const completedTasksRef = useRef<CompletedTaskItem[]>([]);

  // MemoPane handles for QuickToolbar actions
  const categoryPaneRef = useRef<MemoPaneHandle>(null);
  const themePaneRef = useRef<MemoPaneHandle>(null);

  const updateCategoryText = (val: string) => {
    categoryTextRef.current = val;
    setCategoryText(val);
  };

  const updateThemeText = (val: string) => {
    themeTextRef.current = val;
    setThemeText(val);
  };

  const updateCategories = (val: string[]) => {
    categoriesRef.current = val;
    setCategories(val);
  };

  const updateThemes = (val: string[]) => {
    themesRef.current = val;
    setThemes(val);
  };

  const updateTasks = (val: TaskItem[]) => {
    tasksRef.current = val;
    setTasks(val);
  };

  const updateCompletedTasks = (val: CompletedTaskItem[]) => {
    completedTasksRef.current = val;
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY_COMPLETED_TASKS, JSON.stringify(val));
    } catch (e) {
      console.warn('Failed to save completed tasks to localStorage', e);
    }
  };

  // Memoized hierarchical options for suggestions
  const categoryOptions = useMemo(() => {
    const all = [...categoriesRef.current];
    tasksRef.current.forEach((t) => {
      if (t.category) all.push(t.category);
    });
    return extractHierarchicalOptions(all, 'inbox');
  }, [categoryText, themeText]);

  const themeOptions = useMemo(() => {
    const all = [...themesRef.current];
    tasksRef.current.forEach((t) => {
      if (t.theme) all.push(t.theme);
    });
    return extractHierarchicalOptions(all, 'Uncategorized');
  }, [categoryText, themeText]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2500);
  };

  // Save to localStorage
  const saveToStorage = useCallback(
    (
      newTasks: TaskItem[],
      newCatText: string,
      newThmText: string,
      newCats?: string[],
      newThms?: string[],
      newCompleted?: CompletedTaskItem[]
    ) => {
      try {
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(newTasks));
        localStorage.setItem(STORAGE_KEY_CAT_TEXT, newCatText);
        localStorage.setItem(STORAGE_KEY_THM_TEXT, newThmText);
        if (newCats) {
          localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(newCats));
        }
        if (newThms) {
          localStorage.setItem(STORAGE_KEY_THEMES, JSON.stringify(newThms));
        }
        if (newCompleted) {
          localStorage.setItem(STORAGE_KEY_COMPLETED_TASKS, JSON.stringify(newCompleted));
        }
      } catch (err) {
        console.error('Failed to save to localStorage', err);
      }
    },
    []
  );

  // SWR: Fetch remote latest and update if user hasn't made dirty local edits
  const syncWithRemote = useCallback(
    async (silent = false) => {
      const settings = loadGitHubSettings();
      if (!settings || !settings.token || !settings.owner || !settings.repo) {
        return;
      }
      // If user is currently editing (dirty), do not overwrite!
      if (dirtyPaneRef.current !== null) {
        return;
      }

      if (!silent) {
        setSyncStatus('syncing');
      }
      try {
        const { payload } = await fetchFromGitHub(settings);
        if (!payload || (!payload.tasks && !payload.categoryText)) return;

        const loadedTasks: TaskItem[] =
          Array.isArray(payload.tasks) && payload.tasks.length > 0
            ? payload.tasks
            : parseCategoryText(payload.categoryText || '');

        const loadedCats: string[] =
          Array.isArray(payload.categories) && payload.categories.length > 0
            ? payload.categories
            : extractCategorySections(payload.categoryText || '');

        const loadedThms: string[] =
          Array.isArray(payload.themes) && payload.themes.length > 0
            ? payload.themes
            : extractThemeSections(payload.themeText || '');

        if (Array.isArray(payload.completedTasks)) {
          updateCompletedTasks(payload.completedTasks);
        }

        // Also fetch archive in background if available
        fetchArchiveFromGitHubRepo(settings).then((remoteArchive) => {
          if (remoteArchive) {
            setArchiveData(remoteArchive);
          }
        }).catch(() => {});

        // Sort tasks globally by due date so both panes (categories and themes) are naturally ordered by due date
        const sortedLoadedTasks = sortTasksByDueDate(loadedTasks);
        const newCat = formatTasksToCategoryText(sortedLoadedTasks, loadedCats);
        const newThm = formatTasksToThemeText(sortedLoadedTasks, loadedThms);

        // If current text is already identical to remote, just mark success
        if (
          categoryTextRef.current === newCat &&
          themeTextRef.current === newThm
        ) {
          setSyncStatus('success');
          const now = Date.now();
          setLastSyncedAt(now);
          persistLastSyncedAt(now);
          return;
        }

        // Only apply if user is still not dirty
        if (dirtyPaneRef.current === null) {
          updateTasks(sortedLoadedTasks);
          updateCategories(loadedCats);
          updateThemes(loadedThms);
          updateCategoryText(newCat);
          updateThemeText(newThm);
          saveToStorage(sortedLoadedTasks, newCat, newThm, loadedCats, loadedThms);
          setSyncStatus('success');
          const now = Date.now();
          setLastSyncedAt(now);
          persistLastSyncedAt(now);
          if (!silent) {
            showToast('☁️ リモートの最新データを取り込みました');
          }
        }
      } catch (err: any) {
        if (!silent) {
          console.warn('Sync with remote failed:', err);
          setSyncStatus('error');
          setSyncErrorMessage(err.message || 'GitHub同期エラー');
        }
      }
    },
    [saveToStorage]
  );

  // Background GitHub push helper
  const triggerBackgroundGitHubPush = useCallback(
    async (
      tasks: TaskItem[],
      cats: string[],
      thms: string[],
      label: string,
      customCompletedTasks?: CompletedTaskItem[]
    ) => {
      const settings = loadGitHubSettings();
      if (!settings || !settings.token || !settings.owner || !settings.repo) {
        return;
      }
      if (!settings.autoSyncOnSave) {
        return;
      }

      setSyncStatus('syncing');
      setSyncErrorMessage(undefined);
      try {
        const payload: RemotePayload = {
          version: 2,
          updatedAt: new Date().toISOString(),
          categories: cats,
          themes: thms,
          tasks,
          completedTasks: customCompletedTasks || completedTasksRef.current,
        };
        await pushToGitHub(settings, payload, `chore: update memo (${label})`);
        setSyncStatus('success');
        const now = Date.now();
        setLastSyncedAt(now);
        persistLastSyncedAt(now);
      } catch (err: any) {
        console.error('Background GitHub push failed:', err);
        setSyncStatus('error');
        setSyncErrorMessage(err.message || 'GitHub同期エラー');
      }
    },
    []
  );

  // Initialize from LocalStorage or default sample, and load history & github settings
  useEffect(() => {
    const loadedSettings = loadGitHubSettings();
    if (loadedSettings) {
      setGitHubSettings(loadedSettings);
    }

    const loadedHist = loadHistoryState();

    let initialCat = '';
    let initialThm = '';
    let initialT: TaskItem[] = [];
    let initialCats: string[] = [];
    let initialThms: string[] = [];

    try {
      const savedTasksJson = localStorage.getItem(STORAGE_KEY_TASKS);
      const savedCompletedJson = localStorage.getItem(STORAGE_KEY_COMPLETED_TASKS);
      const savedCatText = localStorage.getItem(STORAGE_KEY_CAT_TEXT);
      const savedThmText = localStorage.getItem(STORAGE_KEY_THM_TEXT);
      const savedCatsJson = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      const savedThmsJson = localStorage.getItem(STORAGE_KEY_THEMES);

      if (savedCompletedJson) {
        const loadedCompleted = JSON.parse(savedCompletedJson);
        if (Array.isArray(loadedCompleted)) {
          updateCompletedTasks(loadedCompleted);
        }
      }

      if (savedCatsJson) {
        initialCats = JSON.parse(savedCatsJson);
      }
      if (savedThmsJson) {
        initialThms = JSON.parse(savedThmsJson);
      }

      if (savedTasksJson && savedCatText !== null && savedThmText !== null) {
        initialT = JSON.parse(savedTasksJson);
        initialCat = savedCatText;
        initialThm = savedThmText;
      }
    } catch (err) {
      console.warn('Failed to parse localStorage data, falling back to initial sample', err);
    }

    if (!initialCat) {
      initialT = parseCategoryText(INITIAL_CATEGORY_TEXT);
      initialCats = extractCategorySections(INITIAL_CATEGORY_TEXT);
      initialThms = ['Uncategorized'];
      initialCat = INITIAL_CATEGORY_TEXT;
      initialThm = formatTasksToThemeText(initialT, initialThms);
    } else {
      if (initialCats.length === 0) {
        initialCats = extractCategorySections(initialCat);
      }
      if (initialThms.length === 0) {
        initialThms = extractThemeSections(initialThm);
      }
    }

    // Sort tasks on startup by due date so both panes (category and theme) open in due date order
    const sortedInitialT = initialT.length > 0 ? sortTasksByDueDate(initialT) : initialT;
    const initialSortedCat = initialCat ? formatTasksToCategoryText(sortedInitialT, initialCats) : initialCat;
    const initialSortedThm = initialThm ? formatTasksToThemeText(sortedInitialT, initialThms) : initialThm;

    updateTasks(sortedInitialT);
    updateCategories(initialCats);
    updateThemes(initialThms);
    updateCategoryText(initialSortedCat);
    updateThemeText(initialSortedThm);
    if (initialT.length > 0) {
      saveToStorage(sortedInitialT, initialSortedCat, initialSortedThm, initialCats, initialThms);
    }

    // If history is empty, record initial state
    if (loadedHist.snapshots.length === 0) {
      const updatedHist = addSnapshot(loadedHist, '初期ロード', initialSortedCat, initialSortedThm);
      setHistoryState(updatedHist);
    } else {
      setHistoryState(loadedHist);
    }

    // Initial background sync with remote
    syncWithRemote(true);
  }, [syncWithRemote]);

  // SWR: auto-sync on window focus or visibility change (when user returns to app)
  useEffect(() => {
    const onFocus = () => {
      syncWithRemote(true);
      checkForServiceWorkerUpdate();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithRemote(true);
        checkForServiceWorkerUpdate();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [syncWithRemote]);

  // Sync from sourcePane to opposite pane (Ctrl+S / Sync button)
  const handleCommitChange = useCallback(
    (sourcePane: PaneType) => {
      let label = '';
      let newTasks: TaskItem[] = [];
      let newCat = '';
      let newThm = '';
      let newCats = categoriesRef.current;
      let newThms = themesRef.current;

      const activeHandle = sourcePane === 'category' ? categoryPaneRef.current : themePaneRef.current;
      const cursorInfo = activeHandle?.getCursorLineAndCol?.();

      if (sourcePane === 'category') {
        label = '左 ➔ 右 反映';
        const rawCat = categoryTextRef.current;
        newCats = extractCategorySections(rawCat);
        const parsed = parseCategoryTextWithCompleted(
          rawCat,
          tasksRef.current,
          completedTasksRef.current
        );
        newTasks = parsed.tasks;
        if (parsed.completedTasks.length !== completedTasksRef.current.length) {
          updateCompletedTasks(parsed.completedTasks);
        }
        newCat = formatTasksToCategoryText(newTasks, newCats);
        newThm = formatTasksToThemeText(newTasks, newThms);
        updateCategories(newCats);
        updateTasks(newTasks);
        updateCategoryText(newCat);
        updateThemeText(newThm);
        saveToStorage(newTasks, newCat, newThm, newCats, newThms, parsed.completedTasks);
        showToast('💾 左 ➔ 右へ反映しました');
      } else {
        label = '右 ➔ 左 反映';
        const rawThm = themeTextRef.current;
        newThms = extractThemeSections(rawThm);
        const parsed = parseThemeTextWithCompleted(
          rawThm,
          tasksRef.current,
          completedTasksRef.current
        );
        newTasks = parsed.tasks;
        if (parsed.completedTasks.length !== completedTasksRef.current.length) {
          updateCompletedTasks(parsed.completedTasks);
        }
        newThm = formatTasksToThemeText(newTasks, newThms);
        newCat = formatTasksToCategoryText(newTasks, newCats);
        updateThemes(newThms);
        updateTasks(newTasks);
        updateCategoryText(newCat);
        updateThemeText(newThm);
        saveToStorage(newTasks, newCat, newThm, newCats, newThms, parsed.completedTasks);
        showToast('💾 右 ➔ 左へ反映しました');
      }

      updateDirtyPane(null);

      if (cursorInfo) {
        requestAnimationFrame(() => {
          activeHandle?.restoreCursorLineAndCol?.(cursorInfo.lineIdx, cursorInfo.col + 1);
        });
      }

      // Record snapshot to 30-generation history
      setHistoryState((prev) => addSnapshot(prev, label, newCat, newThm));

      // Trigger background GitHub push if configured
      triggerBackgroundGitHubPush(newTasks, newCats, newThms, label);
    },
    [saveToStorage, triggerBackgroundGitHubPush]
  );

  // Complete current task at cursor
  const handleCompleteCurrentTask = useCallback(() => {
    const activePane = focusedPane || activeMobilePane;
    const activeHandle = activePane === 'category' ? categoryPaneRef.current : themePaneRef.current;
    const cursor = activeHandle?.getCursorLineAndCol?.();
    if (!cursor) {
      showToast('⚠️ 完了にするタスク行を選択してください');
      return;
    }

    const currentText = activePane === 'category' ? categoryTextRef.current : themeTextRef.current;
    const lines = currentText.split('\n');
    const targetIdx = cursor.lineIdx;

    if (targetIdx < 0 || targetIdx >= lines.length) return;
    const line = lines[targetIdx];

    if (
      line.trim() === '' ||
      line.trim().startsWith('!') ||
      line.trim().startsWith('[') ||
      /^[ \t\u3000]+/.test(line)
    ) {
      showToast('⚠️ 完了にするタスク行を選択してください');
      return;
    }

    const collectedComments: string[] = [];
    let endIdx = targetIdx + 1;
    while (endIdx < lines.length && /^[ \t\u3000]+/.test(lines[endIdx])) {
      collectedComments.push(lines[endIdx].replace(/^[ \t\u3000]+/, ''));
      endIdx++;
    }

    let lineWorking = line.trim();
    let theme = 'Uncategorized';
    const themeMatch = lineWorking.match(/[\[［]([^\[\]［］\n#＃!！]+?)(?:[\]］]|$)/);
    if (themeMatch) {
      theme = themeMatch[1].trim() || 'Uncategorized';
      lineWorking = lineWorking.replace(themeMatch[0], ' ');
    } else if (activePane === 'theme') {
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (/^[\[［][^\[\]［］]+[\]］]$/.test(lines[i].trim())) {
          theme = lines[i].trim().slice(1, -1).trim() || 'Uncategorized';
          break;
        }
      }
    }

    let dueDate: string | null = null;
    const dueDateMatch = lineWorking.match(DUE_DATE_REGEX);
    if (dueDateMatch) {
      dueDate = dueDateMatch[0].replace(/^[#＃]/, '').trim();
      lineWorking = lineWorking.replace(dueDateMatch[0], ' ');
    }

    let category = 'inbox';
    const catMatch = lineWorking.match(/(?:^|\s)[!！]([^\s\[\]［］#＃!！]+)/);
    if (catMatch) {
      category = catMatch[1].trim() || 'inbox';
      lineWorking = lineWorking.replace(catMatch[0], ' ');
    } else if (activePane === 'category') {
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (/^[!！].+/.test(lines[i].trim())) {
          category = lines[i].trim().replace(/^[!！]/, '').trim() || 'inbox';
          break;
        }
      }
    }

    const title = cleanTaskTitle(lineWorking.replace(/\s+/g, ' ').trim());
    if (!title) return;

    const completedItem: CompletedTaskItem = {
      id: generateId(),
      title,
      category,
      theme,
      dueDate,
      comments: collectedComments,
      completedAt: new Date().toISOString(),
    };

    lines.splice(targetIdx, endIdx - targetIdx);
    const updatedRawText = lines.join('\n');

    const newCompleted = [completedItem, ...completedTasksRef.current];
    updateCompletedTasks(newCompleted);
    setLastCompletedTaskForUndo(completedItem);

    if (activePane === 'category') {
      const newCats = extractCategorySections(updatedRawText);
      const parsed = parseCategoryTextWithCompleted(updatedRawText, tasksRef.current, newCompleted);
      const newTasks = parsed.tasks;
      const newCat = formatTasksToCategoryText(newTasks, newCats);
      const newThm = formatTasksToThemeText(newTasks, themesRef.current);
      updateCategories(newCats);
      updateTasks(newTasks);
      updateCategoryText(newCat);
      updateThemeText(newThm);
      saveToStorage(newTasks, newCat, newThm, newCats, themesRef.current, newCompleted);
      triggerBackgroundGitHubPush(newTasks, newCats, themesRef.current, `complete: ${title}`);
    } else {
      const newThms = extractThemeSections(updatedRawText);
      const parsed = parseThemeTextWithCompleted(updatedRawText, tasksRef.current, newCompleted);
      const newTasks = parsed.tasks;
      const newThm = formatTasksToThemeText(newTasks, newThms);
      const newCat = formatTasksToCategoryText(newTasks, categoriesRef.current);
      updateThemes(newThms);
      updateTasks(newTasks);
      updateCategoryText(newCat);
      updateThemeText(newThm);
      saveToStorage(newTasks, newCat, newThm, categoriesRef.current, newThms, newCompleted);
      triggerBackgroundGitHubPush(newTasks, categoriesRef.current, newThms, `complete: ${title}`);
    }

    updateDirtyPane(null);
    showToast(`✔︎「${title}」を完了にしました`);
  }, [focusedPane, activeMobilePane, saveToStorage, triggerBackgroundGitHubPush]);

  // Restore completed task back to active tasks
  const handleRestoreCompletedTask = useCallback(
    (taskId: string) => {
      const found = completedTasksRef.current.find((t) => t.id === taskId);
      if (!found) return;

      const remaining = completedTasksRef.current.filter((t) => t.id !== taskId);
      updateCompletedTasks(remaining);

      const restored: TaskItem = {
        id: found.id,
        title: found.title,
        category: found.category && found.category !== 'done' ? found.category : 'inbox',
        theme: found.theme || 'Uncategorized',
        dueDate: found.dueDate,
        comments: found.comments,
        order: tasksRef.current.length,
      };

      const newTasks = [restored, ...tasksRef.current];
      const newCat = formatTasksToCategoryText(newTasks, categoriesRef.current);
      const newThm = formatTasksToThemeText(newTasks, themesRef.current);

      updateTasks(newTasks);
      updateCategoryText(newCat);
      updateThemeText(newThm);
      saveToStorage(newTasks, newCat, newThm, categoriesRef.current, themesRef.current, remaining);
      triggerBackgroundGitHubPush(newTasks, categoriesRef.current, themesRef.current, `restore: ${found.title}`);

      showToast(`↩️「${found.title}」を未完了に復元しました`);
    },
    [saveToStorage, triggerBackgroundGitHubPush]
  );

  // Archive entire theme to todo-archive.json
  const handleArchiveTheme = useCallback(
    (themeName: string) => {
      const res = archiveTheme(
        themeName,
        tasksRef.current,
        completedTasksRef.current,
        archiveData
      );

      updateTasks(res.updatedTasks);
      updateCompletedTasks(res.updatedCompletedTasks);
      const newThms = res.updatedThemes(themesRef.current);
      updateThemes(newThms);
      setArchiveData(res.updatedArchive);

      const newCat = formatTasksToCategoryText(res.updatedTasks, categoriesRef.current);
      const newThm = formatTasksToThemeText(res.updatedTasks, newThms);
      updateCategoryText(newCat);
      updateThemeText(newThm);

      saveToStorage(res.updatedTasks, newCat, newThm, categoriesRef.current, newThms, res.updatedCompletedTasks);

      triggerBackgroundGitHubPush(res.updatedTasks, categoriesRef.current, newThms, `archive theme: ${themeName}`);
      const settings = loadGitHubSettings();
      if (settings) {
        pushArchiveToGitHubRepo(settings, res.updatedArchive);
      }

      showToast(`📦 テーマ「${themeName}」をアーカイブしました (${res.archivedCount}件)`);
    },
    [archiveData, saveToStorage, triggerBackgroundGitHubPush]
  );

  // Restore archived theme from todo-archive.json
  const handleRestoreArchivedTheme = useCallback(
    (themeName: string) => {
      try {
        const res = restoreArchivedTheme(themeName, archiveData);
        setArchiveData(res.updatedArchive);

        const newThms = [res.restoredThemeName, ...themesRef.current.filter((th) => th !== res.restoredThemeName)];
        const newTasks = [...res.restoredTasks, ...tasksRef.current];

        updateThemes(newThms);
        updateTasks(newTasks);

        const newCat = formatTasksToCategoryText(newTasks, categoriesRef.current);
        const newThm = formatTasksToThemeText(newTasks, newThms);
        updateCategoryText(newCat);
        updateThemeText(newThm);

        saveToStorage(newTasks, newCat, newThm, categoriesRef.current, newThms);
        triggerBackgroundGitHubPush(newTasks, categoriesRef.current, newThms, `restore theme: ${themeName}`);

        const settings = loadGitHubSettings();
        if (settings) {
          pushArchiveToGitHubRepo(settings, res.updatedArchive);
        }

        showToast(`↩️ テーマ「${themeName}」を現役に復元しました`);
      } catch (e: any) {
        showToast(`⚠️ 復元に失敗しました: ${e.message}`);
      }
    },
    [archiveData, saveToStorage, triggerBackgroundGitHubPush]
  );

  const completedCountByTheme = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of completedTasksRef.current) {
      const th = task.theme || 'Uncategorized';
      counts[th] = (counts[th] || 0) + 1;
    }
    return counts;
  }, [categoryText, themeText, isCompletedDrawerOpen]);

  // Sort by due date within each section
  const handleSortDueDates = useCallback(() => {
    let currentTasks = tasksRef.current;
    let currentCats = categoriesRef.current;
    let currentThms = themesRef.current;
    if (dirtyPane === 'category') {
      currentCats = extractCategorySections(categoryTextRef.current);
      currentTasks = parseCategoryText(categoryTextRef.current, currentTasks);
      updateCategories(currentCats);
    } else if (dirtyPane === 'theme') {
      currentThms = extractThemeSections(themeTextRef.current);
      currentTasks = parseThemeText(themeTextRef.current, currentTasks);
      updateThemes(currentThms);
    }

    // Sort tasks globally by due date so all sections in both panes are sorted by due date
    const sorted = sortTasksByDueDate(currentTasks);
    const newCatText = formatTasksToCategoryText(sorted, currentCats);
    const newThmText = formatTasksToThemeText(sorted, currentThms);

    updateTasks(sorted);
    updateCategoryText(newCatText);
    updateThemeText(newThmText);
    saveToStorage(sorted, newCatText, newThmText, currentCats, currentThms);
    updateDirtyPane(null);

    const label = '期日ソート';
    showToast('⚡️ 各区切りを期日順にソートしました (両ペイン)');

    // Record snapshot
    setHistoryState((prev) => addSnapshot(prev, label, newCatText, newThmText));

    // Background push
    triggerBackgroundGitHubPush(sorted, currentCats, currentThms, label);
  }, [dirtyPane, saveToStorage, triggerBackgroundGitHubPush]);

  // Undo (restore previous snapshot in stack)
  const canUndo = historyState.currentIndex > 0;
  const canRedo = historyState.currentIndex < historyState.snapshots.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const targetIndex = historyState.currentIndex - 1;
    const targetSnap = historyState.snapshots[targetIndex];
    if (!targetSnap) return;

    const parsedTasks = parseCategoryText(targetSnap.categoryText);
    const parsedCats = extractCategorySections(targetSnap.categoryText);
    const parsedThms = extractThemeSections(targetSnap.themeText);
    updateTasks(parsedTasks);
    updateCategories(parsedCats);
    updateThemes(parsedThms);
    updateCategoryText(targetSnap.categoryText);
    updateThemeText(targetSnap.themeText);
    saveToStorage(parsedTasks, targetSnap.categoryText, targetSnap.themeText, parsedCats, parsedThms);
    updateDirtyPane(null);

    const newState: HistoryState = {
      ...historyState,
      currentIndex: targetIndex,
    };
    persistHistoryState(newState);
    setHistoryState(newState);

    showToast(`↶ 元に戻しました (${targetSnap.label})`);
  }, [canUndo, historyState, saveToStorage]);

  // Redo (advance to next snapshot in stack)
  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const targetIndex = historyState.currentIndex + 1;
    const targetSnap = historyState.snapshots[targetIndex];
    if (!targetSnap) return;

    const parsedTasks = parseCategoryText(targetSnap.categoryText);
    const parsedCats = extractCategorySections(targetSnap.categoryText);
    const parsedThms = extractThemeSections(targetSnap.themeText);
    updateTasks(parsedTasks);
    updateCategories(parsedCats);
    updateThemes(parsedThms);
    updateCategoryText(targetSnap.categoryText);
    updateThemeText(targetSnap.themeText);
    saveToStorage(parsedTasks, targetSnap.categoryText, targetSnap.themeText, parsedCats, parsedThms);
    updateDirtyPane(null);

    const newState: HistoryState = {
      ...historyState,
      currentIndex: targetIndex,
    };
    persistHistoryState(newState);
    setHistoryState(newState);

    showToast(`↷ やり直しました (${targetSnap.label})`);
  }, [canRedo, historyState, saveToStorage]);

  // Restore snapshot by index from HistoryModal
  const handleRestoreSnapshot = useCallback(
    (index: number) => {
      const snap = historyState.snapshots[index];
      if (!snap) return;

      const parsedTasks = parseCategoryText(snap.categoryText);
      const parsedCats = extractCategorySections(snap.categoryText);
      const parsedThms = extractThemeSections(snap.themeText);
      updateTasks(parsedTasks);
      updateCategories(parsedCats);
      updateThemes(parsedThms);
      updateCategoryText(snap.categoryText);
      updateThemeText(snap.themeText);
      saveToStorage(parsedTasks, snap.categoryText, snap.themeText, parsedCats, parsedThms);
      updateDirtyPane(null);

      const newState: HistoryState = {
        ...historyState,
        currentIndex: index,
      };
      persistHistoryState(newState);
      setHistoryState(newState);

      showToast(`🕰️ 世代「${snap.label}」に復元しました`);
    },
    [historyState, saveToStorage]
  );

  // Manual GitHub Pull
  const handleManualPull = useCallback(async () => {
    const settings = gitHubSettings || loadGitHubSettings();
    if (!settings || !settings.token || !settings.owner || !settings.repo) {
      throw new Error('GitHub設定を入力してください');
    }

    setSyncStatus('syncing');
    setSyncErrorMessage(undefined);
    try {
      const { payload } = await fetchFromGitHub(settings);
      const loadedTasks: TaskItem[] =
        Array.isArray(payload.tasks) && payload.tasks.length > 0
          ? payload.tasks
          : parseCategoryText(payload.categoryText || '');

      const loadedCats: string[] =
        Array.isArray(payload.categories) && payload.categories.length > 0
          ? payload.categories
          : extractCategorySections(payload.categoryText || '');

      const loadedThms: string[] =
        Array.isArray(payload.themes) && payload.themes.length > 0
          ? payload.themes
          : extractThemeSections(payload.themeText || '');

      const sortedLoadedTasks = sortTasksByDueDate(loadedTasks);
      const newCat = formatTasksToCategoryText(sortedLoadedTasks, loadedCats);
      const newThm = formatTasksToThemeText(sortedLoadedTasks, loadedThms);

      updateTasks(sortedLoadedTasks);
      updateCategories(loadedCats);
      updateThemes(loadedThms);
      updateCategoryText(newCat);
      updateThemeText(newThm);
      saveToStorage(sortedLoadedTasks, newCat, newThm, loadedCats, loadedThms);
      updateDirtyPane(null);

      setSyncStatus('success');
      const now = Date.now();
      setLastSyncedAt(now);
      persistLastSyncedAt(now);

      const label = 'GitHubから取得 (Pull)';
      setHistoryState((prev) => addSnapshot(prev, label, newCat, newThm));
      showToast('☁️ GitHubから最新データを取得しました');
    } catch (err: any) {
      setSyncStatus('error');
      setSyncErrorMessage(err.message || 'GitHub取得エラー');
      throw err;
    }
  }, [gitHubSettings, saveToStorage]);

  // Manual GitHub Push
  const handleManualPush = useCallback(async () => {
    const settings = gitHubSettings || loadGitHubSettings();
    if (!settings || !settings.token || !settings.owner || !settings.repo) {
      throw new Error('GitHub設定を入力してください');
    }

    setSyncStatus('syncing');
    setSyncErrorMessage(undefined);
    try {
      const currentCats = categoriesRef.current;
      const currentThms = themesRef.current;
      const currentT = tasksRef.current;

      const payload: RemotePayload = {
        version: 2,
        updatedAt: new Date().toISOString(),
        categories: currentCats,
        themes: currentThms,
        tasks: currentT,
      };

      await pushToGitHub(settings, payload, 'chore: manual push from Dual Memo PWA');
      setSyncStatus('success');
      const now = Date.now();
      setLastSyncedAt(now);
      persistLastSyncedAt(now);
      showToast('☁️ GitHubへバックアップ保存しました');
    } catch (err: any) {
      setSyncStatus('error');
      setSyncErrorMessage(err.message || 'GitHub保存エラー');
      throw err;
    }
  }, [gitHubSettings]);

  // Save GitHub Settings handler
  const handleSaveSettings = (settings: GitHubSettings) => {
    persistGitHubSettings(settings);
    setGitHubSettings(settings);
    showToast('⚙️ GitHub設定を保存しました');
  };

  // QuickToolbar helper targets
  const getActivePaneHandle = () => {
    const target = dirtyPane || focusedPane || activeMobilePane;
    return target === 'theme' ? themePaneRef.current : categoryPaneRef.current;
  };

  const handleQuickInsertText = (before: string, after = '') => {
    getActivePaneHandle()?.insertText(before, after);
  };

  const handleQuickInsertIndent = () => {
    getActivePaneHandle()?.insertIndentComment();
  };

  const handleQuickInsertDueDate = (dateStr: string) => {
    getActivePaneHandle()?.insertDueDate(dateStr);
  };

  const handleOpenCalendar = () => {
    setIsCalendarOpen(true);
  };

  // Global Ctrl+S fallback
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const targetPane = dirtyPane || focusedPane || activeMobilePane;
        handleCommitChange(targetPane);
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [dirtyPane, focusedPane, activeMobilePane, handleCommitChange]);

  const viewport = useVisualViewport();
  const isDesktop =
    !viewport.isKeyboardOpen &&
    typeof window !== 'undefined' &&
    window.innerWidth >= 640;

  return (
    <div
      className="fixed inset-x-0 flex flex-col bg-slate-100 overflow-hidden font-sans select-none sm:select-auto"
      style={{
        top: 'var(--vv-offset-top, 0px)',
        height: 'var(--vv-height, 100dvh)',
      }}
    >
      {/* Temporary Mobile Viewport Debug Pill (non-interactive, top-right) */}
      <div className="sm:hidden absolute top-1 right-1.5 z-50 pointer-events-none bg-slate-900/75 text-emerald-300 font-mono text-[9px] leading-tight px-1.5 py-0.5 rounded shadow">
        in:{viewport.innerHeight} vv:{viewport.vvHeight} top:{viewport.vvOffsetTop} sy:{viewport.scrollY} kb:{viewport.isKeyboardOpen ? 1 : 0}
      </div>

      {/* Header (auto-collapsed on mobile when keyboard is open to maximize editor lines) */}
      <div className={viewport.isKeyboardOpen ? 'hidden sm:block' : 'block'}>
        <Header
          onSortDueDates={handleSortDueDates}
          onManualSync={() => {
            const targetPane = dirtyPane || focusedPane || activeMobilePane;
            handleCommitChange(targetPane);
          }}
          onToggleHelp={() => setIsHelpOpen(true)}
          onToggleHistory={() => setIsHistoryOpen(true)}
          onToggleArchive={() => setIsArchiveModalOpen(true)}
          archiveThemeCount={archiveData.archivedThemes.length}
          onToggleSettings={() => setIsSettingsOpen(true)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          historyCount={historyState.snapshots.length}
          syncStatus={syncStatus}
          activeMobilePane={activeMobilePane}
          onChangeMobilePane={setActiveMobilePane}
          isSaved={dirtyPane === null}
        />
      </div>

      {/* Main Dual Memo Workspace */}
      <main
        className={`flex-1 min-h-0 w-full mx-auto overflow-hidden ${
          viewport.isKeyboardOpen ? 'p-0 sm:p-3' : 'p-1.5 sm:p-3'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 h-full min-h-0">
          {/* Left Pane (Category axis: !inbox) */}
          <div
            className={`h-full min-h-0 ${
              activeMobilePane === 'category' ? 'block' : 'hidden sm:block'
            }`}
          >
            <MemoPane
              ref={categoryPaneRef}
              type="category"
              title="左ペイン（分類軸: !inbox）"
              subTitle="タスク行に [テーマ名] を書いて Ctrl+S で右へ反映"
              placeholder={`!inbox\n・牛乳を買う #10/25 [生活]\n  スーパーの特売日\n\n!ワーク\n・企画書作成 #10/22 [仕事]`}
              text={categoryText}
              isDirty={dirtyPane === 'category'}
              isKeyboardOpen={viewport.isKeyboardOpen}
              onChangeText={(newText) => {
                updateCategoryText(newText);
                updateDirtyPane('category');
              }}
              onCommitChange={handleCommitChange}
              onFocus={() => setFocusedPane('category')}
              onBlur={() => setFocusedPane(null)}
              onActiveLineTagsChange={(tags) => setActiveLineTags(tags)}
              onSuggestionTrigger={(trig) => setSuggestionTrigger(trig)}
              suggestionTrigger={
                focusedPane === 'category' || (!focusedPane && activeMobilePane === 'category')
                  ? suggestionTrigger
                  : null
              }
              categoryOptions={categoryOptions}
              themeOptions={themeOptions}
              onOpenCalendar={handleOpenCalendar}
            />
          </div>

          {/* Right Pane (Theme axis: [Uncategorized]) */}
          <div
            className={`h-full min-h-0 ${
              activeMobilePane === 'theme' ? 'block' : 'hidden sm:block'
            }`}
          >
            <MemoPane
              ref={themePaneRef}
              type="theme"
              title="右ペイン（テーマ軸: [Uncategorized]）"
              subTitle="タスク行に !分類名 を書いて Ctrl+S で左へ反映"
              placeholder={`[生活]\n・牛乳を買う #10/25\n  スーパーの特売日\n\n[仕事]\n・企画書作成 #10/22 !ワーク`}
              text={themeText}
              isDirty={dirtyPane === 'theme'}
              isKeyboardOpen={viewport.isKeyboardOpen}
              onChangeText={(newText) => {
                updateThemeText(newText);
                updateDirtyPane('theme');
              }}
              onCommitChange={handleCommitChange}
              onFocus={() => setFocusedPane('theme')}
              onBlur={() => setFocusedPane(null)}
              onActiveLineTagsChange={(tags) => setActiveLineTags(tags)}
              onSuggestionTrigger={(trig) => setSuggestionTrigger(trig)}
              suggestionTrigger={
                focusedPane === 'theme' || (!focusedPane && activeMobilePane === 'theme')
                  ? suggestionTrigger
                  : null
              }
              categoryOptions={categoryOptions}
              themeOptions={themeOptions}
              onOpenCalendar={handleOpenCalendar}
              completedTasksCount={completedTasksRef.current.length}
              completedCountByTheme={completedCountByTheme}
              onOpenCompletedDrawer={(th) => {
                setSelectedThemeForCompletedDrawer(th || null);
                setIsCompletedDrawerOpen(true);
              }}
              onArchiveTheme={handleArchiveTheme}
            />
          </div>
        </div>
      </main>

      {/* Quick Toolbar (Always visible on mobile bottom or desktop bottom helper) */}
      <QuickToolbar
        onInsertText={handleQuickInsertText}
        onInsertIndentComment={handleQuickInsertIndent}
        onInsertDueDate={handleQuickInsertDueDate}
        onOpenCalendar={handleOpenCalendar}
        onCompleteCurrentTask={handleCompleteCurrentTask}
        onCommit={() => {
          const targetPane = dirtyPane || focusedPane || activeMobilePane;
          handleCommitChange(targetPane);
        }}
        isDirty={dirtyPane !== null}
        isKeyboardOpen={viewport.isKeyboardOpen}
        activeLineTags={activeLineTags}
        onRemoveActiveTag={(tag) => {
          getActivePaneHandle()?.removeTagFromCurrentLine(tag);
        }}
        onClickActiveTag={(tag) => {
          if (tag.type === 'category' || tag.type === 'theme') {
            setSuggestionTrigger({
              type: tag.type,
              query: tag.parts.length > 1 ? `${tag.parts[0]}:` : tag.value,
              triggerChar: tag.type === 'category' ? '!' : '[',
              replaceStart: tag.startIndex,
              replaceEnd: tag.endIndex,
            });
          }
        }}
        suggestionTrigger={isDesktop ? null : suggestionTrigger}
        categoryOptions={categoryOptions}
        themeOptions={themeOptions}
        onSelectSuggestion={(val) => {
          if (suggestionTrigger) {
            getActivePaneHandle()?.applySuggestionAtCursor(val, suggestionTrigger);
            if (!val.endsWith(':')) {
              setSuggestionTrigger(null);
            }
          }
        }}
        onCloseSuggestion={() => setSuggestionTrigger(null)}
      />

      {/* Modals */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        snapshots={historyState.snapshots}
        currentIndex={historyState.currentIndex}
        onRestore={handleRestoreSnapshot}
      />

      <CalendarPickerModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        onSelectDate={handleQuickInsertDueDate}
        selectedDateStr={getActivePaneHandle()?.getCurrentLineDueDate()}
      />

      <CompletedTasksDrawer
        isOpen={isCompletedDrawerOpen}
        onClose={() => setIsCompletedDrawerOpen(false)}
        completedTasks={completedTasksRef.current}
        themes={themesRef.current}
        initialSelectedTheme={selectedThemeForCompletedDrawer}
        onRestoreTask={handleRestoreCompletedTask}
        onArchiveTheme={handleArchiveTheme}
      />

      <ArchiveModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        archiveData={archiveData}
        onRestoreTheme={handleRestoreArchivedTheme}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={gitHubSettings}
        onSaveSettings={handleSaveSettings}
        onManualPull={handleManualPull}
        onManualPush={handleManualPush}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        errorMessage={syncErrorMessage}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-14 right-4 z-50 bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-lg shadow-xl animate-fadeIn flex items-center gap-2">
          <span>{toastMessage}</span>
          {lastCompletedTaskForUndo && toastMessage.includes('完了にしました') && (
            <button
              type="button"
              onClick={() => {
                handleRestoreCompletedTask(lastCompletedTaskForUndo.id);
                setLastCompletedTaskForUndo(null);
              }}
              className="text-amber-300 hover:text-amber-200 underline font-bold cursor-pointer text-xs"
            >
              元に戻す
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
