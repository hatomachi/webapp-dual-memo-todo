import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';
import { getCalendarMonthGrid, formatDateToMMDD, resolveDueDate } from '../utils/dateHelper';

interface CalendarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDateStr?: string | null;
}

const WEEKDAY_NAMES = [
  { name: '日', isSunday: true, isSaturday: false },
  { name: '月', isSunday: false, isSaturday: false },
  { name: '火', isSunday: false, isSaturday: false },
  { name: '水', isSunday: false, isSaturday: false },
  { name: '木', isSunday: false, isSaturday: false },
  { name: '金', isSunday: false, isSaturday: false },
  { name: '土', isSunday: false, isSaturday: true },
];

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectDate,
  selectedDateStr,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());

  // Reset to current month or selected date when opened
  useEffect(() => {
    if (isOpen) {
      if (selectedDateStr) {
        const resolved = resolveDueDate(selectedDateStr, today);
        if (resolved) {
          setCurrentYear(resolved.year);
          setCurrentMonth(resolved.month - 1);
          return;
        }
      }
      setCurrentYear(today.getFullYear());
      setCurrentMonth(today.getMonth());
    }
  }, [isOpen, selectedDateStr]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const t = new Date();
    setCurrentYear(t.getFullYear());
    setCurrentMonth(t.getMonth());
  };

  const daysGrid = getCalendarMonthGrid(currentYear, currentMonth);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs sm:max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800 text-white">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold tracking-tight">日付を選択</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
            title="前の月"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono text-slate-800">
              {currentYear}年 {currentMonth + 1}月
            </span>
            <button
              type="button"
              onClick={handleJumpToToday}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors cursor-pointer"
            >
              今月
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
            title="次の月"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-3">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 mb-1 text-center">
            {WEEKDAY_NAMES.map((wd, i) => (
              <div
                key={i}
                className={`text-[11px] font-bold py-1 ${
                  wd.isSunday
                    ? 'text-rose-500'
                    : wd.isSaturday
                    ? 'text-blue-500'
                    : 'text-slate-500'
                }`}
              >
                {wd.name}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {daysGrid.map((dayItem, idx) => {
              const isSelected = selectedDateStr === dayItem.dateStr;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectDate(dayItem.dateStr);
                    onClose();
                  }}
                  className={`
                    relative h-8 sm:h-9 rounded-lg flex flex-col items-center justify-center text-xs font-mono transition-all cursor-pointer
                    ${
                      !dayItem.isCurrentMonth
                        ? 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                        : dayItem.isSunday
                        ? 'text-rose-600 hover:bg-rose-50'
                        : dayItem.isSaturday
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-slate-800 hover:bg-slate-100'
                    }
                    ${dayItem.isToday ? 'font-bold ring-1.5 ring-emerald-500 bg-emerald-50/50' : ''}
                    ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-xs ring-0'
                        : ''
                    }
                  `}
                >
                  <span>{dayItem.dayNumber}</span>
                  {dayItem.isToday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-emerald-500 absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer shortcuts */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">タップで即時反映</span>
          <button
            type="button"
            onClick={() => {
              onSelectDate(formatDateToMMDD(new Date()));
              onClose();
            }}
            className="text-emerald-700 font-medium hover:underline cursor-pointer"
          >
            今日（{formatDateToMMDD(new Date())}）を選択
          </button>
        </div>
      </div>
    </div>
  );
};
