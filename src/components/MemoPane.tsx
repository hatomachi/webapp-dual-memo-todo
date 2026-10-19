import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { PaneType } from '../types/todo';
import {
  isCategoryHeader,
  isThemeHeader,
  isCommentLine,
  extractSectionsFromText,
} from '../utils/parser';
import { SectionNav } from './SectionNav';

export interface MemoPaneHandle {
  insertText: (before: string, after?: string) => void;
  insertIndentComment: () => void;
  toggleNav: () => void;
  focus: () => void;
}

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

export const MemoPane = forwardRef<MemoPaneHandle, MemoPaneProps>(
  (
    {
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
    },
    ref
  ) => {
    const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    const sections = useMemo(() => {
      return extractSectionsFromText(text, type);
    }, [text, type]);

    // Expose manipulation methods to parent (for QuickToolbar)
    useImperativeHandle(ref, () => ({
      insertText: (before: string, after = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? text.length;
        const end = textarea.selectionEnd ?? text.length;
        const selected = text.substring(start, end);

        const newText =
          text.substring(0, start) + before + selected + after + text.substring(end);
        onChangeText(newText);

        const targetCursor = start + before.length + selected.length;
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(targetCursor, targetCursor);
        });
      },

      insertIndentComment: () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? text.length;
        const val = text;

        // Find the end of the current line
        const lineEnd = val.indexOf('\n', start);
        const insertPos = lineEnd === -1 ? val.length : lineEnd;

        // Insert newline and 2 half-width spaces for indent comment
        const prefix = val.substring(0, insertPos);
        const suffix = val.substring(insertPos);
        const newText = `${prefix}\n  ${suffix}`;
        onChangeText(newText);

        const newCursorPos = insertPos + 3; // \n + 2 spaces
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
      },

      toggleNav: () => {
        setIsNavOpen((prev) => !prev);
      },

      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    // Jump to section line and scroll smoothly
    const handleSelectSection = (charIndex: number, lineIndex: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(charIndex, charIndex);

      // Line height is leading-7 (28px = 1.75rem)
      const lineHeight = 28;
      const targetScrollTop = Math.max(0, (lineIndex - 1) * lineHeight);

      textarea.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });

      if (backdropRef.current) {
        backdropRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      }

      // Close mobile drawer on selection
      if (window.innerWidth < 640) {
        setIsNavOpen(false);
      }
    };

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
          // Shift+Tab: remove leading spaces on current line
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          if (val.substring(lineStart, lineStart + 2) === '  ') {
            const updated = val.substring(0, lineStart) + val.substring(lineStart + 2);
            onChangeText(updated);
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = Math.max(
                lineStart,
                start - 2
              );
            });
          } else if (
            val.substring(lineStart, lineStart + 1) === '　' ||
            val.substring(lineStart, lineStart + 1) === ' '
          ) {
            const updated = val.substring(0, lineStart) + val.substring(lineStart + 1);
            onChangeText(updated);
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = Math.max(
                lineStart,
                start - 1
              );
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
      <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden relative">
        {/* Simple Notepad Header Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 sm:py-2 bg-slate-100 border-b border-slate-200 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                type === 'category' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
            <h2 className="text-xs font-bold text-slate-700 truncate">{title}</h2>
            <span className="text-[11px] text-slate-400 hidden lg:inline truncate">
              — {subTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Table of contents toggle button (visible on mobile too) */}
            <button
              type="button"
              onClick={() => setIsNavOpen(!isNavOpen)}
              className="text-[11px] flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
              title="区切り目次"
            >
              <span>📑 目次</span>
              <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1 rounded">
                {sections.length}
              </span>
            </button>

            {isDirty ? (
              <button
                type="button"
                onClick={() => onCommitChange(type)}
                className="text-[11px] font-mono bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 px-2 py-0.5 rounded transition-colors"
                title="クリックまたは Ctrl+S で反対側へ反映"
              >
                未反映
              </button>
            ) : (
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                反映済
              </span>
            )}
          </div>
        </div>

        {/* Main Body: SectionNav & Notepad Editor */}
        <div className="relative flex-1 flex overflow-hidden bg-white">
          {/* Section Navigation: Desktop = side column, Mobile = slide-over drawer */}
          {/* Mobile backdrop */}
          {isNavOpen && (
            <div
              onClick={() => setIsNavOpen(false)}
              className="sm:hidden absolute inset-0 bg-slate-900/30 z-20 backdrop-blur-[1px]"
            />
          )}

          {/* SectionNav container */}
          <div
            className={`
              absolute sm:relative top-0 bottom-0 left-0 z-30 sm:z-0
              ${isNavOpen ? 'block' : 'hidden sm:block'}
              h-full transition-all duration-200 shadow-lg sm:shadow-none
            `}
          >
            <SectionNav
              sections={sections}
              paneType={type}
              isOpen={isNavOpen}
              onToggleOpen={() => setIsNavOpen(!isNavOpen)}
              onSelectSection={handleSelectSection}
            />
          </div>

          {/* Notepad Editor Container with Backdrop Highlight */}
          <div className="relative flex-1 h-full overflow-hidden bg-white">
            {/* Backdrop Layer */}
            <div
              ref={backdropRef}
              aria-hidden="true"
              className="notepad-layer absolute inset-0 overflow-y-auto overflow-x-hidden pointer-events-none select-none font-mono text-base sm:text-sm leading-7 py-3 pl-4 sm:pl-6 pr-3 sm:pr-4 whitespace-pre-wrap break-words text-transparent"
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
                            isNarrowIndent ? '-left-3' : 'left-0'
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
              className="notepad-layer relative z-10 w-full h-full overflow-y-auto overflow-x-hidden font-mono text-base sm:text-sm leading-7 py-3 pl-4 sm:pl-6 pr-3 sm:pr-4 whitespace-pre-wrap break-words text-slate-800 bg-transparent resize-none border-none outline-none focus:ring-0 placeholder:text-slate-300"
            />
          </div>
        </div>
      </div>
    );
  }
);

MemoPane.displayName = 'MemoPane';
