import { GitHubSettings, RemotePayload } from '../types/github';
import { base64ToUtf8, utf8ToBase64, persistLastSha, persistLastSyncedAt } from './githubSync';

export interface GitLabProjectMetadata {
  id: string;
  defaultBranch: string;
  emptyRepo: boolean;
  name: string;
  pathWithNamespace: string;
}

export interface GitLabFileInfo {
  exists: boolean;
  sha?: string;
  content?: string; // base64
}

/**
 * Resolve GitLab API Base URL (e.g. https://gitlab.internal.example.com/api/v4)
 */
export const getGitLabApiBase = (settings: GitHubSettings): string => {
  let base = (settings.baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) {
    base = 'https://gitlab.com';
  }
  if (!base.endsWith('/api/v4')) {
    base = `${base}/api/v4`;
  }
  return base;
};

/**
 * Resolve GitLab project identifier (numeric ID or URL-encoded "group%2Frepo")
 */
export const getGitLabProjectId = (settings: GitHubSettings): string => {
  const owner = (settings.owner || '').trim();
  const repo = (settings.repo || '').trim();

  if (!owner) {
    return encodeURIComponent(repo.replace(/^\/+|\/+$/g, ''));
  }
  const fullPath = `${owner}/${repo}`.replace(/^\/+|\/+$/g, '');
  return encodeURIComponent(fullPath);
};

/**
 * Helper to perform GitLab API requests with PRIVATE-TOKEN & Bearer headers
 */
export const gitLabApiFetch = async (
  settings: GitHubSettings,
  endpoint: string,
  init: RequestInit = {}
): Promise<Response> => {
  const base = getGitLabApiBase(settings);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;

  const headers = new Headers(init.headers || {});
  if (settings.token) {
    const cleanToken = settings.token.trim();
    headers.set('PRIVATE-TOKEN', cleanToken);
    headers.set('Authorization', `Bearer ${cleanToken}`);
  }

  return fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });
};

/**
 * Test GitLab connectivity, PAT permissions, project accessibility, and branch
 */
export const testGitLabConnection = async (
  settings: GitHubSettings
): Promise<{ success: boolean; message: string; username?: string; detectedBranch?: string }> => {
  if (!settings.token || !settings.repo) {
    return { success: false, message: 'Token と プロジェクト名 (Repo) を入力してください' };
  }

  try {
    // 1. Fetch user profile (PAT test)
    let username = '';
    try {
      const userRes = await gitLabApiFetch(settings, '/user');
      if (userRes.ok) {
        const userData = await userRes.json();
        username = userData.username || userData.name || '';
      }
    } catch (e) {
      console.warn('GitLab /user fetch failed:', e);
    }

    // 2. Fetch project metadata
    const rawProjectId = getGitLabProjectId(settings);
    const projRes = await gitLabApiFetch(settings, `/projects/${rawProjectId}`);
    if (!projRes.ok) {
      let errMsg = `${projRes.status} ${projRes.statusText}`;
      try {
        const errJson = await projRes.json();
        if (errJson.message) {
          errMsg += ` - ${typeof errJson.message === 'string' ? errJson.message : JSON.stringify(errJson.message)}`;
        }
      } catch {}
      return {
        success: false,
        message: `プロジェクト "${decodeURIComponent(rawProjectId)}" の取得に失敗しました: ${errMsg}`,
        username,
      };
    }

    const projData = await projRes.json();
    const defaultBranch = projData.default_branch || 'main';
    const targetBranch = settings.branch?.trim() || defaultBranch;

    if (projData.empty_repo) {
      return {
        success: false,
        message: `接続成功しましたが、プロジェクト「${projData.path_with_namespace || projData.name}」は空のリポジトリです。初期コミットを作成してください。`,
        username,
      };
    }

    // 3. Test branch access via tree API
    const treeRes = await gitLabApiFetch(
      settings,
      `/projects/${rawProjectId}/repository/tree?ref=${encodeURIComponent(targetBranch)}&per_page=1`
    );

    if (treeRes.ok) {
      return {
        success: true,
        message: `接続成功: ${projData.path_with_namespace || projData.name} (ブランチ: ${targetBranch})`,
        username,
        detectedBranch: targetBranch,
      };
    }

    // If targetBranch failed, check defaultBranch
    if (targetBranch !== defaultBranch) {
      const defTreeRes = await gitLabApiFetch(
        settings,
        `/projects/${rawProjectId}/repository/tree?ref=${encodeURIComponent(defaultBranch)}&per_page=1`
      );
      if (defTreeRes.ok) {
        return {
          success: true,
          message: `指定ブランチ "${targetBranch}" は見つかりませんでしたが、デフォルトブランチ "${defaultBranch}" に接続成功しました。`,
          username,
          detectedBranch: defaultBranch,
        };
      }
    }

    return {
      success: true,
      message: `接続成功: ${projData.path_with_namespace || projData.name}`,
      username,
      detectedBranch: defaultBranch,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `GitLab接続エラー: ${err.message || err}`,
    };
  }
};

/**
 * Fetch remote file info & content from GitLab Repository Files API
 */
export const fetchRemoteGitLabFileInfo = async (
  settings: GitHubSettings,
  relativePath: string
): Promise<GitLabFileInfo> => {
  const projectId = getGitLabProjectId(settings);
  const branch = encodeURIComponent(settings.branch?.trim() || 'main');
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);

  const endpoint = `/projects/${projectId}/repository/files/${encodedPath}?ref=${branch}&_t=${Date.now()}`;
  const res = await gitLabApiFetch(settings, endpoint);

  if (res.status === 404) {
    return { exists: false };
  }

  if (!res.ok) {
    let errMsg = `${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.message) {
        errMsg += ` - ${typeof errJson.message === 'string' ? errJson.message : JSON.stringify(errJson.message)}`;
      }
    } catch {}
    throw new Error(`GitLab APIエラー: ${errMsg}`);
  }

  const data = await res.json();
  return {
    exists: true,
    sha: data.blob_id || data.commit_id,
    content: data.content,
  };
};

/**
 * Fetch todo-data.json from GitLab repository
 */
export const fetchFromGitLab = async (
  settings: GitHubSettings
): Promise<{ payload: RemotePayload; sha: string }> => {
  const path = settings.path || 'todo-data.json';
  const info = await fetchRemoteGitLabFileInfo(settings, path);

  if (!info.exists || !info.content) {
    throw new Error('FILE_NOT_FOUND');
  }

  const rawText = base64ToUtf8(info.content);
  const payload: RemotePayload = JSON.parse(rawText);
  const sha = info.sha || 'gitlab-blob';

  persistLastSha(sha);
  persistLastSyncedAt(Date.now());
  return { payload, sha };
};

/**
 * Push todo-data.json to GitLab repository
 */
export const pushToGitLab = async (
  settings: GitHubSettings,
  payload: RemotePayload,
  commitMessage?: string
): Promise<{ newSha: string }> => {
  const path = settings.path || 'todo-data.json';
  return pushCustomJsonToGitLab(settings, path, payload, commitMessage || 'chore: update dual memo via PWA');
};

/**
 * Generic fetch for any JSON file in the same GitLab repository (e.g. todo-archive.json, todo-staging.json)
 */
export const fetchCustomJsonFromGitLab = async <T>(
  settings: GitHubSettings,
  relativePath: string
): Promise<{ payload: T; sha: string } | null> => {
  try {
    const info = await fetchRemoteGitLabFileInfo(settings, relativePath);
    if (!info.exists || !info.content) {
      return null;
    }
    const decodedStr = base64ToUtf8(info.content);
    const payload = JSON.parse(decodedStr) as T;
    return { payload, sha: info.sha || 'gitlab-blob' };
  } catch (err) {
    console.warn(`Failed to fetch custom json from GitLab (${relativePath}):`, err);
    return null;
  }
};

/**
 * Generic push for any JSON file in the same GitLab repository
 */
export const pushCustomJsonToGitLab = async <T>(
  settings: GitHubSettings,
  relativePath: string,
  payload: T,
  commitMessage?: string
): Promise<{ newSha: string }> => {
  const projectId = getGitLabProjectId(settings);
  const branch = settings.branch?.trim() || 'main';
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);

  // Check if file already exists
  let fileExists = false;
  try {
    const info = await fetchRemoteGitLabFileInfo(settings, cleanPath);
    fileExists = info.exists;
  } catch {
    fileExists = false;
  }

  const jsonString = JSON.stringify(payload, null, 2);
  const contentBase64 = utf8ToBase64(jsonString);

  const defaultMsg = `chore: update ${cleanPath} [${new Date().toISOString()}]`;
  const filePayload = {
    branch,
    commit_message: commitMessage || defaultMsg,
    content: contentBase64,
    encoding: 'base64',
  };

  const method = fileExists ? 'PUT' : 'POST';
  let res = await gitLabApiFetch(settings, `/projects/${projectId}/repository/files/${encodedPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(filePayload),
  });

  // If 404 or 400 (e.g. file already existed or doesn't exist yet, or reverse proxy decoded %2F)
  if (!res.ok) {
    // Try the Commits API fallback, which avoids URL %2F problems by putting file_path in JSON body
    const fallbackAction = fileExists ? 'update' : 'create';
    const commitBody = {
      branch,
      commit_message: commitMessage || defaultMsg,
      actions: [
        {
          action: fallbackAction,
          file_path: cleanPath,
          content: contentBase64,
          encoding: 'base64',
        },
      ],
    };

    const commitRes = await gitLabApiFetch(settings, `/projects/${projectId}/repository/commits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitBody),
    });

    if (commitRes.ok) {
      res = commitRes;
    } else {
      // If update failed, try create or vice versa
      const invertedAction = fileExists ? 'create' : 'update';
      const retryBody = {
        branch,
        commit_message: commitMessage || defaultMsg,
        actions: [
          {
            action: invertedAction,
            file_path: cleanPath,
            content: contentBase64,
            encoding: 'base64',
          },
        ],
      };
      const retryRes = await gitLabApiFetch(settings, `/projects/${projectId}/repository/commits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(retryBody),
      });

      if (retryRes.ok) {
        res = retryRes;
      } else {
        let errMsg = `${res.status} ${res.statusText}`;
        try {
          const errData = await res.json();
          if (errData.message) errMsg += ` - ${typeof errData.message === 'string' ? errData.message : JSON.stringify(errData.message)}`;
        } catch {}
        throw new Error(`GitLabプッシュエラー: ${errMsg}`);
      }
    }
  }

  const resData = await res.json().catch(() => ({}));
  const newSha = resData.id || resData.commit_id || resData.content_sha256 || `gl-${Date.now()}`;

  persistLastSha(newSha);
  persistLastSyncedAt(Date.now());
  return { newSha };
};
