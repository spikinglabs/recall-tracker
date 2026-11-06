import { render } from 'preact'
import './index.css'
import { App } from './app.jsx'
import { setupInstall } from './install.js'

// The build puts a plain copy of the page in #app for search engines (scripts/prerender.mjs); the app replaces it.
const root = document.getElementById('app')
root.textContent = ''
render(<App />, root)
setupInstall()
