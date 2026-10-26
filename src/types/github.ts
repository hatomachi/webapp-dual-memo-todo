import { CompletedTaskItem } from './todo';

export type GitProvider = 'github' | 'gitlab';

export interface GitHubSettings {
  provider?: GitProvider; // 'github' | 'gitlab' (default: 'github')
  baseUrl?: string; // GitLab用 Base URL (例: https://gitlab.internal.example.com)
  token: string;
  owner: string; // GitHub: Owner / GitLab: Group or Namespace (空欄可)
  repo: string; // GitHub: Repo / GitLab: Project name or numeric Project ID
  branch: string;
  path: string;
  archivePath?: string; // e.g. "todo-archive.json"
  stagingPath?: string; // e.g. "todo-staging.json"
  autoSyncOnSave: boolean;
}

export type GitSettings = GitHubSettings;

export interface RemotePayload {
  version: number;
  updatedAt: string;
  tasks: any[];
  completedTasks?: CompletedTaskItem[];
  categories?: string[];
  themes?: string[];
  categoryComments?: Record<string, string[]>;
  themeComments?: Record<string, string[]>;
  categoryText?: string;
  themeText?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface GitHubSyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  errorMessage?: string;
}
