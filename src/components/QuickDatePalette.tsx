import React, { useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, Hash, X } from 'lucide-react';
import { getQuickDateSuggestions, DateSuggestion } from '../utils/dateHelper';

interface QuickDatePaletteProps {
  isOpen: boolean;
  onSelectDate: (dateStr: string) => void;
  onOpenCalendar: () => void;
  onInsertRawHash: () => void;
  onClose: () => void;
}

interface PaletteButtonProps {
  onTrigger: () => void;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

/**
 * Mobile-safe button that prevents textarea from losing focus (blur),
 * keeping the iOS / Android virtual keyboard wide open while tapping date chips.
 */
const PaletteButton: React.FC<PaletteButtonProps> = ({
  onTrigger,
  className = '',
  title,
  children,
}) => {
  const isPointerDownRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Crucial: Prevent browser from shifting focus away from textarea,
    // which would cause iOS Safari to dismiss the virtual keyboard.
    e.preventDefault();
    isPointerDownRef.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      e.preventDefault();
      onTrigger();
    }
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current = false;
  };

  const handlePointerLeave = () => {
    isPointerDownRef.current = false;
  };

  return (
    <button
      type="button"
      title={title}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      className={className}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </button>
  );
};

export const QuickDatePalette: React.FC<QuickDatePaletteProps> = ({
  isOpen,
  onSelectDate,
  onOpenCalendar,
  onInsertRawHash,
  onClose,
}) => {
  const suggestions = useMemo<DateSuggestion[]>(() => {
    return getQuickDateSuggestions();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="bg-slate-900/95 text-slate-200 border-t border-slate-700/80 px-2 py-1.5 flex items-center justify-between gap-1.5 select-none shadow-md z-30 animate-fadeIn backdrop-blur-xs">
      {/* Scrollable quick date chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
        {/* Open full Calendar button */}
        <PaletteButton
          onTrigger={onOpenCalendar}
          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-900/80 hover:bg-emerald-800 active:bg-emerald-700 text-emerald-300 border border-emerald-700/60 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors shadow-xs"
          title="カレンダーから選択..."
        >
          <CalendarIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>カレンダー</span>
        </PaletteButton>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-700 mx-0.5 flex-shrink-0" />

        {/* Dynamic date suggestion chips */}
        {suggestions.map((item) => (
          <PaletteButton
            key={item.id}
            onTrigger={() => onSelectDate(item.dateStr)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono whitespace-nowrap cursor-pointer transition-colors border shadow-xs ${
              item.isToday
                ? 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-700/70 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border-slate-700 hover:text-white'
            }`}
            title={`期日 #${item.dateStr} を挿入`}
          >
            <span className="font-sans font-medium text-[11px] text-slate-300">
              {item.label}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">
              {item.dateStr}
            </span>
          </PaletteButton>
        ))}

        {/* Raw '#' insertion button for pure manual typing */}
        <PaletteButton
          onTrigger={onInsertRawHash}
          className="flex items-center gap-0.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md text-xs font-mono whitespace-nowrap cursor-pointer transition-colors"
          title="'#' のみ挿入して手打ち"
        >
          <Hash className="w-3 h-3 text-slate-400" />
          <span className="text-[10px]">手打ち</span>
        </PaletteButton>
      </div>

      {/* Close button */}
      <div className="flex-shrink-0 pl-1">
        <PaletteButton
          onTrigger={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors cursor-pointer"
          title="パレットを閉じる"
        >
          <X className="w-3.5 h-3.5" />
        </PaletteButton>
      </div>
    </div>
  );
};
