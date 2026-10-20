import React, { useState } from 'react';
import {
  X,
  Archive,
  RotateCcw,
  Search,
} from 'lucide-react';
import { ArchiveData } from '../types/todo';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  archiveData: ArchiveData;
  onRestoreTheme: (themeName: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  archiveData,
  onRestoreTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number>(0);

  if (!isOpen) return null;

  const themes = archiveData.archivedThemes || [];
  const query = searchQuery.trim().toLowerCase();

  const filteredThemes = themes.filter((at) => {
    if (!query) return true;
    const matchName = at.theme.toLowerCase().includes(query);
    const matchTask = at.tasks.some(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.comments.some((c) => c.toLowerCase().includes(query))
    );
    return matchName || matchTask;
  });

  const activeTheme = filteredThemes[selectedThemeIndex] || filteredThemes[0];

  const handleRestore = (themeName: string) => {
    const ok = window.confirm(
      `テーマ「${themeName}」を現役の右ペインへ復元しますか？\n配下のタスク（${activeTheme?.tasks?.length || 0}件）も未完了タスクとして復元されます。`
    );
    if (ok) {
      onRestoreTheme(themeName);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span>プロジェクト保管庫（todo-archive.json）</span>
                <span className="text-[11px] font-mono font-normal bg-amber-950 text-amber-300 border border-amber-700/50 px-1.5 py-0.2 rounded-full">
                  {themes.length}テーマ
                </span>
              </h2>
              <p className="text-[10px] text-slate-300">
                完了したイベントやプロジェクトの知見・メモを冷凍保存
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="アーカイブ内のテーマ・タスク・メモを検索..."
              className="w-full pl-8 pr-4 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 2-Column Body: Themes list on left, Task details on right */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
          {/* Left: Themes list */}
          <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r border-slate-200 overflow-y-auto bg-slate-50/50 p-2 space-y-1">
            {filteredThemes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                アーカイブされたテーマはありません
              </div>
            ) : (
              filteredThemes.map((at, idx) => {
                const isSelected = activeTheme && activeTheme.theme === at.theme;
                return (
                  <button
                    key={at.theme}
                    type="button"
                    onClick={() => setSelectedThemeIndex(idx)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100/80 border border-amber-300 text-amber-950 font-bold'
                        : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate flex-1">[{at.theme}]</span>
                      <span className="text-[10px] font-mono bg-white/80 border border-slate-200 text-slate-500 px-1 rounded flex-shrink-0">
                        {at.tasks.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDate(at.archivedAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Active Theme Details */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
            {activeTheme ? (
              <>
                {/* Theme Title bar */}
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">
                      [{activeTheme.theme}]
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono">
                      アーカイブ日時: {formatDate(activeTheme.archivedAt)} (タスク {activeTheme.tasks.length}件)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(activeTheme.theme)}
                    className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>現役に復元</span>
                  </button>
                </div>

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {activeTheme.tasks.map((task, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-2 border border-slate-100 rounded-md bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-700 font-medium">
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
                            <div key={cIdx} className="text-[11px] text-slate-500">
                              ↳ {c}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                テーマを選択してください
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
          <span>💾 保存先: hatomachi/dual-memo-data / todo-archive.json</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs transition-colors cursor-pointer font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
