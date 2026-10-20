import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  RotateCcw,
  Archive,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
} from 'lucide-react';
import { CompletedTaskItem } from '../types/todo';

interface CompletedTasksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  completedTasks: CompletedTaskItem[];
  themes: string[];
  initialSelectedTheme?: string | null;
  onRestoreTask: (taskId: string) => void;
  onArchiveTheme: (themeName: string) => void;
}

export const CompletedTasksDrawer: React.FC<CompletedTasksDrawerProps> = ({
  isOpen,
  onClose,
  completedTasks,
  themes,
  initialSelectedTheme = null,
  onRestoreTask,
  onArchiveTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Set of opened theme accordion names
  const [openedThemes, setOpenedThemes] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (initialSelectedTheme) {
      s.add(initialSelectedTheme);
    }
    return s;
  });

  // Group completed tasks by theme
  const groupedTasks = useMemo(() => {
    const map = new Map<string, CompletedTaskItem[]>();
    const query = searchQuery.trim().toLowerCase();

    for (const task of completedTasks) {
      // Filter by search query if any
      if (query) {
        const matchTitle = task.title.toLowerCase().includes(query);
        const matchComment = task.comments.some((c) => c.toLowerCase().includes(query));
        const matchTheme = (task.theme || '').toLowerCase().includes(query);
        if (!matchTitle && !matchComment && !matchTheme) {
          continue;
        }
      }

      const th = task.theme || 'Uncategorized';
      if (!map.has(th)) {
        map.set(th, []);
      }
      map.get(th)!.push(task);
    }

    return map;
  }, [completedTasks, searchQuery]);

  // All known themes that have completed tasks or are in active themes
  const displayThemes = useMemo(() => {
    const all = new Set<string>();
    // Add themes that have completed tasks
    for (const th of groupedTasks.keys()) {
      all.add(th);
    }
    // Also include active themes if not searching
    if (!searchQuery) {
      for (const th of themes) {
        all.add(th);
      }
    }
    return Array.from(all);
  }, [groupedTasks, themes, searchQuery]);

  const toggleTheme = (themeName: string) => {
    setOpenedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeName)) {
        next.delete(themeName);
      } else {
        next.add(themeName);
      }
      return next;
    });
  };

  const handleArchiveConfirm = (themeName: string) => {
    const count = (groupedTasks.get(themeName) || []).length;
    const ok = window.confirm(
      `テーマ「${themeName}」をアーカイブ（保管庫）に送りますか？\n\n・右ペインとサジェストから除外され、メイン画面がスッキリします。\n・このテーマのタスク（${count}件）は todo-archive.json に冷凍保存され、いつでも見返せます。`
    );
    if (ok) {
      onArchiveTheme(themeName);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span>完了タスク</span>
                <span className="text-[11px] font-mono font-normal bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.2 rounded-full">
                  {completedTasks.length}件
                </span>
              </h2>
              <p className="text-[10px] text-slate-300">
                テーマ（区切り）ごとに確認・復元・アーカイブ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タスク名・コメント・テーマで検索..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content: Theme Accordions */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {displayThemes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              完了タスクがありません
            </div>
          ) : (
            displayThemes.map((themeName) => {
              const tasks = groupedTasks.get(themeName) || [];
              const isOpened = openedThemes.has(themeName) || Boolean(searchQuery);

              return (
                <div
                  key={themeName}
                  className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs"
                >
                  {/* Theme Header Bar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-100/80 hover:bg-slate-100 transition-colors select-none">
                    <button
                      type="button"
                      onClick={() => toggleTheme(themeName)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    >
                      {isOpened ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      )}
                      <span className="font-bold text-xs text-slate-800 truncate">
                        [{themeName}]
                      </span>
                      <span className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full flex-shrink-0">
                        {tasks.length}
                      </span>
                    </button>

                    {/* Archive theme button */}
                    {themeName !== 'Uncategorized' && (
                      <button
                        type="button"
                        onClick={() => handleArchiveConfirm(themeName)}
                        title={`テーマ「${themeName}」を丸ごとアーカイブ（保管庫）へ送る`}
                        className="ml-2 flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded transition-colors flex-shrink-0 cursor-pointer"
                      >
                        <Archive className="w-3 h-3" />
                        <span className="hidden sm:inline">アーカイブ</span>
                      </button>
                    )}
                  </div>

                  {/* Task List under this Theme */}
                  {isOpened && (
                    <div className="divide-y divide-slate-100 bg-slate-50/40">
                      {tasks.length === 0 ? (
                        <div className="text-[11px] text-slate-400 py-3 px-4 text-center">
                          このテーマの完了タスクはありません
                        </div>
                      ) : (
                        tasks.map((task) => (
                          <div
                            key={task.id}
                            className="p-2.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="line-through text-slate-500 text-xs font-medium">
                                  ・{task.title}
                                </span>
                                {task.dueDate && (
                                  <span className="text-[10px] text-emerald-600 font-mono">
                                    #{task.dueDate}
                                  </span>
                                )}
                                {task.category && task.category !== 'inbox' && (
                                  <span className="text-[10px] text-amber-700 font-mono">
                                    !{task.category}
                                  </span>
                                )}
                              </div>

                              {/* Comments */}
                              {task.comments && task.comments.length > 0 && (
                                <div className="mt-1 space-y-0.5 pl-3 border-l-2 border-slate-200">
                                  {task.comments.map((c, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="text-[11px] text-slate-500 line-through"
                                    >
                                      ↳ {c}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Completed Timestamp */}
                              {task.completedAt && (
                                <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                                  <Calendar className="w-2.5 h-2.5" />
                                  <span>完了: {formatDate(task.completedAt)}</span>
                                </div>
                              )}
                            </div>

                            {/* Restore Button */}
                            <button
                              type="button"
                              onClick={() => onRestoreTask(task.id)}
                              title="未完了タスクに戻す"
                              className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span className="text-[10px] font-bold">復元</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
