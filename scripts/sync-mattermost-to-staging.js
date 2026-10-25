#!/usr/bin/env node
/**
 * Mattermost Flagged Posts to Dual Memo TODO Staging Synchronizer (Autonomous AI Drafter)
 * 
 * Fetches flagged (Saved) posts from Mattermost API, reads current todo-data.json
 * context (existing themes and categories), autonomously drafts optimal task definitions
 * (concise action title, theme mapping, due date, full message in comments) using LLM / heuristics,
 * appends them to todo-staging.json, and automatically unflags the processed posts.
 * 
 * Usage:
 *   node scripts/sync-mattermost-to-staging.js
 * 
 * Environment variables:
 *   MATTERMOST_URL   (default: http://localhost:8065)
 *   MATTERMOST_TOKEN (optional for mock, required for real Mattermost PAT)
 *   MAIN_DATA_PATH   (default: /Users/s-ikari/work/dual-memo-data/todo-data.json)
 *   STAGING_PATH     (default: /Users/s-ikari/work/dual-memo-data/todo-staging.json)
 *   GEMINI_API_KEY   (optional: if provided, uses Gemini 2.5 Flash for smart inference)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MATTERMOST_URL = (process.env.MATTERMOST_URL || 'http://localhost:8065').replace(/\/+$/, '');
const MATTERMOST_TOKEN = process.env.MATTERMOST_TOKEN || '';
const DEFAULT_MAIN_DATA_PATH = path.resolve(__dirname, '../../dual-memo-data/todo-data.json');
const MAIN_DATA_PATH = process.env.MAIN_DATA_PATH || DEFAULT_MAIN_DATA_PATH;
const DEFAULT_STAGING_PATH = path.resolve(__dirname, '../../dual-memo-data/todo-staging.json');
const STAGING_PATH = process.env.STAGING_PATH || DEFAULT_STAGING_PATH;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Headers for Mattermost API
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (MATTERMOST_TOKEN) {
    headers['Authorization'] = `Bearer ${MATTERMOST_TOKEN}`;
  }
  return headers;
};

// Generate unique ID
const generateId = () => {
  return 'mm_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(4);
};

// Fallback rule-based title extraction
const extractTaskTitleFallback = (message) => {
  if (!message) return 'Mattermost依頼の確認';
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || 'Mattermost依頼の確認';

  let title = firstLine
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^[@＠][^\s]+\s*/, '')
    .replace(/^[・･•\-\*]\s*/, '')
    .trim();

  // Keyword-based cleanup into verb phrases
  if (/500|エラー|障害|バグ|動かない|落ち/.test(title)) {
    const errorMatch = title.match(/([^\s]+API|[^\s]+機能|[^\s]+画面|[^\s]+システム)/);
    const target = errorMatch ? errorMatch[0] : 'システム';
    return `${target}エラーの調査・対応`;
  }
  if (/レビュー|確認|見て|チェック/.test(title)) {
    const docMatch = title.match(/([^\s]+案|[^\s]+ドキュメント|[^\s]+仕様書|[^\s]+PR|[^\s]+コード)/);
    const target = docMatch ? docMatch[0] : 'ドキュメント';
    return `${target}のレビュー・確認`;
  }

  if (title.length > 25) {
    title = title.substring(0, 25) + '…';
  }
  return title || 'Mattermost依頼の確認';
};

// Extract due date tag (#MM/DD or #M/D) from message
const extractDueDate = (message) => {
  const match = message.match(/[#＃](?:(?:\d{4}|\d{2})[-/])?(\d{1,2}[-/]\d{1,2})/);
  if (match) {
    return match[1].replace('-', '/');
  }
  return null;
};

// Rule-based theme mapping
const inferThemeFallback = (message, knownThemes) => {
  const lowerMsg = message.toLowerCase();
  for (const th of knownThemes) {
    if (th.toLowerCase() === 'uncategorized') continue;
    const cleanTh = th.toLowerCase().replace(/[:_]/g, ' ');
    const parts = cleanTh.split(' ').filter((p) => p.length > 1);
    for (const p of parts) {
      if (lowerMsg.includes(p)) {
        return th;
      }
    }
  }
  return 'Uncategorized';
};

/**
 * Autonomous AI Drafter: Uses Gemini API if key is available, else smart heuristics
 */
async function generateSmartTaskDraft(post, username, channelName, knownThemes, knownCategories) {
  const message = post.message || '';

  if (GEMINI_API_KEY) {
    try {
      const prompt = `あなたは優秀なタスク管理アシスタントです。
ユーザー宛てのチャットメッセージを分析し、ユーザーのTODOリストに追加するための最適なタスク定義をJSONで作成してください。

【チャットメッセージ】
発言者: @${username}
チャンネル: #${channelName}
本文:
"""
${message}
"""

【既存のテーマ一覧（右ペイン）】
${JSON.stringify(knownThemes)}

【既存の分類一覧（左ペイン）】
${JSON.stringify(knownCategories)}

【出力要件 (JSON)】
以下のキーを持つ単一のJSONオブジェクトのみを返してください。Markdownのコードブロックは不要です。
{
  "title": "ユーザーが実行すべきアクションを表す簡潔な動詞終止形のタイトル（10〜18文字以内。チャットの挨拶や長文を排除し、タスクの核心だけを抜き出す。例: '決済API 500エラー調査', 'インフラ構成案のレビュー')",
  "theme": "既存のテーマ一覧の中から最も適したテーマを1つ選択。どれにも合わない場合は 'Uncategorized'",
  "category": "既存の分類一覧の中から最も適切なものを選択（通常は 'ワーク' または 'inbox'）",
  "dueDate": "メッセージ内に期日（'今週末', '10/25まで', '明日'等）の言及があれば 'MM/DD' 形式で。無ければ null",
  "summary": "依頼の要点を1行（30文字以内）で要約"
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          return {
            title: parsed.title || extractTaskTitleFallback(message),
            theme: parsed.theme || inferThemeFallback(message, knownThemes),
            category: parsed.category || 'ワーク',
            dueDate: parsed.dueDate || extractDueDate(message),
            summary: parsed.summary || message.slice(0, 40),
            aiGenerated: true,
          };
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ Gemini API呼び出し失敗、スマートヒューリスティクスへフォールバック:`, err.message);
    }
  }

  // Fallback to smart heuristics
  const title = extractTaskTitleFallback(message);
  const theme = inferThemeFallback(message, knownThemes);
  const dueDate = extractDueDate(message);

  return {
    title,
    theme,
    category: 'ワーク',
    dueDate,
    summary: message.slice(0, 40),
    aiGenerated: false,
  };
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🤖 Mattermost ➔ Dual Memo TODO 自律型AIドラフト同期`);
  console.log(`   Mattermost: ${MATTERMOST_URL}`);
  console.log(`   Main Data:  ${MAIN_DATA_PATH}`);
  console.log(`   Staging:    ${STAGING_PATH}`);
  console.log(`   AI Engine:  ${GEMINI_API_KEY ? '✨ Gemini 2.5 Flash' : '🧠 Smart Context Heuristics'}`);
  console.log(`======================================================\n`);

  // 1. Read existing todo-data.json for context (themes & categories)
  let knownThemes = ['Uncategorized'];
  let knownCategories = ['ワーク', 'inbox'];

  if (fs.existsSync(MAIN_DATA_PATH)) {
    try {
      const rawMain = fs.readFileSync(MAIN_DATA_PATH, 'utf-8');
      const mainJson = JSON.parse(rawMain);
      if (Array.isArray(mainJson.themes) && mainJson.themes.length > 0) {
        knownThemes = mainJson.themes;
      }
      if (Array.isArray(mainJson.categories) && mainJson.categories.length > 0) {
        knownCategories = mainJson.categories;
      }
      console.log(`📖 現在のコンテキストを読込完了:`);
      console.log(`   テーマ (${knownThemes.length}): ${knownThemes.slice(0, 5).join(', ')}${knownThemes.length > 5 ? '…' : ''}`);
      console.log(`   分類   (${knownCategories.length}): ${knownCategories.join(', ')}\n`);
    } catch (e) {
      console.warn(`⚠️ 本番データの読み込みに失敗しました:`, e.message);
    }
  }

  // 2. Fetch flagged posts from Mattermost
  console.log(`⏳ 旗マーク（保存）のついた投稿を取得中...`);
  let flaggedData;
  try {
    const res = await fetch(`${MATTERMOST_URL}/api/v4/users/me/posts/flagged`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Mattermost API Error: ${res.status} ${res.statusText}`);
    }
    flaggedData = await res.json();
  } catch (err) {
    console.error(`❌ Mattermostからの取得に失敗しました:`, err.message);
    process.exit(1);
  }

  const postIds = flaggedData.order || [];
  const postsMap = flaggedData.posts || {};

  if (postIds.length === 0) {
    console.log(`✨ 旗マークのついた新しい投稿はありません（未処理ゼロ）。`);
    return;
  }

  console.log(`🎯 ${postIds.length}件の旗付き投稿を検出。裏で自律的にドラフトを生成します...\n`);

  const userCache = new Map();
  const channelCache = new Map();

  const getUserName = async (userId) => {
    if (userCache.has(userId)) return userCache.get(userId);
    try {
      const res = await fetch(`${MATTERMOST_URL}/api/v4/users/${userId}`, { headers: getHeaders() });
      if (res.ok) {
        const u = await res.json();
        const name = u.username || u.id;
        userCache.set(userId, name);
        return name;
      }
    } catch {}
    return userId;
  };

  const getChannelName = async (channelId) => {
    if (channelCache.has(channelId)) return channelCache.get(channelId);
    try {
      const res = await fetch(`${MATTERMOST_URL}/api/v4/channels/${channelId}`, { headers: getHeaders() });
      if (res.ok) {
        const c = await res.json();
        const name = c.name || c.id;
        channelCache.set(channelId, name);
        return name;
      }
    } catch {}
    return channelId;
  };

  // 3. Read existing todo-staging.json
  let stagingData = { version: 1, updatedAt: new Date().toISOString(), tasks: [] };
  if (fs.existsSync(STAGING_PATH)) {
    try {
      const raw = fs.readFileSync(STAGING_PATH, 'utf-8');
      stagingData = JSON.parse(raw);
      if (!Array.isArray(stagingData.tasks)) stagingData.tasks = [];
    } catch (e) {
      console.warn(`⚠️ stagingファイルの読み込みに失敗したため新規作成します:`, e.message);
    }
  }

  const existingPostUrls = new Set(
    stagingData.tasks.map((t) => t.postUrl).filter(Boolean)
  );

  const newTasks = [];
  const processedPostIds = [];

  for (const postId of postIds) {
    const post = postsMap[postId];
    if (!post) continue;

    const postUrl = `${MATTERMOST_URL}/team/pl/${post.id}`;

    // Skip if already imported into staging
    if (existingPostUrls.has(postUrl)) {
      console.log(`  ⏩ スキップ (既に待合室に存在): [${post.id}]`);
      processedPostIds.push(post.id);
      continue;
    }

    const username = await getUserName(post.user_id);
    const channelName = await getChannelName(post.channel_id);

    // AI Drafter: Infer title, theme, category, due date
    const draft = await generateSmartTaskDraft(post, username, channelName, knownThemes, knownCategories);

    const dateStr = new Date(post.create_at).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Indented comments preserving original context
    const comments = [
      `↳ 👤 @${username} (${dateStr} / #${channelName})`,
    ];

    const rawLines = post.message.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length > 0) {
      const snippet = rawLines.slice(0, 3).join(' ');
      comments.push(`↳ 💬 「${snippet}」`);
    }

    comments.push(`↳ 🔗 ${postUrl}`);

    const newTask = {
      id: generateId(),
      title: draft.title,
      category: 'staging',
      theme: draft.theme,
      dueDate: draft.dueDate,
      comments,
      order: stagingData.tasks.length + newTasks.length,
      source: 'mattermost',
      createdAt: new Date().toISOString(),
      postUrl,
      author: username,
    };

    newTasks.push(newTask);
    processedPostIds.push(post.id);

    console.log(`  ✨ AI生成ドラフト: ・${draft.title} ${draft.dueDate ? '#' + draft.dueDate : ''} [${draft.theme}]`);
    console.log(`     ${comments[0]}`);
  }

  if (newTasks.length > 0) {
    // 4. Save to todo-staging.json
    stagingData.tasks = [...newTasks, ...stagingData.tasks];
    stagingData.updatedAt = new Date().toISOString();

    fs.writeFileSync(STAGING_PATH, JSON.stringify(stagingData, null, 2), 'utf-8');
    console.log(`\n💾 ${newTasks.length}件のドラフトを待合室（todo-staging.json）に裏保存完了！`);

    // 4.5 Auto-push to GitHub if staging path is inside a git repo
    const stagingDir = path.dirname(STAGING_PATH);
    if (fs.existsSync(path.join(stagingDir, '.git'))) {
      try {
        console.log(`☁️ GitHub Private Repo へ自動プッシュ中...`);
        execSync(`git pull --rebase && git add todo-staging.json && (git diff-index --quiet HEAD || git commit -m "feat(staging): sync ${newTasks.length} tasks from Mattermost") && git push origin main`, {
          cwd: stagingDir,
          stdio: 'pipe',
        });
        console.log(`  ✓ GitHubへのプッシュ完了！（PWA/スマホ側にも即時反映されます）`);
      } catch (gitErr) {
        console.warn(`  ⚠️ GitHubへの自動プッシュをスキップしました:`, gitErr.message);
      }
    }
  }

  // 5. Unflag processed posts in Mattermost
  console.log(`\n🧹 Mattermostの旗マーク（保存）を自動解除中...`);
  for (const pid of processedPostIds) {
    try {
      const unflagRes = await fetch(`${MATTERMOST_URL}/api/v4/users/me/posts/${pid}/unflag`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (unflagRes.ok) {
        console.log(`  ✓ 旗解除完了: [${pid}]`);
      }
    } catch (e) {
      console.warn(`  ⚠️ 旗解除失敗 [${pid}]:`, e.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 完了！Dual Memo TODO のヘッダー「📥 待合室」から`);
  console.log(`   裏で作成されたドラフトを確認・1タップ採用できます。`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
