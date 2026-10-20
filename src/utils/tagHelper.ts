import { DUE_DATE_REGEX, isCommentLine, isCategoryHeader, isThemeHeader, isEmptyLine } from './parser';
import { getQuickDateSuggestions } from './dateHelper';

export type InlineTagType = 'date' | 'theme' | 'category';

export interface InlineTagInfo {
  type: InlineTagType;
  raw: string; // e.g. "#10/25", "[APIGW:設計]", "!ワーク:開発"
  value: string; // e.g. "10/25", "APIGW:設計", "ワーク:開発"
  parts: string[]; // e.g. ["10/25"], ["APIGW", "設計"], ["ワーク", "開発"]
  startIndex: number; // 0-indexed start in line
  endIndex: number; // 0-indexed end in line (exclusive)
}

export interface LineToken {
  text: string;
  tag?: InlineTagInfo;
}

// Regex for Theme tag: [Theme] or ［Theme］
export const THEME_TAG_REGEX_GLOBAL = /[\[［]([^\[\]［］\n]+)[\]］]/g;

// Regex for Category tag: !category or ！category (not followed by space or brackets)
export const CATEGORY_TAG_REGEX_GLOBAL = /(?:^|\s)([!！]([^\s\[\]［］#＃!！\n]+))/g;

/**
 * Parse all inline tags (#date, [theme], !category) from a single line.
 * Skips comment lines, section headers, and empty lines.
 */
export const parseLineInlineTags = (line: string): InlineTagInfo[] => {
  if (isEmptyLine(line) || isCommentLine(line) || isCategoryHeader(line) || isThemeHeader(line)) {
    return [];
  }

  const tags: InlineTagInfo[] = [];

  // 1. Due date tag: #MM/DD
  const dateMatch = line.match(DUE_DATE_REGEX);
  if (dateMatch && dateMatch.index !== undefined) {
    const raw = dateMatch[0];
    const value = raw.replace(/^[#＃]/, '').trim();
    tags.push({
      type: 'date',
      raw,
      value,
      parts: [value],
      startIndex: dateMatch.index,
      endIndex: dateMatch.index + raw.length,
    });
  }

  // 2. Theme tags: [Theme]
  const themeRegex = new RegExp(THEME_TAG_REGEX_GLOBAL.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = themeRegex.exec(line)) !== null) {
    const raw = match[0];
    const value = match[1].trim();
    const parts = value.split(':').map((p) => p.trim());
    tags.push({
      type: 'theme',
      raw,
      value,
      parts,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // 3. Category tags: !category (inline)
  const catRegex = new RegExp(CATEGORY_TAG_REGEX_GLOBAL.source, 'g');
  while ((match = catRegex.exec(line)) !== null) {
    const fullMatch = match[0];
    const rawTag = match[1]; // "!category"
    const value = match[2].trim();
    const tagStartIndex = match.index + (fullMatch.length - rawTag.length);
    const parts = value.split(':').map((p) => p.trim());

    // Avoid overlapping with existing tags
    const overlaps = tags.some(
      (t) =>
        (tagStartIndex >= t.startIndex && tagStartIndex < t.endIndex) ||
        (tagStartIndex + rawTag.length > t.startIndex && tagStartIndex + rawTag.length <= t.endIndex)
    );

    if (!overlaps) {
      tags.push({
        type: 'category',
        raw: rawTag,
        value,
        parts,
        startIndex: tagStartIndex,
        endIndex: tagStartIndex + rawTag.length,
      });
    }
  }

  // Sort by appearance in line
  tags.sort((a, b) => a.startIndex - b.startIndex);

  return tags;
};

/**
 * Split a task line into tokens (text segments and tags) for Backdrop rendering.
 */
export const splitLineIntoTokens = (line: string): LineToken[] => {
  const tags = parseLineInlineTags(line);
  if (tags.length === 0) {
    return [{ text: line || '\u200B' }];
  }

  const tokens: LineToken[] = [];
  let currentIndex = 0;

  for (const tag of tags) {
    if (tag.startIndex > currentIndex) {
      tokens.push({
        text: line.substring(currentIndex, tag.startIndex),
      });
    }

    tokens.push({
      text: line.substring(tag.startIndex, tag.endIndex),
      tag,
    });

    currentIndex = tag.endIndex;
  }

  if (currentIndex < line.length) {
    tokens.push({
      text: line.substring(currentIndex),
    });
  }

  return tokens;
};

/**
 * Remove an inline tag from a line, cleaning up redundant surrounding whitespace.
 */
export const removeTagFromLine = (line: string, tag: InlineTagInfo): string => {
  const before = line.substring(0, tag.startIndex);
  const after = line.substring(tag.endIndex);

  // Clean trailing spaces in before, or leading spaces in after
  const cleanedBefore = before.replace(/\s+$/, '');
  const cleanedAfter = after.replace(/^\s+/, '');

  if (cleanedBefore && cleanedAfter) {
    return `${cleanedBefore} ${cleanedAfter}`;
  }
  return cleanedBefore || cleanedAfter;
};

/**
 * Replace an inline tag in a line with a new tag string.
 */
export const replaceTagInLine = (
  line: string,
  oldTag: InlineTagInfo,
  newRawTag: string
): string => {
  const before = line.substring(0, oldTag.startIndex);
  const after = line.substring(oldTag.endIndex);
  return `${before}${newRawTag}${after}`;
};

export type SuggestionType = 'category' | 'theme' | 'date';

export interface SuggestionTrigger {
  type: SuggestionType;
  query: string;
  triggerChar: string;
  replaceStart: number;
  replaceEnd: number;
}

/**
 * Detect if the cursor is currently in a position where a suggestion palette should open.
 * e.g. after '!', '[', or '#' on the current line.
 */
export const detectSuggestionTrigger = (
  line: string,
  col: number
): SuggestionTrigger | null => {
  if (col <= 0 || isCommentLine(line) || isCategoryHeader(line) || isThemeHeader(line)) {
    return null;
  }

  const textBeforeCursor = line.substring(0, col);

  // Check for category trigger: !word or ！word
  const lastExcl = Math.max(
    textBeforeCursor.lastIndexOf('!'),
    textBeforeCursor.lastIndexOf('！')
  );

  // Check for theme trigger: [word or ［word
  const lastBracket = Math.max(
    textBeforeCursor.lastIndexOf('['),
    textBeforeCursor.lastIndexOf('［')
  );

  // Check for date trigger: #word or ＃word
  const lastHash = Math.max(
    textBeforeCursor.lastIndexOf('#'),
    textBeforeCursor.lastIndexOf('＃')
  );

  // Find the closest trigger character to the cursor
  const maxTriggerIdx = Math.max(lastBracket, lastExcl, lastHash);
  if (maxTriggerIdx === -1) {
    return null;
  }

  // 1. Theme trigger: [
  if (maxTriggerIdx === lastBracket) {
    const afterBracket = textBeforeCursor.substring(lastBracket + 1);
    if (!afterBracket.includes(']') && !afterBracket.includes('］') && !afterBracket.includes('\n')) {
      return {
        type: 'theme',
        query: afterBracket,
        triggerChar: textBeforeCursor[lastBracket],
        replaceStart: lastBracket,
        replaceEnd: col,
      };
    }
  }

  // 2. Category trigger: !
  if (maxTriggerIdx === lastExcl) {
    const charBeforeExcl = lastExcl > 0 ? textBeforeCursor[lastExcl - 1] : ' ';
    if (charBeforeExcl === ' ' || charBeforeExcl === '　' || lastExcl === 0) {
      const afterExcl = textBeforeCursor.substring(lastExcl + 1);
      if (!afterExcl.includes(' ') && !afterExcl.includes('　') && !afterExcl.includes('\n')) {
        return {
          type: 'category',
          query: afterExcl,
          triggerChar: textBeforeCursor[lastExcl],
          replaceStart: lastExcl,
          replaceEnd: col,
        };
      }
    }
  }

  // 3. Date trigger: #
  if (maxTriggerIdx === lastHash) {
    const charBeforeHash = lastHash > 0 ? textBeforeCursor[lastHash - 1] : ' ';
    if (charBeforeHash === ' ' || charBeforeHash === '　' || lastHash === 0) {
      const afterHash = textBeforeCursor.substring(lastHash + 1);
      // Valid date query doesn't contain spaces, line breaks, brackets, or other tag chars
      if (
        !afterHash.includes(' ') &&
        !afterHash.includes('　') &&
        !afterHash.includes('\n') &&
        !afterHash.includes('[') &&
        !afterHash.includes(']') &&
        !afterHash.includes('!')
      ) {
        return {
          type: 'date',
          query: afterHash,
          triggerChar: textBeforeCursor[lastHash],
          replaceStart: lastHash,
          replaceEnd: col,
        };
      }
    }
  }

  return null;
};

export interface HierarchicalOption {
  raw: string; // e.g. "ワーク:開発"
  displayName: string; // e.g. "開発"
  parent?: string; // e.g. "ワーク"
  depth: number;
  hasChildren: boolean;
}

/**
 * Extract and organize all unique categories and themes with hierarchy info.
 */
export const extractHierarchicalOptions = (
  items: string[],
  defaultItem: string
): HierarchicalOption[] => {
  const seen = new Set<string>();
  const uniqueItems: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueItems.push(trimmed);
    }
  }

  // Ensure default is present
  if (!seen.has(defaultItem.toLowerCase())) {
    uniqueItems.push(defaultItem);
  }

  // Check which items act as parents
  const parents = new Set<string>();
  uniqueItems.forEach((item) => {
    const parts = item.split(':').map((p) => p.trim());
    if (parts.length > 1) {
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}:${parts[i]}` : parts[i];
        parents.add(currentPath.toLowerCase());
      }
    }
  });

  return uniqueItems.map((raw) => {
    const parts = raw.split(':').map((p) => p.trim());
    const depth = parts.length - 1;
    const displayName = parts[parts.length - 1] || raw;
    const parent = depth > 0 ? parts.slice(0, -1).join(':') : undefined;
    const hasChildren = parents.has(raw.toLowerCase());

    return {
      raw,
      displayName,
      parent,
      depth,
      hasChildren,
    };
  });
};

export interface UnifiedSuggestItem {
  id: string;
  type: 'category' | 'theme' | 'date' | 'calendar' | 'create';
  raw: string;
  primaryLabel: string;
  secondaryLabel?: string;
  isAction?: boolean;
}

/**
 * Generate unified suggestions for inline popover or quick palettes
 */
export const getUnifiedSuggestItems = (
  trigger: SuggestionTrigger,
  categoryOptions: HierarchicalOption[],
  themeOptions: HierarchicalOption[]
): UnifiedSuggestItem[] => {
  const trimmedQuery = trigger.query.trim();
  const lowerQuery = trimmedQuery.toLowerCase();

  // 1. DATE trigger (#)
  if (trigger.type === 'date') {
    const dateSuggestions = getQuickDateSuggestions();
    const list: UnifiedSuggestItem[] = [];

    // Calendar Modal Action item
    list.push({
      id: 'action-calendar',
      type: 'calendar',
      raw: '',
      primaryLabel: 'カレンダーから選択...',
      secondaryLabel: '日付ピッカーを開く',
      isAction: true,
    });

    // Filter and map date suggestions
    for (const ds of dateSuggestions) {
      if (
        !lowerQuery ||
        ds.label.toLowerCase().includes(lowerQuery) ||
        ds.dateStr.includes(lowerQuery) ||
        ds.subLabel.includes(lowerQuery)
      ) {
        list.push({
          id: `date-${ds.id}`,
          type: 'date',
          raw: ds.dateStr,
          primaryLabel: ds.label,
          secondaryLabel: `#${ds.subLabel}`,
        });
      }
    }

    // If user typed custom digits like "11/05" or "12"
    if (trimmedQuery && /^\d{1,2}(\/\d{1,2})?$/.test(trimmedQuery)) {
      const isAlreadyInList = list.some((i) => i.raw === trimmedQuery);
      if (!isAlreadyInList) {
        list.push({
          id: `date-custom-${trimmedQuery}`,
          type: 'date',
          raw: trimmedQuery,
          primaryLabel: `#${trimmedQuery}`,
          secondaryLabel: '入力した日付',
        });
      }
    }

    return list;
  }

  // 2. THEME ([) or CATEGORY (!) trigger
  const rawOptions = trigger.type === 'category' ? categoryOptions : themeOptions;

  let filtered: HierarchicalOption[] = [];
  if (!trimmedQuery) {
    filtered = rawOptions;
  } else if (trimmedQuery.includes(':')) {
    const parts = trimmedQuery.split(':');
    const parentQuery = parts[0].toLowerCase();
    const childQuery = parts.slice(1).join(':').toLowerCase();

    filtered = rawOptions.filter((opt) => {
      const optLower = opt.raw.toLowerCase();
      if (!optLower.startsWith(`${parentQuery}:`)) return false;
      if (!childQuery) return true;
      const optChild = opt.raw.substring(parentQuery.length + 1).toLowerCase();
      return optChild.includes(childQuery);
    });
  } else {
    filtered = rawOptions.filter((opt) => {
      return (
        opt.raw.toLowerCase().includes(lowerQuery) ||
        opt.displayName.toLowerCase().includes(lowerQuery)
      );
    });
  }

  const list: UnifiedSuggestItem[] = filtered.map((opt) => ({
    id: `opt-${opt.raw}`,
    type: trigger.type === 'category' ? 'category' : 'theme',
    raw: opt.raw,
    primaryLabel: opt.displayName,
    secondaryLabel: opt.parent ? `${opt.parent} ›` : undefined,
  }));

  // If query does not exactly match any existing option, show "Create new"
  const exactMatch = rawOptions.some(
    (o) => o.raw.toLowerCase() === lowerQuery
  );
  if (trimmedQuery.length > 0 && !exactMatch) {
    list.push({
      id: `create-new-${trimmedQuery}`,
      type: 'create',
      raw: trimmedQuery,
      primaryLabel:
        trigger.type === 'category' ? `!${trimmedQuery}` : `[${trimmedQuery}]`,
      secondaryLabel: '新規作成',
    });
  }

  return list;
};
