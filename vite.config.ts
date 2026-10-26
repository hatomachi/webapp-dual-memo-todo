import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

const now = new Date();
const pad = (n: number) => n.toString().padStart(2, '0');
const buildTime = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const LOCAL_DATA_DIR = path.resolve(__dirname, '../dual-memo-data');
const LOCAL_STAGING_PATH = path.join(LOCAL_DATA_DIR, 'todo-staging.json');
const LOCAL_MAIN_DATA_PATH = path.join(LOCAL_DATA_DIR, 'todo-data.json');

const localDataMiddleware = (): Plugin => ({
  name: 'local-data-middleware',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ? req.url.split('?')[0] : '';

      // 1. /api/local/staging
      if (url === '/api/local/staging') {
        if (req.method === 'GET') {
          if (fs.existsSync(LOCAL_STAGING_PATH)) {
            const content = fs.readFileSync(LOCAL_STAGING_PATH, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(content);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), tasks: [] }));
          }
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              JSON.parse(body);
              fs.writeFileSync(LOCAL_STAGING_PATH, body, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      // 2. /api/local/data
      if (url === '/api/local/data') {
        if (req.method === 'GET') {
          if (fs.existsSync(LOCAL_MAIN_DATA_PATH)) {
            const content = fs.readFileSync(LOCAL_MAIN_DATA_PATH, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(content);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
          }
          return;
        }
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    localDataMiddleware(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dual Memo TODO',
        short_name: 'DualMemo',
        description: '思考の摩擦ゼロ メモ帳感覚TODOアプリ（左右2面連動 & 期日ソート）',
        theme_color: '#ffffff',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt}'],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
