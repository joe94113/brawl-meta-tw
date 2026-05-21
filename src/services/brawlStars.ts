const LOCAL_PROXY_BASE = '/api/brawlstars'

function officialApiBase() {
  const configuredBase = import.meta.env.VITE_BRAWL_STARS_PROXY_BASE?.trim().replace(/\/+$/, '')
  if (configuredBase) return configuredBase
  if (import.meta.env.DEV) return LOCAL_PROXY_BASE
  return ''
}

export function hasOfficialApiProxy() {
  return Boolean(officialApiBase())
}

export async function fetchOfficialJson<T>(path: string): Promise<T> {
  const base = officialApiBase()

  if (!base) {
    throw new Error('線上玩家戰績查詢需要設定 VITE_BRAWL_STARS_PROXY_BASE。GitHub Pages 不能直接讀玩家資料，必須透過 Worker API。')
  }

  const response = await fetch(`${base}${path}`)
  if (!response.ok) throw new Error(`玩家資料代理回傳 HTTP ${response.status}`)
  return response.json() as Promise<T>
}
