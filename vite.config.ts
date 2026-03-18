import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { writeFileSync, readdirSync } from 'fs'
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDesktop = mode === 'desktop' || !!process.env.TAURI_ENV_PLATFORM;
  return {
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    tailwindcss(),
    react(),
    versionJsonPlugin(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  base: isDesktop ? './' : '/app/',
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
          // ── App: Gamification engine (large, only active after login) ──
          if (id.includes('/lib/gamification/') ||
              id.includes('/hooks/useGamification')) {
            return 'gamification';
          }
          // ── App: System bus + adapters ──
          if (id.includes('/lib/systems/')) {
            return 'systems';
          }
        },
      },
    },
  },
}})
