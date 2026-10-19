import React, { useState } from 'react';
import { HistorySnapshot } from '../types/history';
import { X, Clock, RotateCcw, CheckCircle, FileText } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: HistorySnapshot[];
  currentIndex: number;
  onRestore: (index: number) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  currentIndex,
  onRestore,
}) => {
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const activeIndex = selectedPreviewIndex !== null ? selectedPreviewIndex : currentIndex;
  const activeSnapshot = activeIndex >= 0 && activeIndex < snapshots.length ? snapshots[activeIndex] : null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const getRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 10) return 'たった今';
    if (diffSec < 60) return `${diffSec}秒前`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    return `${Math.floor(diffHour / 24)}日前`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800">
              世代履歴（最大30世代・Undo/Redo・復元）
            </h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {snapshots.length} 世代保存中
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left = Snapshot list (reversed to see latest first), Right = Preview */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* Snapshot List */}
          <div className="w-full sm:w-1/2 overflow-y-auto p-3 space-y-2 max-h-60 sm:max-h-none">
            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                履歴はまだ記録されていません（保存・反映時に自動記録されます）
              </div>
            ) : (
              // Display in reverse order (newest first)
              [...snapshots]
                .map((snap, origIndex) => ({ snap, origIndex }))
                .reverse()
                .map(({ snap, origIndex }) => {
                  const isCurrent = origIndex === currentIndex;
                  const isSelected = origIndex === activeIndex;

                  return (
                    <div
                      key={snap.id}
                      onClick={() => setSelectedPreviewIndex(origIndex)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                          <span>{snap.label}</span>
                          {isCurrent && (
                            <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">
                              <CheckCircle className="w-3 h-3" /> 現在適用中
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {getRelativeTime(snap.timestamp)}
                        </span>
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500 font-mono flex items-center justify-between">
                        <span>{formatTime(snap.timestamp)}</span>
                        <span>
                          {snap.categoryText.split('\n').filter(Boolean).length} 行
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Preview & Action Panel */}
          <div className="w-full sm:w-1/2 flex flex-col bg-slate-50/50 overflow-hidden p-4">
            {activeSnapshot ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">
                      プレビュー: {activeSnapshot.label}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`この世代（${formatTime(activeSnapshot.timestamp)}: ${activeSnapshot.label}）の状態に復元しますか？`)) {
                        onRestore(activeIndex);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>この時点に戻す</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 mb-2 font-mono">
                  日時: {formatTime(activeSnapshot.timestamp)}
                </div>

                {/* Text preview scroll container */}
                <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2.5 font-mono text-xs text-slate-700 whitespace-pre leading-5">
                  {activeSnapshot.categoryText || '(空)'}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                世代を選択するとプレビューが表示されます
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>💡 反映（Ctrl+S）、期日ソートなどの操作ごとに自動記録されます</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-slate-200 border border-slate-300 rounded text-slate-700 text-xs font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
