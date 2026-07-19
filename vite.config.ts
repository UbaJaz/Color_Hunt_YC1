import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Points at the browser-only entry point (excludes the Node-only
      // `sharp` dependency used for server-side image loading) per
      // packages/color-science/HANDOFF.md's documented import path.
      '@color-science': path.resolve(__dirname, './packages/color-science/dist/browser.js'),
    },
  },
})
