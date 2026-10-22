import { CompletedTaskItem } from './todo';

export interface GitHubSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  archivePath?: string; // e.g. "todo-archive.json"
  stagingPath?: string; // e.g. "todo-staging.json"
  autoSyncOnSave: boolean;
}

export interface RemotePayload {
  version: number;
  updatedAt: string;
  tasks: any[];
  completedTasks?: CompletedTaskItem[];
  categories?: string[];
  themes?: string[];
  categoryText?: string;
  themeText?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface GitHubSyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  errorMessage?: string;
}
