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
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* App Title */}
        <div className="flex items-center space-x-2.5">
          <span className="text-lg">📝</span>
          <h1 className="text-sm font-bold text-slate-800">
            Dual Memo TODO
          </h1>
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
            title="各区切りの中を #MM/DD 昇順で並び替え"
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-md shadow-sm transition-all active:scale-95"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>期日ソート</span>
          </button>

          {/* Sync / Save Button (Ctrl+S) */}
          <button
            onClick={onManualSync}
            title="Ctrl+S で左右を同期・保存"
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-all ${
              isSaved
                ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 font-semibold shadow-sm'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>同期済み (Ctrl+S)</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>左右反映 (Ctrl+S)</span>
              </>
            )}
          </button>

          {/* Sample Data Reset */}
          <button
            onClick={onResetSample}
            title="初期サンプルデータを復元"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Help Modal Toggle */}
          <button
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
