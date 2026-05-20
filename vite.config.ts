import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const brawlStarsToken = env.BRAWL_STARS_TOKEN || env.VITE_BRAWL_STARS_TOKEN

  return {
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
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
