import { GitHubSettings, RemotePayload } from '../types/github';

const STORAGE_KEY_GITHUB_SETTINGS = 'dual_memo_github_settings_v1';
const STORAGE_KEY_GITHUB_SHA = 'dual_memo_github_sha_v1';

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
  const cleanBase64 = base64.replace(/\n/g, '');
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

/**
 * Fetch remote todo-data.json from GitHub repository
 */
export const fetchFromGitHub = async (
  settings: GitHubSettings
): Promise<{ payload: RemotePayload; sha: string }> => {
  const { token, owner, repo, branch, path } = settings;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'If-None-Match': '', // bypass caching
    },
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
  return { payload, sha: json.sha };
};

/**
 * Push todo-data.json to GitHub repository (creates or updates)
 */
export const pushToGitHub = async (
  settings: GitHubSettings,
  payload: RemotePayload,
  commitMessage?: string
): Promise<{ newSha: string }> => {
  const { token, owner, repo, branch, path } = settings;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // Check if we have an existing SHA or need to fetch current SHA to avoid conflict
  let currentSha = loadLastSha();
  try {
    const checkRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      currentSha = checkJson.sha;
    }
  } catch {
    // If check fails, fallback to stored SHA
  }

  const jsonString = JSON.stringify(payload, null, 2);
  const contentBase64 = utf8ToBase64(jsonString);

  const now = new Date();
  const defaultMsg = `chore: update dual memo [${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}]`;

  const body: any = {
    message: commitMessage || defaultMsg,
    content: contentBase64,
    branch: branch || 'main',
  };

  if (currentSha) {
    body.sha = currentSha;
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
    throw new Error(errBody.message || `Failed to push to GitHub: ${res.status}`);
  }

  const resJson = await res.json();
  const newSha = resJson.content?.sha || resJson.commit?.sha;
  if (newSha) {
    persistLastSha(newSha);
  }

  return { newSha };
};
