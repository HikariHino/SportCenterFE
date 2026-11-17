import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { getGoogleClientId } from './src/utils/googleAuth.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['API_PROXY_TARGET', 'VITE_GOOGLE_CLIENT_ID'])
  const apiTarget = env.API_PROXY_TARGET || 'https://sportscenterbe-0.onrender.com'

  return {
    plugins: [react(), {
      name: 'google-login-local-config',
      configureServer(server) {
        if (!getGoogleClientId(env.VITE_GOOGLE_CLIENT_ID)) {
          server.config.logger.warn('[Google login] Chưa có Client ID thật. Điền VITE_GOOGLE_CLIENT_ID trong .env.local, khớp GoogleAuth:ClientId của BE, rồi khởi động lại Vite.')
        }
      },
    }],
    // SSR test servers use Vite's default cache. Keep browser bundles separate
    // so running tests cannot invalidate modules already served to local tabs.
    cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite-dev',
    // The lazy Member route renders Markdown in its AI chat view.
    optimizeDeps: { include: ['react-markdown', 'remark-gfm'] },
    server: {
      // Match the ReturnUrl/CancelUrl configured by the existing BE.
      port: 3000,
      strictPort: true,
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
