import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { writeFileSync, mkdirSync } from 'fs'

// 检测 Electron 桌面端构建模式
const isElectronBuild = !!process.env.ELECTRON_BUILD;

/**
 * Vite 插件：Electron 构建时将主进程需要的 VITE_* 环境变量写入 build-config.json
 *
 * 生成的文件位于 dist-electron/build-config.json，随 asar 一起打包。
 * Electron 主进程启动时读取此文件，替代直接打包 .env 文件。
 * 这样 .env.production 仅用于 Vite 构建时，不会泄露到安装包中。
 */
function electronBuildConfigPlugin(): Plugin {
  return {
    name: 'electron-build-config',
    applyToEnvironment: () => isElectronBuild,
    writeBundle() {
      const config = {
        VITE_AI_GATEWAY_URL: process.env.VITE_AI_GATEWAY_URL || '',
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || '',
      };
      const outDir = path.resolve(__dirname, 'dist-electron');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        path.join(outDir, 'build-config.json'),
        JSON.stringify(config, null, 2),
        'utf-8',
      );
      console.log(`[electron-build-config] Generated build-config.json (gateway=${config.VITE_AI_GATEWAY_URL || '(empty)'})`);
    },
  };
}

export default defineConfig({
  base: isElectronBuild ? './' : '/',
  plugins: [
    react(),
    // Electron 构建时生成 build-config.json，供主进程运行时读取环境变量
    ...(isElectronBuild ? [electronBuildConfigPlugin()] : []),
    ...(isElectronBuild ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '熵减 - 学习伴侣',
        short_name: '熵减',
        description: '智能学习管理工具 - 笔记、闪卡、费曼学习法、番茄钟',
        theme_color: '#3b82f6',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
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
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    })]),
  ],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/electron/**', '**/dist-electron/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // electron-updater 是纯 ESM 模块，仅 Electron 主进程使用，
  // better-sqlite3 是原生 C++ addon，均排除 Vite 预构建以避免 ERR_REQUIRE_ESM / .node 加载错误
  optimizeDeps: {
    exclude: ['electron-updater', 'better-sqlite3'],
  },
})
