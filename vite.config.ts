import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // A GitHub Pages project site is served from /<repo>/, so built asset URLs
  // need that prefix. Everywhere else — local dev, Vercel, Netlify — serves
  // from the root, so this stays '/' unless the Pages build sets it.
  base: process.env.PAGES_BASE ?? '/',
  server: { port: 5173 },
})
