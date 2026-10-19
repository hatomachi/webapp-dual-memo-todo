import React, { useRef, useEffect } from 'react';
import { PaneType } from '../types/todo';
import { isCategoryHeader, isThemeHeader, isCommentLine } from '../utils/parser';

interface MemoPaneProps {
  type: PaneType;
  title: string;
  subTitle: string;
  placeholder: string;
  text: string;
  isDirty: boolean;
  onChangeText: (newText: string) => void;
  onCommitChange: (paneType: PaneType) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export const MemoPane: React.FC<MemoPaneProps> = ({
  type,
  title,
  subTitle,
  placeholder,
  text,
  isDirty,
  onChangeText,
  onCommitChange,
  onFocus,
  onBlur,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync scroll position between textarea and highlight backdrop
  const syncScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    syncScroll();
  }, [text]);

  // Handle Tab indentation and Ctrl+S / Cmd+S sync
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      onCommitChange(type);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (e.shiftKey) {
        // Shift+Tab: remove leading spaces or full-width space on current line
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        if (val.substring(lineStart, lineStart + 2) === '  ') {
          const updated = val.substring(0, lineStart) + val.substring(lineStart + 2);
          onChangeText(updated);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
          });
        } else if (val.substring(lineStart, lineStart + 1) === '　' || val.substring(lineStart, lineStart + 1) === ' ') {
          const updated = val.substring(0, lineStart) + val.substring(lineStart + 1);
          onChangeText(updated);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 1);
          });
        }
      } else {
        // Tab: insert 2 half-width spaces
        const updated = val.substring(0, start) + '  ' + val.substring(end);
        onChangeText(updated);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    }
  };

  const lines = text.split('\n');

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden">
      {/* Simple Notepad Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-100 border-b border-slate-200 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              type === 'category' ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
          />
          <h2 className="text-xs font-bold text-slate-700 truncate">{title}</h2>
          <span className="text-[11px] text-slate-400 hidden md:inline truncate">
            — {subTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isDirty ? (
            <button
              onClick={() => onCommitChange(type)}
              className="text-[11px] font-mono bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 px-2 py-0.5 rounded transition-colors"
              title="クリックまたは Ctrl+S で反対側へ反映"
            >
              未反映 (Ctrl+Sで反映)
            </button>
          ) : (
            <span className="text-[11px] font-mono text-slate-400">
              Ctrl+S で反映
            </span>
          )}
        </div>
      </div>

      {/* Notepad Editor Container with Backdrop Highlight */}
      <div className="relative flex-1 overflow-hidden bg-white">
        {/* Backdrop Layer: renders only light marker backgrounds & comment ↳ symbol */}
        <div
          ref={backdropRef}
          aria-hidden="true"
          className="notepad-layer absolute inset-0 overflow-y-auto overflow-x-hidden pointer-events-none select-none font-mono text-sm leading-7 py-3 pl-6 pr-4 whitespace-pre-wrap break-words text-transparent"
        >
          {lines.map((line, idx) => {
            const isHeader =
              type === 'category'
                ? isCategoryHeader(line)
                : isThemeHeader(line);

            if (isHeader) {
              return (
                <div
                  key={idx}
                  className="bg-yellow-100/90 -mx-2 px-2 rounded-sm min-h-[1.75rem]"
                >
                  {line || '\u200B'}
                </div>
              );
            }

            if (isCommentLine(line)) {
              const indentMatch = line.match(/^[ \t\u3000]+/);
              const indentStr = indentMatch ? indentMatch[0] : '';
              const bodyStr = line.slice(indentStr.length);
              const isNarrowIndent = indentStr === ' ';

              return (
                <div
                  key={idx}
                  className="bg-slate-100/90 -mx-1 px-1 rounded-sm min-h-[1.75rem]"
                >
                  <span className="relative">
                    {indentStr}
                    <span
                      className={`absolute top-0 text-slate-400 font-normal select-none ${
                        isNarrowIndent ? '-left-3.5' : 'left-0'
                      }`}
                    >
                      ↳
                    </span>
                  </span>
                  {bodyStr || '\u200B'}
                </div>
              );
            }

            return (
              <div key={idx} className="min-h-[1.75rem]">
                {line || '\u200B'}
              </div>
            );
          })}
        </div>

        {/* Foreground Native Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          onScroll={syncScroll}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="notepad-layer relative z-10 w-full h-full overflow-y-auto overflow-x-hidden font-mono text-sm leading-7 py-3 pl-6 pr-4 whitespace-pre-wrap break-words text-slate-800 bg-transparent resize-none border-none outline-none focus:ring-0 placeholder:text-slate-300"
        />
      </div>
    </div>
  );
};
