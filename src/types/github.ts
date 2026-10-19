export interface GitHubSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  autoSyncOnSave: boolean;
}

export interface RemotePayload {
  version: number;
  updatedAt: string;
  tasks: any[];
  categoryText: string;
  themeText: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface GitHubSyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  errorMessage?: string;
}
