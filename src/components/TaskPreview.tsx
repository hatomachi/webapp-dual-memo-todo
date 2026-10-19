import React from 'react';
import { TaskItem, PaneType } from '../types/todo';
import { Calendar, Trash2, Tag, CornerDownRight, Folder } from 'lucide-react';

interface TaskPreviewProps {
  tasks: TaskItem[];
  paneType: PaneType;
  onDeleteTask: (taskId: string) => void;
  onEditRequest: () => void;
}

export const TaskPreview: React.FC<TaskPreviewProps> = ({
  tasks,
  paneType,
  onDeleteTask,
  onEditRequest,
}) => {
  // Group tasks by section
  const sections: { name: string; tasks: TaskItem[] }[] = [];

  if (paneType === 'category') {
    // Left pane: group by category
    const catOrder: string[] = ['inbox'];
    tasks.forEach((t) => {
      const cat = t.category || 'inbox';
      if (!catOrder.includes(cat)) catOrder.push(cat);
    });

    catOrder.forEach((cat) => {
      const matching = tasks.filter((t) => (t.category || 'inbox') === cat);
      if (matching.length > 0 || cat === 'inbox') {
        sections.push({ name: cat, tasks: matching });
      }
    });
  } else {
    // Right pane: group by theme
    const themeOrder: string[] = [];
    tasks.forEach((t) => {
      const th = t.theme || 'Uncategorized';
      if (!themeOrder.includes(th)) themeOrder.push(th);
    });
    if (!themeOrder.includes('Uncategorized')) themeOrder.push('Uncategorized');

    themeOrder.forEach((theme) => {
      const matching = tasks.filter((t) => (t.theme || 'Uncategorized') === theme);
      if (matching.length > 0 || theme === 'Uncategorized') {
        sections.push({ name: theme, tasks: matching });
      }
    });
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {sections.map((sec) => (
        <div
          key={sec.name}
          className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Section Header */}
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                {paneType === 'category' ? (
                  <>
                    <span className="text-emerald-600 font-black">!</span>
                    <span>{sec.name}</span>
                  </>
                ) : (
                  <>
                    <Folder className="w-4 h-4 text-blue-500 inline" />
                    <span>[{sec.name}]</span>
                  </>
                )}
              </span>
              <span className="text-xs bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                {sec.tasks.length}
              </span>
            </div>
          </div>

          {/* Task list in this section */}
          <div className="divide-y divide-slate-100">
            {sec.tasks.length === 0 ? (
              <div
                onClick={onEditRequest}
                className="p-4 text-center text-sm text-slate-400 italic cursor-pointer hover:bg-slate-50 transition-colors"
              >
                タスクがありません（クリックしてメモ帳で入力）
              </div>
            ) : (
              sec.tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Task title and tags */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 break-words">
                          {task.title}
                        </span>

                        {/* Due date badge */}
                        {task.dueDate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Calendar className="w-3 h-3 text-amber-500" />
                            #{task.dueDate}
                          </span>
                        )}

                        {/* Counterpart tag */}
                        {paneType === 'category' ? (
                          task.theme && task.theme !== 'Uncategorized' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200">
                              <Tag className="w-3 h-3 text-blue-500" />
                              [{task.theme}]
                            </span>
                          )
                        ) : (
                          task.category && task.category !== 'inbox' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="font-bold">!</span>
                              {task.category}
                            </span>
                          )
                        )}
                      </div>

                      {/* Indented Comments */}
                      {task.comments && task.comments.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-slate-200">
                          {task.comments.map((comment, cIdx) => (
                            <div
                              key={cIdx}
                              className="flex items-start gap-1.5 text-xs text-slate-600 bg-slate-100/80 px-2 py-1 rounded"
                            >
                              <CornerDownRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="break-words font-mono">{comment}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete action */}
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      title="行ごと削除（完了）"
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
