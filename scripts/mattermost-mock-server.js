#!/usr/bin/env node
/**
 * Mattermost API Compatible Mock Server (with Web UI)
 * 
 * Provides:
 * - Mattermost REST API v4 endpoints:
 *   - GET  /api/v4/users/me/posts/flagged
 *   - POST /api/v4/users/me/posts/:id/unflag
 *   - POST /api/v4/users/me/posts/:id/flag
 *   - GET  /api/v4/users/:id
 *   - GET  /api/v4/channels/:id
 * - Web UI at http://localhost:8065 for chatting and flagging posts
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8065;

// Initial in-memory mock data
const users = {
  'user_tanaka': { id: 'user_tanaka', username: 'tanaka', first_name: '太郎', last_name: '田中' },
  'user_sato': { id: 'user_sato', username: 'sato', first_name: '花子', last_name: '佐藤' },
  'user_suzuki': { id: 'user_suzuki', username: 'suzuki', first_name: '一郎', last_name: '鈴木' },
  'user_me': { id: 'user_me', username: 'ikari', first_name: 'Shinji', last_name: 'Ikari' },
};

const channels = {
  'channel_dev': { id: 'channel_dev', name: 'dev-core', display_name: '開発コア' },
  'channel_general': { id: 'channel_general', name: 'general', display_name: '全社連絡' },
};

let posts = [
  {
    id: 'post_001',
    create_at: Date.now() - 3600 * 1000 * 2,
    user_id: 'user_tanaka',
    channel_id: 'channel_dev',
    message: '14時頃から決済APIで500エラーが多発しています。先週のデプロイ関連でしょうか？ログの確認をお願いできますでしょうか！',
    is_flagged: true, // Default flagged for quick demo
  },
  {
    id: 'post_002',
    create_at: Date.now() - 3600 * 1000,
    user_id: 'user_sato',
    channel_id: 'channel_dev',
    message: '来期のインフラ構成案のドキュメントを更新しました。今週末 #10/25 までにレビューいただけますと助かります！ https://example.com/doc/arch-2026',
    is_flagged: true, // Default flagged for quick demo
  },
  {
    id: 'post_003',
    create_at: Date.now() - 1800 * 1000,
    user_id: 'user_suzuki',
    channel_id: 'channel_general',
    message: 'お疲れ様です！来週の社内ハッカソンの出欠アンケートまだの方はお早めにご回答をお願いしますー。',
    is_flagged: false,
  },
];

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  // --- API Endpoints ---

  // 1. GET /api/v4/users/me/posts/flagged
  if (method === 'GET' && pathname === '/api/v4/users/me/posts/flagged') {
    const flagged = posts.filter((p) => p.is_flagged);
    const order = flagged.map((p) => p.id);
    const postsObj = {};
    flagged.forEach((p) => {
      postsObj[p.id] = {
        id: p.id,
        create_at: p.create_at,
        user_id: p.user_id,
        channel_id: p.channel_id,
        message: p.message,
        original_id: '',
      };
    });
    return sendJson(res, 200, { order, posts: postsObj });
  }

  // 2. POST /api/v4/users/me/posts/:id/unflag
  const unflagMatch = pathname.match(/^\/api\/v4\/users\/me\/posts\/([^\/]+)\/unflag$/);
  if (method === 'POST' && unflagMatch) {
    const postId = unflagMatch[1];
    const target = posts.find((p) => p.id === postId);
    if (target) {
      target.is_flagged = false;
      return sendJson(res, 200, { status: 'OK' });
    }
    return sendJson(res, 404, { message: 'Post not found' });
  }

  // 3. POST /api/v4/users/me/posts/:id/flag
  const flagMatch = pathname.match(/^\/api\/v4\/users\/me\/posts\/([^\/]+)\/flag$/);
  if (method === 'POST' && flagMatch) {
    const postId = flagMatch[1];
    const target = posts.find((p) => p.id === postId);
    if (target) {
      target.is_flagged = true;
      return sendJson(res, 200, { status: 'OK' });
    }
    return sendJson(res, 404, { message: 'Post not found' });
  }

  // 4. GET /api/v4/users/:id
  const userMatch = pathname.match(/^\/api\/v4\/users\/([^\/]+)$/);
  if (method === 'GET' && userMatch) {
    const uid = userMatch[1];
    const user = users[uid] || { id: uid, username: uid, first_name: '', last_name: '' };
    return sendJson(res, 200, user);
  }

  // 5. GET /api/v4/channels/:id
  const channelMatch = pathname.match(/^\/api\/v4\/channels\/([^\/]+)$/);
  if (method === 'GET' && channelMatch) {
    const cid = channelMatch[1];
    const channel = channels[cid] || { id: cid, name: cid, display_name: cid };
    return sendJson(res, 200, channel);
  }

  // 6. POST /api/mock/new_post (Helper for UI to create posts)
  if (method === 'POST' && pathname === '/api/mock/new_post') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const newPost = {
          id: `post_${Date.now()}`,
          create_at: Date.now(),
          user_id: parsed.user_id || 'user_tanaka',
          channel_id: 'channel_dev',
          message: parsed.message || '',
          is_flagged: true,
        };
        posts.unshift(newPost);
        sendJson(res, 201, newPost);
      } catch (e) {
        sendJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // Ignore favicon
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Web UI (HTML) ---
  if ((method === 'GET' || method === 'HEAD') && (pathname === '/' || pathname.startsWith('/team/pl/'))) {
    const flaggedCount = posts.filter((p) => p.is_flagged).length;
    const highlightPostId = pathname.startsWith('/team/pl/') ? pathname.replace('/team/pl/', '') : null;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mattermost Mock (Local Test)</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col font-sans">
  <!-- Top Bar -->
  <header class="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between text-xs">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 font-bold text-sm text-blue-400">
        <span>💬 Mattermost Mock</span>
        <span class="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded font-mono">v4 API Compatible</span>
      </div>
      <span class="text-slate-400">|</span>
      <span class="text-slate-300">#dev-core (開発コア)</span>
    </div>
    <div class="flex items-center gap-3">
      <div class="bg-amber-950/60 border border-amber-600/40 text-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
        <span>🚩 旗付き（未処理）:</span>
        <span id="flag-count" class="font-bold text-amber-200 text-sm">${flaggedCount}</span>
        <span>件</span>
      </div>
      <div class="text-[11px] text-slate-400 font-mono bg-slate-950/80 px-2 py-1 rounded border border-slate-700">
        npm run sync:mattermost
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left Sidebar -->
    <aside class="w-56 bg-slate-950/80 border-r border-slate-800 p-3 hidden sm:flex flex-col text-xs space-y-4">
      <div>
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">チャンネル</div>
        <div class="space-y-1">
          <div class="px-2 py-1.5 rounded bg-blue-600/20 text-blue-300 font-semibold flex items-center gap-1.5">
            <span>#</span> dev-core
          </div>
          <div class="px-2 py-1.5 rounded hover:bg-slate-800 text-slate-400 flex items-center gap-1.5">
            <span>#</span> general
          </div>
        </div>
      </div>
      <div class="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
        <p class="font-semibold text-slate-300 mb-1">💡 テスト手順:</p>
        <ol class="list-decimal pl-4 space-y-1 text-slate-400">
          <li>依頼メッセージの右上の <b class="text-amber-400">🚩 旗マーク</b> を押す（相手に見えません）</li>
          <li>ターミナルで <code class="text-blue-300 bg-slate-800 px-1 rounded">npm run sync:mattermost</code> を実行</li>
          <li>Dual Memo TODO を開くと最上部に <b class="text-emerald-400">!staging</b> で登場！</li>
        </ol>
      </div>
    </aside>

    <!-- Chat Messages View -->
    <main class="flex-1 flex flex-col bg-slate-900">
      <div class="flex-1 overflow-y-auto p-4 space-y-3" id="posts-container">
        ${posts
          .map((p) => {
            const user = users[p.user_id] || { username: p.user_id, last_name: '', first_name: '' };
            const timeStr = new Date(p.create_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            const isHighlight = p.id === highlightPostId;
            return `
          <div id="${p.id}" class="group relative p-3 rounded-lg border transition-all ${
              isHighlight ? 'bg-blue-950/40 border-blue-500/80 ring-2 ring-blue-500/30' : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
            }">
            <div class="flex items-baseline justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-200 text-xs">@${user.username}</span>
                <span class="text-[11px] text-slate-400">(${user.last_name} ${user.first_name})</span>
                <span class="text-[10px] text-slate-500">${timeStr}</span>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  onclick="toggleFlag('${p.id}')"
                  class="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                    p.is_flagged
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                  }"
                  title="${p.is_flagged ? '保存解除 (Unflag)' : '保存する (Flag - 相手に見えません)'}"
                >
                  <span>🚩</span>
                  <span class="text-[10px]">${p.is_flagged ? '保存中' : '保存'}</span>
                </button>
              </div>
            </div>
            <div class="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">${escapeHtml(p.message)}</div>
            <div class="mt-2 text-[10px] text-slate-500 font-mono">
              URL: <a href="/team/pl/${p.id}" class="text-blue-400 hover:underline">http://localhost:8065/team/pl/${p.id}</a>
            </div>
          </div>
          `;
          })
          .join('')}
      </div>

      <!-- Quick Message Input Form -->
      <div class="p-3 bg-slate-950/90 border-t border-slate-800 flex gap-2">
        <select id="user-select" class="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 text-xs focus:outline-none">
          <option value="user_tanaka">@tanaka (田中)</option>
          <option value="user_sato">@sato (佐藤)</option>
          <option value="user_suzuki">@suzuki (鈴木)</option>
        </select>
        <input 
          id="msg-input" 
          type="text" 
          placeholder="新しい依頼メッセージを入力してEnter (自動で旗が立ちます)..."
          class="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          onkeydown="if(event.key==='Enter') createPost()"
        />
        <button 
          onclick="createPost()" 
          class="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3 py-1.5 rounded transition-colors"
        >
          送信 ＆ 旗付け
        </button>
      </div>
    </main>
  </div>

  <script>
    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function toggleFlag(postId) {
      const btn = event.currentTarget;
      const isCurrentlyFlagged = btn.innerText.includes('保存中');
      const endpoint = isCurrentlyFlagged ? \`/api/v4/users/me/posts/\${postId}/unflag\` : \`/api/v4/users/me/posts/\${postId}/flag\`;
      await fetch(endpoint, { method: 'POST' });
      location.reload();
    }

    async function createPost() {
      const input = document.getElementById('msg-input');
      const userSelect = document.getElementById('user-select');
      const message = input.value.trim();
      if (!message) return;

      await fetch('/api/mock/new_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, user_id: userSelect.value }),
      });
      location.reload();
    }
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Fallback 404
  sendJson(res, 404, { message: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Mattermost API Mock Server started on:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`   👉 http://127.0.0.1:${PORT}`);
  console.log(`   👉 Flagged API: http://localhost:${PORT}/api/v4/users/me/posts/flagged`);
  console.log(`======================================================\n`);
});
