import React from 'react';
import { SectionItem, PaneType } from '../types/todo';

interface SectionNavProps {
  sections: SectionItem[];
  paneType: PaneType;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectSection: (charIndex: number, lineIndex: number) => void;
}

export const SectionNav: React.FC<SectionNavProps> = ({
  sections,
  paneType,
  isOpen,
  onToggleOpen,
  onSelectSection,
}) => {
  const accentColor = paneType === 'category' ? 'text-emerald-600' : 'text-blue-600';
  const headerBg = paneType === 'category' ? 'bg-emerald-50/50' : 'bg-blue-50/50';

  if (!isOpen) {
    return (
      <div
        onClick={onToggleOpen}
        title="区切りリストを展開"
        className="w-7 flex-shrink-0 bg-slate-50/80 hover:bg-slate-100/90 border-r border-slate-200 select-none flex flex-col items-center py-2 h-full cursor-pointer transition-colors group"
      >
        <button
          type="button"
          className="text-slate-400 group-hover:text-slate-600 p-1 rounded hover:bg-slate-200/50 transition-colors"
          aria-label="区切りリストを展開"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="mt-3 [writing-mode:vertical-rl] text-[10px] font-mono tracking-wider text-slate-400 group-hover:text-slate-600 flex items-center gap-1">
          <span>区切り</span>
          <span className="font-bold text-[9px] bg-slate-200 px-1 py-0.5 rounded-full [writing-mode:horizontal-tb]">
            {sections.length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <nav
      aria-label={`${paneType === 'category' ? '分類' : 'テーマ'}の区切り目次`}
      className="w-40 flex-shrink-0 bg-slate-50 border-r border-slate-200 select-none flex flex-col h-full overflow-hidden text-xs transition-all"
    >
      {/* Header bar */}
      <div className={`flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 ${headerBg}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs ${accentColor}`}>📑</span>
          <span className="text-[11px] font-bold text-slate-700 truncate">区切り</span>
          <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded px-1">
            {sections.length}
          </span>
        </div>

        <button
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200/60 transition-colors"
          title="目次を折りたたむ"
          aria-label="目次を折りたたむ"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-0.5">
        {sections.length === 0 ? (
          <div className="text-[11px] text-slate-400 text-center py-6 px-2 leading-relaxed">
            見出しが<br />ありません
          </div>
        ) : (
          sections.map((sec, idx) => {
            const isRoot = sec.depth === 0;

            // Indentation padding per depth
            const paddingClass =
              sec.depth === 0
                ? 'pl-1.5 font-semibold text-slate-800'
                : sec.depth === 1
                ? 'pl-4 text-slate-600'
                : sec.depth === 2
                ? 'pl-6 text-slate-500'
                : 'pl-8 text-slate-500';

            return (
              <button
                key={`${sec.raw}-${idx}`}
                onClick={() => onSelectSection(sec.charIndex, sec.lineIndex)}
                title={`${sec.raw} (行 ${sec.lineIndex + 1})`}
                type="button"
                className={`w-full text-left py-1 pr-1.5 rounded transition-colors hover:bg-slate-200/70 flex items-center gap-1 group ${paddingClass}`}
              >
                {/* Icon / Bullet */}
                {isRoot ? (
                  sec.isDefault ? (
                    <span className="text-slate-400 text-[10px] flex-shrink-0">📥</span>
                  ) : (
                    <span className="text-amber-600 text-[10px] flex-shrink-0">📁</span>
                  )
                ) : (
                  <span className="text-slate-300 group-hover:text-slate-400 text-[10px] font-mono flex-shrink-0">
                    └
                  </span>
                )}

                {/* Section Display Name */}
                <span className="truncate text-[11px] group-hover:text-slate-900">
                  {sec.displayName}
                </span>
              </button>
            );
          })
        )}
      </div>
    </nav>
  );
};
