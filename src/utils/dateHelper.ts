/**
 * Date helper utilities for Quick Date Palette & Calendar Picker
 */

export type DueDateStatus = 'overdue' | 'today' | 'future' | 'none';

export interface ResolvedDueDate {
  year: number;
  month: number;
  day: number;
  date: Date;
}

export interface DateSuggestion {
  id: string;
  label: string; // e.g. "今日", "明日", "今週金", "来週月"
  subLabel: string; // e.g. "10/20 (火)"
  dateStr: string; // e.g. "10/20"
  fullDateStr: string; // e.g. "2026/10/20"
  isToday?: boolean;
}

/**
 * Parse and resolve a due date string (e.g. "10/20", "1/11", "2026/10/20", "2027-01-11", "27/1/11").
 * When year is omitted (MM/DD), it smartly determines the most likely year based on baseDate:
 * - Dates within overdueToleranceDays (default: 45 days) in the past are treated as this year's overdue tasks.
 * - Dates further in the past (e.g. 1/11 when today is 10/20) are treated as upcoming tasks in the next year.
 * - Dates in near past after year rollover (e.g. 12/28 when today is 1/5) are treated as last year's overdue tasks.
 */
export const resolveDueDate = (
  dueDateStr: string,
  baseDate: Date = new Date(),
  overdueToleranceDays: number = 45
): ResolvedDueDate | null => {
  if (!dueDateStr) return null;
  const cleanStr = dueDateStr.replace(/^[#＃]/, '').trim();
  const parts = cleanStr.replace(/-/g, '/').split('/');

  let explicitYear: number | null = null;
  let month = 1;
  let day = 1;

  if (parts.length === 3) {
    let y = parseInt(parts[0], 10);
    if (isNaN(y)) return null;
    // Support 2-digit years like 26/1/11 or 27/01/11
    if (y < 100) {
      y += 2000;
    }
    explicitYear = y;
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
  } else {
    return null;
  }

  if (
    isNaN(month) ||
    isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  if (explicitYear !== null) {
    if (explicitYear < 1900 || explicitYear > 2200) {
      return null;
    }
    const targetDate = new Date(explicitYear, month - 1, day);
    if (targetDate.getMonth() !== month - 1 || targetDate.getDate() !== day) {
      return null;
    }
    return {
      year: explicitYear,
      month,
      day,
      date: targetDate,
    };
  }

  // Smart rolling year inference for MM/DD
  const baseYear = baseDate.getFullYear();
  const today = new Date(baseYear, baseDate.getMonth(), baseDate.getDate());
  const oneDayMs = 1000 * 60 * 60 * 24;

  // Candidate years: current year first, then next year, then previous year
  const candidateYears = [baseYear, baseYear + 1, baseYear - 1];
  let bestYear = baseYear;
  let found = false;

  for (const candYear of candidateYears) {
    const candDate = new Date(candYear, month - 1, day);
    if (candDate.getMonth() !== month - 1 || candDate.getDate() !== day) {
      continue;
    }

    const diffDays = Math.round((candDate.getTime() - today.getTime()) / oneDayMs);
    // Window: [-overdueToleranceDays, +(365 - overdueToleranceDays))
    if (diffDays >= -overdueToleranceDays && diffDays < 365 - overdueToleranceDays) {
      bestYear = candYear;
      found = true;
      break;
    }
  }

  if (!found) {
    const fallbackDate = new Date(baseYear, month - 1, day);
    if (fallbackDate.getMonth() !== month - 1 || fallbackDate.getDate() !== day) {
      return null;
    }
    bestYear = baseYear;
  }

  const finalDate = new Date(bestYear, month - 1, day);
  return {
    year: bestYear,
    month,
    day,
    date: finalDate,
  };
};

/**
 * Determine the status of a due date string (e.g. "10/20", "2026/10/20", "2026-10-20").
 * Returns:
 * - 'overdue': Date is strictly before today (based on local date 00:00:00)
 * - 'today': Date is today
 * - 'future': Date is strictly after today
 * - 'none': Invalid or empty date string
 */
export const checkDueDateStatus = (
  dueDateStr: string,
  baseDate: Date = new Date()
): DueDateStatus => {
  const resolved = resolveDueDate(dueDateStr, baseDate);
  if (!resolved) return 'none';

  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const targetTime = resolved.date.getTime();
  const todayTime = today.getTime();

  if (targetTime < todayTime) {
    return 'overdue';
  } else if (targetTime === todayTime) {
    return 'today';
  } else {
    return 'future';
  }
};

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
