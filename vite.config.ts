import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Production builds (served from file:// inside Electron, or any static host)
 * get a strict Content-Security-Policy. Not applied in dev — Vite's HMR needs
 * inline preamble scripts and a websocket.
 */
function injectCsp(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // Tailwind + React inline style attributes
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), injectCsp()],
  base: './', // relative asset paths so the build also works from file:// (Electron)
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
})
