import { useEffect, useState } from 'preact/hooks'
import { dismissHint, hasPrompt, hintWanted, install, ios, standalone, subscribe, waitForPrompt } from '../install.js'

const useInstallState = () => {
  const [s, setS] = useState({ prompt: null, installed: false, alreadyInstalled: false })
  useEffect(() => subscribe(setS), [])
  return s
}

/** Phones only: a quiet, dismissible "add to home screen" line under the header (from the second visit). */
export function InstallHint({ t }) {
  const s = useInstallState()
  const [open, setOpen] = useState(() => hintWanted())
  if (!open || s.installed || s.alreadyInstalled) return null
  const close = () => { dismissHint(); setOpen(false) }
  return (
    <aside class="app-hint">
      <span class="app-hint-icon" aria-hidden="true">📱</span>
      <span class="app-hint-text">{ios ? t.install.hintIos : t.install.hint}</span>
      {s.prompt && <button type="button" class="app-hint-go" onClick={() => install()}>{t.install.short}</button>}
      <button type="button" class="app-hint-x" aria-label={t.install.dismiss} onClick={close}>×</button>
    </aside>
  )
}

/** In the foot of every page outside the installed app, even after the hint was dismissed.
 *  Where the browser has no install dialog (Safari, Firefox), it says how instead. */
export function InstallButton({ t }) {
  const s = useInstallState()
  const [how, setHow] = useState(null)
  if (standalone || s.installed) return null
  const click = async () => {
    if (!hasPrompt() && !ios) await waitForPrompt(1500)
    if (hasPrompt()) return void install()
    setHow(ios ? t.install.hintIos : t.install.menu)
  }
  return (
    <p class="install">
      {!s.alreadyInstalled && <button type="button" class="btn install-btn" onClick={click}>{t.install.button}</button>}
      {(how || s.alreadyInstalled) && <span class="install-how" role="status">{s.alreadyInstalled ? t.install.installed : how}</span>}
    </p>
  )
}
