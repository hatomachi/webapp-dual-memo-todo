import React, { useRef, useMemo } from 'react';
import { HierarchicalOption } from '../utils/tagHelper';
import { X, Tag, Package, Plus, ChevronRight } from 'lucide-react';

interface TagSuggestPaletteProps {
  isOpen: boolean;
  type: 'category' | 'theme';
  query: string;
  options: HierarchicalOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

export const TagSuggestPalette: React.FC<TagSuggestPaletteProps> = ({
  isOpen,
  type,
  query,
  options,
  onSelect,
  onClose,
}) => {
  const isPointerDownRef = useRef(false);

  // Filter options based on query and colon hierarchy
  const filteredOptions = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return options;
    }

    const lowerQuery = trimmedQuery.toLowerCase();

    // If query contains a colon, e.g. "ワーク:開" or "ワーク:"
    if (trimmedQuery.includes(':')) {
      const parts = trimmedQuery.split(':');
      const parentQuery = parts[0].toLowerCase();
      const childQuery = parts.slice(1).join(':').toLowerCase();

      return options.filter((opt) => {
        const optLower = opt.raw.toLowerCase();
        if (!optLower.startsWith(`${parentQuery}:`)) {
          return false;
        }
        if (!childQuery) {
          return true; // Show all children of this parent
        }
        const optChildPart = opt.raw.substring(parentQuery.length + 1).toLowerCase();
        return optChildPart.includes(childQuery);
      });
    }

    // Standard filtering (parent or raw includes query)
    return options.filter((opt) => {
      return (
        opt.raw.toLowerCase().includes(lowerQuery) ||
        opt.displayName.toLowerCase().includes(lowerQuery)
      );
    });
  }, [options, query]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isPointerDownRef.current = true;
  };

  const handleSelectOption = (raw: string) => {
    onSelect(raw);
  };

  const isExactMatch = options.some(
    (o) => o.raw.toLowerCase() === query.trim().toLowerCase()
  );

  const cleanQuery = query.trim();
  const showCreateNew = cleanQuery.length > 0 && !isExactMatch;

  const titleIcon =
    type === 'category' ? (
      <Tag className="w-3.5 h-3.5 text-amber-400" />
    ) : (
      <Package className="w-3.5 h-3.5 text-blue-400" />
    );

  const typeLabel = type === 'category' ? '分類 (!)' : 'テーマ ([ ])';

  return (
    <div
      onPointerDown={handlePointerDown}
      className="bg-slate-900 border-b border-slate-700 text-slate-100 px-2 py-1.5 flex flex-col gap-1 select-none z-20 shadow-md animate-fadeIn"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {titleIcon}
          <span className="text-slate-300">{typeLabel} 候補</span>
          {cleanQuery && (
            <span className="font-mono text-[11px] bg-slate-800 text-amber-300 px-1.5 py-0.2 rounded border border-slate-700 truncate max-w-[140px]">
              {cleanQuery}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 active:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
          title="閉じる"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Suggestion Chips list (horizontal scroll) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {/* Create New Tag Chip if query is typed and not an exact match */}
        {showCreateNew && (
          <button
            type="button"
            onClick={() => handleSelectOption(cleanQuery)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 text-xs font-mono font-semibold whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer shadow-xs"
            title={`新規 "${cleanQuery}" として作成`}
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>新規: {cleanQuery}</span>
          </button>
        )}

        {/* Existing options */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => {
            const isChild = opt.depth > 0;
            const parts = opt.raw.split(':');

            return (
              <button
                key={opt.raw}
                type="button"
                onClick={() => handleSelectOption(opt.raw)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-all flex-shrink-0 cursor-pointer border ${
                  type === 'category'
                    ? 'bg-amber-950/70 hover:bg-amber-900/90 text-amber-200 border-amber-800/80 hover:border-amber-600'
                    : 'bg-blue-950/70 hover:bg-blue-900/90 text-blue-200 border-blue-800/80 hover:border-blue-600'
                }`}
                title={opt.raw}
              >
                {isChild ? (
                  <div className="flex items-center gap-0.5">
                    <span className="opacity-60">{parts.slice(0, -1).join(':')}</span>
                    <ChevronRight className="w-3 h-3 opacity-50 flex-shrink-0" />
                    <span className="font-semibold">{parts[parts.length - 1]}</span>
                  </div>
                ) : (
                  <span className="font-semibold">{opt.displayName}</span>
                )}

                {opt.hasChildren && !cleanQuery.includes(':') && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectOption(`${opt.raw}:`);
                    }}
                    className="ml-0.5 px-1 py-0.2 rounded text-[10px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600"
                    title={`子カテゴリを絞り込み`}
                  >
                    :子
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <span className="text-[11px] text-slate-400 px-2 py-0.5 italic">
            一致する候補がありません（そのまま自由に入力できます）
          </span>
        )}
      </div>
    </div>
  );
};
