import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'

const wranglerToml = fs.readFileSync(path.resolve(__dirname, './wrangler.toml'), 'utf8')
const wranglerVersion =
  wranglerToml.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1] ?? '0.0.0'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(wranglerVersion),
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['/images/favicon.svg', '/images/favicon_light.svg'],
      manifest: {
        name: 'KomunitiKita',
        short_name: 'Komuniti',
        description: 'KomunitiKita is a neighbourhood community platform.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/images/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/images/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        //target: 'http://localhost:8788',
        target: 'https://komuniti-kita.pages.dev',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
})
