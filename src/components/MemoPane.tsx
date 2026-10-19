import React, { useRef, useState } from 'react';
import { PaneType, TaskItem } from '../types/todo';
import { TaskPreview } from './TaskPreview';
import { Edit3, Eye, Info } from 'lucide-react';

interface MemoPaneProps {
  type: PaneType;
  title: string;
  subTitle: string;
  placeholder: string;
  text: string;
  tasks: TaskItem[];
  onChangeText: (newText: string) => void;
  onCommitChange: (paneType: PaneType) => void;
  onDeleteTask: (taskId: string) => void;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}

export const MemoPane: React.FC<MemoPaneProps> = ({
  type,
  title,
  subTitle,
  placeholder,
  text,
  tasks,
  onChangeText,
  onCommitChange,
  onDeleteTask,
  onFocus,
  onBlur,
}) => {
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tab key indent handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (e.shiftKey) {
        // Shift+Tab: Unindent
        // If current line starts with two spaces, remove them
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        if (val.substring(lineStart, lineStart + 2) === '  ') {
          const updated = val.substring(0, lineStart) + val.substring(lineStart + 2);
          onChangeText(updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
          }, 0);
        }
      } else {
        // Tab: Insert 2 spaces
        const updated = val.substring(0, start) + '  ' + val.substring(end);
        onChangeText(updated);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onCommitChange(type);
    }
  };

  // Filter tasks belonging to current pane logic count
  const taskCount = tasks.length;
  const sectionCount = new Set(
    tasks.map((t) => (type === 'category' ? t.category || 'inbox' : t.theme || 'Uncategorized'))
  ).size;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Pane Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/90 border-b border-slate-200 backdrop-blur-sm select-none">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                type === 'category' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h2>
            <span className="text-xs bg-slate-200 text-slate-700 font-mono font-medium px-2 py-0.5 rounded-full">
              {taskCount} 件 / {sectionCount} セクション
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subTitle}</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setViewMode('editor')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              viewMode === 'editor'
                ? 'bg-white text-slate-800 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>メモ帳</span>
          </button>
          <button
            onClick={() => {
              onCommitChange(type);
              setViewMode('preview');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              viewMode === 'preview'
                ? 'bg-white text-slate-800 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>装飾ビュー</span>
          </button>
        </div>
      </div>

      {/* Pane Body */}
      <div className="flex-1 relative overflow-hidden bg-slate-50/30">
        {viewMode === 'editor' ? (
          <div className="h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              onFocus={onFocus}
              onBlur={() => {
                onBlur();
                onCommitChange(type);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              spellCheck={false}
              className="notepad-editor flex-1 w-full p-4 font-mono text-sm leading-relaxed text-slate-800 bg-transparent resize-none border-none outline-none focus:ring-0 placeholder:text-slate-400 select-text"
              style={{
                fontFeatureSettings: '"tnum"',
              }}
            />

            {/* Quick Helper Footer */}
            <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 select-none">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {type === 'category'
                    ? '見出し: !分類 / テーマ指定: [テーマ] / 期日: #MM/DD / 字下げ: スペース2つ'
                    : '見出し: [テーマ] / 分類指定: !分類 / 期日: #MM/DD / 字下げ: スペース2つ'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 font-mono">
                <span>Tab: 字下げ</span>
                <span>•</span>
                <span>Ctrl+S: 即時同期</span>
              </div>
            </div>
          </div>
        ) : (
          <TaskPreview
            tasks={tasks}
            paneType={type}
            onDeleteTask={onDeleteTask}
            onEditRequest={() => setViewMode('editor')}
          />
        )}
      </div>
    </div>
  );
};
