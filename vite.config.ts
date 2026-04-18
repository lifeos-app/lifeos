import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import { writeFileSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))

/** Post-build: generate version.json with the index chunk hash for UpdateBanner detection */
function versionJsonPlugin() {
  return {
    name: 'version-json',
    closeBundle() {
      const distAssets = resolve(__dirname, 'dist/assets')
      try {
        const files = readdirSync(distAssets)
        const indexFile = files.find((f: string) => f.match(/^index-[A-Za-z0-9_-]+\.js$/))
        const match = indexFile?.match(/index-([A-Za-z0-9_-]+)\.js/)
        if (match) {
          const versionData = { buildId: match[1], version: pkg.version, builtAt: new Date().toISOString() }
          writeFileSync(resolve(__dirname, 'dist/version.json'), JSON.stringify(versionData, null, 2))
          // eslint-disable-next-line no-console
          console.log(`[post-build] version.json generated, buildId: ${match[1]}, version: ${pkg.version}`)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[post-build] version.json generation failed:', err)
      }
    },
  }
}

/** Dev middleware: serve /academy/* files from the academy content directory */
function academyServePlugin() {
  const ACADEMY_ROOT = '/mnt/data/tmp/academy'
  return {
    name: 'academy-serve',
    configureServer(server: any) {
      server.middlewares.use('/academy', (req: any, res: any, next: any) => {
        const filePath = resolve(ACADEMY_ROOT, decodeURIComponent(req.url || '').replace(/^\//, ''))
        if (existsSync(filePath)) {
          const content = readFileSync(filePath)
          const ext = filePath.split('.').pop()?.toLowerCase() || ''
          const mimeTypes: Record<string, string> = {
            'md': 'text/markdown; charset=utf-8',
            'mp3': 'audio/mpeg',
            'json': 'application/json',
            'txt': 'text/plain; charset=utf-8',
          }
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
          res.setHeader('Access-Control-Allow-Origin', '*')
          // For audio, support range requests
          if (ext === 'mp3') {
            const stat = require('fs').statSync(filePath)
            const range = req.headers.range
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-')
              const start = parseInt(parts[0], 10)
              const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': end - start + 1,
                'Content-Type': 'audio/mpeg',
              })
              const stream = require('fs').createReadStream(filePath, { start, end })
              stream.pipe(res)
              return
            }
            res.setHeader('Content-Length', stat.size)
            res.setHeader('Accept-Ranges', 'bytes')
          }
          res.end(content)
        } else {
          res.statusCode = 404
          res.end('Not found')
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDesktop = mode === 'desktop' || !!process.env.TAURI_ENV_PLATFORM || !!process.env.ELECTRON_ENV;
  return {
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __IS_TAURI__: JSON.stringify(!!process.env.TAURI_ENV_PLATFORM),
    __IS_ELECTRON__: JSON.stringify(!!process.env.ELECTRON_ENV),
  },
  plugins: [
    tailwindcss(),
    react(),
    academyServePlugin(),
    versionJsonPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/realtime/, /^\/functions/],
        runtimeCaching: [
          {
            // Supabase API calls: network-first with 30s timeout, then cache fallback
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\//,
            handler: 'NetworkFirst',
            options: {
              networkTimeoutSeconds: 30,
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Supabase auth endpoints: network-only (never cache auth)
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\//,
            handler: 'NetworkOnly',
          },
          {
            // Supabase storage: cache-first for uploaded files/images
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // OpenRouter AI API: network-only (no caching of AI responses)
            urlPattern: /^https:\/\/openrouter\.ai\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'LifeOS',
        short_name: 'LifeOS',
        description: 'Your holistic personal operating system',
        theme_color: '#050E1A',
        background_color: '#050E1A',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  base: isDesktop ? './' : '/',
  server: {
    // Serve academy content files for dev mode
    fs: {
      allow: ['.', '/mnt/data/tmp/academy'],
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
  },
  build: {
    // Disable Vite's automatic <link rel="modulepreload"> injection.
    // Safari warns when preloaded modules aren't consumed within seconds,
    // which happens for chunks behind lazy routes (gamification, systems, etc).
    // Modern browsers handle module loading efficiently without preload hints.
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor: React core (react, react-dom, react-dom/client, scheduler) ──
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/scheduler/') ||
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // ── Vendor: Supabase ──
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // ── Vendor: UI libs (lucide, driver.js) ──
          if (id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/driver.js')) {
            return 'vendor-ui';
          }
          // ── Vendor: Markdown (only used by Journal & Chat) ──
          if (id.includes('node_modules/react-markdown') ||
              id.includes('node_modules/remark-') ||
              id.includes('node_modules/unified') ||
              id.includes('node_modules/mdast-') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/hast-') ||
              id.includes('node_modules/property-information') ||
              id.includes('node_modules/vfile') ||
              id.includes('node_modules/unist-')) {
            return 'vendor-markdown';
          }
          // ── Vendor: Zustand ──
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          // ── Vendor: date-fns (used by schedule, habits, health) ──
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date';
          }
          // ── App: System bus + adapters ──
          if (id.includes('/lib/systems/')) {
            return 'systems';
          }
          // ── App: LLM/AI engine (only used by AI chat features) ──
          // Note: morning-brief imports from gamification, so some llm files
          // will stay in the main bundle to avoid circular chunks
          if ((id.includes('/lib/llm/') || id.includes('/lib/llm-proxy') ||
               id.includes('/lib/llm-providers') || id.includes('/lib/streaming')) &&
              !id.includes('morning-brief')) {
            return 'llm-engine';
          }
          // ── Vendor: Tone.js (audio engine for Realm — ~430KB) ──
          if (id.includes('node_modules/tone/')) {
            return 'vendor-tone';
          }
          // ── Vendor: XLSX (spreadsheet parser — only used by Replicator file upload) ──
          if (id.includes('node_modules/xlsx/') || id.includes('node_modules/sheetjs')) {
            return 'vendor-xlsx';
          }
          // ── Vendor: Chart.js (data visualization) ──
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/chartjs')) {
            return 'vendor-charts';
          }
          // ── App: Social features (guilds, partners, messaging) ──
          if (id.includes('/lib/social/')) {
            return 'social';
          }
          // ── App: Gamification engine (XP, levels, quests — used by many pages) ──
          if (id.includes('/lib/gamification/') && !id.includes('morning-brief')) {
            return 'gamification-engine';
          }
          // ── App: Eager pages (Habits — high-traffic, keep separate from index) ──
          if (id.includes('/pages/Habits.tsx') || id.includes('/pages/Habits.')) {
            return 'page-habits';
          }
        },
      },
    },
  },
}})
