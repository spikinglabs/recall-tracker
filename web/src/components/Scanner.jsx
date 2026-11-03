import { useEffect, useRef, useState } from 'preact/hooks'

// Reads a product barcode with the camera. The browser's own detector where there is one (Chrome on Android),
// otherwise ZXing, loaded only when the scanner opens (Safari on iPhone has no detector).
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

export function Scanner({ open, onCode, onClose, t }) {
    const box = useRef(null)
    const video = useRef(null)
    const [msg, setMsg] = useState(t.scanHint)

    useEffect(() => {
        if (!open) return
        box.current?.showModal()
        setMsg(t.scanHint)
        let stop = () => {}
        let gone = false
        const found = (code) => { if (!gone) { gone = true; stop(); onCode(code) } }
        ;(async () => {
            if (!navigator.mediaDevices?.getUserMedia) { setMsg(t.scanUnsupported); return }
            try {
                if ('BarcodeDetector' in window) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                    stop = () => stream.getTracks().forEach(tr => tr.stop())
                    if (gone) return stop()
                    video.current.srcObject = stream
                    await video.current.play()
                    const detector = new window.BarcodeDetector({ formats: FORMATS })
                    const look = async () => {
                        if (gone) return
                        try {
                            const [hit] = await detector.detect(video.current)
                            if (hit?.rawValue) return found(hit.rawValue)
                        } catch { /* a frame that couldn't be read */ }
                        setTimeout(look, 200)
                    }
                    look()
                } else {
                    const { BrowserMultiFormatReader } = await import('@zxing/browser')
                    if (gone) return
                    const reader = new BrowserMultiFormatReader()
                    const controls = await reader.decodeFromVideoDevice(undefined, video.current, (result) => {
                        if (result) found(result.getText())
                    })
                    stop = () => controls.stop()
                    if (gone) stop()
                }
            } catch (e) {
                setMsg(e?.name === 'NotAllowedError' ? t.scanDenied : t.scanUnsupported)
            }
        })()
        return () => { gone = true; stop() }
    }, [open])

    if (!open) return null
    const close = () => { box.current?.close(); onClose() }
    return (
        <dialog class="sheet scan-sheet" ref={box} aria-labelledby="scan-title" onClose={onClose}>
            <div class="pic-head">
                <h3 id="scan-title">{t.scan}</h3>
                <button type="button" class="btn" aria-label={t.close} onClick={close}>✕</button>
            </div>
            <video ref={video} muted playsInline />
            <p class="small" role="status">{msg}</p>
        </dialog>
    )
}
