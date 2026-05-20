import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import brawlStarsWorker from './workers/brawlstars-proxy/worker.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const githubPagesBase = process.env.GITHUB_PAGES === 'true' && repoName ? `/${repoName}/` : '/'

  return {
    base: env.VITE_BASE_PATH || githubPagesBase,
    plugins: [
      vue(),
      tailwindcss(),
      vueDevTools(),
      brawlStarsDevProxy(),
    ],
    server: {
      proxy: {
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

function brawlStarsDevProxy(): Plugin {
  return {
    name: 'brawl-stars-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/brawlstars')) {
          next()
          return
        }

        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (Array.isArray(value)) {
            value.forEach((item) => headers.append(key, item))
          } else if (value) {
            headers.set(key, value)
          }
        }

        try {
          const response = await brawlStarsWorker.fetch(new Request(`http://localhost${req.url}`, { method: req.method, headers }), {
            ALLOWED_ORIGINS: '',
          })

          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }))
        }
      })
    },
  }
}
