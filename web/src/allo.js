// The other Allo sites, linked from every page's foot (and they link back here).
const OUTINGS_DIR = { de: 'de', 'zh-CN': 'zh' }
export const alloSites = (lang) => [
  { id: 'outings', name: lang === 'zh-CN' ? '小鹿出游 Allo Outings' : 'Allo Outings', url: `https://outings.allo.land/${OUTINGS_DIR[lang] || 'en'}/` },
  { id: 'auri', name: 'Allo Auri', url: 'https://auri.allo.land/' },
  { id: 'land', name: 'Alloland', url: 'https://allo.land/' },
]
