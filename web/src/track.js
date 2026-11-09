// Anonymous usage counts (Allo usage counter, spikinglabs/alloland-rebirth workers/count).
// A call adds 1 to today's count for this feature and the visitor's country. Nothing
// identifies the visitor: no cookie, no ID, nothing stored in the browser. Skipped when
// the browser asks not to be tracked, and off the real site (local dev, previews).
const ENDPOINT = 'https://monitoring.admin.allo.land/e'

export function track(feature) {
  try {
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return
    if (!/(^|\.)allo\.land$/.test(location.hostname)) return
    navigator.sendBeacon?.(`${ENDPOINT}?f=${encodeURIComponent(feature)}`)
  } catch { /* counting must never break the page */ }
}

// Runs fn once a person is plausibly there: after the page has been visible for 3 seconds,
// or at the first tap, click, key or scroll. Scripts that load the page and leave aren't counted.
export function whenPresent(fn) {
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
  let timer
  const onVisibility = () => {
    clearTimeout(timer)
    if (document.visibilityState === 'visible') timer = setTimeout(go, 3000)
  }
  function go() {
    clearTimeout(timer)
    for (const e of events) removeEventListener(e, go, true)
    document.removeEventListener('visibilitychange', onVisibility)
    fn()
  }
  for (const e of events) addEventListener(e, go, { capture: true, passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  onVisibility()
}
