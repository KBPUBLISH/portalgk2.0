import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    port: 4174,
  },
  server: {
    proxy: {
      // Same-origin stand-in for signed GCS PUTs during local dev.
      '/gcs-upload': {
        target: 'https://storage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/gcs-upload/, ''),
      },
    },
  },
})
