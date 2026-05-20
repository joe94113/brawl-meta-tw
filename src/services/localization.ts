import { parseCsv } from '../utils/csv'
import { cleanText } from '../utils/format'
import { normalizeLookupKey } from '../utils/keys'

const ASSET_VERSION = '67.264'
const ASSET_BASE = `https://raw.githubusercontent.com/tailsjs/brawl-stars-assets/master/${ASSET_VERSION}/localization`

export interface TranslationIndex {
  translate(value?: string): string
}

export async function fetchTranslationIndex(): Promise<TranslationIndex> {
  try {
    const [englishCsv, traditionalCsv, patchCsv] = await Promise.all([
      fetchText(`${ASSET_BASE}/texts.csv`),
      fetchText(`${ASSET_BASE}/cnt.csv`),
      fetchText(`${ASSET_BASE}/texts_patch.csv`).catch(() => ''),
    ])

    const values = new Map<string, string>()
    const traditionalByTid = new Map<string, string>()

    for (const [tid, value] of parseCsv(traditionalCsv).slice(2)) {
      if (tid && value) traditionalByTid.set(tid, cleanText(value))
    }

    for (const [tid, english] of parseCsv(englishCsv).slice(2)) {
      if (!tid) continue
      const translated = traditionalByTid.get(tid)
      addTranslation(values, english, translated)
    }

    addPatchTranslations(values, patchCsv)

    return {
      translate(value) {
        if (!value) return ''
        return values.get(normalizeLookupKey(cleanText(value))) || value
      },
    }
  } catch {
    return {
      translate(value) {
        return value || ''
      },
    }
  }
}

async function fetchText(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Localization ${response.status}: ${url}`)
  return response.text()
}

function addPatchTranslations(values: Map<string, string>, csvText: string) {
  if (!csvText) return

  const rows = parseCsv(csvText)
  const header = rows[0] || []
  const englishIndex = header.indexOf('EN')
  const traditionalIndex = header.indexOf('CNT')

  if (englishIndex < 0 || traditionalIndex < 0) return

  for (const row of rows.slice(2)) {
    addTranslation(values, row[englishIndex], row[traditionalIndex])
  }
}

function addTranslation(values: Map<string, string>, english?: string, translated?: string) {
  if (!english || !translated) return

  const key = normalizeLookupKey(cleanText(english))
  if (key && !values.has(key)) values.set(key, cleanText(translated))
}
