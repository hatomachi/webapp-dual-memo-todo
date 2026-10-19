import React from 'react';
import { X, CornerDownRight, ArrowRight } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <h3 className="text-base font-bold text-slate-800">
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
        <div className="p-6 space-y-5 text-sm text-slate-600 max-h-[80vh] overflow-y-auto">
          {/* Concept */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 text-xs leading-relaxed">
            <p className="font-semibold text-blue-950 mb-1">💡 思考の摩擦ゼロ</p>
            メモ帳に直接書き殴る感覚でタスクを管理できます。セレクタやダイアログは不要です。
          </div>

          {/* Grammar */}
          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-emerald-700">!見出し（左ペイン: 分類軸）</span>
              <p className="font-sans text-slate-600 mt-1">
                行頭に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">!inbox</code> や <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">!ワーク</code> と書くとセクションになります。
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-blue-700">[見出し]（右ペイン: テーマ軸）</span>
              <p className="font-sans text-slate-600 mt-1">
                行頭に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">[Uncategorized]</code> や <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">[生活]</code> と書くとセクションになります。
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-amber-700">#MM/DD（期日タグ）</span>
              <p className="font-sans text-slate-600 mt-1">
                タスク行に <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">#10/25</code> と書くと期日として認識され、ヘッダの「⚡️期日ソート」で並び替えられます。
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-indigo-700">階層区切り（コロン区切り）＆目次ジャンプ</span>
              <p className="font-sans text-slate-600 mt-1">
                <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">[APIGW]</code> と <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">[APIGW:xx対応]</code> のようにコロン <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">:</code> で区切ると、左側の「区切りリスト」でツリー階層として表示されます。反映・保存時も親の直下に子が揃って並びます。目次をクリックすると該当行へジャンプできます。
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                字下げコメント（親子関係）
              </span>
              <p className="font-sans text-slate-600 mt-1">
                タスク行の直下に、半角スペース2つ（またはTab）で字下げして書くと、直上タスクのコメントになります（複数行OK）。反対側のペインでも連動して保持されます。
              </p>
            </div>
          </div>

          {/* Sync Behavior */}
          <div className="border-t border-slate-200 pt-3">
            <h4 className="font-bold text-slate-800 text-xs mb-1.5 flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
              双方向同期のタイミング
            </h4>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-600">
              <li>エディタからフォーカスを外したとき（自動）</li>
              <li>キーボードで <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Ctrl + S</code>（または <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Cmd + S</code>）を押したとき</li>
              <li>ヘッダーの「同期する」ボタンを押したとき</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
