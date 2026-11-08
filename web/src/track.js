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
