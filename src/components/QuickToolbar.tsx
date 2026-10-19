import React, { useRef } from 'react';
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
  onTogglePane?: () => void;
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
  isKeyboardOpen?: boolean;
}

interface ToolbarButtonProps {
  onTrigger: () => void;
  className?: string;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * Mobile-safe button that prevents textarea from losing focus (blur),
 * keeping the iOS / Android virtual keyboard wide open while tapping shortcuts.
 */
const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onTrigger,
  className = '',
  title,
  disabled = false,
  children,
}) => {
  const isPointerDownRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    // Crucial: Prevent browser from shifting focus away from textarea,
    // which would cause iOS Safari to dismiss the virtual keyboard.
    e.preventDefault();
    isPointerDownRef.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      e.preventDefault();
      onTrigger();
    }
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current = false;
  };

  const handlePointerLeave = () => {
    isPointerDownRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTrigger();
    }
  };

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </button>
  );
};

export const QuickToolbar: React.FC<QuickToolbarProps> = ({
  activePane,
  onTogglePane,
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
  isKeyboardOpen = false,
}) => {
  return (
    <div
      className="bg-slate-800 text-slate-200 border-t border-slate-700 px-2 pt-1.5 flex items-center justify-between gap-1 select-none shadow-lg z-20 flex-shrink-0"
      style={{
        paddingBottom: isKeyboardOpen
          ? '0.375rem'
          : 'max(0.375rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Quick Insert Symbols & Active Pane Pill */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <ToolbarButton
          onTrigger={() => onTogglePane?.()}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight flex-shrink-0 cursor-pointer ${
            activePane === 'category'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-blue-950 text-blue-400 border border-blue-800'
          }`}
          title="現在操作中のペイン（タップで切替）"
        >
          {activePane === 'category' ? '!分類' : '[テーマ]'}
        </ToolbarButton>

        {/* Indent comment button */}
        <ToolbarButton
          onTrigger={onInsertIndentComment}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-medium text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
          title="次の行に字下げコメントを挿入"
        >
          <CornerDownRight className="w-3.5 h-3.5 text-amber-400" />
          <span>↳字下げ</span>
        </ToolbarButton>

        {/* Bullet item button */}
        <ToolbarButton
          onTrigger={() => onInsertText('・')}
          className="flex items-center justify-center px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-bold text-amber-300 hover:text-white transition-colors min-w-[30px] cursor-pointer"
          title="TODO行頭 (・)"
        >
          <span>・</span>
        </ToolbarButton>

        {/* Date hashtag */}
        <ToolbarButton
          onTrigger={() => onInsertText('#')}
          className="flex items-center justify-center px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-mono font-bold text-emerald-400 transition-colors min-w-[32px] cursor-pointer"
          title="期日タグ (#MM/DD)"
        >
          <Hash className="w-3.5 h-3.5" />
        </ToolbarButton>

        {/* Theme brackets */}
        <ToolbarButton
          onTrigger={() => onInsertText('[', ']')}
          className="flex items-center justify-center px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-mono font-bold text-blue-400 transition-colors min-w-[32px] cursor-pointer"
          title="テーマタグ ([テーマ名])"
        >
          <Brackets className="w-3.5 h-3.5" />
        </ToolbarButton>

        {/* Category exclamation */}
        <ToolbarButton
          onTrigger={() => onInsertText('!')}
          className="flex items-center justify-center px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs font-mono font-bold text-amber-400 transition-colors min-w-[32px] cursor-pointer"
          title="分類ヘッダー (!分類名)"
        >
          <AlertCircle className="w-3.5 h-3.5" />
        </ToolbarButton>

        {/* Section Table of Contents drawer toggle */}
        <ToolbarButton
          onTrigger={onToggleSectionNav}
          className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          title="区切り目次を開閉"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px]">目次</span>
        </ToolbarButton>

        {/* Due date sort button */}
        <ToolbarButton
          onTrigger={onSortDueDates}
          className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded text-xs text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          title="期日昇順で並び替え"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px]">ソート</span>
        </ToolbarButton>
      </div>

      {/* Undo / Redo & Save commit */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <ToolbarButton
          onTrigger={onUndo}
          disabled={!canUndo}
          className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-700 rounded text-slate-200 transition-colors cursor-pointer"
          title="元に戻す (Undo)"
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onTrigger={onRedo}
          disabled={!canRedo}
          className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-700 rounded text-slate-200 transition-colors cursor-pointer"
          title="やり直す (Redo)"
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>

        {/* Commit/Save button */}
        <ToolbarButton
          onTrigger={onCommit}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm cursor-pointer ${
            isDirty
              ? 'bg-blue-600 hover:bg-blue-500 text-white animate-pulse'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="左右反映 & 保存"
        >
          <Save className="w-3.5 h-3.5" />
          <span>反映</span>
        </ToolbarButton>
      </div>
    </div>
  );
};
