import React, { useState } from 'react';
import {
  X,
  Check,
  Trash2,
  ExternalLink,
  Calendar,
  Tag,
  Folder,
  Sparkles,
  Edit2,
  MessageSquare,
} from 'lucide-react';
import { StagingTaskItem } from '../types/todo';

interface StagingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stagingTasks: StagingTaskItem[];
  knownCategories: string[];
  knownThemes: string[];
  onPromoteTask: (task: StagingTaskItem, targetCategory: string, targetTheme: string) => void;
  onDismissTask: (taskId: string) => void;
}

export const StagingDrawer: React.FC<StagingDrawerProps> = ({
  isOpen,
  onClose,
  stagingTasks,
  knownCategories,
  knownThemes,
  onPromoteTask,
  onDismissTask,
}) => {
  // Global toggle to expand/collapse Mattermost chat previews
  const [showChatPreviews, setShowChatPreviews] = useState<boolean>(true);

  // Inline editing state for tweaking title/theme before promoting
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTheme, setEditTheme] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  if (!isOpen) return null;

  const startEditing = (task: StagingTaskItem) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditCategory(task.category === 'staging' ? 'ワーク' : task.category || 'ワーク');
    setEditTheme(task.theme || 'Uncategorized');
    setEditDueDate(task.dueDate || '');
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
  };

  // Promote task: preserves regular memo comments & ↳ 🔗 permalink,
  // excluding the raw verbose chat snippet so the memo stays clean
  const handlePromoteDirect = (task: StagingTaskItem, cat?: string, thm?: string) => {
    const targetCat = cat || (task.category === 'staging' ? 'ワーク' : task.category || 'ワーク');
    const targetThm = thm || task.theme || 'Uncategorized';

    const linkLine = task.comments.find((c) => c.includes('🔗') || c.includes('http'));
    const urlMatch = linkLine?.match(/https?:\/\/[^\s]+/);
    const permalink = urlMatch ? urlMatch[0] : task.postUrl;

    const regularComments = task.comments.filter(
      (c) => !c.includes('👤') && !c.includes('💬') && !c.includes('🔗') && !c.includes('http')
    );

    const cleanComments = [
      ...regularComments,
      ...(permalink ? [`↳ 🔗 ${permalink}`] : []),
    ];

    onPromoteTask(
      {
        ...task,
        category: targetCat,
        theme: targetThm,
        comments: cleanComments,
      },
      targetCat,
      targetThm
    );
  };

  const handleSaveAndPromote = (task: StagingTaskItem) => {
    const targetCat = editCategory.trim() || 'ワーク';
    const targetThm = editTheme.trim() || 'Uncategorized';

    const linkLine = task.comments.find((c) => c.includes('🔗') || c.includes('http'));
    const urlMatch = linkLine?.match(/https?:\/\/[^\s]+/);
    const permalink = urlMatch ? urlMatch[0] : task.postUrl;

    const regularComments = task.comments.filter(
      (c) => !c.includes('👤') && !c.includes('💬') && !c.includes('🔗') && !c.includes('http')
    );

    const cleanComments = [
      ...regularComments,
      ...(permalink ? [`↳ 🔗 ${permalink}`] : []),
    ];

    onPromoteTask(
      {
        ...task,
        title: editTitle.trim() || task.title,
        category: targetCat,
        theme: targetThm,
        dueDate: editDueDate.trim() || null,
        comments: cleanComments,
      },
      targetCat,
      targetThm
    );
    setEditingTaskId(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-base">📥</span>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>受信トレイ・待合室</span>
                  <span className="text-[11px] font-mono bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full border border-amber-300">
                    {stagingTasks.length}件
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Toggle to show/hide Mattermost unfurled chat previews */}
              <button
                type="button"
                onClick={() => setShowChatPreviews((prev) => !prev)}
                title="リンク先のMattermostチャット引用を一括表示/非表示"
                className={`text-[11px] font-medium px-2 py-1 rounded-md border flex items-center gap-1 transition-colors ${
                  showChatPreviews
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>チャット表示: {showChatPreviews ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader hint */}
          <div className="bg-slate-100/70 px-4 py-1.5 border-b border-slate-200/70 text-[11px] text-slate-500 flex items-center justify-between">
            <span>採用すると、タイトルとリンク（↳ 🔗）のみがメモ帳に反映されます</span>
          </div>

          {/* Body: Notepad Theme-Oriented Presentation View */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-white font-mono text-xs">
            {stagingTasks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 font-sans">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5 text-slate-300">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-600 mb-0.5">待合室は空です</p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
                  Mattermostで投稿を保存（旗マーク）すると、AIが文脈を解釈してここにドラフトを自動生成します。
                </p>
              </div>
            ) : (
              /* Group tasks by Theme to show exactly how they land in the right pane */
              (() => {
                const groupedByTheme: Record<string, StagingTaskItem[]> = {};
                for (const t of stagingTasks) {
                  const th = t.theme || 'Uncategorized';
                  if (!groupedByTheme[th]) groupedByTheme[th] = [];
                  groupedByTheme[th].push(t);
                }

                return Object.entries(groupedByTheme).map(([themeName, tasksInTheme]) => (
                  <div key={themeName} className="space-y-3">
                    {/* Theme Header - exactly as in the right pane */}
                    <div className="font-bold text-slate-800 bg-slate-200/70 px-2.5 py-1 rounded text-xs select-none">
                      [{themeName}]
                    </div>

                    {/* Tasks under this theme */}
                    <div className="space-y-4 pl-1 sm:pl-2">
                      {tasksInTheme.map((task) => {
                        const isEditing = editingTaskId === task.id;

                        // Metadata and comments separation
                        const authorLine = task.comments.find((c) => c.includes('👤'));
                        const messageLine = task.comments.find((c) => c.includes('💬'));
                        const linkLine = task.comments.find((c) => c.includes('🔗') || c.includes('http'));
                        const urlMatch = linkLine?.match(/https?:\/\/[^\s]+/);
                        const permalink = urlMatch ? urlMatch[0] : task.postUrl;

                        // Non-mattermost user/memo comments that will actually land in Dual Memo
                        const regularComments = task.comments.filter(
                          (c) => !c.includes('👤') && !c.includes('💬') && !c.includes('🔗') && !c.includes('http')
                        );

                        const effectiveCategory = task.category === 'staging' ? 'ワーク' : task.category || 'ワーク';

                        return (
                          <div
                            key={task.id}
                            className="border-b border-slate-150 pb-3 space-y-1.5 last:border-b-0"
                          >
                            {isEditing ? (
                              /* Inline Editing View */
                              <div className="space-y-2.5 font-sans bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    タスク名
                                  </label>
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                                    placeholder="タスクのタイトル"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                                      <Tag className="w-3 h-3 text-emerald-600" /> 分類 (!category)
                                    </label>
                                    <input
                                      type="text"
                                      value={editCategory}
                                      onChange={(e) => setEditCategory(e.target.value)}
                                      className="w-full text-xs px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder="ワーク"
                                      list="category-suggestions"
                                    />
                                    <datalist id="category-suggestions">
                                      {knownCategories.map((c) => (
                                        <option key={c} value={c} />
                                      ))}
                                    </datalist>
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                                      <Folder className="w-3 h-3 text-blue-600" /> テーマ ([theme])
                                    </label>
                                    <input
                                      type="text"
                                      value={editTheme}
                                      onChange={(e) => setEditTheme(e.target.value)}
                                      className="w-full text-xs px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder="Uncategorized"
                                      list="theme-suggestions"
                                    />
                                    <datalist id="theme-suggestions">
                                      {knownThemes.map((th) => (
                                        <option key={th} value={th} />
                                      ))}
                                    </datalist>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-amber-600" /> 期日 (#MM/DD)
                                  </label>
                                  <input
                                    type="text"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    placeholder="例: 10/25"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60 font-sans">
                                  <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200/50 rounded"
                                  >
                                    キャンセル
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAndPromote(task)}
                                    className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded shadow-sm flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" /> 保存して本番採用
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Pure Notepad-style Presentation View (Exactly like Right Theme Pane) */
                              <>
                                {/* 1. Task Line */}
                                <div className="leading-relaxed">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="text-slate-900 tracking-tight font-medium">
                                      <span>・{task.title}</span>
                                      {task.dueDate && (
                                        <span className="text-amber-700 font-mono ml-1.5">
                                          #{task.dueDate}
                                        </span>
                                      )}
                                      <span className="text-emerald-700 font-medium ml-1.5">
                                        !{effectiveCategory}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => startEditing(task)}
                                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                      title="タイトル・テーマ・期日を修正"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* 2. Optional Regular Comments (landing directly in memo) */}
                                  {regularComments.map((c, cIdx) => (
                                    <div key={cIdx} className="text-[11px] text-slate-600 pl-4 mt-0.5">
                                      ↳ {c.replace(/^[↳\s]+/, '')}
                                    </div>
                                  ))}

                                  {/* 3. Indented URL Link Line (landing directly in memo) */}
                                  {permalink && (
                                    <div className="text-[11px] text-slate-500 pl-4 mt-0.5 flex items-center gap-1">
                                      <span className="text-slate-400 select-none">↳ 🔗</span>
                                      <a
                                        href={permalink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 hover:underline truncate max-w-[300px] sm:max-w-[360px]"
                                      >
                                        {permalink}
                                      </a>
                                    </div>
                                  )}
                                </div>

                                {/* 4. Unfurled Chat Preview Box (Mattermost reference context) */}
                                {showChatPreviews && messageLine && (
                                  <div className="ml-5 pl-2.5 border-l-2 border-indigo-200/90 pt-1 space-y-1 font-sans">
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2 text-xs text-slate-700 space-y-1 shadow-2xs">
                                      {/* Header */}
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1 border-b border-slate-200/60 font-medium">
                                        <span className="flex items-center gap-1 text-slate-700 font-semibold">
                                          <span className="text-indigo-600">💬</span>
                                          {authorLine
                                            ? authorLine.replace(/^↳\s*/, '')
                                            : 'Mattermost 元発言'}
                                        </span>
                                        {permalink && (
                                          <a
                                            href={permalink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-slate-400 hover:text-blue-600 flex items-center gap-0.5"
                                          >
                                            <span>開く</span>
                                            <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        )}
                                      </div>

                                      {/* Message Body */}
                                      <div className="text-slate-700 whitespace-pre-wrap leading-relaxed text-[11px]">
                                        {messageLine.replace(/^↳\s*💬\s*/, '')}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* 5. Action Buttons (Clean & minimal) */}
                                <div className="flex items-center justify-between pt-1 pl-4 font-sans text-xs">
                                  <button
                                    type="button"
                                    onClick={() => onDismissTask(task.id)}
                                    className="text-[11px] text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                                    title="待合室から破棄"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>破棄</span>
                                  </button>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handlePromoteDirect(task, 'inbox')}
                                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded transition-colors"
                                      title="!inbox セクションへ採用"
                                    >
                                      <span>!inboxへ採用</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePromoteDirect(task, effectiveCategory)}
                                      className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-0.5 rounded shadow-sm transition-colors flex items-center gap-1"
                                      title={`!${effectiveCategory} セクションへ採用`}
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      <span>!{effectiveCategory}へ採用</span>
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
