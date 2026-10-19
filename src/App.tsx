import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PaneType, TaskItem } from './types/todo';
import {
  parseCategoryText,
  parseThemeText,
  formatTasksToCategoryText,
  formatTasksToThemeText,
  sortTasksByDueDate,
} from './utils/parser';
import { INITIAL_CATEGORY_TEXT } from './data/sampleData';
import { Header } from './components/Header';
import { MemoPane, MemoPaneHandle } from './components/MemoPane';
import { HelpModal } from './components/HelpModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { QuickToolbar } from './components/QuickToolbar';
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
  fetchFromGitHub,
  pushToGitHub,
} from './utils/githubSync';

const STORAGE_KEY_TASKS = 'dual_memo_tasks_v3';
const STORAGE_KEY_CAT_TEXT = 'dual_memo_category_text_v3';
const STORAGE_KEY_THM_TEXT = 'dual_memo_theme_text_v3';

export const App: React.FC = () => {
  const [, setTasks] = useState<TaskItem[]>([]);
  const [categoryText, setCategoryText] = useState<string>('');
  const [themeText, setThemeText] = useState<string>('');
  const [activeMobilePane, setActiveMobilePane] = useState<PaneType>('category');
  const [focusedPane, setFocusedPane] = useState<PaneType | null>(null);
  const [dirtyPane, setDirtyPane] = useState<PaneType | null>(null);

  // Modals state
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // History state (30 generations undo/redo)
  const [historyState, setHistoryState] = useState<HistoryState>({
    snapshots: [],
    currentIndex: -1,
  });

  // GitHub Settings & Sync state
  const [gitHubSettings, setGitHubSettings] = useState<GitHubSettings | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | undefined>(undefined);

  // Refs to always hold the exact latest text without closure staleness
  const categoryTextRef = useRef<string>('');
  const themeTextRef = useRef<string>('');
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
    (newTasks: TaskItem[], newCatText: string, newThmText: string) => {
      try {
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(newTasks));
        localStorage.setItem(STORAGE_KEY_CAT_TEXT, newCatText);
        localStorage.setItem(STORAGE_KEY_THM_TEXT, newThmText);
      } catch (err) {
        console.error('Failed to save to localStorage', err);
      }
    },
    []
  );

  // Background GitHub push helper
  const triggerBackgroundGitHubPush = useCallback(
    async (tasks: TaskItem[], catText: string, thmText: string, label: string) => {
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
          version: 1,
          updatedAt: new Date().toISOString(),
          tasks,
          categoryText: catText,
          themeText: thmText,
        };
        await pushToGitHub(settings, payload, `chore: update memo (${label})`);
        setSyncStatus('success');
        setLastSyncedAt(Date.now());
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

    try {
      const savedTasksJson = localStorage.getItem(STORAGE_KEY_TASKS);
      const savedCatText = localStorage.getItem(STORAGE_KEY_CAT_TEXT);
      const savedThmText = localStorage.getItem(STORAGE_KEY_THM_TEXT);

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
      initialThm = formatTasksToThemeText(initialT);
      initialCat = INITIAL_CATEGORY_TEXT;
    }

    updateTasks(initialT);
    updateCategoryText(initialCat);
    updateThemeText(initialThm);

    // If history is empty, record initial state
    if (loadedHist.snapshots.length === 0) {
      const updatedHist = addSnapshot(loadedHist, '初期ロード', initialCat, initialThm);
      setHistoryState(updatedHist);
    } else {
      setHistoryState(loadedHist);
    }
  }, []);

  // Sync from sourcePane to opposite pane (Ctrl+S / Sync button)
  const handleCommitChange = useCallback(
    (sourcePane: PaneType) => {
      let label = '';
      let newTasks: TaskItem[] = [];
      let newCat = '';
      let newThm = '';

      if (sourcePane === 'category') {
        label = '左 ➔ 右 反映';
        newCat = categoryTextRef.current;
        newTasks = parseCategoryText(newCat, tasksRef.current);
        newThm = formatTasksToThemeText(newTasks);
        updateTasks(newTasks);
        updateThemeText(newThm);
        saveToStorage(newTasks, newCat, newThm);
        showToast('💾 左 ➔ 右へ反映しました');
      } else {
        label = '右 ➔ 左 反映';
        newThm = themeTextRef.current;
        newTasks = parseThemeText(newThm, tasksRef.current);
        newCat = formatTasksToCategoryText(newTasks);
        updateTasks(newTasks);
        updateCategoryText(newCat);
        saveToStorage(newTasks, newCat, newThm);
        showToast('💾 右 ➔ 左へ反映しました');
      }

      setDirtyPane(null);

      // Record snapshot to 30-generation history
      setHistoryState((prev) => addSnapshot(prev, label, newCat, newThm));

      // Trigger background GitHub push if configured
      triggerBackgroundGitHubPush(newTasks, newCat, newThm, label);
    },
    [saveToStorage, triggerBackgroundGitHubPush]
  );

  // Sort by due date within each section
  const handleSortDueDates = useCallback(() => {
    let currentTasks = tasksRef.current;
    const activeSource = dirtyPane || focusedPane || activeMobilePane || 'category';
    if (dirtyPane === 'category') {
      currentTasks = parseCategoryText(categoryTextRef.current, currentTasks);
    } else if (dirtyPane === 'theme') {
      currentTasks = parseThemeText(themeTextRef.current, currentTasks);
    }

    const sorted = sortTasksByDueDate(currentTasks, activeSource);
    const newCatText = formatTasksToCategoryText(sorted);
    const newThmText = formatTasksToThemeText(sorted);

    updateTasks(sorted);
    updateCategoryText(newCatText);
    updateThemeText(newThmText);
    saveToStorage(sorted, newCatText, newThmText);
    setDirtyPane(null);

    const label = '期日ソート';
    showToast('⚡️ 各区切りを期日順にソートしました');

    // Record snapshot
    setHistoryState((prev) => addSnapshot(prev, label, newCatText, newThmText));

    // Background push
    triggerBackgroundGitHubPush(sorted, newCatText, newThmText, label);
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
    updateTasks(parsedTasks);
    updateCategoryText(targetSnap.categoryText);
    updateThemeText(targetSnap.themeText);
    saveToStorage(parsedTasks, targetSnap.categoryText, targetSnap.themeText);
    setDirtyPane(null);

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
    updateTasks(parsedTasks);
    updateCategoryText(targetSnap.categoryText);
    updateThemeText(targetSnap.themeText);
    saveToStorage(parsedTasks, targetSnap.categoryText, targetSnap.themeText);
    setDirtyPane(null);

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
      updateTasks(parsedTasks);
      updateCategoryText(snap.categoryText);
      updateThemeText(snap.themeText);
      saveToStorage(parsedTasks, snap.categoryText, snap.themeText);
      setDirtyPane(null);

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
      const newCat = payload.categoryText || '';
      const newThm = payload.themeText || '';
      const newT: TaskItem[] =
        Array.isArray(payload.tasks) && payload.tasks.length > 0
          ? payload.tasks
          : parseCategoryText(newCat);

      updateTasks(newT);
      updateCategoryText(newCat);
      updateThemeText(newThm);
      saveToStorage(newT, newCat, newThm);
      setDirtyPane(null);

      setSyncStatus('success');
      setLastSyncedAt(Date.now());

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
      const currentCat = categoryTextRef.current;
      const currentThm = themeTextRef.current;
      const currentT = tasksRef.current;

      const payload: RemotePayload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        tasks: currentT,
        categoryText: currentCat,
        themeText: currentThm,
      };

      await pushToGitHub(settings, payload, 'chore: manual push from Dual Memo PWA');
      setSyncStatus('success');
      setLastSyncedAt(Date.now());
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

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-100 overflow-hidden font-sans select-none sm:select-auto">
      {/* Header */}
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

      {/* Main Dual Memo Workspace */}
      <main className="flex-1 w-full mx-auto p-1.5 sm:p-3 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 h-full">
          {/* Left Pane (Category axis: !inbox) */}
          <div
            className={`h-full ${
              activeMobilePane === 'category' ? 'block' : 'hidden sm:block'
            }`}
          >
            <MemoPane
              ref={categoryPaneRef}
              type="category"
              title="左ペイン（分類軸: !inbox）"
              subTitle="タスク行に [テーマ名] を書いて Ctrl+S で右へ反映"
              placeholder={`!inbox\n牛乳を買う #10/25 [生活]\n  スーパーの特売日\n\n!ワーク\n企画書作成 #10/22 [仕事]`}
              text={categoryText}
              isDirty={dirtyPane === 'category'}
              onChangeText={(newText) => {
                updateCategoryText(newText);
                setDirtyPane('category');
              }}
              onCommitChange={handleCommitChange}
              onFocus={() => setFocusedPane('category')}
              onBlur={() => setFocusedPane(null)}
            />
          </div>

          {/* Right Pane (Theme axis: [Uncategorized]) */}
          <div
            className={`h-full ${
              activeMobilePane === 'theme' ? 'block' : 'hidden sm:block'
            }`}
          >
            <MemoPane
              ref={themePaneRef}
              type="theme"
              title="右ペイン（テーマ軸: [Uncategorized]）"
              subTitle="タスク行に !分類名 を書いて Ctrl+S で左へ反映"
              placeholder={`[生活]\n牛乳を買う #10/25\n  スーパーの特売日\n\n[仕事]\n企画書作成 #10/22 !ワーク`}
              text={themeText}
              isDirty={dirtyPane === 'theme'}
              onChangeText={(newText) => {
                updateThemeText(newText);
                setDirtyPane('theme');
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
        onInsertText={handleQuickInsertText}
        onInsertIndentComment={handleQuickInsertIndent}
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
