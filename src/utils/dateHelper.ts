/**
 * Date helper utilities for Quick Date Palette & Calendar Picker
 */

export interface DateSuggestion {
  id: string;
  label: string; // e.g. "今日", "明日", "今週金", "来週月"
  subLabel: string; // e.g. "10/20 (火)"
  dateStr: string; // e.g. "10/20"
  fullDateStr: string; // e.g. "2026/10/20"
  isToday?: boolean;
}

const JAPANESE_DAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * Format a Date object to "MM/DD" (with 2-digit zero padding)
 */
export const formatDateToMMDD = (date: Date): string => {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}`;
};

/**
 * Format a Date object to "YYYY/MM/DD"
 */
export const formatDateToYYYYMMDD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

/**
 * Add days to a Date object (returns a new Date)
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Helper to build a DateSuggestion item
 */
const createSuggestion = (
  id: string,
  label: string,
  date: Date,
  isToday = false
): DateSuggestion => {
  const dayName = JAPANESE_DAYS[date.getDay()];
  const dateStr = formatDateToMMDD(date);
  return {
    id,
    label,
    subLabel: `${dateStr} (${dayName})`,
    dateStr,
    fullDateStr: formatDateToYYYYMMDD(date),
    isToday,
  };
};

/**
 * Generate smart date suggestions tailored to today's day of week.
 * Always includes:
 * - 今日 (Today)
 * - 明日 (Tomorrow)
 * - 明後日 (Day after tomorrow)
 * Followed by dynamic next target days (weekend, next Monday, next Friday, etc.)
 */
export const getQuickDateSuggestions = (baseDate: Date = new Date()): DateSuggestion[] => {
  const suggestions: DateSuggestion[] = [];
  const dayOfWeek = baseDate.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

  // 1. 今日
  suggestions.push(createSuggestion('today', '今日', baseDate, true));

  // 2. 明日
  const tomorrow = addDays(baseDate, 1);
  suggestions.push(createSuggestion('tomorrow', '明日', tomorrow));

  // 3. 明後日
  const dayAfter = addDays(baseDate, 2);
  suggestions.push(createSuggestion('dayAfter', '明後日', dayAfter));

  // 4. Dynamic upcoming days depending on current day of week
  switch (dayOfWeek) {
    case 0: // 日曜日
      // 明日=月, 明後日=火
      suggestions.push(createSuggestion('this-wed', '今週水', addDays(baseDate, 3)));
      suggestions.push(createSuggestion('this-fri', '今週金', addDays(baseDate, 5)));
      suggestions.push(createSuggestion('next-mon', '来週月', addDays(baseDate, 8)));
      break;

    case 1: // 月曜日
      // 明日=火, 明後日=水
      suggestions.push(createSuggestion('this-fri', '今週金', addDays(baseDate, 4)));
      suggestions.push(createSuggestion('this-sat', '今週末', addDays(baseDate, 5)));
      suggestions.push(createSuggestion('next-mon', '来週月', addDays(baseDate, 7)));
      break;

    case 2: // 火曜日
      // 明日=水, 明後日=木
      suggestions.push(createSuggestion('this-fri', '今週金', addDays(baseDate, 3)));
      suggestions.push(createSuggestion('this-sat', '今週末', addDays(baseDate, 4)));
      suggestions.push(createSuggestion('next-mon', '来週月', addDays(baseDate, 6)));
      break;

    case 3: // 水曜日
      // 明日=木, 明後日=金
      suggestions.push(createSuggestion('this-sat', '今週末', addDays(baseDate, 3)));
      suggestions.push(createSuggestion('next-mon', '来週月', addDays(baseDate, 5)));
      suggestions.push(createSuggestion('next-fri', '来週金', addDays(baseDate, 9)));
      break;

    case 4: // 木曜日
      // 明日=金, 明後日=土
      suggestions.push(createSuggestion('this-sun', '今週日', addDays(baseDate, 3)));
      suggestions.push(createSuggestion('next-mon', '来週月', addDays(baseDate, 4)));
      suggestions.push(createSuggestion('next-fri', '来週金', addDays(baseDate, 8)));
      break;

    case 5: // 金曜日
      // 明日=土, 明後日=日
      suggestions.push(createSuggestion('next-mon', '来週月', addDays(baseDate, 3)));
      suggestions.push(createSuggestion('next-wed', '来週水', addDays(baseDate, 5)));
      suggestions.push(createSuggestion('next-fri', '来週金', addDays(baseDate, 7)));
      break;

    case 6: // 土曜日
      // 明日=日, 明後日=月
      suggestions.push(createSuggestion('next-wed', '来週水', addDays(baseDate, 4)));
      suggestions.push(createSuggestion('next-fri', '来週金', addDays(baseDate, 6)));
      suggestions.push(createSuggestion('next2-mon', '再来週月', addDays(baseDate, 9)));
      break;
  }

  return suggestions;
};

export interface CalendarDay {
  date: Date;
  dayNumber: number;
  dateStr: string; // "MM/DD"
  isCurrentMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
}

/**
 * Generate calendar grid cells (42 days: 6 weeks x 7 days) for a given year & month (0-indexed month)
 */
export const getCalendarMonthGrid = (year: number, month: number): CalendarDay[] => {
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sun, 1 for Mon...

  // Today reference for comparison
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  // Grid start date (might be in the previous month)
  const startDate = new Date(year, month, 1 - startDayOfWeek);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + i);

    const curYear = curDate.getFullYear();
    const curMonth = curDate.getMonth();
    const curDayNumber = curDate.getDate();
    const curDayOfWeek = curDate.getDay();

    const isCurrentMonth = curYear === year && curMonth === month;
    const isToday = curYear === todayYear && curMonth === todayMonth && curDayNumber === todayDate;

    days.push({
      date: curDate,
      dayNumber: curDayNumber,
      dateStr: formatDateToMMDD(curDate),
      isCurrentMonth,
      isToday,
      isSunday: curDayOfWeek === 0,
      isSaturday: curDayOfWeek === 6,
    });
  }

  return days;
};
