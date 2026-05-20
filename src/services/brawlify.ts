import type { ApiBrawler, ApiGameMode, ApiMap } from '../types'

const API_BASE = 'https://api.brawlify.com/v1'

export async function fetchBrawlers() {
  return fetchJson<{ list: ApiBrawler[] }>(`${API_BASE}/brawlers`)
}

export async function fetchMaps() {
  return fetchJson<{ list: ApiMap[] }>(`${API_BASE}/maps`)
}

export async function fetchGameModes() {
  return fetchJson<{ list: ApiGameMode[] }>(`${API_BASE}/gamemodes`)
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`API ${response.status}: ${url}`)
  return response.json() as Promise<T>
}
