// Installing the site as an app, as on Allo Outings (src/scripts/app.ts there): the service worker,
// Chrome's install offer (caught early in index.html), and whether the app is already installed.
const local = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : (localStorage.setItem(k, v), v) } catch { return null } }

export const standalone = typeof window !== 'undefined' &&
  (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)
export const ios = typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const listeners = new Set()
const state = { prompt: null, installed: false, alreadyInstalled: false }
const emit = () => listeners.forEach((f) => f({ ...state }))
export const subscribe = (f) => { listeners.add(f); f({ ...state }); return () => listeners.delete(f) }

/** Starts the service worker and listens for the browser's install offer. Call once, at start. */
export function setupInstall() {
  if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
  // Chrome, Edge and Android offer an install dialog we can open from our own buttons. The early
  // listener in index.html keeps the offer, because Chrome may make it before this script runs.
  const take = () => { if (window.__rtInstall) { state.prompt = window.__rtInstall; window.__rtInstall = null; emit() } }
  take()
  addEventListener('rt:installable', take)
  addEventListener('appinstalled', () => { state.installed = true; state.prompt = null; local(HINT_KEY, 'off'); emit() })
  // Chrome makes no install offer while the app is already installed: say so, and where to open it.
  if (!standalone && navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => { if (apps.length) { state.alreadyInstalled = true; local(HINT_KEY, 'off'); emit() } }).catch(() => {})
  }
}

/** Opens the browser's install dialog; true when the reader accepted. */
export async function install() {
  const ev = state.prompt
  if (!ev) return false
  state.prompt = null
  emit()
  await ev.prompt()
  const choice = await ev.userChoice.catch(() => null)
  if (choice?.outcome === 'accepted') { state.installed = true; local(HINT_KEY, 'off'); emit() }
  return choice?.outcome === 'accepted'
}

/** Waits up to `ms` for Chrome's install offer (it can come a moment after the page loads). */
export const waitForPrompt = (ms) => new Promise((done) => {
  if (state.prompt) return done()
  const t = setTimeout(done, ms)
  addEventListener('rt:installable', () => { clearTimeout(t); setTimeout(done) }, { once: true })
})
export const hasPrompt = () => !!state.prompt

// On phones, a quiet line under the header says the site works as an app. It waits until the
// second visit, and once dismissed (or installed) it stays away on this device.
export const HINT_KEY = 'rt-app-hint'
let hintDecided = null
export function hintWanted() {
  if (hintDecided !== null) return hintDecided
  const phone = matchMedia('(pointer: coarse) and (max-width: 899px)').matches
  const views = Number(local(HINT_KEY) || 0)
  const wanted = phone && !standalone && local(HINT_KEY) !== 'off' && !Number.isNaN(views)
  if (wanted) local(HINT_KEY, String(views + 1))
  hintDecided = wanted && views >= 1
  return hintDecided
}
export const dismissHint = () => local(HINT_KEY, 'off')
