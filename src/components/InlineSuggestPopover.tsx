import React, { useEffect, useRef, useMemo } from 'react';
import {
  Tag,
  Package,
  Calendar as CalendarIcon,
  Plus,
  Clock,
} from 'lucide-react';
import {
  SuggestionTrigger,
  HierarchicalOption,
  UnifiedSuggestItem,
  getUnifiedSuggestItems,
} from '../utils/tagHelper';

export interface InlineSuggestPopoverProps {
  isOpen: boolean;
  trigger: SuggestionTrigger;
  categoryOptions: HierarchicalOption[];
  themeOptions: HierarchicalOption[];
  caretCoordinates: { top: number; left: number; height: number };
  containerWidth: number;
  containerHeight: number;
  selectedIndex: number;
  onSelectIndexChange: (index: number) => void;
  onSelect: (value: string) => void;
  onOpenCalendar: () => void;
  onClose: () => void;
}

export const InlineSuggestPopover: React.FC<InlineSuggestPopoverProps> = ({
  isOpen,
  trigger,
  categoryOptions,
  themeOptions,
  caretCoordinates,
  containerWidth,
  containerHeight,
  selectedIndex,
  onSelectIndexChange,
  onSelect,
  onOpenCalendar,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Build candidate items based on trigger type and query
  const items = useMemo<UnifiedSuggestItem[]>(() => {
    return getUnifiedSuggestItems(trigger, categoryOptions, themeOptions);
  }, [trigger, categoryOptions, themeOptions]);

  // Ensure selectedIndex is within valid range
  useEffect(() => {
    if (items.length === 0) {
      if (selectedIndex !== 0) onSelectIndexChange(0);
    } else if (selectedIndex >= items.length) {
      onSelectIndexChange(items.length - 1);
    } else if (selectedIndex < 0) {
      onSelectIndexChange(0);
    }
  }, [items.length, selectedIndex, onSelectIndexChange]);

  // Scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen || items.length === 0) return null;

  // Calculate position: default below caret, flip above if overflowing bottom
  const popoverWidth = 260;
  const estimatedPopoverHeight = Math.min(240, items.length * 32 + 40);

  const spaceBelow =
    containerHeight - (caretCoordinates.top + caretCoordinates.height);
  const shouldFlipAbove =
    spaceBelow < estimatedPopoverHeight + 10 &&
    caretCoordinates.top > estimatedPopoverHeight + 10;

  const topPos = shouldFlipAbove
    ? Math.max(10, caretCoordinates.top - estimatedPopoverHeight - 4)
    : Math.min(
        containerHeight - estimatedPopoverHeight - 10,
        caretCoordinates.top + caretCoordinates.height + 4
      );

  const leftPos = Math.max(
    10,
    Math.min(caretCoordinates.left, containerWidth - popoverWidth - 12)
  );

  const handleItemClick = (item: UnifiedSuggestItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.isAction && item.type === 'calendar') {
      onOpenCalendar();
      onClose();
    } else {
      onSelect(item.raw);
    }
  };

  const getHeaderInfo = () => {
    if (trigger.type === 'date') {
      return {
        icon: <Clock className="w-3.5 h-3.5 text-emerald-400" />,
        title: '期日 (#)',
        color: 'text-emerald-400',
      };
    }
    if (trigger.type === 'category') {
      return {
        icon: <Tag className="w-3.5 h-3.5 text-amber-400" />,
        title: '分類 (!)',
        color: 'text-amber-400',
      };
    }
    return {
      icon: <Package className="w-3.5 h-3.5 text-blue-400" />,
      title: 'テーマ ([ ])',
      color: 'text-blue-400',
    };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div
      ref={popoverRef}
      onMouseDown={(e) => e.preventDefault()}
      className="absolute z-40 bg-slate-900/95 border border-slate-700/80 rounded-lg shadow-2xl backdrop-blur-md text-slate-200 select-none flex flex-col overflow-hidden animate-fadeIn"
      style={{
        top: `${topPos}px`,
        left: `${leftPos}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${estimatedPopoverHeight}px`,
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 text-[11px] font-medium text-slate-400 bg-slate-950/40">
        <div className="flex items-center gap-1.5">
          {headerInfo.icon}
          <span className={headerInfo.color}>{headerInfo.title}</span>
          {trigger.query && (
            <span className="text-slate-400 truncate max-w-[100px]">
              : &ldquo;{trigger.query}&rdquo;
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          {selectedIndex + 1}/{items.length}
        </span>
      </div>

      {/* Suggestion list */}
      <div className="overflow-y-auto overflow-x-hidden flex-1 py-1 no-scrollbar">
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;

          let itemIcon = null;
          if (item.type === 'calendar') {
            itemIcon = (
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            );
          } else if (item.type === 'date') {
            itemIcon = (
              <Clock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            );
          } else if (item.type === 'category') {
            itemIcon = (
              <Tag className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            );
          } else if (item.type === 'theme') {
            itemIcon = (
              <Package className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            );
          } else if (item.type === 'create') {
            itemIcon = (
              <Plus className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            );
          }

          return (
            <button
              key={item.id}
              ref={isSelected ? activeItemRef : null}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => handleItemClick(item, e)}
              className={`w-full flex items-center justify-between px-2.5 py-1 text-left text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-200 hover:bg-slate-800/80 active:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {itemIcon}
                <span className="truncate">{item.primaryLabel}</span>
              </div>

              {item.secondaryLabel && (
                <span
                  className={`text-[10px] ml-2 flex-shrink-0 truncate font-mono ${
                    isSelected ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {item.secondaryLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer shortcut hints */}
      <div className="px-2.5 py-1 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between bg-slate-950/60 font-mono">
        <div className="flex items-center gap-2">
          <span>↑↓ 移動</span>
          <span>↵ 決定</span>
          <span>Esc 閉じる</span>
        </div>
      </div>
    </div>
  );
};
