export interface HistorySnapshot {
  id: string;
  timestamp: number;
  label: string; // e.g., "左 ➔ 右 反映", "期日ソート", "手動保存", "GitHub同期"
  categoryText: string;
  themeText: string;
}

export interface HistoryState {
  snapshots: HistorySnapshot[];
  currentIndex: number;
}
