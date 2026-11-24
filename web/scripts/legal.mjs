// Writes the imprint (Impressum, § 5 DDG), privacy notice and disclaimer to
// dist/legal/ (English), dist/de/legal/ and dist/zh/legal/. Spanish and French
// pages link to the English one. Runs after prerender.mjs (npm run build).
// The operator's details are the ones already published on cars.allo.land/legal/,
// outings.allo.land/en/impressum and allo.land/legal/; keep them in step.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SITE } from '../src/paths.js'

const dist = new URL('../dist/', import.meta.url).pathname

const O = {
  name: 'SL Spiking Labs UG (haftungsbeschränkt)',
  street: 'Subbelrather Str. 15 a',
  city: '50823 Köln',
  directors: 'Ahmed Elsherbiny, Lei Ma',
  register: 'Amtsgericht Köln, HRB 122682',
  email: 'hi@spikinglabs.com',
  responsible: 'Lei Ma',
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// [heading, [paragraphs]]; a paragraph may hold \n for a line break.
const PAGES = {
  en: {
    htmlLang: 'en', dir: 'legal', home: '/',
    title: 'Imprint, privacy and disclaimer · Allo Recalls',
    h1: 'Imprint, privacy and disclaimer',
    sections: [
      ['Imprint (Impressum)', [
        `${O.name}\n${O.street}\n${O.city}\nGermany`,
        `Represented by the managing directors: ${O.directors}`,
        `Commercial register: ${O.register}`,
        `Email: ${O.email}`,
        `Responsible for the content under § 18 (2) MStV: ${O.responsible}, address as above.`,
      ]],
      ['Disclaimer', [
        'Allo Recalls collects recall notices published by official authorities: the EU Safety Gate, the UK Office for Product Safety and Standards, the US Consumer Product Safety Commission and Food and Drug Administration, and lebensmittelwarnung.de. Every recall links to its official notice, which is the binding text. Summaries and translations are made automatically and can contain mistakes.',
        'Finding no recall does not mean a product is safe. We may not have every notice, a notice may name a different model or batch, and many unsafe products are never recalled. Compare the exact model and batch with the official notice, and ask the seller or manufacturer when in doubt. We take no responsibility for decisions made on the basis of this site.',
        'Product and brand names belong to their owners and are shown only to identify the recalled product.',
      ]],
      ['Privacy notice (Datenschutzerklärung)', []],
      ['Who is responsible', [`The controller under the GDPR is ${O.name}, ${O.street}, ${O.city}, Germany, ${O.email}.`]],
      ['Hosting and data', ['The pages are hosted on GitHub Pages (GitHub, Inc., USA; certified under the EU-US Data Privacy Framework). The recall data loads from recalls-api.allo.land, our storage at Cloudflare (Cloudflare, Inc., USA; certified under the EU-US Data Privacy Framework, with a data processing agreement). To deliver pages and files, both necessarily process your IP address and technical request data and keep short-lived security logs. Legal basis: Art. 6 (1) (f) GDPR, our interest in a secure, working website.']],
      ['No account, no cookies, your searches stay with you', ['Allo Recalls has no accounts and sets no cookies. We do not use advertising or third-party tracking. Searching, pasting a Vinted or Kleinanzeigen link and scanning a barcode all happen in your browser: what you type or scan is never sent to us. The camera is used only while the scanner is open, and the picture never leaves your device. Fonts load from this site.']],
      ['Anonymous usage counts', ['To see which parts of the site are used, page visits and a few taps (such as sharing or making a poster) add one to a daily total per country in our own usage counter (monitoring.admin.allo.land, a Cloudflare Worker run by us). It keeps only the day, the site, the name of the action and your country, and for visits also the kind of device and browser and the network operator\'s name (to spot automated visits): no IP address, no ID, no cookie, nothing that could identify you. It is skipped if your browser sends Do Not Track or Global Privacy Control. Legal basis: Art. 6 (1) (f) GDPR, our interest in knowing which parts of the site are used.']],
      ['Stored on your device', ['Your language, country, category, light or dark, your last searches and whether you closed the install hint are kept in your browser\'s local storage, so the site remembers them. A service worker keeps copies of the pages and data you opened so they work offline. All of this stays on your device and is never sent to us. It is needed for features you use (§ 25 (2) no. 2 TDDDG). You can remove it by clearing the site data in your browser.']],
      ['Sharing', ['If you share a recall or save a poster, your device\'s share menu or downloads handle it. We do not receive what you share or with whom.']],
      ['Your rights', ['You have the right to access, rectification, erasure, restriction of processing, data portability and to object (Art. 15–21 GDPR). Write to us at the address above. You can also complain to a data protection authority, for example the one in North Rhine-Westphalia (LDI NRW).']],
    ],
    updated: 'Last updated 24 November 2026. The German version is the binding one.',
    back: 'Back to Allo Recalls',
    other: [['Deutsch', '/de/legal/'], ['中文', '/zh/legal/']],
  },
  de: {
    htmlLang: 'de', dir: 'de/legal', home: '/de/',
    title: 'Impressum, Datenschutz und Haftungsausschluss · Allo Recalls',
    h1: 'Impressum, Datenschutz und Haftungsausschluss',
    sections: [
      ['Impressum', [
        `${O.name}\n${O.street}\n${O.city}\nDeutschland`,
        `Vertreten durch die Geschäftsführer: ${O.directors}`,
        `Registereintrag: ${O.register}`,
        `E-Mail: ${O.email}`,
        `Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: ${O.responsible}, Anschrift wie oben.`,
      ]],
      ['Haftungsausschluss', [
        'Allo Recalls sammelt Rückrufe, die Behörden veröffentlichen: EU Safety Gate, das britische Office for Product Safety and Standards, die US-Behörden Consumer Product Safety Commission und Food and Drug Administration sowie lebensmittelwarnung.de. Jeder Rückruf verlinkt die amtliche Meldung, deren Text maßgeblich ist. Zusammenfassungen und Übersetzungen entstehen automatisch und können Fehler enthalten.',
        'Wird kein Rückruf gefunden, heißt das nicht, dass ein Produkt sicher ist. Uns fehlen vielleicht Meldungen, eine Meldung kann ein anderes Modell oder eine andere Charge betreffen, und viele unsichere Produkte werden nie zurückgerufen. Vergleichen Sie Modell und Charge genau mit der amtlichen Meldung und fragen Sie im Zweifel Händler oder Hersteller. Für Entscheidungen auf Grundlage dieser Seite übernehmen wir keine Haftung.',
        'Produkt- und Markennamen gehören ihren Inhabern und dienen nur dazu, das zurückgerufene Produkt zu erkennen.',
      ]],
      ['Datenschutzerklärung', []],
      ['Verantwortlicher', [`Verantwortlich im Sinne der DSGVO ist die ${O.name}, ${O.street}, ${O.city}, Deutschland, ${O.email}.`]],
      ['Hosting und Daten', ['Die Seiten liegen bei GitHub Pages (GitHub, Inc., USA; zertifiziert nach dem EU-US Data Privacy Framework). Die Rückrufdaten kommen von recalls-api.allo.land, unserem Speicher bei Cloudflare (Cloudflare, Inc., USA; zertifiziert nach dem EU-US Data Privacy Framework, mit Auftragsverarbeitungsvertrag). Um Seiten und Dateien auszuliefern, verarbeiten beide zwangsläufig Ihre IP-Adresse und technische Anfragedaten und speichern kurzlebige Sicherheitsprotokolle. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO, unser Interesse an einer sicheren, funktionierenden Website.']],
      ['Kein Konto, keine Cookies, Ihre Suchen bleiben bei Ihnen', ['Allo Recalls hat keine Konten und setzt keine Cookies. Wir nutzen keine Werbung und kein Tracking Dritter. Suchen, das Einfügen eines Vinted- oder Kleinanzeigen-Links und das Scannen eines Barcodes geschehen in Ihrem Browser: Was Sie eingeben oder scannen, wird nie an uns gesendet. Die Kamera wird nur genutzt, solange der Scanner offen ist, und das Bild verlässt Ihr Gerät nicht. Schriften werden von dieser Seite geladen.']],
      ['Anonyme Nutzungszahlen', ['Um zu sehen, welche Teile der Seite genutzt werden, zählen Besuche und einige Aktionen (etwa Teilen oder ein Poster erstellen) als eins in einer Tagessumme pro Land in unserem eigenen Zähler (monitoring.admin.allo.land, ein von uns betriebener Cloudflare Worker). Er speichert nur den Tag, die Seite, den Namen der Aktion und Ihr Land, bei Besuchen außerdem die Art von Gerät und Browser und den Namen des Netzbetreibers (um automatische Aufrufe zu erkennen): keine IP-Adresse, keine Kennung, kein Cookie, nichts, was Sie identifizieren könnte. Sendet Ihr Browser Do Not Track oder Global Privacy Control, wird nicht gezählt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO, unser Interesse daran, zu wissen, welche Teile der Seite genutzt werden.']],
      ['Auf Ihrem Gerät gespeichert', ['Sprache, Land, Kategorie, hell oder dunkel, Ihre letzten Suchen und ob Sie den Installationshinweis geschlossen haben, werden im lokalen Speicher Ihres Browsers abgelegt, damit die Seite sie sich merkt. Ein Service Worker hält Kopien der geöffneten Seiten und Daten, damit sie auch offline funktionieren. All das bleibt auf Ihrem Gerät und wird nie an uns gesendet. Es ist für von Ihnen genutzte Funktionen erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Sie können es löschen, indem Sie die Websitedaten in Ihrem Browser entfernen.']],
      ['Teilen', ['Wenn Sie einen Rückruf teilen oder ein Poster speichern, übernimmt das Teilen-Menü bzw. der Download Ihres Geräts. Wir erfahren nicht, was Sie mit wem teilen.']],
      ['Ihre Rechte', ['Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Schreiben Sie uns an die oben genannte Adresse. Sie können sich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, etwa bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW).']],
    ],
    updated: 'Stand: 24. November 2026. Die deutsche Fassung ist verbindlich.',
    back: 'Zurück zu Allo Recalls',
    other: [['English', '/legal/'], ['中文', '/zh/legal/']],
  },
  'zh-CN': {
    htmlLang: 'zh-CN', dir: 'zh/legal', home: '/zh/',
    title: '网站信息、隐私与免责声明 · 小鹿召回',
    h1: '网站信息、隐私与免责声明',
    sections: [
      ['网站信息（Impressum）', [
        `${O.name}\n${O.street}\n${O.city}\n德国`,
        `法定代表（总经理）：${O.directors}`,
        `商业登记：${O.register}`,
        `电子邮件：${O.email}`,
        `依据《州际媒体协议》第 18 条第 2 款的内容负责人：${O.responsible}，地址同上。`,
      ]],
      ['免责声明', [
        '小鹿召回收集官方机构发布的召回通告：欧盟 Safety Gate、英国产品安全与标准办公室（OPSS）、美国消费品安全委员会（CPSC）和食品药品监督管理局（FDA），以及德国 lebensmittelwarnung.de。每条召回都附有官方通告链接，以官方原文为准。摘要和翻译为自动生成，可能有误。',
        '查不到召回，并不代表产品安全。我们可能没有收录全部通告，通告也可能针对其他型号或批次，而且很多不安全的产品从未被召回。请将具体型号和批次与官方通告仔细核对，有疑问时请咨询商家或厂家。对于依据本网站作出的决定，我们不承担责任。',
        '产品和品牌名称归其所有者所有，仅用于识别被召回的产品。',
      ]],
      ['隐私说明（Datenschutzerklärung）', []],
      ['负责方', [`依据 GDPR，数据控制者是 ${O.name}，${O.street}，${O.city}，德国，${O.email}。`]],
      ['托管与数据', ['网页托管在 GitHub Pages（GitHub, Inc.，美国；已通过欧盟-美国数据隐私框架认证）。召回数据从 recalls-api.allo.land 加载，即我们在 Cloudflare 的存储（Cloudflare, Inc.，美国；已通过欧盟-美国数据隐私框架认证，并签有数据处理协议）。为了传送网页和文件，两者必然会处理您的 IP 地址和技术请求数据，并保存短期安全日志。法律依据：GDPR 第 6 条第 1 款 f 项，即我们保持网站安全、正常运行的正当利益。']],
      ['无账户，无 Cookie，搜索内容只在您这里', ['小鹿召回没有账户，也不设置 Cookie。我们不投放广告，也不使用第三方跟踪。搜索、粘贴 Vinted 或 Kleinanzeigen 链接、扫描条形码都在您的浏览器里完成：您输入或扫描的内容从不发送给我们。只有在扫描器打开时才使用摄像头，画面不会离开您的设备。字体从本站加载。']],
      ['匿名使用统计', ['为了了解网站哪些部分被使用，访问和部分操作（如分享或生成海报）会在我们自己的计数器（monitoring.admin.allo.land，由我们运行的 Cloudflare Worker）里按国家给当天的总数加一。它只保存日期、网站、操作名称和您所在的国家；访问时还保存设备和浏览器的类型以及网络运营商名称（用于识别自动访问）。不保存 IP 地址、ID、Cookie 或任何能识别您的信息。如果您的浏览器发送 Do Not Track 或 Global Privacy Control，则不计数。法律依据：GDPR 第 6 条第 1 款 f 项，即我们了解网站使用情况的正当利益。']],
      ['保存在您设备上的内容', ['语言、国家、类别、浅色或深色模式、最近的搜索，以及您是否关闭了安装提示，会保存在浏览器的本地存储中，以便网站记住。Service Worker 会保存您打开过的页面和数据的副本，以便离线使用。这些都只留在您的设备上，从不发送给我们，是您所用功能所必需的（TDDDG 第 25 条第 2 款第 2 项）。清除浏览器中的网站数据即可删除。']],
      ['分享', ['当您分享召回或保存海报时，由您设备的分享菜单或下载功能处理。我们不会知道您分享了什么、分享给谁。']],
      ['您的权利', ['您有权访问、更正、删除、限制处理、数据可携带以及提出异议（GDPR 第 15–21 条）。请按上述地址写信给我们。您也可以向数据保护监管机构投诉，例如北莱茵-威斯特法伦州数据保护与信息自由专员（LDI NRW）。']],
    ],
    updated: '更新于 2026 年 11 月 24 日。以德文版本为准。',
    back: '回到小鹿召回',
    other: [['English', '/legal/'], ['Deutsch', '/de/legal/']],
  },
}

const CSS = `:root{color-scheme:light dark;--paper:#f6f5f2;--ink:#17191b;--soft:#5b6066;--line:#dddbd5}
@media (prefers-color-scheme:dark){:root{--paper:#121314;--ink:#ecebe8;--soft:#a5a9ae;--line:#303235}}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 "Atkinson Hyperlegible","Segoe UI",system-ui,"PingFang SC","Noto Sans SC",sans-serif}
.flag{height:6px;background:linear-gradient(90deg,#17191b 33.3%,#d1001f 33.3% 66.6%,#ffcc00 66.6%)}
main{max-width:760px;margin:0 auto;padding:24px 16px 56px}
h1{font-size:clamp(28px,5vw,42px);line-height:1.1;margin:12px 0 8px}
h2{font-size:1.35rem;margin:32px 0 10px;padding-top:12px;border-top:1px solid var(--line)}
p{margin:0 0 12px;overflow-wrap:anywhere}a{color:inherit}.small{color:var(--soft);font-size:.9rem}`

function html(lang) {
  const L = PAGES[lang]
  const body = L.sections.map(([h, ps], i) => {
    const big = i === 0 || ps.length === 0 || i === 1
    const id = i === 0 ? ' id="imprint"' : i === 1 ? ' id="disclaimer"' : ps.length === 0 ? ' id="privacy"' : ''
    const head = big ? `<h2${id}>${esc(h)}</h2>` : `<h3>${esc(h)}</h3>`
    return head + ps.map((p) => `<p>${esc(p).replaceAll('\n', '<br>')}</p>`).join('')
  }).join('\n')
  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(L.title)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}/${L.dir}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
</head>
<body>
<div class="flag" aria-hidden="true"></div>
<main>
<p class="small"><a href="${L.home}">${esc(L.back)}</a> · ${L.other.map(([n, h]) => `<a href="${h}">${esc(n)}</a>`).join(' · ')}</p>
<h1>${esc(L.h1)}</h1>
${body}
<p class="small">${esc(L.updated)}</p>
</main>
</body>
</html>
`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const lang of Object.keys(PAGES)) {
    const dir = join(dist, PAGES[lang].dir)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), html(lang))
  }
  console.log('legal: wrote /legal/, /de/legal/, /zh/legal/')
}
