import React, { useRef } from 'react';
import { InlineTagInfo } from '../utils/tagHelper';
import { X, Calendar, Package, Tag } from 'lucide-react';

interface ActiveTagPillsProps {
  tags: InlineTagInfo[];
  onRemoveTag: (tag: InlineTagInfo) => void;
  onClickTag?: (tag: InlineTagInfo) => void;
}

export const ActiveTagPills: React.FC<ActiveTagPillsProps> = ({
  tags,
  onRemoveTag,
  onClickTag,
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

  const renderTagContent = (tag: InlineTagInfo) => {
    const isMultiPart = tag.parts.length > 1;

    let icon = <Tag className="w-3 h-3 text-amber-400 flex-shrink-0" />;
    if (tag.type === 'date') {
      icon = <Calendar className="w-3 h-3 text-emerald-400 flex-shrink-0" />;
    } else if (tag.type === 'theme') {
      icon = <Package className="w-3 h-3 text-blue-400 flex-shrink-0" />;
    }

    return (
      <div className="flex items-center gap-1 min-w-0">
        {icon}
        {isMultiPart ? (
          <div className="flex items-center gap-0.5 truncate">
            {tag.parts.map((p, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-[10px] opacity-60">›</span>}
                <span className={idx === tag.parts.length - 1 ? 'font-semibold' : 'opacity-80'}>
                  {p}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <span className="truncate font-semibold">{tag.value}</span>
        )}
      </div>
    );
  };

  const getPillColorClasses = (type: InlineTagInfo['type']) => {
    switch (type) {
      case 'date':
        return 'bg-emerald-950/85 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/90';
      case 'theme':
        return 'bg-blue-950/85 border-blue-700/80 text-blue-300 hover:bg-blue-900/90';
      case 'category':
        return 'bg-amber-950/85 border-amber-700/80 text-amber-300 hover:bg-amber-900/90';
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className="bg-slate-900/95 border-b border-slate-700/80 px-2 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none z-10"
      style={{ touchAction: 'manipulation' }}
    >
      <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 select-none">
        行タグ:
      </span>

      <div className="flex items-center gap-1.5 min-w-0">
        {tags.map((tag, idx) => (
          <div
            key={`${tag.type}-${tag.startIndex}-${idx}`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono shadow-xs transition-colors cursor-pointer flex-shrink-0 ${getPillColorClasses(
              tag.type
            )}`}
            onClick={() => onClickTag?.(tag)}
            title="タップで変更、✕で削除"
          >
            {renderTagContent(tag)}

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onPointerUp={(e) => handleRemove(e, tag)}
              className="ml-0.5 p-0.5 hover:bg-white/20 active:bg-white/30 rounded-full text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="タグをワン操作で削除"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
