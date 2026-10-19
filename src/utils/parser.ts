import { TaskItem, PaneType, SectionItem } from '../types/todo';

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
 * Organize section names hierarchically.
 * - Root sections appear in their first-encountered order.
 * - Child sections (delimited by ':') appear immediately under their parent.
 * - Children under the same parent maintain their relative order.
 * - The defaultSection ('inbox' or 'Uncategorized') is placed at the very bottom.
 */
export const organizeSections = (sections: string[], defaultSection: string): string[] => {
  const defaultLower = defaultSection.toLowerCase();

  // Deduplicate preserving case of first occurrence
  const seen = new Set<string>();
  const uniqueList: string[] = [];
  for (const s of sections) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueList.push(trimmed);
    }
  }

  // Filter out defaultSection so it can be appended at the end
  const nonDefaults = uniqueList.filter((s) => s.toLowerCase() !== defaultLower);

  // Map root section names to their first encountered index
  const rootOrder = new Map<string, number>();
  let rootIndex = 0;
  for (const s of nonDefaults) {
    const root = s.split(':')[0].trim().toLowerCase();
    if (!rootOrder.has(root)) {
      rootOrder.set(root, rootIndex++);
    }
  }

  // Preserve relative appearance order
  const origIndexMap = new Map<string, number>();
  nonDefaults.forEach((s, idx) => origIndexMap.set(s, idx));

  nonDefaults.sort((a, b) => {
    const partsA = a.split(':').map((p) => p.trim());
    const partsB = b.split(':').map((p) => p.trim());
    const rootA = partsA[0].toLowerCase();
    const rootB = partsB[0].toLowerCase();

    // 1. Group by root order
    const orderA = rootOrder.get(rootA) ?? 9999;
    const orderB = rootOrder.get(rootB) ?? 9999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 2. Both belong to same root
    const minLen = Math.min(partsA.length, partsB.length);
    for (let i = 0; i < minLen; i++) {
      if (partsA[i].toLowerCase() !== partsB[i].toLowerCase()) {
        return (origIndexMap.get(a) ?? 0) - (origIndexMap.get(b) ?? 0);
      }
    }

    // Shorter path (parent) comes first before longer path (child)
    if (partsA.length !== partsB.length) {
      return partsA.length - partsB.length;
    }

    return (origIndexMap.get(a) ?? 0) - (origIndexMap.get(b) ?? 0);
  });

  // Always put the defaultSection at the very bottom
  return [...nonDefaults, defaultSection];
};

/**
 * Format TaskItems to Category Text (Left Pane format)
 * Default (!inbox) is placed at the bottom.
 * Preserves customCategories ordering and outputs empty sections if explicitly defined.
 */
export const formatTasksToCategoryText = (
  tasks: TaskItem[],
  customCategories?: string[]
): string => {
  const categoryList: string[] = [...(customCategories || [])];
  tasks.forEach((t) => {
    if (t.category) categoryList.push(t.category);
  });

  const orderedCategories = organizeSections(categoryList, 'inbox');
  const sections: string[] = [];

  for (const cat of orderedCategories) {
    const catTasks = tasks.filter((t) => (t.category || 'inbox').toLowerCase() === cat.toLowerCase());
    const isExplicit = customCategories && customCategories.some((c) => c.toLowerCase() === cat.toLowerCase());
    // Output if there are tasks, or if explicitly declared in customCategories, or if default 'inbox'
    if (catTasks.length === 0 && !isExplicit && cat.toLowerCase() !== 'inbox') {
      continue;
    }

    const lines: string[] = [`!${cat}`];

    for (const task of catTasks) {
      let taskLine = task.title;
      if (task.dueDate) {
        taskLine += ` #${task.dueDate}`;
      }
      if (task.theme && task.theme.toLowerCase() !== 'uncategorized') {
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
 * Default ([Uncategorized]) is placed at the bottom.
 * Preserves customThemes ordering and outputs empty sections if explicitly defined.
 */
export const formatTasksToThemeText = (
  tasks: TaskItem[],
  customThemes?: string[]
): string => {
  const themeList: string[] = [...(customThemes || [])];
  tasks.forEach((t) => {
    if (t.theme) themeList.push(t.theme);
  });

  const orderedThemes = organizeSections(themeList, 'Uncategorized');
  const sections: string[] = [];

  for (const theme of orderedThemes) {
    const themeTasks = tasks.filter((t) => (t.theme || 'Uncategorized').toLowerCase() === theme.toLowerCase());
    const isExplicit = customThemes && customThemes.some((th) => th.toLowerCase() === theme.toLowerCase());
    // Output if there are tasks, or if explicitly declared in customThemes, or if default 'Uncategorized'
    if (themeTasks.length === 0 && !isExplicit && theme.toLowerCase() !== 'uncategorized') {
      continue;
    }

    const lines: string[] = [`[${theme}]`];

    for (const task of themeTasks) {
      let taskLine = task.title;
      if (task.dueDate) {
        taskLine += ` #${task.dueDate}`;
      }
      if (task.category && task.category.toLowerCase() !== 'inbox') {
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
 * Extract distinct category section headers from text in appearance order.
 */
export const extractCategorySections = (text: string): string[] => {
  const sections = extractSectionsFromText(text, 'category');
  return organizeSections(sections.map((s) => s.raw), 'inbox');
};

/**
 * Extract distinct theme section headers from text in appearance order.
 */
export const extractThemeSections = (text: string): string[] => {
  const sections = extractSectionsFromText(text, 'theme');
  return organizeSections(sections.map((s) => s.raw), 'Uncategorized');
};

/**
 * Extract hierarchical section headers from text with position and depth info.
 */
export const extractSectionsFromText = (
  text: string,
  paneType: PaneType
): SectionItem[] => {
  const lines = text.split('\n');
  const sections: SectionItem[] = [];
  const defaultName = paneType === 'category' ? 'inbox' : 'Uncategorized';
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeader = isSectionHeader(line, paneType);

    if (isHeader) {
      let rawName = '';
      if (paneType === 'category') {
        rawName = line.trim().replace(/^[!！]/, '').trim();
      } else {
        rawName = line.trim().replace(/^[\[［]/, '').replace(/[\]］]$/, '').trim();
      }

      if (rawName) {
        const parts = rawName.split(':').map((p) => p.trim());
        const depth = Math.max(0, parts.length - 1);
        const displayName = parts[parts.length - 1] || rawName;
        const isDefault = rawName.toLowerCase() === defaultName.toLowerCase();

        sections.push({
          raw: rawName,
          displayName,
          depth,
          lineIndex: i,
          charIndex: charOffset,
          isDefault,
        });
      }
    }

    charOffset += line.length + 1; // +1 for '\n'
  }

  return sections;
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
