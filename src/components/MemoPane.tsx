import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useCallback,
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
  isKeyboardOpen?: boolean;
  onChangeText: (newText: string) => void;
  onCommitChange: (paneType: PaneType) => void;
  onFocus: () => void;
  onBlur: () => void;
}

const NAVIGATION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Enter',
  'Backspace',
  'Delete',
]);

export const MemoPane = forwardRef<MemoPaneHandle, MemoPaneProps>(
  (
    {
      type,
      title,
      subTitle,
      placeholder,
      text,
      isDirty,
      isKeyboardOpen = false,
      onChangeText,
      onCommitChange,
      onFocus,
      onBlur,
    },
    ref
  ) => {
    const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const pointerDownScrollTopRef = useRef<number | null>(null);

    const sections = useMemo(() => {
      return extractSectionsFromText(text, type);
    }, [text, type]);

    // Ensure the active caret line is visible within the single scroll container
    const ensureCaretVisible = useCallback(() => {
      const textarea = textareaRef.current;
      const container = scrollContainerRef.current;
      const backdrop = backdropRef.current;
      if (!textarea || !container || !backdrop) return;
      if (document.activeElement !== textarea) return;

      const caretPos = textarea.selectionEnd ?? 0;
      const textBefore = textarea.value.substring(0, caretPos);
      const lineIdx = textBefore.split('\n').length - 1;
      const lineEl = backdrop.children[lineIdx] as HTMLElement | undefined;
      if (!lineEl) return;

      const lineTop = lineEl.offsetTop;
      const lineBottom = lineTop + lineEl.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      const padding = 36; // 1+ line of breathing room above bottom toolbar

      if (lineTop < viewTop + 12) {
        container.scrollTop = Math.max(0, lineTop - 12);
      } else if (lineBottom + padding > viewBottom) {
        container.scrollTop = Math.max(0, lineBottom + padding - container.clientHeight);
      }
    }, []);

    // Prevent any internal textarea scroll offset; forward it to the parent scroll container
    const normalizeTextareaInternalScroll = useCallback(() => {
      const textarea = textareaRef.current;
      const container = scrollContainerRef.current;
      if (!textarea) return;

      if (textarea.scrollTop !== 0) {
        if (container) {
          container.scrollTop += textarea.scrollTop;
        }
        textarea.scrollTop = 0;
      }
      if (textarea.scrollLeft !== 0) {
        textarea.scrollLeft = 0;
      }
    }, []);

    useLayoutEffect(() => {
      normalizeTextareaInternalScroll();
    }, [text, normalizeTextareaInternalScroll]);

    // Keep active caret visible after layout settles when virtual keyboard opens or resizes
    useEffect(() => {
      const vv = window.visualViewport;
      if (!vv) return;

      let raf1 = 0;
      let raf2 = 0;

      const handleViewportChange = () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        raf1 = requestAnimationFrame(() => {
          normalizeTextareaInternalScroll();
          ensureCaretVisible();
          raf2 = requestAnimationFrame(() => {
            ensureCaretVisible();
          });
        });
      };

      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      };
    }, [ensureCaretVisible, normalizeTextareaInternalScroll]);

    // Re-check caret visibility when header collapses/expands on keyboard state change
    useEffect(() => {
      const raf = requestAnimationFrame(() => {
        ensureCaretVisible();
      });
      return () => cancelAnimationFrame(raf);
    }, [isKeyboardOpen, ensureCaretVisible]);

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
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(targetCursor, targetCursor);
          ensureCaretVisible();
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
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          ensureCaretVisible();
        });
      },

      toggleNav: () => {
        setIsNavOpen((prev) => !prev);
      },

      focus: () => {
        textareaRef.current?.focus({ preventScroll: true });
      },
    }));

    // Jump to section line and scroll smoothly using exact DOM line offset
    const handleSelectSection = (charIndex: number, lineIndex: number) => {
      const textarea = textareaRef.current;
      const container = scrollContainerRef.current;
      const backdrop = backdropRef.current;
      if (!textarea || !container) return;

      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(charIndex, charIndex);

      const lineEl = backdrop?.children[lineIndex] as HTMLElement | undefined;
      const targetScrollTop = lineEl
        ? Math.max(0, lineEl.offsetTop - 12)
        : Math.max(0, (lineIndex - 1) * 28);

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });

      // Close mobile drawer on selection
      if (window.innerWidth < 640) {
        setIsNavOpen(false);
      }
    };

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

    const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (NAVIGATION_KEYS.has(e.key)) {
        ensureCaretVisible();
      }
    };

    const handlePointerDown = () => {
      if (
        document.activeElement !== textareaRef.current &&
        scrollContainerRef.current
      ) {
        pointerDownScrollTopRef.current = scrollContainerRef.current.scrollTop;
      } else {
        pointerDownScrollTopRef.current = null;
      }
    };

    const handleFocus = () => {
      if (
        pointerDownScrollTopRef.current !== null &&
        scrollContainerRef.current
      ) {
        const savedTop = pointerDownScrollTopRef.current;
        scrollContainerRef.current.scrollTop = savedTop;
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedTop;
          }
          pointerDownScrollTopRef.current = null;
          ensureCaretVisible();
        });
      } else {
        requestAnimationFrame(() => {
          ensureCaretVisible();
        });
      }
      onFocus();
    };

    const lines = text.split('\n');

    return (
      <div
        className={`flex flex-col h-full bg-white shadow-sm overflow-hidden relative ${
          isKeyboardOpen
            ? 'rounded-none border-0 sm:rounded-lg sm:border sm:border-slate-300'
            : 'rounded-lg border border-slate-300'
        }`}
      >
        {/* Simple Notepad Header Bar (auto-collapsed on mobile when keyboard is open) */}
        <div
          className={`${
            isKeyboardOpen ? 'hidden sm:flex' : 'flex'
          } items-center justify-between px-3 py-1.5 sm:py-2 bg-slate-100 border-b border-slate-200 select-none`}
        >
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

          {/* Single Scroll Container holding both Backdrop and Textarea in lockstep */}
          <div
            ref={scrollContainerRef}
            className="notepad-scroll-container relative flex-1 h-full overflow-y-auto overflow-x-hidden bg-white"
          >
            <div className="notepad-grid">
              {/* Backdrop Layer (in-flow inside grid cell 1/1, stretches container height) */}
              <div
                ref={backdropRef}
                aria-hidden="true"
                className="notepad-layer overflow-hidden pointer-events-none select-none pt-3 pb-16 pl-4 sm:pl-6 pr-3 sm:pr-4 text-transparent"
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
                        className="notepad-line bg-yellow-100/90 -mx-2 px-2 rounded-sm"
                      >
                        {line || '\u200B'}
                      </div>
                    );
                  }

                  if (isCommentLine(line)) {
                    const indentMatch = line.match(/^[ \t\u3000]+/);
                    const indentStr = indentMatch ? indentMatch[0] : '';
                    const isNarrowIndent = indentStr === ' ';

                    return (
                      <div
                        key={idx}
                        className="notepad-line relative bg-slate-100/90 -mx-1 px-1 rounded-sm"
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute top-0 text-slate-400 font-normal select-none pointer-events-none ${
                            isNarrowIndent ? '-left-2' : 'left-1'
                          }`}
                        >
                          ↳
                        </span>
                        {line || '\u200B'}
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="notepad-line">
                      {line || '\u200B'}
                    </div>
                  );
                })}
              </div>

              {/* Foreground Native Textarea (shares grid cell 1/1, never scrolls independently) */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  onChangeText(e.target.value);
                  requestAnimationFrame(() => {
                    normalizeTextareaInternalScroll();
                    ensureCaretVisible();
                  });
                }}
                onScroll={normalizeTextareaInternalScroll}
                onPointerDown={handlePointerDown}
                onClick={() => requestAnimationFrame(() => ensureCaretVisible())}
                onFocus={handleFocus}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                placeholder={placeholder}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="notepad-layer relative z-10 w-full h-full overflow-hidden pt-3 pb-16 pl-4 sm:pl-6 pr-3 sm:pr-4 text-slate-800 bg-transparent resize-none border-none outline-none focus:ring-0 placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MemoPane.displayName = 'MemoPane';

