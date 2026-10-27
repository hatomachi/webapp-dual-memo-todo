import React, { useRef } from 'react';
import { InlineTagInfo } from '../utils/tagHelper';
import { PaneType } from '../types/todo';
import { X, Calendar, Package, Tag, ArrowUpRight } from 'lucide-react';

interface ActiveTagPillsProps {
  tags: InlineTagInfo[];
  currentPaneType?: PaneType;
  onRemoveTag: (tag: InlineTagInfo) => void;
  onClickTag?: (tag: InlineTagInfo) => void;
  onJumpTag?: (tag: InlineTagInfo) => void;
}

export const ActiveTagPills: React.FC<ActiveTagPillsProps> = ({
  tags,
  currentPaneType,
  onRemoveTag,
  onClickTag,
  onJumpTag,
}) => {
  const isPointerDownRef = useRef(false);

  if (tags.length === 0) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Keep virtual keyboard open on mobile
    e.preventDefault();
    isPointerDownRef.current = true;
  };

  const handleRemove = (e: React.PointerEvent, tag: InlineTagInfo) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveTag(tag);
  };

  const handlePillClick = (tag: InlineTagInfo) => {
    const isJumpable =
      (currentPaneType === 'category' && tag.type === 'theme') ||
      (currentPaneType === 'theme' && tag.type === 'category');

    if (isJumpable && onJumpTag) {
      onJumpTag(tag);
    } else {
      onClickTag?.(tag);
    }
  };

  const renderTagContent = (tag: InlineTagInfo) => {
    const isMultiPart = tag.parts.length > 1;

    let icon = <Tag className="w-3 h-3 text-amber-600 flex-shrink-0" />;
    if (tag.type === 'date') {
      icon = <Calendar className="w-3 h-3 text-emerald-600 flex-shrink-0" />;
    } else if (tag.type === 'theme') {
      icon = <Package className="w-3 h-3 text-blue-600 flex-shrink-0" />;
    }

    return (
      <div className="flex items-center gap-1 min-w-0">
        {icon}
        {isMultiPart ? (
          <div className="flex items-center gap-0.5 truncate text-[11px]">
            {tag.parts.map((p, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-[10px] text-slate-300">›</span>}
                <span className={idx === tag.parts.length - 1 ? 'font-medium text-slate-700' : 'text-slate-400'}>
                  {p}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <span className="truncate font-medium text-slate-700 text-[11px]">{tag.value}</span>
        )}
      </div>
    );
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className="bg-slate-100/95 border-b border-slate-200 px-2.5 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none z-10"
      style={{ touchAction: 'manipulation' }}
    >
      <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 select-none">
        行タグ:
      </span>

      <div className="flex items-center gap-1.5 min-w-0">
        {tags.map((tag, idx) => {
          const isJumpable =
            (currentPaneType === 'category' && tag.type === 'theme') ||
            (currentPaneType === 'theme' && tag.type === 'category');

          const jumpDestLabel =
            currentPaneType === 'category' ? '右ペイン（テーマ）' : '左ペイン（分類）';

          return (
            <div
              key={`${tag.type}-${tag.startIndex}-${idx}`}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border font-mono shadow-2xs transition-colors cursor-pointer flex-shrink-0 ${
                isJumpable
                  ? 'bg-blue-50/70 hover:bg-blue-100/80 border-blue-200 text-blue-900'
                  : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => handlePillClick(tag)}
              title={
                isJumpable
                  ? `タップで${jumpDestLabel}の該当行へジャンプ、✕で削除`
                  : 'タップで変更、✕で削除'
              }
            >
              {renderTagContent(tag)}

              {isJumpable && (
                <span
                  className="text-blue-500 hover:text-blue-700 flex items-center ml-0.5"
                  title={`${jumpDestLabel}へジャンプ`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              )}

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerUp={(e) => handleRemove(e, tag)}
                className="ml-0.5 p-0.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 active:bg-slate-200 rounded transition-colors cursor-pointer"
                title="タグをワン操作で削除"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
