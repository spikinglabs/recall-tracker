import { useEffect, useRef, useState } from 'preact/hooks'
import { IN_WECHAT, copy, posterPng, recallLink, recallText } from '../share'

// "Poster": the recall as a picture, drawn when the box opens so the share button hands the phone a ready
// file (Safari drops a share that waits). Many apps drop the text that comes with a picture, so it goes on
// the clipboard too. Without a share sheet the picture can be saved, or held to save on a phone.
export function PosterSheet({ recall, t, lang, onClose }) {
    const box = useRef(null)
    const [src, setSrc] = useState('')
    const [file, setFile] = useState(null)
    const [msg, setMsg] = useState(t.posterDrawing)

    useEffect(() => {
        if (!recall) return
        box.current?.showModal()
        setSrc(''); setFile(null); setMsg(t.posterDrawing)
        let gone = false
        posterPng(recall, t, lang, recallLink(recall, lang)).then(png => {
            if (gone) return
            const f = new File([png], `recall-${recall.id}.png`, { type: 'image/png' })
            setFile(f)
            // A data: address, not blob:, so a long press in WeChat can save it too.
            const r = new FileReader()
            r.onload = () => { if (!gone) setSrc(r.result) }
            r.readAsDataURL(png)
            setMsg(!IN_WECHAT && navigator.canShare?.({ files: [f] }) ? '' : t.posterHold)
        }).catch(() => { if (!gone) setMsg(t.posterFailed) })
        return () => { gone = true }
    }, [recall, lang])

    if (!recall) return null
    const canShare = file && !IN_WECHAT && navigator.canShare?.({ files: [file] })
    const close = () => { box.current?.close(); onClose() }

    const share = async () => {
        const text = `${recallText(recall, t, lang)}\n${recallLink(recall, lang)}`
        // Both start in the same tick as the tap: Safari refuses either one after a wait.
        const copied = copy(text)
        const shared = navigator.share({ files: [file], text, title: t.recallTag }).catch(() => {})
        setMsg((await copied) === 'copied' ? t.posterCopied : '')
        await shared
    }

    return (
        <dialog
            class="sheet pic-sheet"
            ref={box}
            aria-labelledby="pic-title"
            onClose={onClose}
            onClick={(e) => {
                // A tap on the dimmed page around the box closes it.
                if (e.target !== box.current) return
                const r = box.current.getBoundingClientRect()
                if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close()
            }}
        >
            <div class="pic-head">
                <h3 id="pic-title">{t.posterTitle}</h3>
                <button type="button" class="btn" aria-label={t.close} onClick={close}>✕</button>
            </div>
            {src ? <img src={src} alt={t.posterTitle} width="1080" height="1440" /> : <div class="pic-wait"><span class="spinner" /></div>}
            {msg && <p class="small" role="status">{msg}</p>}
            {src && (
                <div class="pic-btns">
                    {canShare && <button type="button" class="btn primary" onClick={share}>{t.posterShare}</button>}
                    <a class="btn" href={src} download={`recall-${recall.id}.png`}>{t.posterSave}</a>
                </div>
            )}
        </dialog>
    )
}
