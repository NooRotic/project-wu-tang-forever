import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devApiPlugin from './vite-plugin-dev-api.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' ? devApiPlugin() : null,
  ].filter(Boolean),
}))
