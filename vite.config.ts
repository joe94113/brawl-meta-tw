import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const brawlStarsToken = env.BRAWL_STARS_TOKEN || env.VITE_BRAWL_STARS_TOKEN
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const githubPagesBase = process.env.GITHUB_PAGES === 'true' && repoName ? `/${repoName}/` : '/'

  return {
    base: env.VITE_BASE_PATH || githubPagesBase,
    plugins: [
      vue(),
      tailwindcss(),
      vueDevTools(),
    ],
    server: {
      proxy: {
        '/api/brawlstars': {
          target: 'https://api.brawlstars.com/v1',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/brawlstars/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (brawlStarsToken) {
                proxyReq.setHeader('Authorization', `Bearer ${brawlStarsToken}`)
              }
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
        '/api/brawltime': {
          target: 'https://brawltime.ninja',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/brawltime/, ''),
        },
        '/api/brawl-assets': {
          target: 'https://raw.githubusercontent.com/tailsjs/brawl-stars-assets/master',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/brawl-assets/, ''),
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
