import React from 'react';
import { PaneType } from '../types/todo';
import { ArrowUpDown, RefreshCw, Save, HelpCircle, Check } from 'lucide-react';

interface HeaderProps {
  onSortDueDates: () => void;
  onManualSync: () => void;
  onResetSample: () => void;
  onToggleHelp: () => void;
  activeMobilePane: PaneType;
  onChangeMobilePane: (pane: PaneType) => void;
  isSaved: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSortDueDates,
  onManualSync,
  onResetSample,
  onToggleHelp,
  activeMobilePane,
  onChangeMobilePane,
  isSaved,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* App Title & Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shadow-sm font-black text-base">
            📝
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 leading-none">
                Dual Memo TODO
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                MVP Prototype
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              メモ帳の手軽さ × 2面連動（分類 × テーマ） × 期日ソート
            </p>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex sm:hidden bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
          <button
            onClick={() => onChangeMobilePane('category')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeMobilePane === 'category'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            ! 分類
          </button>
          <button
            onClick={() => onChangeMobilePane('theme')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeMobilePane === 'theme'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            [ テーマ ]
          </button>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center space-x-2">
          {/* Due date sort button */}
          <button
            onClick={onSortDueDates}
            title="各セクション内で #日付 昇順にタスクをソート"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-all active:scale-95"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">⚡️ 期日ソート</span>
            <span className="xs:hidden">ソート</span>
          </button>

          {/* Sync / Save Button */}
          <button
            onClick={onManualSync}
            title="手動で左右をパースして同期＆保存"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              isSaved
                ? 'bg-slate-50 text-slate-600 border-slate-200'
                : 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">同期済み</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">同期する</span>
              </>
            )}
          </button>

          {/* Sample Data Reset */}
          <button
            onClick={onResetSample}
            title="サンプルデータを復元"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Help Modal Toggle */}
          <button
            onClick={onToggleHelp}
            title="使い方のヒント"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
