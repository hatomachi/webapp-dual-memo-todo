import React from 'react';
import { X, CornerDownRight, ArrowRight, Clock, Cloud, Smartphone } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <h3 className="text-sm font-bold text-slate-800">
              Dual Memo TODO の使い方
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-600 overflow-y-auto">
          {/* Concept */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 leading-relaxed">
            <p className="font-semibold text-blue-950 mb-0.5">💡 思考の摩擦ゼロ</p>
            Windowsメモ帳やiPhoneメモに書き殴る感覚でタスクを管理できます。セレクタや日付ピッカー、モーダル入力は不要です。
          </div>

          {/* Grammar */}
          <div className="space-y-2.5 font-mono">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-emerald-700">!見出し（左ペイン: 分類軸）</span>
              <p className="font-sans text-slate-600 mt-0.5">
                行頭に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">!inbox</code> や <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">!ワーク</code> と書くとセクションになります。
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-blue-700">[見出し]（右ペイン: テーマ軸）</span>
              <p className="font-sans text-slate-600 mt-0.5">
                行頭に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">[Uncategorized]</code> や <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">[生活]</code> と書くとセクションになります。
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800">・TODO行（自動中黒）</span>
              <p className="font-sans text-slate-600 mt-0.5">
                通常のタスク行は行頭に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">・</code> が表示されます。入力時に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">・</code> を付けても省いて保存され、<code className="bg-slate-200 px-1 py-0.5 rounded font-mono">・</code> を付けずに書いても保存・反映時に自動で付与されます。
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-amber-700">#MM/DD（期日タグ）</span>
              <p className="font-sans text-slate-600 mt-0.5">
                タスク行に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">#10/25</code> と書くと期日として認識され、「期日ソート」で昇順に並び替えられます。
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                字下げコメント（ぶら下がりメモ）
              </span>
              <p className="font-sans text-slate-600 mt-0.5">
                タスク行の直下に、半角スペース2つ（またはTab）で字下げして書くと、直上タスクのコメントになります（下部ツールの「↳字下げ」でも1発挿入）。
              </p>
            </div>
          </div>

          {/* New features */}
          <div className="space-y-2 pt-2 border-t border-slate-200 font-sans">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">30世代Undo/Redo & 世代復元</span>
                <p className="text-[11px] text-slate-500">
                  ヘッダーの「↶ / ↷」ボタン、または時計アイコンから過去最大30世代のスナップショットをいつでもプレビュー＆巻き戻し可能です。誤って消したり崩れたりしても安心です。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Cloud className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">GitHub Private Repo 自動永続化</span>
                <p className="text-[11px] text-slate-500">
                  ヘッダーの雲アイコン（☁️）からPersonal Access Tokenを設定すると、プライベートリポジトリに `todo-data.json` を安全にコミット・バックアップできます。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">iPhone / スマホ対応 (PWA)</span>
                <p className="text-[11px] text-slate-500">
                  スマホでは1ペイン表示で上部タブ切替。下部のクイック入力バーから「↳字下げ」「#」「[ ]」「!」がワンタップで打てるため、キーボード切り替えのストレスがありません。Safariの「ホーム画面に追加」で全画面PWAとして動作します。
                </p>
              </div>
            </div>
          </div>

          {/* Sync Behavior */}
          <div className="border-t border-slate-200 pt-2 font-sans">
            <h4 className="font-bold text-slate-800 text-xs mb-1 flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
              反映・保存のショートカット
            </h4>
            <p className="text-[11px] text-slate-500">
              PCでは <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Ctrl + S</code>（Macは <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Cmd + S</code>）、またはヘッダー・下部ツールの「反映」ボタンを押すと、反対側のペインへ即座に整列反映されます。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
