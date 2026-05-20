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
    throw new Error('線上玩家戰績查詢需要設定 VITE_BRAWL_STARS_PROXY_BASE，GitHub Pages 無法直接使用本機 Vite proxy。')
  }

  const response = await fetch(`${base}${path}`)
  if (!response.ok) throw new Error(`Brawl Stars API ${response.status}`)
  return response.json() as Promise<T>
}
