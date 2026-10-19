import React, { useState, useEffect } from 'react';
import { GitHubSettings, SyncStatus } from '../types/github';
import {
  X,
  Settings,
  Github,
  CloudUpload,
  CloudDownload,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GitHubSettings | null;
  onSaveSettings: (settings: GitHubSettings) => void;
  onManualPull: () => Promise<void>;
  onManualPush: () => Promise<void>;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  errorMessage?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onManualPull,
  onManualPush,
  syncStatus,
  lastSyncedAt,
  errorMessage,
}) => {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [path, setPath] = useState('todo-data.json');
  const [autoSyncOnSave, setAutoSyncOnSave] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setToken(settings.token || '');
      setOwner(settings.owner || '');
      setRepo(settings.repo || '');
      setBranch(settings.branch || 'main');
      setPath(settings.path || 'todo-data.json');
      setAutoSyncOnSave(settings.autoSyncOnSave !== false);
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newSettings: GitHubSettings = {
      token: token.trim(),
      owner: owner.trim(),
      repo: repo.trim(),
      branch: branch.trim() || 'main',
      path: path.trim() || 'todo-data.json',
      autoSyncOnSave,
    };
    onSaveSettings(newSettings);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  const handlePullClick = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await onManualPull();
    } catch (err: any) {
      setActionError(err.message || 'プルに失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePushClick = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await onManualPush();
    } catch (err: any) {
      setActionError(err.message || 'プッシュに失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return '未同期';
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-800">
              設定 & GitHub Private Repo データ同期
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Sync Status Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">同期ステータス:</span>
              {syncStatus === 'syncing' ? (
                <span className="flex items-center gap-1 text-blue-600 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 通信中...
                </span>
              ) : syncStatus === 'success' ? (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 成功 ({formatLastSync(lastSyncedAt)})
                </span>
              ) : syncStatus === 'error' ? (
                <span className="flex items-center gap-1 text-rose-600 font-medium" title={errorMessage}>
                  <AlertCircle className="w-3.5 h-3.5" /> エラー
                </span>
              ) : (
                <span className="text-slate-400">待機中 (最終: {formatLastSync(lastSyncedAt)})</span>
              )}
            </div>
          </div>

          {(actionError || errorMessage) && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{actionError || errorMessage}</div>
            </div>
          )}

          {/* Settings Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Github className="w-3.5 h-3.5" />
                  GitHub Personal Access Token (PAT)
                </label>
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <HelpCircle className="w-3 h-3" />
                  Fine-grained PAT作成
                </a>
              </div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="github_pat_xxxx または ghp_xxxx"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ※トークンはブラウザ内（LocalStorage）のみに安全に保存されます。対象リポジトリのみのアクセス権限を持つ Fine-grained PAT を推奨します。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  GitHub ユーザー名 (Owner)
                </label>
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="例: hatomachi"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  リポジトリ名 (Repo)
                </label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="例: dual-memo-data"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ブランチ名
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ファイルパス
                </label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="todo-data.json"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoSync"
                checked={autoSyncOnSave}
                onChange={(e) => setAutoSyncOnSave(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <label htmlFor="autoSync" className="text-xs text-slate-700 cursor-pointer select-none">
                反映（Ctrl+S）時に自動でGitHubへもバックグラウンドプッシュする
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-emerald-600 font-medium">
                {saveSuccessNotice && '✓ 設定を保存しました'}
              </span>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              >
                設定を保存
              </button>
            </div>
          </form>

          {/* Manual Sync Actions */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-xs font-bold text-slate-700 mb-2">手動同期アクション</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handlePullClick}
                disabled={isProcessing || !token || !owner || !repo}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-all active:scale-95"
              >
                <CloudDownload className="w-4 h-4 text-indigo-600" />
                <span>GitHubから取得 (Pull)</span>
              </button>

              <button
                type="button"
                onClick={handlePushClick}
                disabled={isProcessing || !token || !owner || !repo}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-all active:scale-95"
              >
                <CloudUpload className="w-4 h-4 text-blue-600" />
                <span>GitHubへ保存 (Push)</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              ※スマホ等別端末で更新した場合は「取得」、ローカルで書き換えて今すぐリモートに反映したい場合は「保存」を実行できます。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
