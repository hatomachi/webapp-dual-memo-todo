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

const STORAGE_KEY_TASKS = 'dual_memo_tasks_v1';
const STORAGE_KEY_CAT_TEXT = 'dual_memo_category_text_v1';
const STORAGE_KEY_THM_TEXT = 'dual_memo_theme_text_v1';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [categoryText, setCategoryText] = useState<string>('');
  const [themeText, setThemeText] = useState<string>('');
  const [activeMobilePane, setActiveMobilePane] = useState<PaneType>('category');
  const [focusedPane, setFocusedPane] = useState<PaneType | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2500);
  };

  // Initialize from LocalStorage or default sample
  useEffect(() => {
    try {
      const savedTasksJson = localStorage.getItem(STORAGE_KEY_TASKS);
      const savedCatText = localStorage.getItem(STORAGE_KEY_CAT_TEXT);
      const savedThmText = localStorage.getItem(STORAGE_KEY_THM_TEXT);

      if (savedTasksJson && savedCatText && savedThmText) {
        const loadedTasks: TaskItem[] = JSON.parse(savedTasksJson);
        setTasks(loadedTasks);
        setCategoryText(savedCatText);
        setThemeText(savedThmText);
        return;
      }
    } catch (err) {
      console.warn('Failed to parse localStorage data, falling back to initial sample', err);
    }

    // Default sample initialization
    const initialTasks = parseCategoryText(INITIAL_CATEGORY_TEXT);
    const initialThemeText = formatTasksToThemeText(initialTasks);
    setTasks(initialTasks);
    setCategoryText(INITIAL_CATEGORY_TEXT);
    setThemeText(initialThemeText);
  }, []);

  // Save changes to localStorage
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

  // Commit changes from one pane to the other
  const handleCommitChange = useCallback(
    (sourcePane: PaneType) => {
      if (sourcePane === 'category') {
        const parsedTasks = parseCategoryText(categoryText, tasks);
        const newThemeText = formatTasksToThemeText(parsedTasks);
        setTasks(parsedTasks);
        setThemeText(newThemeText);
        saveToStorage(parsedTasks, categoryText, newThemeText);
      } else {
        const parsedTasks = parseThemeText(themeText, tasks);
        const newCategoryText = formatTasksToCategoryText(parsedTasks);
        setTasks(parsedTasks);
        setCategoryText(newCategoryText);
        saveToStorage(parsedTasks, newCategoryText, themeText);
      }
      setIsSaved(true);
    },
    [categoryText, themeText, tasks, saveToStorage]
  );

  // Debounced auto-commit while typing
  const triggerDebouncedSync = useCallback(
    (sourcePane: PaneType) => {
      setIsSaved(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        handleCommitChange(sourcePane);
      }, 1500);
    },
    [handleCommitChange]
  );

  // Sort by due date
  const handleSortDueDates = useCallback(() => {
    // Sort primarily by current active view or category
    const sorted = sortTasksByDueDate(tasks, focusedPane || 'category');
    const newCatText = formatTasksToCategoryText(sorted);
    const newThmText = formatTasksToThemeText(sorted);

    setTasks(sorted);
    setCategoryText(newCatText);
    setThemeText(newThmText);
    saveToStorage(sorted, newCatText, newThmText);
    setIsSaved(true);
    showToast('⚡️ 各セクションを期日順にソートしました');
  }, [tasks, focusedPane, saveToStorage]);

  // Delete task by ID (Completion)
  const handleDeleteTask = useCallback(
    (taskId: string) => {
      const remainingTasks = tasks.filter((t) => t.id !== taskId);
      const newCatText = formatTasksToCategoryText(remainingTasks);
      const newThmText = formatTasksToThemeText(remainingTasks);

      setTasks(remainingTasks);
      setCategoryText(newCatText);
      setThemeText(newThmText);
      saveToStorage(remainingTasks, newCatText, newThmText);
      setIsSaved(true);
      showToast('タスクを削除しました');
    },
    [tasks, saveToStorage]
  );

  // Reset sample data
  const handleResetSample = useCallback(() => {
    if (window.confirm('初期サンプルデータにリセットしますか？')) {
      const initialTasks = parseCategoryText(INITIAL_CATEGORY_TEXT);
      const initialThemeText = formatTasksToThemeText(initialTasks);
      setTasks(initialTasks);
      setCategoryText(INITIAL_CATEGORY_TEXT);
      setThemeText(initialThemeText);
      saveToStorage(initialTasks, INITIAL_CATEGORY_TEXT, initialThemeText);
      setIsSaved(true);
      showToast('サンプルデータを復元しました');
    }
  }, [saveToStorage]);

  // Global keyboard shortcuts (Ctrl+S / Cmd+S)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (focusedPane) {
          handleCommitChange(focusedPane);
          showToast('💾 同期・保存しました');
        } else {
          handleCommitChange('category');
          showToast('💾 同期・保存しました');
        }
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [focusedPane, handleCommitChange]);

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Header */}
      <Header
        onSortDueDates={handleSortDueDates}
        onManualSync={() => {
          handleCommitChange(focusedPane || 'category');
          showToast('💾 同期・保存しました');
        }}
        onResetSample={handleResetSample}
        onToggleHelp={() => setIsHelpOpen(true)}
        activeMobilePane={activeMobilePane}
        onChangeMobilePane={setActiveMobilePane}
        isSaved={isSaved}
      />

      {/* Main Dual Memo Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 h-full">
          {/* Left Pane (Category axis: !inbox) */}
          <div
            className={`h-full ${
              activeMobilePane === 'category' ? 'block' : 'hidden sm:block'
            }`}
          >
            <MemoPane
              type="category"
              title="左ペイン（分類軸: !inbox）"
              subTitle="見出し: !分類名 / 行末に [テーマ名] を付けると右側と連動"
              placeholder={`!inbox\n牛乳を買う #10/25 [生活]\n  スーパーの特売日\n\n!ワーク\n企画書作成 #10/22 [仕事]`}
              text={categoryText}
              tasks={tasks}
              onChangeText={(newText) => {
                setCategoryText(newText);
                triggerDebouncedSync('category');
              }}
              onCommitChange={handleCommitChange}
              onDeleteTask={handleDeleteTask}
              isFocused={focusedPane === 'category'}
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
              subTitle="見出し: [テーマ名] / 行末に !分類名 を付けると左側と連動"
              placeholder={`[生活]\n牛乳を買う #10/25 !inbox\n  スーパーの特売日\n\n[仕事]\n企画書作成 #10/22 !ワーク`}
              text={themeText}
              tasks={tasks}
              onChangeText={(newText) => {
                setThemeText(newText);
                triggerDebouncedSync('theme');
              }}
              onCommitChange={handleCommitChange}
              onDeleteTask={handleDeleteTask}
              isFocused={focusedPane === 'theme'}
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
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
