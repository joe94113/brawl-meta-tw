import { mkdir, writeFile } from 'node:fs/promises'

const META_SOURCE_URL = 'https://brawltime.ninja/tier-list/brawler'
const RECENT_WINDOW_DAYS = 30
const windowStart = recentWindowStart()
const statsSourceUrl = recentStatsSourceUrl(windowStart)
const gadgetSourceUrl = abilityStatsSourceUrl('gadget', windowStart)
const starPowerSourceUrl = abilityStatsSourceUrl('starpower', windowStart)

const [statsHtml, auxHtml, gadgetHtml, starPowerHtml] = await Promise.all([
  fetch(statsSourceUrl).then((response) => {
    if (!response.ok) throw new Error(`Brawl Time Ninja ${response.status}`)
    return response.text()
  }),
  fetch(META_SOURCE_URL).then((response) => {
    if (!response.ok) throw new Error(`Brawl Time Ninja ${response.status}`)
    return response.text()
  }),
  fetch(gadgetSourceUrl).then((response) => {
    if (!response.ok) throw new Error(`Brawl Time Ninja ${response.status}`)
    return response.text()
  }),
  fetch(starPowerSourceUrl).then((response) => {
    if (!response.ok) throw new Error(`Brawl Time Ninja ${response.status}`)
    return response.text()
  }),
])

const statsPageContext = extractPageContext(statsHtml)
const auxPageContext = extractPageContext(auxHtml)
const statsQueries = statsPageContext?.vueQueryState?.queries || []
const auxQueries = auxPageContext?.vueQueryState?.queries || []
const statsPayloads = statsQueries.map((query) => query.state?.data).filter(Boolean)
const auxPayloads = auxQueries.map((query) => query.state?.data).filter(Boolean)
const abilityStats = [...parseAbilityStats(gadgetHtml, 'gadget'), ...parseAbilityStats(starPowerHtml, 'starpower')]

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

const teamPayload = auxPayloads.find(
  (payload) =>
    payload?.kind === 'response' &&
    payload.query?.cubeId === 'battle' &&
    payload.query?.dimensionsIds?.includes('team') &&
    payload.query?.metricsIds?.includes('wins'),
)

const snapshot = {
  stats: (statPayload?.data || [])
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
    .filter((stat) => stat.brawlerKey && Number.isFinite(stat.winRateAdj)),
  abilityStats,
  topTeams: (teamPayload?.data || [])
    .map((row) => ({
      brawlerKeys: (row.dimensionsRaw?.team?.team || []).map((name) => brawlerStatKey(name)),
      wins: asNumber(row.metricsRaw?.wins),
    }))
    .filter((team) => team.brawlerKeys.length >= 3 && Number.isFinite(team.wins))
    .slice(0, 8),
  activeEvents: auxQueries
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
    .slice(0, 12),
  windowStart,
  windowLabel: `近 ${RECENT_WINDOW_DAYS} 天`,
  sampleSize,
  lastUpdated: typeof sample.timestamp === 'string' ? sample.timestamp : undefined,
  sourceUrl: statsSourceUrl,
}

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/data/meta-snapshot.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

function extractPageContext(pageHtml) {
  const match = pageHtml.match(/<script id="vike_pageContext" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('Brawl Time Ninja page context not found')
  return JSON.parse(match[1])
}

function asNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return Number.NaN
}

function brawlerStatKey(value) {
  return value
    .normalize('NFKD')
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]+/g, '')
}

function recentWindowStart() {
  const date = new Date()
  date.setDate(date.getDate() - RECENT_WINDOW_DAYS)
  return date.toISOString().slice(0, 10)
}

function recentStatsSourceUrl(start) {
  return `https://brawltime.ninja/dashboard?cube=map&dimension=brawler&filter%5Bseason%5D=${start}&metric=useRate&metric=winRateAdj&sort=winRateAdj`
}

function abilityStatsSourceUrl(cube, start) {
  return `https://brawltime.ninja/dashboard?cube=${cube}&dimension=brawler&dimension=${cube}&filter%5Bseason%5D=${start}&metric=useRate&metric=winRateAdj&sort=winRateAdj`
}

function parseAbilityStats(pageHtml, cube) {
  const pageContext = extractPageContext(pageHtml)
  const queries = pageContext?.vueQueryState?.queries || []
  const payloads = queries.map((query) => query.state?.data).filter(Boolean)
  const statPayload = payloads
    .filter(
      (payload) =>
        payload?.kind === 'response' &&
        payload.query?.cubeId === cube &&
        payload.query?.dimensionsIds?.includes('brawler') &&
        payload.query?.dimensionsIds?.includes(cube) &&
        payload.query?.metricsIds?.includes('winRateAdj') &&
        payload.query?.metricsIds?.includes('useRate'),
    )
    .sort((a, b) => (b?.data?.length || 0) - (a?.data?.length || 0))[0]

  const samplePayload = payloads.find(
    (payload) =>
      payload?.kind === 'response' &&
      payload.query?.cubeId === cube &&
      payload.query.metricsIds?.includes('timestamp') &&
      payload.query.metricsIds?.includes('picks') &&
      !payload.query.dimensionsIds?.length,
  )
  const sample = samplePayload?.data?.[0]?.metricsRaw || {}
  const sampleSize = typeof sample.picks === 'number' ? sample.picks : undefined

  return (statPayload?.data || [])
    .map((row) => {
      const rawAbility = cube === 'gadget' ? row.dimensionsRaw?.gadget : row.dimensionsRaw?.starpower
      const abilityId = Number(cube === 'gadget' ? rawAbility?.gadget : rawAbility?.starpower)
      const brawlerName = row.dimensionsRaw?.brawler?.brawler || rawAbility?.brawler || ''
      const abilityName = (cube === 'gadget' ? rawAbility?.gadgetName : rawAbility?.starpowerName) || ''
      const winRate = asNumber(row.metricsRaw?.winRateAdj)
      const useRate = asNumber(row.metricsRaw?.useRate)

      return {
        type: cube === 'gadget' ? 'gadget' : 'starPower',
        abilityId,
        abilityName,
        brawlerKey: brawlerStatKey(brawlerName),
        winRateAdj: winRate * 100,
        useRate: useRate * 100,
        picksEstimate: sampleSize ? Math.round(sampleSize * useRate) : undefined,
      }
    })
    .filter((stat) => stat.abilityId > 0 && stat.brawlerKey && Number.isFinite(stat.winRateAdj))
}
