import type { ActiveEvent, MetaSnapshot, MetaStat, MetaTeam } from '../types'
import { brawlerStatKey } from '../utils/keys'

const RECENT_WINDOW_DAYS = 30

interface VikeQuery {
  state?: {
    data?: {
      kind?: string
      query?: {
        cubeId?: string
        dimensionsIds?: string[]
        metricsIds?: string[]
      }
      data?: Array<{
        id?: string
        map?: string
        mode?: string
        powerplay?: boolean
        metricsRaw?: Record<string, number | string>
        dimensionsRaw?: {
          brawler?: {
            brawler?: string
          }
          team?: {
            team?: string[]
          }
        }
      }>
    }
  }
}

export async function fetchMetaSnapshot(): Promise<MetaSnapshot> {
  const staticSnapshot = await fetch(`${import.meta.env.BASE_URL}data/meta-snapshot.json`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)

  if (staticSnapshot?.stats?.length) return staticSnapshot as MetaSnapshot

  const windowStart = recentWindowStart()
  const [statsResponse, auxResponse] = await Promise.all([
    fetch(recentStatsProxyPath(windowStart)),
    fetch('/api/brawltime/tier-list/brawler').catch(() => null),
  ])

  if (!statsResponse.ok) throw new Error(`Brawl Time Ninja ${statsResponse.status}`)

  const statsHtml = await statsResponse.text()
  const auxHtml = auxResponse?.ok ? await auxResponse.text() : statsHtml

  return parseMetaSnapshot(statsHtml, auxHtml, recentStatsSourceUrl(windowStart), windowStart)
}

function parseMetaSnapshot(statsHtml: string, auxHtml: string, sourceUrl: string, windowStart: string): MetaSnapshot {
  const statsPageContext = extractPageContext(statsHtml)
  const auxPageContext = extractPageContext(auxHtml)
  const statsQueries: VikeQuery[] = statsPageContext?.vueQueryState?.queries || []
  const auxQueries: VikeQuery[] = auxPageContext?.vueQueryState?.queries || []

  const statsPayloads = statsQueries.map((query) => query.state?.data).filter(Boolean)
  const auxPayloads = auxQueries.map((query) => query.state?.data).filter(Boolean)
  const statPayload = statsPayloads
    .filter(
      (payload) =>
        payload?.kind === 'response' &&
        payload.query?.cubeId === 'map' &&
        payload.query?.dimensionsIds?.includes('brawler') &&
        payload.query?.metricsIds?.includes('winRateAdj') &&
        payload.query?.metricsIds?.includes('useRate'),
    )
    .sort((a, b) => (b?.data?.length || 0) - (a?.data?.length || 0))[0]

  if (!statPayload?.data?.length) throw new Error('找不到 Brawl Time Ninja 的英雄勝率資料')

  const samplePayload = statsPayloads.find(
    (payload) =>
      payload?.kind === 'response' &&
      payload.query?.cubeId === 'map' &&
      payload.query.metricsIds?.includes('timestamp') &&
      payload.query.metricsIds?.includes('picks') &&
      !payload.query.dimensionsIds?.length,
  ) || statsPayloads.find(
    (payload) =>
      payload?.kind === 'response' &&
      payload.query?.cubeId === 'battle' &&
      payload.query.metricsIds?.includes('timestamp') &&
      payload.query.metricsIds?.includes('picks') &&
      !payload.query.dimensionsIds?.length,
  )

  const sample = samplePayload?.data?.[0]?.metricsRaw || {}
  const sampleSize = typeof sample.picks === 'number' ? sample.picks : undefined

  const stats: MetaStat[] = statPayload.data
    .map((row) => {
      const sourceName = row.dimensionsRaw?.brawler?.brawler || ''
      const winRate = asNumber(row.metricsRaw?.winRateAdj)
      const useRate = asNumber(row.metricsRaw?.useRate)

      return {
        brawlerKey: brawlerStatKey(sourceName),
        winRateAdj: winRate * 100,
        useRate: useRate * 100,
        picksEstimate: sampleSize ? Math.round(sampleSize * useRate) : undefined,
      }
    })
      .filter((stat) => stat.brawlerKey && Number.isFinite(stat.winRateAdj))

  const teamPayload = auxPayloads.find(
    (payload) =>
      payload?.kind === 'response' &&
      payload.query?.cubeId === 'battle' &&
      payload.query?.dimensionsIds?.includes('team') &&
      payload.query?.metricsIds?.includes('wins'),
  )
  const topTeams: MetaTeam[] = (teamPayload?.data || [])
    .map((row) => ({
      brawlerKeys: (row.dimensionsRaw?.team?.team || []).map((name) => brawlerStatKey(name)),
      wins: asNumber(row.metricsRaw?.wins),
    }))
    .filter((team) => team.brawlerKeys.length >= 3 && Number.isFinite(team.wins))
      .slice(0, 8)

  const activeEvents: ActiveEvent[] = auxQueries
    .flatMap((query) => {
      const data = query.state?.data
      if (Array.isArray(data) && data[0]?.map && data[0]?.mode) return data
      return []
    })
    .filter((event) => event.id && event.map && event.mode && event.powerplay !== undefined)
    .map((event) => ({
      id: String(event.id),
      map: String(event.map),
      mode: String(event.mode),
      powerplay: Boolean(event.powerplay),
    }))
    .slice(0, 12)

  return {
    stats,
    topTeams,
    activeEvents,
    windowStart,
    windowLabel: `近 ${RECENT_WINDOW_DAYS} 天`,
    sampleSize,
    lastUpdated: typeof sample.timestamp === 'string' ? sample.timestamp : undefined,
    sourceUrl,
  }
}

function recentWindowStart() {
  const date = new Date()
  date.setDate(date.getDate() - RECENT_WINDOW_DAYS)
  return date.toISOString().slice(0, 10)
}

function recentStatsSourceUrl(windowStart: string) {
  return `https://brawltime.ninja/dashboard?cube=map&dimension=brawler&filter%5Bseason%5D=${windowStart}&metric=useRate&metric=winRateAdj&sort=winRateAdj`
}

function recentStatsProxyPath(windowStart: string) {
  return `/api/brawltime/dashboard?cube=map&dimension=brawler&filter%5Bseason%5D=${windowStart}&metric=useRate&metric=winRateAdj&sort=winRateAdj`
}

function extractPageContext(html: string) {
  const match = html.match(/<script id="vike_pageContext" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('Brawl Time Ninja 頁面格式已改變')
  return JSON.parse(match[1])
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return Number.NaN
}
