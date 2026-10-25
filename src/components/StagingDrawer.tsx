import React, { useState } from 'react';
import {
  X,
  Inbox,
  Check,
  Trash2,
  ExternalLink,
  Calendar,
  Tag,
  Folder,
  Sparkles,
  Edit2,
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
  // Editing state for each task in staging drawer
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

  const handlePromoteDirect = (task: StagingTaskItem, cat?: string, thm?: string) => {
    const targetCat = cat || (task.category === 'staging' ? 'ワーク' : task.category || 'ワーク');
    const targetThm = thm || task.theme || 'Uncategorized';
    onPromoteTask(
      {
        ...task,
        category: targetCat,
        theme: targetThm,
      },
      targetCat,
      targetThm
    );
  };

  const handleSaveAndPromote = (task: StagingTaskItem) => {
    onPromoteTask(
      {
        ...task,
        title: editTitle.trim() || task.title,
        category: editCategory.trim() || 'ワーク',
        theme: editTheme.trim() || 'Uncategorized',
        dueDate: editDueDate.trim() || null,
      },
      editCategory.trim() || 'ワーク',
      editTheme.trim() || 'Uncategorized'
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

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shadow-sm border border-amber-200">
                <Inbox className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>受信トレイ・待合室</span>
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300/60">
                    {stagingTasks.length}件
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  MattermostやAIから裏で下ごしらえされたタスク候補
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30">
            {stagingTasks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-600 mb-1">待合室は空です</p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
                  Mattermostで投稿を保存（旗マーク）すると、AIが文脈を解釈してここに自動ドラフトを作成します。
                </p>
              </div>
            ) : (
              stagingTasks.map((task) => {
                const isEditing = editingTaskId === task.id;
                // Parse comments for UI display
                const authorLine = task.comments.find((c) => c.includes('👤'));
                const messageLine = task.comments.find((c) => c.includes('💬'));
                const linkLine = task.comments.find((c) => c.includes('🔗') || c.includes('http'));
                const urlMatch = linkLine?.match(/https?:\/\/[^\s]+/);
                const permalink = urlMatch ? urlMatch[0] : task.postUrl;

                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 hover:shadow-md hover:border-slate-300 transition-all space-y-3"
                  >
                    {isEditing ? (
                      /* Editing View */
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            タスク名
                          </label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
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
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="例: 10/25"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveAndPromote(task)}
                            className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> 保存して本番採用
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display View */
                      <>
                        {/* Title and Badges */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-bold text-slate-800 leading-snug">
                              ・{task.title}
                            </h3>
                            <button
                              type="button"
                              onClick={() => startEditing(task)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="タイトルやテーマを修正"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {task.theme && task.theme !== 'Uncategorized' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                                <Folder className="w-2.5 h-2.5" /> [{task.theme}]
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-mono">
                                <Calendar className="w-2.5 h-2.5" /> #{task.dueDate}
                              </span>
                            )}
                            {authorLine && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {authorLine.replace(/^↳\s*/, '')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Message Snippet Box */}
                        {messageLine && (
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                            {messageLine.replace(/^↳\s*💬\s*/, '')}
                          </div>
                        )}

                        {/* Permalink */}
                        {permalink && (
                          <div className="text-[10px] flex items-center gap-1 text-slate-400">
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                            <a
                              href={permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline truncate max-w-[280px]"
                            >
                              元のメッセージを開く
                            </a>
                          </div>
                        )}

                        {/* Actions Toolbar */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => onDismissTask(task.id)}
                            className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            title="待合室から破棄"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>破棄</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePromoteDirect(task, 'inbox')}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                              title="!inbox セクションへ追加"
                            >
                              <span>!inbox</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromoteDirect(task, 'ワーク')}
                              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                              title="!ワーク セクションへ追加（本番採用）"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>!ワークへ採用</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
