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
