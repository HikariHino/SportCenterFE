import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_TARGET')
  const apiTarget = env.API_PROXY_TARGET || 'https://localhost:7182'

  return {
    plugins: [react()],
    cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure(proxy) {
            proxy.on('error', (_error, _request, response) => {
              if (!response || typeof response.writeHead !== 'function' || response.headersSent || response.writableEnded) return
              response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
              response.end(JSON.stringify({
                success: false,
                message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.',
              }))
            })
          },
        },
      },
    },
  }
})
