import type { AbilityMetaStat, ActiveEvent, MetaSnapshot, MetaStat, MetaTeam } from '../types'
import { isHomeActiveModeSlug } from '../data/modeFilters'
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
          gadget?: {
            gadgetName?: string
            brawler?: string
            gadget?: string
          }
          starpower?: {
            starpowerName?: string
            brawler?: string
            starpower?: string
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
  const [statsResponse, auxResponse, gadgetResponse, starPowerResponse] = await Promise.all([
    fetch(recentStatsProxyPath(windowStart)),
    fetch('/api/brawltime/tier-list/brawler').catch(() => null),
    fetch(abilityStatsProxyPath('gadget', windowStart)).catch(() => null),
    fetch(abilityStatsProxyPath('starpower', windowStart)).catch(() => null),
  ])

  if (!statsResponse.ok) throw new Error(`Brawl Time Ninja ${statsResponse.status}`)

  const statsHtml = await statsResponse.text()
  const auxHtml = auxResponse?.ok ? await auxResponse.text() : statsHtml
  const gadgetHtml = gadgetResponse?.ok ? await gadgetResponse.text() : ''
  const starPowerHtml = starPowerResponse?.ok ? await starPowerResponse.text() : ''

  return parseMetaSnapshot(statsHtml, auxHtml, recentStatsSourceUrl(windowStart), windowStart, gadgetHtml, starPowerHtml)
}

function parseMetaSnapshot(
  statsHtml: string,
  auxHtml: string,
  sourceUrl: string,
  windowStart: string,
  gadgetHtml = '',
  starPowerHtml = '',
): MetaSnapshot {
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

  const abilityStats = [
    ...parseAbilityStats(gadgetHtml, 'gadget'),
    ...parseAbilityStats(starPowerHtml, 'starpower'),
  ]

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
    .filter((event) => isHomeActiveModeSlug(String(event.mode)))
    .map((event) => ({
      id: String(event.id),
      map: String(event.map),
      mode: String(event.mode),
      powerplay: Boolean(event.powerplay),
    }))
    .slice(0, 12)

  return {
    stats,
    abilityStats,
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

function abilityStatsProxyPath(cube: 'gadget' | 'starpower', windowStart: string) {
  return `/api/brawltime/dashboard?cube=${cube}&dimension=brawler&dimension=${cube}&filter%5Bseason%5D=${windowStart}&metric=picks&metric=winRateAdj&sort=winRateAdj`
}

function parseAbilityStats(html: string, cube: 'gadget' | 'starpower'): AbilityMetaStat[] {
  if (!html) return []

  const pageContext = extractPageContext(html)
  const queries: VikeQuery[] = pageContext?.vueQueryState?.queries || []
  const payloads = queries.map((query) => query.state?.data).filter(Boolean)
  const statPayload = payloads
    .filter(
      (payload) =>
        payload?.kind === 'response' &&
        payload.query?.cubeId === cube &&
        payload.query?.dimensionsIds?.includes('brawler') &&
        payload.query?.dimensionsIds?.includes(cube) &&
        payload.query?.metricsIds?.includes('winRateAdj') &&
        payload.query?.metricsIds?.includes('picks'),
    )
    .sort((a, b) => (b?.data?.length || 0) - (a?.data?.length || 0))[0]

  return (statPayload?.data || [])
    .map((row) => {
      const rawGadget = row.dimensionsRaw?.gadget
      const rawStarPower = row.dimensionsRaw?.starpower
      const abilityId = Number(cube === 'gadget' ? rawGadget?.gadget : rawStarPower?.starpower)
      const brawlerName = row.dimensionsRaw?.brawler?.brawler || rawGadget?.brawler || rawStarPower?.brawler || ''
      const abilityName = (cube === 'gadget' ? rawGadget?.gadgetName : rawStarPower?.starpowerName) || ''
      const winRate = asNumber(row.metricsRaw?.winRateAdj)
      const picks = asNumber(row.metricsRaw?.picks)

      return {
        type: cube === 'gadget' ? ('gadget' as const) : ('starPower' as const),
        abilityId,
        abilityName,
        brawlerKey: brawlerStatKey(brawlerName),
        winRateAdj: winRate * 100,
        picks: Number.isFinite(picks) ? picks : undefined,
      }
    })
    .filter((stat) => stat.abilityId > 0 && stat.brawlerKey && Number.isFinite(stat.winRateAdj))
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
