import { GitHubSettings, RemotePayload } from '../types/github';

const STORAGE_KEY_GITHUB_SETTINGS = 'dual_memo_github_settings_v1';
const STORAGE_KEY_GITHUB_SHA = 'dual_memo_github_sha_v1';
const STORAGE_KEY_LAST_SYNCED_AT = 'dual_memo_github_last_synced_at_v1';

export const loadGitHubSettings = (): GitHubSettings | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GITHUB_SETTINGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load GitHub settings from localStorage', err);
  }
  return null;
};

export const persistGitHubSettings = (settings: GitHubSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY_GITHUB_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to persist GitHub settings', err);
  }
};

export const loadLastSha = (): string | null => {
  return localStorage.getItem(STORAGE_KEY_GITHUB_SHA);
};

export const persistLastSha = (sha: string): void => {
  localStorage.setItem(STORAGE_KEY_GITHUB_SHA, sha);
};

export const loadLastSyncedAt = (): number | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_SYNCED_AT);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
};

export const persistLastSyncedAt = (ts: number): void => {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SYNCED_AT, ts.toString());
  } catch (err) {
    console.error('Failed to persist last synced at', err);
  }
};

// Safe UTF-8 Base64 encode
export const utf8ToBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Safe UTF-8 Base64 decode
export const base64ToUtf8 = (base64: string): string => {
  const cleanBase64 = base64.replace(/\s/g, '');
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

/**
 * Normalize and sanitize GitHub settings to prevent invalid API calls
 */
export const normalizeGitHubSettings = (settings: GitHubSettings): GitHubSettings => {
  const owner = (settings.owner || '').trim();
  const repo = (settings.repo || '').trim();
  const branch = (settings.branch || '').trim() || 'main';
  let path = (settings.path || '').trim() || 'todo-data.json';
  // Strip leading slashes to prevent double slashes in GitHub contents API URLs
  path = path.replace(/^\/+/, '');
  const token = (settings.token || '').trim();
  const autoSyncOnSave = settings.autoSyncOnSave !== false;

  return {
    owner,
    repo,
    branch,
    path,
    token,
    autoSyncOnSave,
  };
};

export interface RemoteFileInfo {
  exists: boolean;
  sha?: string;
  content?: string;
}

/**
 * Fetch remote file metadata & content directly from GitHub bypassing browser caches.
 * Distinguishes cleanly between 404 (file does not exist) and 200 (file exists with SHA).
 */
export const fetchRemoteFileInfo = async (
  rawSettings: GitHubSettings
): Promise<RemoteFileInfo> => {
  const settings = normalizeGitHubSettings(rawSettings);
  const { token, owner, repo, branch, path } = settings;

  if (!token || !owner || !repo) {
    throw new Error('GitHub設定（トークン・オーナー・リポジトリ名）が不足しています');
  }

  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}&_t=${Date.now()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  });

  if (res.status === 404) {
    return { exists: false };
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody.message || `GitHub API error: ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    throw new Error(`指定されたパス (${path}) はディレクトリです。ファイル名を指定してください。`);
  }

  return {
    exists: true,
    sha: data.sha,
    content: data.content,
  };
};

/**
 * Fetch remote file SHA directly from GitHub bypassing all browser & CDN caching
 */
export const fetchRemoteSha = async (rawSettings: GitHubSettings): Promise<string | null> => {
  try {
    const info = await fetchRemoteFileInfo(rawSettings);
    return info.sha || null;
  } catch (err) {
    console.warn('Failed to fetch remote SHA', err);
    return null;
  }
};

/**
 * Fetch remote todo-data.json from GitHub repository with strict cache busting
 */
export const fetchFromGitHub = async (
  rawSettings: GitHubSettings
): Promise<{ payload: RemotePayload; sha: string }> => {
  const info = await fetchRemoteFileInfo(rawSettings);

  if (!info.exists || !info.content || !info.sha) {
    throw new Error('FILE_NOT_FOUND');
  }

  const rawText = base64ToUtf8(info.content);
  const payload: RemotePayload = JSON.parse(rawText);

  persistLastSha(info.sha);
  persistLastSyncedAt(Date.now());
  return { payload, sha: info.sha };
};

/**
 * Push todo-data.json to GitHub repository (creates or updates).
 * Resolves remote SHA accurately, prevents missing SHA errors, and auto-retries on conflicts.
 */
export const pushToGitHub = async (
  rawSettings: GitHubSettings,
  payload: RemotePayload,
  commitMessage?: string
): Promise<{ newSha: string }> => {
  const settings = normalizeGitHubSettings(rawSettings);
  const { token, owner, repo, branch, path } = settings;

  if (!token || !owner || !repo) {
    throw new Error('GitHub設定（トークン・オーナー・リポジトリ名）が不足しています');
  }

  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  // 1. Fetch fresh remote file info (exists & sha)
  let remoteInfo: RemoteFileInfo;
  try {
    remoteInfo = await fetchRemoteFileInfo(settings);
  } catch (err: any) {
    console.error('Failed to inspect remote file status before push:', err);
    throw err;
  }

  let shaToSend: string | undefined = undefined;
  if (remoteInfo.exists) {
    shaToSend = remoteInfo.sha || loadLastSha() || undefined;
  }

  const jsonString = JSON.stringify(payload, null, 2);
  const contentBase64 = utf8ToBase64(jsonString);

  const now = new Date();
  const defaultMsg = `chore: update dual memo [${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}]`;

  const sendCommit = async (sha?: string): Promise<string> => {
    const body: any = {
      message: commitMessage || defaultMsg,
      content: contentBase64,
      branch,
    };

    if (sha) {
      body.sha = sha;
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody.message || `GitHub error: ${res.status}`;
      const err: any = new Error(msg);
      err.status = res.status;
      throw err;
    }

    const resJson = await res.json();
    return resJson.content?.sha || resJson.commit?.sha;
  };

  try {
    const newSha = await sendCommit(shaToSend);
    if (newSha) {
      persistLastSha(newSha);
      persistLastSyncedAt(Date.now());
    }
    return { newSha };
  } catch (err: any) {
    // If sha wasn't supplied (422) or conflict (409 does not match SHA), retry once with fresh SHA
    const isShaMissingError =
      err.message &&
      (err.message.includes('"sha" wasn\'t supplied') ||
        err.message.includes('sha wasn\'t supplied') ||
        err.message.includes('"sha"'));
    const isConflict =
      err.status === 409 ||
      err.status === 422 ||
      (err.message && err.message.includes('does not match'));

    if (isShaMissingError || isConflict) {
      console.warn(
        'SHA conflict or missing SHA detected, re-fetching latest SHA and retrying commit once...',
        err.message
      );
      try {
        const retryInfo = await fetchRemoteFileInfo(settings);
        if (retryInfo.exists && retryInfo.sha) {
          const newSha = await sendCommit(retryInfo.sha);
          if (newSha) {
            persistLastSha(newSha);
            persistLastSyncedAt(Date.now());
          }
          return { newSha };
        }
      } catch (retryErr) {
        console.error('Failed to retry push with fresh SHA:', retryErr);
      }
    }
    throw err;
  }
};

/**
 * Generic fetch for any JSON file in the same repository (e.g. todo-archive.json)
 */
export const fetchCustomJsonFromGitHub = async <T>(
  settings: GitHubSettings,
  relativePath: string
): Promise<{ payload: T; sha: string } | null> => {
  const customSettings: GitHubSettings = {
    ...settings,
    path: relativePath,
  };
  const remoteInfo = await fetchRemoteFileInfo(customSettings);
  if (!remoteInfo.exists || !remoteInfo.content || !remoteInfo.sha) {
    return null;
  }
  const decodedStr = base64ToUtf8(remoteInfo.content);
  const payload = JSON.parse(decodedStr) as T;
  return { payload, sha: remoteInfo.sha };
};

/**
 * Generic push for any JSON file in the same repository (e.g. todo-archive.json)
 */
export const pushCustomJsonToGitHub = async <T>(
  settings: GitHubSettings,
  relativePath: string,
  payload: T,
  commitMessage?: string
): Promise<{ newSha: string }> => {
  const customSettings: GitHubSettings = {
    ...settings,
    path: relativePath,
  };
  const { owner, repo, branch, token } = normalizeGitHubSettings(customSettings);
  const encodedPath = relativePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const remoteInfo = await fetchRemoteFileInfo(customSettings);
  const shaToSend = remoteInfo.exists ? remoteInfo.sha : undefined;

  const jsonString = JSON.stringify(payload, null, 2);
  const contentBase64 = utf8ToBase64(jsonString);

  const body: any = {
    message: commitMessage || `chore: update archive [${new Date().toISOString()}]`,
    content: contentBase64,
    branch,
  };
  if (shaToSend) {
    body.sha = shaToSend;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `GitHub error: ${res.status}`);
  }

  const resJson = await res.json();
  return { newSha: resJson.content?.sha || resJson.commit?.sha };
};
