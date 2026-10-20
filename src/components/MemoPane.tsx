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
  getLineDueDateStatus,
  DUE_DATE_REGEX,
} from '../utils/parser';
import {
  InlineTagInfo,
  SuggestionTrigger,
  HierarchicalOption,
  UnifiedSuggestItem,
  getUnifiedSuggestItems,
  parseLineInlineTags,
  splitLineIntoTokens,
  removeTagFromLine,
  replaceTagInLine,
  detectSuggestionTrigger,
} from '../utils/tagHelper';
import { getCaretCoordinates } from '../utils/caretCoordinates';
import { SectionNav } from './SectionNav';
import { InlineSuggestPopover } from './InlineSuggestPopover';

export interface MemoPaneHandle {
  insertText: (before: string, after?: string) => void;
  insertIndentComment: () => void;
  insertDueDate: (dateStr: string) => void;
  getCurrentLineDueDate: () => string | null;
  toggleNav: () => void;
  focus: () => void;
  getCursorLineAndCol: () => { lineIdx: number; col: number } | null;
  restoreCursorLineAndCol: (lineIdx: number, col: number) => void;
  removeTagFromCurrentLine: (tag: InlineTagInfo) => void;
  replaceTagInCurrentLine: (tag: InlineTagInfo, newRawTag: string) => void;
  applySuggestionAtCursor: (suggestedValue: string, trigger: SuggestionTrigger) => void;
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
  onActiveLineTagsChange?: (tags: InlineTagInfo[]) => void;
  onSuggestionTrigger?: (trigger: SuggestionTrigger | null) => void;
  suggestionTrigger?: SuggestionTrigger | null;
  categoryOptions?: HierarchicalOption[];
  themeOptions?: HierarchicalOption[];
  onOpenCalendar?: () => void;
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
      onActiveLineTagsChange,
      onSuggestionTrigger,
      suggestionTrigger = null,
      categoryOptions = [],
      themeOptions = [],
      onOpenCalendar,
    },
    ref
  ) => {
    const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
    const [scrollbarWidth, setScrollbarWidth] = useState<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const notepadContainerRef = useRef<HTMLDivElement>(null);

    // Caret coordinates for inline floating suggest popover
    const [caretCoords, setCaretCoords] = useState<{ top: number; left: number; height: number }>({
      top: 10,
      left: 16,
      height: 20,
    });
    const [suggestIndex, setSuggestIndex] = useState<number>(0);

    // Desktop mode detection
    const isDesktop =
      !isKeyboardOpen && typeof window !== 'undefined' && window.innerWidth >= 640;

    const sections = useMemo(() => {
      return extractSectionsFromText(text, type);
    }, [text, type]);

    // Update caret coordinates relative to visible notepad area
    const updateCaretCoordinates = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const pos = textarea.selectionStart ?? 0;
      const coords = getCaretCoordinates(textarea, pos);
      setCaretCoords({
        top: coords.top - textarea.scrollTop,
        left: coords.left - textarea.scrollLeft,
        height: coords.height,
      });
    }, []);

    // Keep backdrop scroll in exact 1:1 sync with native textarea scroll
    // Also mirrors any rubber-band stretch via translateY so decorations never detach
    const syncBackdropScroll = useCallback(() => {
      const textarea = textareaRef.current;
      const backdrop = backdropRef.current;
      if (!textarea || !backdrop) return;

      const st = textarea.scrollTop;
      const maxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);

      if (st < 0) {
        // Top rubber-band bounce
        backdrop.scrollTop = 0;
        backdrop.style.transform = `translateY(${-st}px)`;
      } else if (st > maxScroll) {
        // Bottom rubber-band bounce
        backdrop.scrollTop = maxScroll;
        backdrop.style.transform = `translateY(${-(st - maxScroll)}px)`;
      } else {
        // Normal in-bounds scroll
        backdrop.scrollTop = st;
        if (backdrop.style.transform) {
          backdrop.style.transform = '';
        }
      }
      backdrop.scrollLeft = textarea.scrollLeft;
      updateCaretCoordinates();
    }, [updateCaretCoordinates]);

    // Prevent rubber-banding / bounce at scroll boundaries (both wheel and touch)
    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      let touchStartY = 0;

      const handleWheel = (e: WheelEvent) => {
        const scrollTop = textarea.scrollTop;
        const maxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);

        // At top and scrolling up
        if (scrollTop <= 0 && e.deltaY < 0) {
          if (e.cancelable) e.preventDefault();
        }
        // At bottom and scrolling down
        else if (scrollTop >= maxScroll - 0.5 && e.deltaY > 0) {
          if (e.cancelable) e.preventDefault();
        }
      };

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          touchStartY = e.touches[0].clientY;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - touchStartY;
        const scrollTop = textarea.scrollTop;
        const maxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);

        // At top and pulling down
        if (scrollTop <= 0 && deltaY > 0) {
          if (e.cancelable) e.preventDefault();
        }
        // At bottom and pulling up
        else if (scrollTop >= maxScroll - 0.5 && deltaY < 0) {
          if (e.cancelable) e.preventDefault();
        }
      };

      textarea.addEventListener('wheel', handleWheel, { passive: false });
      textarea.addEventListener('touchstart', handleTouchStart, { passive: true });
      textarea.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        textarea.removeEventListener('wheel', handleWheel);
        textarea.removeEventListener('touchstart', handleTouchStart);
        textarea.removeEventListener('touchmove', handleTouchMove);
      };
    }, []);

    // Track textarea clientWidth vs offsetWidth to eliminate word-wrap drift on non-overlay scrollbars
    useLayoutEffect(() => {
      const updateScrollbar = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const diff = textarea.offsetWidth - textarea.clientWidth;
        setScrollbarWidth(Math.max(0, diff));
        syncBackdropScroll();
      };

      updateScrollbar();
      window.addEventListener('resize', updateScrollbar);
      return () => window.removeEventListener('resize', updateScrollbar);
    }, [text, syncBackdropScroll]);

    // Ensure the active caret line is visible within textarea
    const ensureCaretVisible = useCallback(() => {
      const textarea = textareaRef.current;
      const backdrop = backdropRef.current;
      if (!textarea || !backdrop) return;
      if (document.activeElement !== textarea) return;

      const caretPos = textarea.selectionEnd ?? 0;
      const textBefore = textarea.value.substring(0, caretPos);
      const lineIdx = textBefore.split('\n').length - 1;
      const lineEl = backdrop.children[lineIdx] as HTMLElement | undefined;
      if (!lineEl) return;

      const lineTop = lineEl.offsetTop;
      const lineBottom = lineTop + lineEl.offsetHeight;
      const viewTop = textarea.scrollTop;
      const viewBottom = viewTop + textarea.clientHeight;
      const padding = 26; // 1+ line of breathing room above bottom toolbar

      if (lineTop < viewTop + 8) {
        textarea.scrollTop = Math.max(0, lineTop - 8);
      } else if (lineBottom + padding > viewBottom) {
        textarea.scrollTop = Math.max(0, lineBottom + padding - textarea.clientHeight);
      }
      syncBackdropScroll();
    }, [syncBackdropScroll]);

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
          syncBackdropScroll();
          ensureCaretVisible();
          raf2 = requestAnimationFrame(() => {
            syncBackdropScroll();
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
    }, [ensureCaretVisible, syncBackdropScroll]);

    // Re-check caret visibility when header collapses/expands on keyboard state change
    useEffect(() => {
      const raf = requestAnimationFrame(() => {
        syncBackdropScroll();
        ensureCaretVisible();
      });
      return () => cancelAnimationFrame(raf);
    }, [isKeyboardOpen, ensureCaretVisible, syncBackdropScroll]);

    // Reset suggest index when suggestion trigger query or type changes
    useEffect(() => {
      setSuggestIndex(0);
    }, [suggestionTrigger?.query, suggestionTrigger?.type]);

    // Unified suggestion candidate list for this pane
    const suggestItems = useMemo<UnifiedSuggestItem[]>(() => {
      if (!suggestionTrigger) return [];
      return getUnifiedSuggestItems(
        suggestionTrigger,
        categoryOptions,
        themeOptions
      );
    }, [suggestionTrigger, categoryOptions, themeOptions]);

    // Update cursor information, detect tags in active line, and detect suggestion trigger
    const updateCursorState = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const caretPos = textarea.selectionEnd ?? 0;
      const textVal = textarea.value;
      const lineStart = textVal.lastIndexOf('\n', caretPos - 1) + 1;
      const lineEndIdx = textVal.indexOf('\n', caretPos);
      const lineEnd = lineEndIdx === -1 ? textVal.length : lineEndIdx;
      const currentLine = textVal.substring(lineStart, lineEnd);
      const col = caretPos - lineStart;

      // 1. Tags in current line
      const tags = parseLineInlineTags(currentLine);
      onActiveLineTagsChange?.(tags);

      // 2. Suggestion trigger at cursor
      const trigger = detectSuggestionTrigger(currentLine, col);
      onSuggestionTrigger?.(trigger);

      // 3. Update caret pixel coordinates for inline suggest popover
      updateCaretCoordinates();
    }, [onActiveLineTagsChange, onSuggestionTrigger, updateCaretCoordinates]);

    // Core suggestion application logic
    const applySuggestion = useCallback(
      (suggestedValue: string, trigger: SuggestionTrigger) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const caretPos = textarea.selectionEnd ?? text.length;
        const val = text;
        const lineStart = val.lastIndexOf('\n', caretPos - 1) + 1;

        const replaceStartGlobal = lineStart + trigger.replaceStart;
        const replaceEndGlobal = lineStart + trigger.replaceEnd;

        let effectiveReplaceEndGlobal = replaceEndGlobal;
        const isDrillDown = suggestedValue.endsWith(':');

        let replacement = '';
        if (trigger.type === 'category') {
          replacement = `!${suggestedValue}${isDrillDown ? '' : ' '}`;
          // If finalized category and followed by space, consume 1 space to avoid double spacing
          if (!isDrillDown) {
            const afterText = val.substring(replaceEndGlobal);
            const match = afterText.match(/^[ 　]/);
            if (match) {
              effectiveReplaceEndGlobal += match[0].length;
            }
          }
        } else if (trigger.type === 'theme') {
          replacement = `[${suggestedValue}${isDrillDown ? '' : '] '}`;
          // Smart Auto-Consume: if finalized theme and cursor is immediately followed by ']' or '］',
          // consume that closing bracket (and any following space) so ']' doesn't become redundant.
          if (!isDrillDown) {
            const afterText = val.substring(replaceEndGlobal);
            const match = afterText.match(/^[\]］][ 　]?/);
            if (match) {
              effectiveReplaceEndGlobal += match[0].length;
            }
          }
        } else if (trigger.type === 'date') {
          replacement = `#${suggestedValue} `;
          const afterText = val.substring(replaceEndGlobal);
          const match = afterText.match(/^([0-9/]+)?[ 　]?/);
          if (match && match[0]) {
            effectiveReplaceEndGlobal += match[0].length;
          }
        }

        const newText =
          val.substring(0, replaceStartGlobal) +
          replacement +
          val.substring(effectiveReplaceEndGlobal);
        onChangeText(newText);

        const targetCursor = replaceStartGlobal + replacement.length;
        requestAnimationFrame(() => {
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(targetCursor, targetCursor);
          syncBackdropScroll();
          ensureCaretVisible();
          updateCursorState();
        });
      },
      [text, onChangeText, syncBackdropScroll, ensureCaretVisible, updateCursorState]
    );

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
          syncBackdropScroll();
          ensureCaretVisible();
          updateCursorState();
        });
      },

      insertIndentComment: () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? text.length;
        const val = text;

        const lineEnd = val.indexOf('\n', start);
        const insertPos = lineEnd === -1 ? val.length : lineEnd;

        const prefix = val.substring(0, insertPos);
        const suffix = val.substring(insertPos);
        const newText = `${prefix}\n  ${suffix}`;
        onChangeText(newText);

        const newCursorPos = insertPos + 3; // \n + 2 spaces
        requestAnimationFrame(() => {
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          syncBackdropScroll();
          ensureCaretVisible();
          updateCursorState();
        });
      },

      insertDueDate: (dateStr: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? text.length;
        const val = text;

        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const lineEndIdx = val.indexOf('\n', start);
        const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;
        const currentLine = val.substring(lineStart, lineEnd);

        const charBefore = start > 0 ? val[start - 1] : '';
        const isRightAfterHash = charBefore === '#' || charBefore === '＃';

        const match = currentLine.match(DUE_DATE_REGEX);

        let newText: string;
        let newCursorPos: number;

        if (match && match.index !== undefined) {
          const matchStart = lineStart + match.index;
          const matchEnd = matchStart + match[0].length;
          const replacement = `#${dateStr}`;
          newText = val.substring(0, matchStart) + replacement + val.substring(matchEnd);
          newCursorPos = matchStart + replacement.length;
        } else if (isRightAfterHash) {
          const replacement = `#${dateStr} `;
          newText = val.substring(0, start - 1) + replacement + val.substring(start);
          newCursorPos = start - 1 + replacement.length;
        } else {
          const needsLeadingSpace =
            charBefore !== '' &&
            charBefore !== ' ' &&
            charBefore !== '\n' &&
            charBefore !== '　';
          const tagToInsert = `${needsLeadingSpace ? ' ' : ''}#${dateStr} `;
          newText = val.substring(0, start) + tagToInsert + val.substring(start);
          newCursorPos = start + tagToInsert.length;
        }

        onChangeText(newText);

        requestAnimationFrame(() => {
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          syncBackdropScroll();
          ensureCaretVisible();
          updateCursorState();
        });
      },

      getCurrentLineDueDate: () => {
        const textarea = textareaRef.current;
        if (!textarea) return null;
        const start = textarea.selectionStart ?? text.length;
        const val = text;
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const lineEndIdx = val.indexOf('\n', start);
        const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;
        const currentLine = val.substring(lineStart, lineEnd);
        const match = currentLine.match(DUE_DATE_REGEX);
        if (match) {
          return match[0].replace(/^[#＃]/, '').trim();
        }
        return null;
      },

      toggleNav: () => {
        setIsNavOpen((prev) => !prev);
      },

      focus: () => {
        textareaRef.current?.focus({ preventScroll: true });
      },

      getCursorLineAndCol: () => {
        const textarea = textareaRef.current;
        if (!textarea) return null;
        const pos = textarea.selectionStart ?? 0;
        const textBefore = textarea.value.substring(0, pos);
        const lines = textBefore.split('\n');
        return {
          lineIdx: lines.length - 1,
          col: lines[lines.length - 1].length,
        };
      },

      restoreCursorLineAndCol: (lineIdx: number, col: number) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const lines = textarea.value.split('\n');
        let currentOffset = 0;
        for (let i = 0; i < lines.length; i++) {
          if (i === lineIdx) {
            const targetPos = currentOffset + Math.min(col, lines[i].length);
            textarea.setSelectionRange(targetPos, targetPos);
            syncBackdropScroll();
            ensureCaretVisible();
            updateCursorState();
            return;
          }
          currentOffset += lines[i].length + 1;
        }
        const endPos = textarea.value.length;
        textarea.setSelectionRange(endPos, endPos);
        syncBackdropScroll();
        ensureCaretVisible();
        updateCursorState();
      },

      removeTagFromCurrentLine: (tag: InlineTagInfo) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const caretPos = textarea.selectionEnd ?? text.length;
        const val = text;
        const lineStart = val.lastIndexOf('\n', caretPos - 1) + 1;
        const lineEndIdx = val.indexOf('\n', caretPos);
        const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;
        const currentLine = val.substring(lineStart, lineEnd);

        const newLine = removeTagFromLine(currentLine, tag);
        const newText = val.substring(0, lineStart) + newLine + val.substring(lineEnd);
        onChangeText(newText);

        const newCaret = Math.min(lineStart + newLine.length, caretPos);
        requestAnimationFrame(() => {
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(newCaret, newCaret);
          syncBackdropScroll();
          ensureCaretVisible();
          updateCursorState();
        });
      },

      replaceTagInCurrentLine: (tag: InlineTagInfo, newRawTag: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const caretPos = textarea.selectionEnd ?? text.length;
        const val = text;
        const lineStart = val.lastIndexOf('\n', caretPos - 1) + 1;
        const lineEndIdx = val.indexOf('\n', caretPos);
        const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;
        const currentLine = val.substring(lineStart, lineEnd);

        const newLine = replaceTagInLine(currentLine, tag, newRawTag);
        const newText = val.substring(0, lineStart) + newLine + val.substring(lineEnd);
        onChangeText(newText);

        const newCaret = lineStart + tag.startIndex + newRawTag.length;
        requestAnimationFrame(() => {
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(newCaret, newCaret);
          syncBackdropScroll();
          ensureCaretVisible();
          updateCursorState();
        });
      },

      applySuggestionAtCursor: (suggestedValue: string, trigger: SuggestionTrigger) => {
        applySuggestion(suggestedValue, trigger);
      },
    }));

    // Jump to section line and scroll smoothly within native textarea
    const handleSelectSection = (charIndex: number, lineIndex: number) => {
      const textarea = textareaRef.current;
      const backdrop = backdropRef.current;
      if (!textarea) return;

      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(charIndex, charIndex);

      const lineEl = backdrop?.children[lineIndex] as HTMLElement | undefined;
      const targetScrollTop = lineEl
        ? Math.max(0, lineEl.offsetTop - 8)
        : Math.max(0, (lineIndex - 1) * 20);

      textarea.scrollTo({
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

      // Keyboard navigation for Inline Suggestion Popover (Desktop mode)
      if (isDesktop && suggestionTrigger && suggestItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setSuggestIndex((prev) => (prev + 1) % suggestItems.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setSuggestIndex(
            (prev) => (prev - 1 + suggestItems.length) % suggestItems.length
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          const selectedItem = suggestItems[suggestIndex] || suggestItems[0];
          if (selectedItem) {
            if (selectedItem.isAction && selectedItem.type === 'calendar') {
              onOpenCalendar?.();
              onSuggestionTrigger?.(null);
            } else {
              applySuggestion(selectedItem.raw, suggestionTrigger);
              if (!selectedItem.raw.endsWith(':')) {
                onSuggestionTrigger?.(null);
              }
            }
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onSuggestionTrigger?.(null);
          return;
        }
      }

      // Overtype / Skip closing bracket ']' if cursor is right before ']'
      if ((e.key === ']' || e.key === '］') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionStart === textarea.selectionEnd) {
          const pos = textarea.selectionStart;
          const nextChar = textarea.value.charAt(pos);
          if (nextChar === ']' || nextChar === '］') {
            e.preventDefault();
            const targetPos = pos + 1;
            textarea.setSelectionRange(targetPos, targetPos);
            updateCursorState();
            return;
          }
        }
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
              updateCursorState();
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
              updateCursorState();
            });
          }
        } else {
          // Tab: insert 2 half-width spaces
          const updated = val.substring(0, start) + '  ' + val.substring(end);
          onChangeText(updated);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2;
            updateCursorState();
          });
        }
      }
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (NAVIGATION_KEYS.has(e.key)) {
        ensureCaretVisible();
      }
      updateCursorState();
    };

    const handleFocus = () => {
      requestAnimationFrame(() => {
        ensureCaretVisible();
        updateCursorState();
      });
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
        <div className="relative flex-1 min-h-0 flex overflow-hidden bg-white">
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

          {/* Native Scrollable Notepad Area */}
          <div
            ref={notepadContainerRef}
            className="relative flex-1 min-h-0 h-full overflow-hidden bg-white"
          >
            {/* Backdrop Layer (mirrors textarea scroll and content padding) */}
            <div
              ref={backdropRef}
              aria-hidden="true"
              style={{ right: `${scrollbarWidth}px` }}
              className="notepad-layer absolute inset-y-0 left-0 overflow-hidden pointer-events-none select-none text-slate-800 pt-2.5 pb-16 pl-3 sm:pl-4 pr-3 sm:pr-4"
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
                      className="notepad-line text-slate-700 bg-slate-200/80 -mx-1 px-1 rounded-sm"
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
                      className="notepad-line relative text-slate-500 bg-slate-100/90 -mx-0.5 px-0.5 rounded-sm"
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-0 text-[10px] leading-[20px] text-slate-400 font-normal select-none pointer-events-none ${
                          isNarrowIndent ? '-left-2' : 'left-0.5'
                        }`}
                      >
                        ↳
                      </span>
                      {line || '\u200B'}
                    </div>
                  );
                }

                // Task Line: highlight today / overdue, plus inline chip tokens
                const dateStatus = getLineDueDateStatus(line);
                let lineBgClass = '';
                if (dateStatus === 'overdue') {
                  lineBgClass = 'bg-rose-100/90 -mx-1 px-1 rounded-sm';
                } else if (dateStatus === 'today') {
                  lineBgClass = 'bg-amber-100/90 -mx-1 px-1 rounded-sm';
                }

                const tokens = splitLineIntoTokens(line);

                return (
                  <div key={idx} className={`notepad-line ${lineBgClass}`}>
                    {tokens.map((token, tIdx) => {
                      if (!token.tag) {
                        return <React.Fragment key={tIdx}>{token.text}</React.Fragment>;
                      }

                      let chipClass = '';
                      if (token.tag.type === 'date') {
                        chipClass =
                          'text-emerald-700 border-b-[1.5px] border-dotted border-emerald-600/70 pb-[1px]';
                      } else if (token.tag.type === 'theme') {
                        chipClass =
                          'text-blue-700 border-b-[1.5px] border-dotted border-blue-600/70 pb-[1px]';
                      } else if (token.tag.type === 'category') {
                        chipClass =
                          'text-amber-800 border-b-[1.5px] border-dotted border-amber-600/70 pb-[1px]';
                      }

                      return (
                        <span key={tIdx} className={chipClass}>
                          {token.text}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Foreground Native Textarea (independent native scrolling) */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                onChangeText(e.target.value);
                requestAnimationFrame(() => {
                  syncBackdropScroll();
                  ensureCaretVisible();
                  updateCursorState();
                });
              }}
              onScroll={syncBackdropScroll}
              onClick={() => {
                requestAnimationFrame(() => {
                  ensureCaretVisible();
                  updateCursorState();
                });
              }}
              onFocus={handleFocus}
              onBlur={() => {
                onBlur();
                // Delay clearing active tags/suggestions so click on toolbar buttons can register
                setTimeout(() => {
                  onActiveLineTagsChange?.([]);
                  onSuggestionTrigger?.(null);
                }, 200);
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              placeholder={placeholder}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="notepad-layer absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden pt-2.5 pb-16 pl-3 sm:pl-4 pr-3 sm:pr-4 text-transparent caret-slate-800 selection:bg-blue-500/25 bg-transparent resize-none border-none outline-none focus:ring-0 placeholder:text-slate-300"
            />

            {/* Inline Floating Suggestion Popover (Desktop only) */}
            {isDesktop && suggestionTrigger && (
              <InlineSuggestPopover
                isOpen={true}
                trigger={suggestionTrigger}
                categoryOptions={categoryOptions}
                themeOptions={themeOptions}
                caretCoordinates={caretCoords}
                containerWidth={notepadContainerRef.current?.clientWidth || 500}
                containerHeight={notepadContainerRef.current?.clientHeight || 400}
                selectedIndex={suggestIndex}
                onSelectIndexChange={setSuggestIndex}
                onSelect={(val) => {
                  applySuggestion(val, suggestionTrigger);
                  if (!val.endsWith(':')) {
                    onSuggestionTrigger?.(null);
                  }
                }}
                onOpenCalendar={() => {
                  onOpenCalendar?.();
                  onSuggestionTrigger?.(null);
                }}
                onClose={() => onSuggestionTrigger?.(null)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);

MemoPane.displayName = 'MemoPane';
