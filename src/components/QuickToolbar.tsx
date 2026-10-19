import React from 'react';
import {
  CornerDownRight,
  Hash,
  Brackets,
  AlertCircle,
  Undo2,
  Redo2,
  Save,
  ArrowUpDown,
  BookOpen,
} from 'lucide-react';
import { PaneType } from '../types/todo';

interface QuickToolbarProps {
  activePane: PaneType;
  onInsertText: (before: string, after?: string) => void;
  onInsertIndentComment: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCommit: () => void;
  onSortDueDates: () => void;
  onToggleSectionNav: () => void;
  isDirty: boolean;
}

export const QuickToolbar: React.FC<QuickToolbarProps> = ({
  activePane,
  onInsertText,
  onInsertIndentComment,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCommit,
  onSortDueDates,
  onToggleSectionNav,
  isDirty,
}) => {
  return (
    <div className="bg-slate-800 text-slate-200 border-t border-slate-700 px-2 py-1.5 flex items-center justify-between gap-1 select-none shadow-lg z-20">
      {/* Quick Insert Symbols & Active Pane Pill */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight flex-shrink-0 ${
            activePane === 'category'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-blue-950 text-blue-400 border border-blue-800'
          }`}
          title="現在操作中のペイン"
        >
          {activePane === 'category' ? '!分類' : '[テーマ]'}
        </span>

        {/* Indent comment button */}
        <button
          type="button"
          onClick={onInsertIndentComment}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-medium text-slate-100 transition-colors whitespace-nowrap"
          title="次の行に字下げコメントを挿入"
        >
          <CornerDownRight className="w-3.5 h-3.5 text-amber-400" />
          <span>↳字下げ</span>
        </button>

        {/* Date hashtag */}
        <button
          type="button"
          onClick={() => onInsertText('#')}
          className="flex items-center justify-center px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-mono font-bold text-emerald-400 transition-colors min-w-[32px]"
          title="期日タグ (#MM/DD)"
        >
          <Hash className="w-3.5 h-3.5" />
        </button>

        {/* Theme brackets */}
        <button
          type="button"
          onClick={() => onInsertText('[', ']')}
          className="flex items-center justify-center px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-mono font-bold text-blue-400 transition-colors min-w-[32px]"
          title="テーマタグ ([テーマ名])"
        >
          <Brackets className="w-3.5 h-3.5" />
        </button>

        {/* Category exclamation */}
        <button
          type="button"
          onClick={() => onInsertText('!')}
          className="flex items-center justify-center px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-mono font-bold text-amber-400 transition-colors min-w-[32px]"
          title="分類ヘッダー (!分類名)"
        >
          <AlertCircle className="w-3.5 h-3.5" />
        </button>

        {/* Section Table of Contents drawer toggle */}
        <button
          type="button"
          onClick={onToggleSectionNav}
          className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs text-slate-200 transition-colors whitespace-nowrap"
          title="区切り目次を開閉"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px]">目次</span>
        </button>

        {/* Due date sort button */}
        <button
          type="button"
          onClick={onSortDueDates}
          className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs text-slate-200 transition-colors whitespace-nowrap"
          title="期日昇順で並び替え"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px]">ソート</span>
        </button>
      </div>

      {/* Undo / Redo & Save commit */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-700 rounded text-slate-200 transition-colors"
          title="元に戻す (Undo)"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-700 rounded text-slate-200 transition-colors"
          title="やり直す (Redo)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Commit/Save button */}
        <button
          type="button"
          onClick={onCommit}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm ${
            isDirty
              ? 'bg-blue-600 hover:bg-blue-500 text-white animate-pulse'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="左右反映 & 保存"
        >
          <Save className="w-3.5 h-3.5" />
          <span>反映</span>
        </button>
      </div>
    </div>
  );
};
