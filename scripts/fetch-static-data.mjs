import { mkdir, readFile, writeFile } from 'node:fs/promises'

const META_SOURCE_URL = 'https://brawltime.ninja/tier-list/brawler'
const RECENT_WINDOW_DAYS = 30
const SNAPSHOT_URL = new URL('../public/data/meta-snapshot.json', import.meta.url)
const BRAWL_TIME_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}
const HOME_ACTIVE_MODE_SLUGS = new Set([
  'gemGrab',
  'heist',
  'bounty',
  'brawlBall',
  'soloShowdown',
  'duoShowdown',
  'hotZone',
  'knockout',
  'wipeout',
  'wipeout5V5',
  'trioWipeout',
  'brawlBall5V5',
  'gemGrab5V5',
  'knockout5V5',
  'trioShowdown',
  'trophyEscape',
])
const MODE_SLUG_ALIASES = {
  deathmatch: 'wipeout',
  deathmatch5v5: 'wipeout5V5',
  trophyThieves: 'trophyEscape',
}
const windowStart = recentWindowStart()
const statsSourceUrl = recentStatsSourceUrl(windowStart)
const gadgetSourceUrl = abilityStatsSourceUrl('gadget', windowStart)
const starPowerSourceUrl = abilityStatsSourceUrl('starpower', windowStart)

let requiredPages
try {
  requiredPages = await Promise.all([fetchBrawlTimeText(statsSourceUrl), fetchBrawlTimeText(META_SOURCE_URL)])
} catch (error) {
  await keepExistingSnapshotOrThrow(error)
  process.exit(0)
}

const [statsHtml, auxHtml] = requiredPages
const [gadgetHtml, starPowerHtml] = await Promise.all([
  fetchOptionalBrawlTimeText(gadgetSourceUrl),
  fetchOptionalBrawlTimeText(starPowerSourceUrl),
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

const activeEvents = auxQueries
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

const mapStats = await fetchActiveMapStats(activeEvents, windowStart)

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
  mapStats,
  abilityStats,
  topTeams: (teamPayload?.data || [])
    .map((row) => ({
      brawlerKeys: (row.dimensionsRaw?.team?.team || []).map((name) => brawlerStatKey(name)),
      wins: asNumber(row.metricsRaw?.wins),
    }))
    .filter((team) => team.brawlerKeys.length >= 3 && Number.isFinite(team.wins))
    .slice(0, 8),
  activeEvents,
  windowStart,
  windowLabel: `近 ${RECENT_WINDOW_DAYS} 天`,
  sampleSize,
  lastUpdated: typeof sample.timestamp === 'string' ? sample.timestamp : undefined,
  sourceUrl: statsSourceUrl,
}

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true })
await writeFile(SNAPSHOT_URL, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

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
  return `https://brawltime.ninja/dashboard?cube=${cube}&dimension=brawler&dimension=${cube}&filter%5Bseason%5D=${start}&metric=picks&metric=winRateAdj&sort=winRateAdj`
}

async function fetchBrawlTimeText(url) {
  const response = await fetch(url, { headers: BRAWL_TIME_HEADERS })
  if (!response.ok) throw new Error(`Brawl Time Ninja ${response.status}: ${url}`)
  return response.text()
}

async function fetchOptionalBrawlTimeText(url) {
  try {
    return await fetchBrawlTimeText(url)
  } catch (error) {
    console.warn(`[data:meta] Optional Brawl Time request failed: ${errorMessage(error)}`)
    return ''
  }
}

async function keepExistingSnapshotOrThrow(error) {
  const existing = await readExistingSnapshot()
  if (!existing?.stats?.length) throw error

  console.warn(`[data:meta] ${errorMessage(error)}`)
  console.warn('[data:meta] Keeping existing public/data/meta-snapshot.json so deployment can continue.')
}

async function readExistingSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_URL, 'utf8'))
  } catch {
    return null
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function canonicalModeSlug(value) {
  return MODE_SLUG_ALIASES[value] || value
}

function isHomeActiveModeSlug(value) {
  return HOME_ACTIVE_MODE_SLUGS.has(canonicalModeSlug(value))
}

async function fetchActiveMapStats(events, start) {
  const uniqueEvents = Array.from(new Map(events.map((event) => [event.id, event])).values())
  const results = await Promise.all(
    uniqueEvents.map(async (event) => {
      try {
        const html = await fetchBrawlTimeText(mapStatsSourceUrl(event.map, start))
        return parseMapStats(html)
      } catch (error) {
        console.warn(`[data:meta] Map stats skipped for ${event.map}: ${errorMessage(error)}`)
        return []
      }
    }),
  )

  return results.flat()
}

function mapStatsSourceUrl(mapName, start) {
  return `https://brawltime.ninja/dashboard?cube=map&dimension=map&dimension=brawler&filter%5Bseason%5D=${start}&filter%5Bmap%5D=${encodeURIComponent(mapName)}&metric=useRate&metric=winRateAdj&sort=winRateAdj`
}

function parseMapStats(pageHtml) {
  const pageContext = extractPageContext(pageHtml)
  const queries = pageContext?.vueQueryState?.queries || []
  const payloads = queries.map((query) => query.state?.data).filter(Boolean)
  const statPayload = payloads
    .filter(
      (payload) =>
        payload?.kind === 'response' &&
        payload.query?.cubeId === 'map' &&
        payload.query?.dimensionsIds?.includes('map') &&
        payload.query?.dimensionsIds?.includes('brawler') &&
        payload.query?.metricsIds?.includes('winRateAdj') &&
        payload.query?.metricsIds?.includes('useRate'),
    )
    .sort((a, b) => (b?.data?.length || 0) - (a?.data?.length || 0))[0]

  return (statPayload?.data || [])
    .map((row) => {
      const sourceMap = row.dimensionsRaw?.map || {}
      const sourceName = row.dimensionsRaw?.brawler?.brawler || ''
      const winRate = asNumber(row.metricsRaw?.winRateAdj)
      const useRate = asNumber(row.metricsRaw?.useRate)

      return {
        eventId: String(sourceMap.eventId || ''),
        mapName: String(sourceMap.map || ''),
        modeSlug: String(sourceMap.mode || ''),
        brawlerKey: brawlerStatKey(sourceName),
        winRateAdj: winRate * 100,
        useRate: useRate * 100,
      }
    })
    .filter((stat) => stat.eventId && stat.mapName && stat.brawlerKey && Number.isFinite(stat.winRateAdj))
}

function parseAbilityStats(pageHtml, cube) {
  if (!pageHtml) return []

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
        type: cube === 'gadget' ? 'gadget' : 'starPower',
        abilityId,
        abilityName,
        brawlerKey: brawlerStatKey(brawlerName),
        winRateAdj: winRate * 100,
        picks: Number.isFinite(picks) ? picks : undefined,
      }
    })
    .filter((stat) => stat.abilityId > 0 && stat.brawlerKey && Number.isFinite(stat.winRateAdj))
}
