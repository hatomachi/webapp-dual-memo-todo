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
 * Fetch remote file SHA directly from GitHub bypassing all browser & CDN caching
 */
export const fetchRemoteSha = async (settings: GitHubSettings): Promise<string | null> => {
  const { token, owner, repo, branch, path } = settings;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&_t=${Date.now()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'If-None-Match': '',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return data.sha || null;
    }
  } catch (err) {
    console.warn('Failed to fetch remote SHA', err);
  }
  return null;
};

/**
 * Fetch remote todo-data.json from GitHub repository with strict cache busting
 */
export const fetchFromGitHub = async (
  settings: GitHubSettings
): Promise<{ payload: RemotePayload; sha: string }> => {
  const { token, owner, repo, branch, path } = settings;
  // Always attach timestamp query parameter and no-cache headers to prevent iOS Safari/Chrome stale cache
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&_t=${Date.now()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      'If-None-Match': '',
    },
    cache: 'no-store',
  });

  if (res.status === 404) {
    throw new Error('FILE_NOT_FOUND');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `GitHub API error: ${res.status}`);
  }

  const json = await res.json();
  const rawText = base64ToUtf8(json.content);
  const payload: RemotePayload = JSON.parse(rawText);

  persistLastSha(json.sha);
  persistLastSyncedAt(Date.now());
  return { payload, sha: json.sha };
};

/**
 * Push todo-data.json to GitHub repository (creates or updates).
 * Includes auto-fetch of latest SHA and auto-retry on 409 Conflict.
 */
export const pushToGitHub = async (
  settings: GitHubSettings,
  payload: RemotePayload,
  commitMessage?: string
): Promise<{ newSha: string }> => {
  const { token, owner, repo, branch, path } = settings;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // 1. Fetch fresh SHA from GitHub directly
  let currentSha = await fetchRemoteSha(settings);
  if (!currentSha) {
    currentSha = loadLastSha();
  }

  const jsonString = JSON.stringify(payload, null, 2);
  const contentBase64 = utf8ToBase64(jsonString);

  const now = new Date();
  const defaultMsg = `chore: update dual memo [${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}]`;

  const sendCommit = async (shaToSend?: string | null): Promise<string> => {
    const body: any = {
      message: commitMessage || defaultMsg,
      content: contentBase64,
      branch: branch || 'main',
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
      const msg = errBody.message || `GitHub error: ${res.status}`;
      const err: any = new Error(msg);
      err.status = res.status;
      throw err;
    }

    const resJson = await res.json();
    return resJson.content?.sha || resJson.commit?.sha;
  };

  try {
    const newSha = await sendCommit(currentSha);
    if (newSha) {
      persistLastSha(newSha);
      persistLastSyncedAt(Date.now());
    }
    return { newSha };
  } catch (err: any) {
    // If conflict (409 does not match SHA), retry once with freshly fetched SHA
    if (err.status === 409 || (err.message && err.message.includes('does not match'))) {
      console.warn('SHA conflict detected, re-fetching latest SHA and retrying commit once...');
      const retrySha = await fetchRemoteSha(settings);
      const newSha = await sendCommit(retrySha);
      if (newSha) {
        persistLastSha(newSha);
        persistLastSyncedAt(Date.now());
      }
      return { newSha };
    }
    throw err;
  }
};
