import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// The build writes one manifest per language (scripts/prerender.mjs); the dev server makes them on request.
const devManifest = {
  name: 'dev-manifest',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url?.match(/^\/(?:(de|es|fr|zh)\/)?manifest\.webmanifest$/)
      if (!m) return next()
      const { manifest } = await server.ssrLoadModule('/src/manifest.js')
      const lang = { de: 'de', es: 'es', fr: 'fr', zh: 'zh-CN' }[m[1]] || 'en'
      res.setHeader('content-type', 'application/manifest+json')
      res.end(JSON.stringify(manifest(lang), null, 1))
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [preact(), devManifest],
})
