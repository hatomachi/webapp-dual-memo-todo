#!/usr/bin/env node
/**
 * Mattermost Flagged Posts to Dual Memo TODO Staging Synchronizer
 * 
 * Fetches flagged (Saved) posts from Mattermost API, extracts task details
 * with full message context indented in comments, appends them to todo-staging.json,
 * and automatically unflags the processed posts to prevent duplicate imports.
 * 
 * Usage:
 *   node scripts/sync-mattermost-to-staging.js
 * 
 * Environment variables:
 *   MATTERMOST_URL   (default: http://localhost:8065)
 *   MATTERMOST_TOKEN (optional for mock, required for real Mattermost PAT)
 *   STAGING_PATH     (default: /Users/s-ikari/work/dual-memo-data/todo-staging.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MATTERMOST_URL = (process.env.MATTERMOST_URL || 'http://localhost:8065').replace(/\/+$/, '');
const MATTERMOST_TOKEN = process.env.MATTERMOST_TOKEN || '';
const DEFAULT_STAGING_PATH = path.resolve(__dirname, '../../dual-memo-data/todo-staging.json');
const STAGING_PATH = process.env.STAGING_PATH || DEFAULT_STAGING_PATH;

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

// Clean and extract a concise task title from message
const extractTaskTitle = (message) => {
  if (!message) return 'Mattermost依頼の確認';
  // Take first non-empty line
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || 'Mattermost依頼の確認';

  // Strip URLs and mentions for title
  let title = firstLine
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^[@＠][^\s]+\s*/, '')
    .replace(/^[・･•\-\*]\s*/, '')
    .trim();

  // If too long, truncate
  if (title.length > 35) {
    title = title.substring(0, 35) + '…';
  }
  return title || 'Mattermost依頼の確認';
};

// Extract due date tag (#MM/DD or #M/D) from message if present
const extractDueDate = (message) => {
  const match = message.match(/[#＃](?:(?:\d{4}|\d{2})[-/])?(\d{1,2}[-/]\d{1,2})/);
  if (match) {
    return match[1].replace('-', '/');
  }
  return null;
};

async function main() {
  console.log(`\n======================================================`);
  console.log(`📡 Mattermost ➔ Dual Memo TODO (!staging) 同期スクリプト`);
  console.log(`   Mattermost: ${MATTERMOST_URL}`);
  console.log(`   Staging:    ${STAGING_PATH}`);
  console.log(`======================================================\n`);

  // 1. Fetch flagged posts from Mattermost
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

  console.log(`🎯 ${postIds.length}件の旗付き投稿を検出しました。タスク化を開始します...\n`);

  // Cache for user and channel names
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

  // 2. Read existing todo-staging.json
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

    const title = extractTaskTitle(post.message);
    const dueDate = extractDueDate(post.message);
    const dateStr = new Date(post.create_at).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Format indented comments for Dual Memo TODO
    // Line 1: Author, timestamp, channel
    // Line 2+: Clean original message
    // Last line: Permalink
    const comments = [
      `↳ 👤 @${username} (${dateStr} / #${channelName})`,
    ];

    // Add original message lines (max 3 lines to keep editor clean)
    const rawLines = post.message.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length > 0) {
      const snippet = rawLines.slice(0, 3).join(' ');
      comments.push(`↳ 💬 「${snippet}」`);
    }

    comments.push(`↳ 🔗 ${postUrl}`);

    const newTask = {
      id: generateId(),
      title,
      category: 'staging',
      theme: 'Uncategorized',
      dueDate,
      comments,
      order: stagingData.tasks.length + newTasks.length,
      source: 'mattermost',
      createdAt: new Date().toISOString(),
      postUrl,
      author: username,
    };

    newTasks.push(newTask);
    processedPostIds.push(post.id);

    console.log(`  ➕ 追加: ・${title} ${dueDate ? '#' + dueDate : ''}`);
    console.log(`     ${comments[0]}`);
  }

  if (newTasks.length === 0) {
    console.log(`\n✨ 新規に追加するタスクはありませんでした。`);
  } else {
    // 3. Append to todo-staging.json and save
    stagingData.tasks = [...newTasks, ...stagingData.tasks];
    stagingData.updatedAt = new Date().toISOString();

    fs.writeFileSync(STAGING_PATH, JSON.stringify(stagingData, null, 2), 'utf-8');
    console.log(`\n💾 ${newTasks.length}件のタスクを todo-staging.json に保存しました！`);
  }

  // 4. Unflag processed posts in Mattermost to prevent re-processing
  console.log(`\n🧹 Mattermostの旗マーク（保存）を解除中...`);
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
  console.log(`🎉 同期完了！Dual Memo TODO を開いて確認してください。`);
  console.log(`   最上部に「!staging」としてタスクが展開されます。`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
