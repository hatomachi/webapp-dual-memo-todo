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
