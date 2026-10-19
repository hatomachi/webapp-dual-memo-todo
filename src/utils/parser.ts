import { TaskItem, PaneType, FormattedLine } from '../types/todo';

/**
 * Generate a short random ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
};

// Date regex matching #MM/DD, #M/D, #YYYY/MM/DD, #YYYY-MM-DD
const DUE_DATE_REGEX = /#(?:(\d{4}[-/])?\d{1,2}[-/]\d{1,2})/;
// Theme tag matching [ThemeName]
const THEME_TAG_REGEX = /\[([^\[\]]+)\]/;
// Category tag matching !categoryName (letters, numbers, underscores, Japanese, etc.)
const CATEGORY_TAG_REGEX = /!([^\s\[\]#]+)/;

/**
 * Check if a line is an indented comment line (starts with 2+ spaces or a tab)
 */
export const isCommentLine = (line: string): boolean => {
  return /^(?: {2,}|\t+)/.test(line);
};

/**
 * Check if a line is empty or whitespace only
 */
export const isEmptyLine = (line: string): boolean => {
  return line.trim() === '';
};

/**
 * Check if a line is a Category section header (!name)
 */
export const isCategoryHeader = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('!') && !isCommentLine(line) && /^![^\s\[\]#]+$/.test(trimmed);
};

/**
 * Check if a line is a Theme section header ([name])
 */
export const isThemeHeader = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']') && !isCommentLine(line) && /^\[[^\[\]]+\]$/.test(trimmed);
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

    // Check for Category Section Header: !name
    const trimmed = rawLine.trim();
    if (isCategoryHeader(rawLine)) {
      currentCategory = trimmed.substring(1).trim() || 'inbox';
      currentTask = null;
      continue;
    }

    // Check for Comment Line (indented under current task)
    if (isCommentLine(rawLine)) {
      if (currentTask) {
        // Strip leading indentation (spaces or tabs)
        const commentText = rawLine.replace(/^(?: {2,}|\t+)/, '');
        currentTask.comments.push(commentText);
      }
      continue;
    }

    // Otherwise, this is a Task Line!
    let lineWorking = trimmed;

    // Extract Theme Tag: [Theme]
    let theme = 'Uncategorized';
    const themeMatch = lineWorking.match(THEME_TAG_REGEX);
    if (themeMatch) {
      theme = themeMatch[1].trim();
      lineWorking = lineWorking.replace(themeMatch[0], ' ');
    }

    // Extract Due Date Tag: #10/25
    let dueDate: string | null = null;
    const dueDateMatch = lineWorking.match(DUE_DATE_REGEX);
    if (dueDateMatch) {
      dueDate = dueDateMatch[0].substring(1).trim(); // remove '#'
      lineWorking = lineWorking.replace(dueDateMatch[0], ' ');
    }

    // Also strip accidental category tags if typed in the line
    const catMatch = lineWorking.match(CATEGORY_TAG_REGEX);
    if (catMatch) {
      lineWorking = lineWorking.replace(catMatch[0], ' ');
    }

    const title = lineWorking.replace(/\s+/g, ' ').trim();
    if (!title) {
      continue;
    }

    // Try to match existing task by title and category/theme to preserve ID
    const matchedExisting = existingTasks.find(
      (t) => t.title === title && t.category === currentCategory
    );

    currentTask = {
      id: matchedExisting ? matchedExisting.id : generateId(),
      title,
      category: currentCategory,
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

    // Check for Theme Section Header: [Theme]
    const trimmed = rawLine.trim();
    if (isThemeHeader(rawLine)) {
      currentTheme = trimmed.slice(1, -1).trim() || 'Uncategorized';
      currentTask = null;
      continue;
    }

    // Check for Comment Line
    if (isCommentLine(rawLine)) {
      if (currentTask) {
        const commentText = rawLine.replace(/^(?: {2,}|\t+)/, '');
        currentTask.comments.push(commentText);
      }
      continue;
    }

    // Task Line
    let lineWorking = trimmed;

    // Extract Category Tag: !Category
    let category = 'inbox';
    const catMatch = lineWorking.match(CATEGORY_TAG_REGEX);
    if (catMatch) {
      category = catMatch[1].trim();
      lineWorking = lineWorking.replace(catMatch[0], ' ');
    }

    // Extract Due Date Tag: #10/25
    let dueDate: string | null = null;
    const dueDateMatch = lineWorking.match(DUE_DATE_REGEX);
    if (dueDateMatch) {
      dueDate = dueDateMatch[0].substring(1).trim();
      lineWorking = lineWorking.replace(dueDateMatch[0], ' ');
    }

    // Strip accidental theme tag if typed
    const themeMatch = lineWorking.match(THEME_TAG_REGEX);
    if (themeMatch) {
      lineWorking = lineWorking.replace(themeMatch[0], ' ');
    }

    const title = lineWorking.replace(/\s+/g, ' ').trim();
    if (!title) {
      continue;
    }

    const matchedExisting = existingTasks.find(
      (t) => t.title === title && t.theme === currentTheme
    );

    currentTask = {
      id: matchedExisting ? matchedExisting.id : generateId(),
      title,
      category,
      theme: currentTheme,
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
  // Collect all unique categories, keeping 'inbox' first
  const categorySet = new Set<string>();
  categorySet.add('inbox');
  tasks.forEach((t) => categorySet.add(t.category || 'inbox'));
  const categories = Array.from(categorySet);

  const sections: string[] = [];

  for (const cat of categories) {
    const catTasks = tasks.filter((t) => (t.category || 'inbox') === cat);
    if (catTasks.length === 0 && cat !== 'inbox') {
      // Omit empty non-inbox sections unless desired
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
  // Collect all unique themes, keeping 'Uncategorized' at the beginning (or end)
  const themeSet = new Set<string>();
  tasks.forEach((t) => themeSet.add(t.theme || 'Uncategorized'));
  if (themeSet.size === 0) {
    themeSet.add('Uncategorized');
  }

  // Put non-Uncategorized themes first, then Uncategorized (or vice versa)
  const nonUncat = Array.from(themeSet).filter((t) => t !== 'Uncategorized');
  nonUncat.sort((a, b) => a.localeCompare(b, 'ja'));
  const themes = [...nonUncat];
  if (themeSet.has('Uncategorized')) {
    themes.push('Uncategorized');
  }

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
 * Returns negative if d1 < d2, positive if d1 > d2, 0 if equal
 */
export const compareDueDates = (d1: string | null, d2: string | null): number => {
  if (!d1 && !d2) return 0;
  if (!d1) return 1; // Tasks without date go to the bottom
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

  const t1 = parseToTimestamp(d1);
  const t2 = parseToTimestamp(d2);

  return t1 - t2;
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

/**
 * Parse lines for rendering syntax-highlighted decoration view
 */
export const analyzeLines = (text: string, paneType: PaneType): FormattedLine[] => {
  const lines = text.split('\n');
  return lines.map((line) => {
    if (isEmptyLine(line)) {
      return { text: line, type: 'empty' };
    }

    if (paneType === 'category' && isCategoryHeader(line)) {
      return {
        text: line,
        type: 'section',
        sectionName: line.trim().substring(1),
      };
    }

    if (paneType === 'theme' && isThemeHeader(line)) {
      return {
        text: line,
        type: 'section',
        sectionName: line.trim().slice(1, -1),
      };
    }

    if (isCommentLine(line)) {
      const indentMatch = line.match(/^(?: {2,}|\t+)/);
      const indentCount = indentMatch ? indentMatch[0].length : 2;
      return {
        text: line,
        type: 'comment',
        indentCount,
      };
    }

    // Task line
    let catTag: string | undefined;
    let themeTag: string | undefined;
    let dueTag: string | undefined;

    const catMatch = line.match(CATEGORY_TAG_REGEX);
    if (catMatch) catTag = catMatch[0];

    const themeMatch = line.match(THEME_TAG_REGEX);
    if (themeMatch) themeTag = themeMatch[0];

    const dueMatch = line.match(DUE_DATE_REGEX);
    if (dueMatch) dueTag = dueMatch[0];

    return {
      text: line,
      type: 'task',
      categoryTag: catTag,
      themeTag: themeMatch ? themeTag : undefined,
      dueDateTag: dueTag,
    };
  });
};
