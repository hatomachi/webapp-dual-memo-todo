import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PaneType, TaskItem } from './types/todo';
import {
  parseCategoryText,
  parseThemeText,
  formatTasksToCategoryText,
  formatTasksToThemeText,
  sortTasksByDueDate,
  extractCategorySections,
  extractThemeSections,
} from './utils/parser';
import { INITIAL_CATEGORY_TEXT } from './data/sampleData';
import { Header } from './components/Header';
import { MemoPane, MemoPaneHandle } from './components/MemoPane';
import { HelpModal } from './components/HelpModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { CalendarPickerModal } from './components/CalendarPickerModal';
import { QuickToolbar } from './components/QuickToolbar';
import { useVisualViewport } from './hooks/useVisualViewport';
import { HistoryState } from './types/history';
import {
  loadHistoryState,
  addSnapshot,
  persistHistoryState,
} from './utils/historyManager';
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
const STORAGE_KEY_CAT_TEXT = 'dual_memo_category_text_v3';
const STORAGE_KEY_THM_TEXT = 'dual_memo_theme_text_v3';
const STORAGE_KEY_CATEGORIES = 'dual_memo_categories_v3';
const STORAGE_KEY_THEMES = 'dual_memo_themes_v3';

export const App: React.FC = () => {
  const [, setTasks] = useState<TaskItem[]>([]);
  const [categoryText, setCategoryText] = useState<string>('');
  const [themeText, setThemeText] = useState<string>('');
  const [, setCategories] = useState<string[]>([]);
  const [, setThemes] = useState<string[]>([]);
  const [activeMobilePane, setActiveMobilePane] = useState<PaneType>('category');
  const [focusedPane, setFocusedPane] = useState<PaneType | null>(null);
  const [dirtyPane, setDirtyPane] = useState<PaneType | null>(null);
  const dirtyPaneRef = useRef<PaneType | null>(null);

  const updateDirtyPane = (pane: PaneType | null) => {
    dirtyPaneRef.current = pane;
    setDirtyPane(pane);
  };

  // Modals state
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      newThms?: string[]
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

        const newCat = formatTasksToCategoryText(loadedTasks, loadedCats);
        const newThm = formatTasksToThemeText(loadedTasks, loadedThms);

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
          updateTasks(loadedTasks);
          updateCategories(loadedCats);
          updateThemes(loadedThms);
          updateCategoryText(newCat);
          updateThemeText(newThm);
          saveToStorage(loadedTasks, newCat, newThm, loadedCats, loadedThms);
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
      label: string
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
      const savedCatText = localStorage.getItem(STORAGE_KEY_CAT_TEXT);
      const savedThmText = localStorage.getItem(STORAGE_KEY_THM_TEXT);
      const savedCatsJson = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      const savedThmsJson = localStorage.getItem(STORAGE_KEY_THEMES);

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

    updateTasks(initialT);
    updateCategories(initialCats);
    updateThemes(initialThms);
    updateCategoryText(initialCat);
    updateThemeText(initialThm);

    // If history is empty, record initial state
    if (loadedHist.snapshots.length === 0) {
      const updatedHist = addSnapshot(loadedHist, '初期ロード', initialCat, initialThm);
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
        newTasks = parseCategoryText(rawCat, tasksRef.current);
        newCat = formatTasksToCategoryText(newTasks, newCats);
        newThm = formatTasksToThemeText(newTasks, newThms);
        updateCategories(newCats);
        updateTasks(newTasks);
        updateCategoryText(newCat);
        updateThemeText(newThm);
        saveToStorage(newTasks, newCat, newThm, newCats, newThms);
        showToast('💾 左 ➔ 右へ反映しました');
      } else {
        label = '右 ➔ 左 反映';
        const rawThm = themeTextRef.current;
        newThms = extractThemeSections(rawThm);
        newTasks = parseThemeText(rawThm, tasksRef.current);
        newThm = formatTasksToThemeText(newTasks, newThms);
        newCat = formatTasksToCategoryText(newTasks, newCats);
        updateThemes(newThms);
        updateTasks(newTasks);
        updateCategoryText(newCat);
        updateThemeText(newThm);
        saveToStorage(newTasks, newCat, newThm, newCats, newThms);
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

  // Sort by due date within each section
  const handleSortDueDates = useCallback(() => {
    let currentTasks = tasksRef.current;
    let currentCats = categoriesRef.current;
    let currentThms = themesRef.current;
    const activeSource = dirtyPane || focusedPane || activeMobilePane || 'category';
    if (dirtyPane === 'category') {
      currentCats = extractCategorySections(categoryTextRef.current);
      currentTasks = parseCategoryText(categoryTextRef.current, currentTasks);
      updateCategories(currentCats);
    } else if (dirtyPane === 'theme') {
      currentThms = extractThemeSections(themeTextRef.current);
      currentTasks = parseThemeText(themeTextRef.current, currentTasks);
      updateThemes(currentThms);
    }

    const sorted = sortTasksByDueDate(currentTasks, activeSource);
    const newCatText = formatTasksToCategoryText(sorted, currentCats);
    const newThmText = formatTasksToThemeText(sorted, currentThms);

    updateTasks(sorted);
    updateCategoryText(newCatText);
    updateThemeText(newThmText);
    saveToStorage(sorted, newCatText, newThmText, currentCats, currentThms);
    updateDirtyPane(null);

    const label = '期日ソート';
    showToast('⚡️ 各区切りを期日順にソートしました');

    // Record snapshot
    setHistoryState((prev) => addSnapshot(prev, label, newCatText, newThmText));

    // Background push
    triggerBackgroundGitHubPush(sorted, currentCats, currentThms, label);
  }, [dirtyPane, focusedPane, activeMobilePane, saveToStorage, triggerBackgroundGitHubPush]);

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

      const newCat = formatTasksToCategoryText(loadedTasks, loadedCats);
      const newThm = formatTasksToThemeText(loadedTasks, loadedThms);

      updateTasks(loadedTasks);
      updateCategories(loadedCats);
      updateThemes(loadedThms);
      updateCategoryText(newCat);
      updateThemeText(newThm);
      saveToStorage(loadedTasks, newCat, newThm, loadedCats, loadedThms);
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

  const handleQuickToggleNav = () => {
    getActivePaneHandle()?.toggleNav();
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
            />
          </div>
        </div>
      </main>

      {/* Quick Toolbar (Always visible on mobile bottom or desktop bottom helper) */}
      <QuickToolbar
        activePane={dirtyPane || focusedPane || activeMobilePane}
        onTogglePane={() => {
          const nextPane = activeMobilePane === 'category' ? 'theme' : 'category';
          setActiveMobilePane(nextPane);
          requestAnimationFrame(() => {
            if (nextPane === 'theme') {
              themePaneRef.current?.focus();
            } else {
              categoryPaneRef.current?.focus();
            }
          });
        }}
        onInsertText={handleQuickInsertText}
        onInsertIndentComment={handleQuickInsertIndent}
        onInsertDueDate={handleQuickInsertDueDate}
        onOpenCalendar={handleOpenCalendar}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCommit={() => {
          const targetPane = dirtyPane || focusedPane || activeMobilePane;
          handleCommitChange(targetPane);
        }}
        onSortDueDates={handleSortDueDates}
        onToggleSectionNav={handleQuickToggleNav}
        isDirty={dirtyPane !== null}
        isKeyboardOpen={viewport.isKeyboardOpen}
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
        <div className="fixed bottom-14 right-4 z-50 bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-lg shadow-xl animate-fadeIn">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
