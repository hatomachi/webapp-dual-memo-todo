import React from 'react';
import { PaneType } from '../types/todo';
import {
  ArrowUpDown,
  Save,
  HelpCircle,
  Check,
  Undo2,
  Redo2,
  Clock,
  Archive,
  Cloud,
  CloudOff,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import { SyncStatus, GitProvider } from '../types/github';

interface HeaderProps {
  onSortDueDates: () => void;
  onManualSync: () => void;
  onToggleHelp: () => void;
  onToggleHistory: () => void;
  onToggleArchive?: () => void;
  archiveThemeCount?: number;
  onToggleStaging?: () => void;
  stagingCount?: number;
  onToggleSettings: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  historyCount: number;
  syncStatus: SyncStatus;
  gitProvider?: GitProvider;
  activeMobilePane: PaneType;
  onChangeMobilePane: (pane: PaneType) => void;
  isSaved: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSortDueDates,
  onManualSync,
  onToggleHelp,
  onToggleHistory,
  onToggleArchive,
  archiveThemeCount = 0,
  onToggleStaging,
  stagingCount = 0,
  onToggleSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyCount,
  syncStatus,
  gitProvider = 'github',
  activeMobilePane,
  onChangeMobilePane,
  isSaved,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 select-none">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 h-12 flex items-center justify-between gap-1 sm:gap-2">
        {/* App Title */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          <span className="text-base sm:text-lg">📝</span>
          <h1 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight hidden min-[380px]:inline">
            Dual Memo
          </h1>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex sm:hidden bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => onChangeMobilePane('category')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeMobilePane === 'category'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            ! 分類
          </button>
          <button
            type="button"
            onClick={() => onChangeMobilePane('theme')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeMobilePane === 'theme'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            [ テーマ ]
          </button>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
          {/* Undo / Redo Buttons */}
          <div className="hidden sm:flex items-center space-x-0.5 border-r border-slate-200 pr-1.5 mr-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="元に戻す (Ctrl+Z)"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="やり直す (Ctrl+Y)"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* History Modal Button */}
          <button
            type="button"
            onClick={onToggleHistory}
            title={`世代履歴・復元 (${historyCount}世代)`}
            className="flex items-center gap-1 p-1.5 sm:px-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span className="text-[11px] font-mono hidden md:inline">{historyCount}世代</span>
          </button>

          {/* Staging Drawer Button (Pending tasks from Mattermost/AI) */}
          {onToggleStaging && (
            <button
              type="button"
              onClick={onToggleStaging}
              title={`受信トレイ・待合室 (未処理 ${stagingCount}件)`}
              className={`flex items-center gap-1 p-1.5 sm:px-2 rounded-md transition-all ${
                stagingCount > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-sm animate-pulse'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Inbox className={`w-4 h-4 ${stagingCount > 0 ? 'text-amber-700' : 'text-slate-400'}`} />
              <span className="text-[11px] font-mono">
                {stagingCount > 0 ? (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="hidden md:inline">待合室</span>
                    <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                      {stagingCount}
                    </span>
                  </span>
                ) : (
                  <span className="hidden md:inline">待合室</span>
                )}
              </span>
            </button>
          )}

          {/* Archive Modal Button */}
          {onToggleArchive && (
            <button
              type="button"
              onClick={onToggleArchive}
              title={`プロジェクト保管庫 (アーカイブ済み ${archiveThemeCount}テーマ)`}
              className="flex items-center gap-1 p-1.5 sm:px-2 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
            >
              <Archive className="w-4 h-4 text-amber-600" />
              <span className="text-[11px] font-mono hidden md:inline">
                保管庫{archiveThemeCount > 0 ? ` (${archiveThemeCount})` : ''}
              </span>
            </button>
          )}

          {/* Due date sort button (visible on mobile and desktop) */}
          <button
            type="button"
            onClick={onSortDueDates}
            title="各区切りの中を #MM/DD 昇順で並び替え"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-md shadow-sm transition-all active:scale-95 flex-shrink-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="inline md:hidden">ソート</span>
            <span className="hidden md:inline">期日ソート</span>
          </button>

          {/* Sync / Save Button (Ctrl+S) - Hidden on mobile as QuickToolbar has Save button */}
          <button
            type="button"
            onClick={onManualSync}
            title="左右を同期・保存 (Ctrl+S)"
            className={`hidden sm:flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md border transition-all ${
              isSaved
                ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 font-semibold shadow-sm animate-pulse'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">同期済</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>反映</span>
              </>
            )}
          </button>

          {/* Git Sync & Settings Button */}
          <button
            type="button"
            onClick={onToggleSettings}
            title={`データ永続化設定 (${gitProvider === 'gitlab' ? 'GitLab' : 'GitHub'}同期)`}
            className={`p-1.5 rounded-md transition-colors ${
              syncStatus === 'syncing'
                ? 'text-blue-600 bg-blue-50 animate-pulse'
                : syncStatus === 'error'
                ? 'text-rose-600 bg-rose-50'
                : syncStatus === 'success'
                ? 'text-emerald-600 hover:bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            {syncStatus === 'error' ? (
              <CloudOff className="w-4 h-4" />
            ) : syncStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
          </button>

          {/* Help Modal Toggle */}
          <button
            type="button"
            onClick={onToggleHelp}
            title="使い方のヒント"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
