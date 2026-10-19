export type PaneType = 'category' | 'theme';

export interface TaskItem {
  id: string;
  title: string;
  category: string; // !inbox, !ワーク (without '!')
  theme: string;    // [Uncategorized], [プロジェクト] (without '[]')
  dueDate: string | null; // e.g. "10/25", "2026/10/25" (without '#')
  comments: string[];
  order: number;
}

export type LineType = 'section' | 'task' | 'comment' | 'empty';

export interface FormattedLine {
  text: string;
  type: LineType;
  sectionName?: string;
  categoryTag?: string;
  themeTag?: string;
  dueDateTag?: string;
  indentCount?: number;
}

export interface SectionItem {
  raw: string;          // 完全なセクション名 (e.g. "APIGW:xx対応")
  displayName: string;  // 階層末尾の表示名 (e.g. "xx対応")
  depth: number;        // 階層深度 (0 = ルート, 1 = 子, 2 = 孫...)
  lineIndex: number;    // テキスト内の行番号 (0-indexed)
  charIndex: number;    // テキスト内の先頭文字オフセット
  isDefault: boolean;   // inbox または Uncategorized かどうか
}
