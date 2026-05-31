import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [vue()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: Number(env.VITE_PORT) || 5176,
      proxy: {
        '/api': { target: 'http://127.0.0.1:18080', changeOrigin: true }
      }
    }
  }
})
