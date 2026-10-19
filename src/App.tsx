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
import { MemoPane } from './components/MemoPane';
import { HelpModal } from './components/HelpModal';

const STORAGE_KEY_TASKS = 'dual_memo_tasks_v2';
const STORAGE_KEY_CAT_TEXT = 'dual_memo_category_text_v2';
const STORAGE_KEY_THM_TEXT = 'dual_memo_theme_text_v2';

export const App: React.FC = () => {
  const [, setTasks] = useState<TaskItem[]>([]);
  const [categoryText, setCategoryText] = useState<string>('');
  const [themeText, setThemeText] = useState<string>('');
  const [activeMobilePane, setActiveMobilePane] = useState<PaneType>('category');
  const [focusedPane, setFocusedPane] = useState<PaneType | null>(null);
  const [dirtyPane, setDirtyPane] = useState<PaneType | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refs to always hold the exact latest text without closure staleness
  const categoryTextRef = useRef<string>('');
  const themeTextRef = useRef<string>('');
  const tasksRef = useRef<TaskItem[]>([]);

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
    }, 2000);
  };

  // Initialize from LocalStorage or default sample
  useEffect(() => {
    try {
      const savedTasksJson = localStorage.getItem(STORAGE_KEY_TASKS);
      const savedCatText = localStorage.getItem(STORAGE_KEY_CAT_TEXT);
      const savedThmText = localStorage.getItem(STORAGE_KEY_THM_TEXT);

      if (savedTasksJson && savedCatText !== null && savedThmText !== null) {
        const loadedTasks: TaskItem[] = JSON.parse(savedTasksJson);
        updateTasks(loadedTasks);
        updateCategoryText(savedCatText);
        updateThemeText(savedThmText);
        return;
      }
    } catch (err) {
      console.warn('Failed to parse localStorage data, falling back to initial sample', err);
    }

    const initialTasks = parseCategoryText(INITIAL_CATEGORY_TEXT);
    const initialThemeText = formatTasksToThemeText(initialTasks);
    updateTasks(initialTasks);
    updateCategoryText(INITIAL_CATEGORY_TEXT);
    updateThemeText(initialThemeText);
  }, []);

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

  // Sync from sourcePane to the opposite pane (Triggered ONLY on Ctrl+S or Sync button)
  const handleCommitChange = useCallback(
    (sourcePane: PaneType) => {
      if (sourcePane === 'category') {
        const currentCat = categoryTextRef.current;
        const parsedTasks = parseCategoryText(currentCat, tasksRef.current);
        const newThemeText = formatTasksToThemeText(parsedTasks);
        updateTasks(parsedTasks);
        updateThemeText(newThemeText);
        saveToStorage(parsedTasks, currentCat, newThemeText);
        showToast('💾 左 ➔ 右へ反映しました');
      } else {
        const currentThm = themeTextRef.current;
        const parsedTasks = parseThemeText(currentThm, tasksRef.current);
        const newCategoryText = formatTasksToCategoryText(parsedTasks);
        updateTasks(parsedTasks);
        updateCategoryText(newCategoryText);
        saveToStorage(parsedTasks, newCategoryText, currentThm);
        showToast('💾 右 ➔ 左へ反映しました');
      }
      setDirtyPane(null);
    },
    [saveToStorage]
  );

  // Sort by due date within each section
  const handleSortDueDates = useCallback(() => {
    // If there are unsaved edits in either pane, parse them first so nothing is lost
    let currentTasks = tasksRef.current;
    const activeSource = dirtyPane || focusedPane || 'category';
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
    showToast('⚡️ 各セクションを期日順にソートしました');
  }, [dirtyPane, focusedPane, saveToStorage]);

  // Reset sample data
  const handleResetSample = useCallback(() => {
    if (window.confirm('初期サンプルデータにリセットしますか？')) {
      const initialTasks = parseCategoryText(INITIAL_CATEGORY_TEXT);
      const initialThemeText = formatTasksToThemeText(initialTasks);
      updateTasks(initialTasks);
      updateCategoryText(INITIAL_CATEGORY_TEXT);
      updateThemeText(initialThemeText);
      saveToStorage(initialTasks, INITIAL_CATEGORY_TEXT, initialThemeText);
      setDirtyPane(null);
      showToast('サンプルデータを復元しました');
    }
  }, [saveToStorage]);

  // Global Ctrl+S / Cmd+S fallback when focus is outside textarea
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const targetPane = dirtyPane || focusedPane || 'category';
        handleCommitChange(targetPane);
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [dirtyPane, focusedPane, handleCommitChange]);

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Header */}
      <Header
        onSortDueDates={handleSortDueDates}
        onManualSync={() => {
          const targetPane = dirtyPane || focusedPane || 'category';
          handleCommitChange(targetPane);
        }}
        onResetSample={handleResetSample}
        onToggleHelp={() => setIsHelpOpen(true)}
        activeMobilePane={activeMobilePane}
        onChangeMobilePane={setActiveMobilePane}
        isSaved={dirtyPane === null}
      />

      {/* Main Dual Memo Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-3 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
          {/* Left Pane (Category axis: !inbox) */}
          <div
            className={`h-full ${
              activeMobilePane === 'category' ? 'block' : 'hidden sm:block'
            }`}
          >
            <MemoPane
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

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-lg shadow-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
