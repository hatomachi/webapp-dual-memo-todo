import { TaskItem, PaneType } from '../types/todo';

/**
 * Generate a short random ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
};

// Date regex matching #MM/DD, #M/D, #YYYY/MM/DD, #YYYY-MM-DD (also full-width ＃)
const DUE_DATE_REGEX = /[#＃](?:(\d{4}[-/])?\d{1,2}[-/]\d{1,2})/;
// Theme tag matching [ThemeName] or ［ThemeName］
const THEME_TAG_REGEX = /[\[［]([^\[\]［］]+)[\]］]/;
// Category tag matching !categoryName or ！categoryName
const CATEGORY_TAG_REGEX = /(?:^|\s)[!！]([^\s\[\]［］#＃!！]+)/;

/**
 * Check if a line is an indented comment line.
 * Supports 1+ half-width spaces, full-width spaces (　), or tabs at the start of the line.
 */
export const isCommentLine = (line: string): boolean => {
  if (line.trim() === '') return false;
  return /^[ \t\u3000]+/.test(line);
};

/**
 * Check if a line is empty or whitespace only
 */
export const isEmptyLine = (line: string): boolean => {
  return line.trim() === '';
};

/**
 * Check if a line is a Category section header (!name)
 * Must not be indented.
 */
export const isCategoryHeader = (line: string): boolean => {
  if (isCommentLine(line) || isEmptyLine(line)) return false;
  return /^[!！].+/.test(line);
};

/**
 * Check if a line is a Theme section header ([name])
 * Must not be indented, starts with [ and ends with ].
 */
export const isThemeHeader = (line: string): boolean => {
  if (isCommentLine(line) || isEmptyLine(line)) return false;
  const trimmed = line.trim();
  return /^[\[［][^\[\]［］]+[\]］]$/.test(trimmed);
};

/**
 * Check if a line is any section header (!name or [name]) for visual highlighting
 */
export const isSectionHeader = (line: string, paneType: PaneType): boolean => {
  if (paneType === 'category') {
    return isCategoryHeader(line);
  } else {
    return isThemeHeader(line);
  }
};

/**
 * Parse text from the Left Pane (Category-oriented) into TaskItems.
 * Section headers: !categoryName (default: !inbox)
 * Inline tags on task lines: [themeName], #dueDate
 */
export const parseCategoryText = (
  text: string,
  existingTasks: TaskItem[] = []
): TaskItem[] => {
  const lines = text.split('\n');
  const tasks: TaskItem[] = [];

  let currentCategory = 'inbox';
  let currentTask: TaskItem | null = null;
  let orderCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    if (isEmptyLine(rawLine)) {
      continue;
    }

    // 1. Check for Category Section Header: !name
    if (isCategoryHeader(rawLine)) {
      currentCategory = rawLine.trim().replace(/^[!！]/, '').trim() || 'inbox';
      currentTask = null;
      continue;
    }

    // 2. Check for Comment Line (indented with half-width space, full-width space, or tab)
    if (isCommentLine(rawLine)) {
      if (currentTask) {
        const commentText = rawLine.replace(/^[ \t\u3000]+/, '');
        currentTask.comments.push(commentText);
      }
      continue;
    }

    // 3. Otherwise, this is a Task Line
    let lineWorking = rawLine.trim();

    // Extract Theme Tag: [Theme]
    let theme = 'Uncategorized';
    const themeMatch = lineWorking.match(THEME_TAG_REGEX);
    if (themeMatch) {
      theme = themeMatch[1].trim() || 'Uncategorized';
      lineWorking = lineWorking.replace(themeMatch[0], ' ');
    }

    // Extract Due Date Tag: #10/25
    let dueDate: string | null = null;
    const dueDateMatch = lineWorking.match(DUE_DATE_REGEX);
    if (dueDateMatch) {
      dueDate = dueDateMatch[0].replace(/^[#＃]/, '').trim();
      lineWorking = lineWorking.replace(dueDateMatch[0], ' ');
    }

    // If an inline !category tag is explicitly written on the task line, let it override currentCategory
    let taskCategory = currentCategory;
    const catMatch = lineWorking.match(CATEGORY_TAG_REGEX);
    if (catMatch) {
      taskCategory = catMatch[1].trim() || currentCategory;
      lineWorking = lineWorking.replace(catMatch[0], ' ');
    }

    const title = lineWorking.replace(/\s+/g, ' ').trim();
    if (!title) {
      continue;
    }

    const matchedExisting = existingTasks.find(
      (t) => t.title === title && t.category === taskCategory
    );

    currentTask = {
      id: matchedExisting ? matchedExisting.id : generateId(),
      title,
      category: taskCategory,
      theme,
      dueDate,
      comments: [],
      order: orderCounter++,
    };

    tasks.push(currentTask);
  }

  return tasks;
};

/**
 * Parse text from the Right Pane (Theme-oriented) into TaskItems.
 * Section headers: [themeName] (default: [Uncategorized])
 * Inline tags on task lines: !categoryName, #dueDate
 */
export const parseThemeText = (
  text: string,
  existingTasks: TaskItem[] = []
): TaskItem[] => {
  const lines = text.split('\n');
  const tasks: TaskItem[] = [];

  let currentTheme = 'Uncategorized';
  let currentTask: TaskItem | null = null;
  let orderCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    if (isEmptyLine(rawLine)) {
      continue;
    }

    // 1. Check for Theme Section Header: [Theme]
    if (isThemeHeader(rawLine)) {
      const trimmed = rawLine.trim();
      currentTheme = trimmed.slice(1, -1).trim() || 'Uncategorized';
      currentTask = null;
      continue;
    }

    // 2. Check for Comment Line
    if (isCommentLine(rawLine)) {
      if (currentTask) {
        const commentText = rawLine.replace(/^[ \t\u3000]+/, '');
        currentTask.comments.push(commentText);
      }
      continue;
    }

    // 3. Task Line
    let lineWorking = rawLine.trim();

    // Extract Category Tag: !Category
    let category = 'inbox';
    const catMatch = lineWorking.match(CATEGORY_TAG_REGEX);
    if (catMatch) {
      category = catMatch[1].trim() || 'inbox';
      lineWorking = lineWorking.replace(catMatch[0], ' ');
    }

    // Extract Due Date Tag: #10/25
    let dueDate: string | null = null;
    const dueDateMatch = lineWorking.match(DUE_DATE_REGEX);
    if (dueDateMatch) {
      dueDate = dueDateMatch[0].replace(/^[#＃]/, '').trim();
      lineWorking = lineWorking.replace(dueDateMatch[0], ' ');
    }

    // If an inline [Theme] tag is explicitly written on the task line in right pane, let it override currentTheme
    let taskTheme = currentTheme;
    const themeMatch = lineWorking.match(THEME_TAG_REGEX);
    if (themeMatch) {
      taskTheme = themeMatch[1].trim() || currentTheme;
      lineWorking = lineWorking.replace(themeMatch[0], ' ');
    }

    const title = lineWorking.replace(/\s+/g, ' ').trim();
    if (!title) {
      continue;
    }

    const matchedExisting = existingTasks.find(
      (t) => t.title === title && t.theme === taskTheme
    );

    currentTask = {
      id: matchedExisting ? matchedExisting.id : generateId(),
      title,
      category,
      theme: taskTheme,
      dueDate,
      comments: [],
      order: orderCounter++,
    };

    tasks.push(currentTask);
  }

  return tasks;
};

/**
 * Format TaskItems to Category Text (Left Pane format)
 */
export const formatTasksToCategoryText = (tasks: TaskItem[]): string => {
  const categorySet = new Set<string>();
  categorySet.add('inbox');
  tasks.forEach((t) => categorySet.add(t.category || 'inbox'));
  const categories = Array.from(categorySet);

  const sections: string[] = [];

  for (const cat of categories) {
    const catTasks = tasks.filter((t) => (t.category || 'inbox') === cat);
    if (catTasks.length === 0 && cat !== 'inbox') {
      continue;
    }

    const lines: string[] = [`!${cat}`];

    for (const task of catTasks) {
      let taskLine = task.title;
      if (task.dueDate) {
        taskLine += ` #${task.dueDate}`;
      }
      if (task.theme && task.theme !== 'Uncategorized') {
        taskLine += ` [${task.theme}]`;
      }
      lines.push(taskLine);

      for (const comment of task.comments) {
        lines.push(`  ${comment}`);
      }
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
};

/**
 * Format TaskItems to Theme Text (Right Pane format)
 */
export const formatTasksToThemeText = (tasks: TaskItem[]): string => {
  const themeSet = new Set<string>();
  themeSet.add('Uncategorized');
  tasks.forEach((t) => themeSet.add(t.theme || 'Uncategorized'));

  // Keep Uncategorized first (just like !inbox on the left), followed by themes in order of appearance
  const themes = Array.from(themeSet);

  const sections: string[] = [];

  for (const theme of themes) {
    const themeTasks = tasks.filter((t) => (t.theme || 'Uncategorized') === theme);
    if (themeTasks.length === 0 && theme !== 'Uncategorized') {
      continue;
    }

    const lines: string[] = [`[${theme}]`];

    for (const task of themeTasks) {
      let taskLine = task.title;
      if (task.dueDate) {
        taskLine += ` #${task.dueDate}`;
      }
      if (task.category && task.category !== 'inbox') {
        taskLine += ` !${task.category}`;
      }
      lines.push(taskLine);

      for (const comment of task.comments) {
        lines.push(`  ${comment}`);
      }
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
};

/**
 * Compare two due dates in format MM/DD, YYYY/MM/DD, etc.
 */
export const compareDueDates = (d1: string | null, d2: string | null): number => {
  if (!d1 && !d2) return 0;
  if (!d1) return 1;
  if (!d2) return -1;

  const parseToTimestamp = (dStr: string): number => {
    const parts = dStr.replace(/-/g, '/').split('/');
    const currentYear = new Date().getFullYear();

    let y = currentYear;
    let m = 1;
    let d = 1;

    if (parts.length === 3) {
      y = parseInt(parts[0], 10) || currentYear;
      m = parseInt(parts[1], 10) || 1;
      d = parseInt(parts[2], 10) || 1;
    } else if (parts.length === 2) {
      m = parseInt(parts[0], 10) || 1;
      d = parseInt(parts[1], 10) || 1;
    }

    return new Date(y, m - 1, d).getTime();
  };

  return parseToTimestamp(d1) - parseToTimestamp(d2);
};

/**
 * Sort tasks within each section by due date ascending
 */
export const sortTasksByDueDate = (tasks: TaskItem[], primaryAxis: PaneType): TaskItem[] => {
  const groups: { [key: string]: TaskItem[] } = {};

  tasks.forEach((t) => {
    const groupKey = primaryAxis === 'category' ? t.category || 'inbox' : t.theme || 'Uncategorized';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(t);
  });

  const sortedTasks: TaskItem[] = [];

  for (const key of Object.keys(groups)) {
    const list = groups[key];
    list.sort((a, b) => {
      const dateCmp = compareDueDates(a.dueDate, b.dueDate);
      if (dateCmp !== 0) return dateCmp;
      return a.order - b.order;
    });
    sortedTasks.push(...list);
  }

  return sortedTasks;
};
