const BRAWL_TIME_BASE = 'https://brawltime.ninja'
const BRAWL_TIME_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}
const PROFILE_CACHE_TTL_MS = 60 * 1000
const profileCache = new Map()

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = corsHeaders(origin, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'GET') {
      return jsonResponse({ message: 'Method not allowed' }, 405, cors)
    }

    const url = new URL(request.url)
    if (url.pathname === '/__debug/ip') {
      return debugEgressIp(request, env, cors)
    }

    if (!isAllowedOrigin(origin, env)) {
      return jsonResponse({ message: 'Origin not allowed' }, 403, cors)
    }

    const playerRequest = toPlayerRequest(url.pathname)
    if (!playerRequest) {
      return jsonResponse({ message: 'Only /players/:tag and /players/:tag/battlelog are supported' }, 404, cors)
    }

    let brawlTimeProfile
    try {
      brawlTimeProfile = await fetchBrawlTimeProfile(playerRequest.tag)
    } catch (error) {
      return jsonResponse({ message: errorMessage(error) }, 502, {
        ...cors,
        'Cache-Control': 'no-store',
      })
    }

    const body = playerRequest.battlelog ? toBattleLogResponse(brawlTimeProfile) : toPlayerResponse(brawlTimeProfile)

    return jsonResponse(body, 200, {
      ...cors,
      'Cache-Control': 'public, max-age=60',
    })
  },
}

async function fetchBrawlTimeProfile(tag) {
  const cached = profileCache.get(tag)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise
  }

  const promise = fetchBrawlTimeProfileFromPage(tag)
  profileCache.set(tag, {
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
    promise,
  })

  try {
    return await promise
  } catch (error) {
    const latest = profileCache.get(tag)
    if (latest?.promise === promise) profileCache.delete(tag)
    throw error
  }
}

async function fetchBrawlTimeProfileFromPage(tag) {
  const response = await fetch(`${BRAWL_TIME_BASE}/profile/${tag}`, {
    headers: BRAWL_TIME_HEADERS,
  })

  if (!response.ok) throw new Error(`Brawl Time Ninja ${response.status}`)

  const html = await response.text()
  const pageContext = extractPageContext(html)
  const piniaState = parsePiniaState(pageContext.piniaState)
  const player = piniaState?.json?.brawlstars?.player
  const allBrawlers = pageContext.vueQueryState?.queries?.find((query) => query.queryKey?.[0] === 'all-brawlers')?.state?.data || []
  const rankedIcons = extractRankedIcons(html)

  if (!player?.tag) {
    throw new Error('Brawl Time Ninja profile payload not found')
  }

  return { player, allBrawlers, rankedIcons }
}

function toPlayerResponse(profile) {
  const { player } = profile

  return {
    tag: player.tag,
    name: player.name,
    nameColor: player.nameColor,
    icon: player.icon,
    trophies: player.trophies,
    highestTrophies: player.highestTrophies,
    expLevel: player.expLevel,
    expPoints: player.expPoints || 0,
    rankedRank: player.rankedRank || 0,
    rankedRankName: player.rankedRankName || '',
    rankedRankIconUrl: rankIconUrl(profile, player.rankedRankName),
    rankedElo: player.rankedElo || 0,
    rankedSeasonId: player.rankedSeasonId || '',
    highestSeasonRankedRank: player.highestSeasonRankedRank || 0,
    highestSeasonRankedRankName: player.highestSeasonRankedRankName || '',
    highestSeasonRankedRankIconUrl: rankIconUrl(profile, player.highestSeasonRankedRankName),
    highestSeasonRankedElo: player.highestSeasonRankedElo || 0,
    highestAllTimeRankedRank: player.highestAllTimeRankedRank || 0,
    highestAllTimeRankedRankName: player.highestAllTimeRankedRankName || '',
    highestAllTimeRankedRankIconUrl: rankIconUrl(profile, player.highestAllTimeRankedRankName),
    highestAllTimeRankedElo: player.highestAllTimeRankedElo || 0,
    soloVictories: player.soloVictories || 0,
    duoVictories: player.duoVictories || 0,
    '3vs3Victories': player['3vs3Victories'] || 0,
    totalPrestigeLevel: player.totalPrestigeLevel || 0,
    bestRoboRumbleTime: player.bestRoboRumbleTime || 0,
    bestTimeAsBigBrawler: player.bestTimeAsBigBrawler || 0,
    isQualifiedFromChampionshipChallenge: Boolean(player.isQualifiedFromChampionshipChallenge),
    club: player.club,
    brawlers: Object.values(player.brawlers || {}).map(toPlayerBrawler),
  }
}

function toBattleLogResponse(profile) {
  const lookup = brawlerLookup(profile)
  const ownerTag = String(profile.player.tag || '').replace(/^#/, '')

  return {
    items: (profile.player.battles || []).map((battle) => ({
      battleTime: battle.timestamp,
      event: {
        id: battle.event?.id,
        mode: battle.event?.mode,
        modeId: battle.event?.modeId,
        map: battle.event?.map,
      },
      battle: {
        mode: battle.event?.mode,
        type: battle.ranked ? 'ranked' : 'regular',
        result: battle.victory ? 'victory' : 'defeat',
        rawResult: battle.result,
        ranked: Boolean(battle.ranked),
        trophyChange: battle.trophyChange,
        rank: parseBattleRank(battle.result),
        teams: (battle.teams || []).map((team) =>
          team.map((player) => ({
            tag: player.tag ? `#${player.tag.replace(/^#/, '')}` : undefined,
            name: player.name,
            isBigBrawler: Boolean(player.isBigbrawler),
            brawler: toBattleBrawler(player, lookup, ownerTag),
          })),
        ),
      },
    })),
  }
}

function brawlerLookup(profile) {
  const result = new Map()

  for (const brawler of Object.values(profile.player.brawlers || {})) {
    result.set(slugify(brawler.name), brawler)
  }

  for (const brawler of profile.allBrawlers || []) {
    if (result.has(brawler.slug)) continue

    result.set(brawler.slug, {
      id: 0,
      name: brawler.brawlstarsId || brawler.name,
      power: 0,
      rank: 0,
      trophies: 0,
      highestTrophies: 0,
    })
  }

  return result
}

function toPlayerBrawler(brawler) {
  return {
    id: brawler.id,
    name: brawler.name,
    power: brawler.power,
    rank: brawler.rank,
    trophies: brawler.trophies,
    highestTrophies: brawler.highestTrophies,
    prestigeLevel: brawler.prestigeLevel || 0,
    currentWinStreak: brawler.currentWinStreak || 0,
    maxWinStreak: brawler.maxWinStreak || 0,
    skin: brawler.skin ? pickNamedItem(brawler.skin) : undefined,
    gadgets: toNamedItems(brawler.gadgets),
    starPowers: toNamedItems(brawler.starPowers),
    gears: toNamedItems(brawler.gears),
    hyperCharges: toNamedItems(brawler.hyperCharges),
    buffies: {
      gadget: Boolean(brawler.buffies?.gadget),
      starPower: Boolean(brawler.buffies?.starPower),
      hyperCharge: Boolean(brawler.buffies?.hyperCharge),
    },
  }
}

function toBattleBrawler(player, lookup, ownerTag) {
  const matched = lookup.get(player.brawler) || {}
  const isOwner = player.tag?.replace(/^#/, '') === ownerTag

  return {
    id: matched.id || 0,
    name: matched.name || player.brawler?.toUpperCase() || 'UNKNOWN',
    power: isOwner ? matched.power || 0 : 0,
    rank: player.brawlerRank || (isOwner ? matched.rank : 0) || 0,
    trophies: player.brawlerTrophies || matched.trophies || 0,
    highestTrophies: (isOwner ? matched.highestTrophies : 0) || player.brawlerTrophies || 0,
    prestigeLevel: isOwner ? matched.prestigeLevel || 0 : 0,
    currentWinStreak: isOwner ? matched.currentWinStreak || 0 : 0,
    maxWinStreak: isOwner ? matched.maxWinStreak || 0 : 0,
    skin: isOwner && matched.skin ? pickNamedItem(matched.skin) : undefined,
    gadgets: isOwner ? toNamedItems(matched.gadgets) : [],
    starPowers: isOwner ? toNamedItems(matched.starPowers) : [],
    gears: isOwner ? toNamedItems(matched.gears) : [],
    hyperCharges: isOwner ? toNamedItems(matched.hyperCharges) : [],
    buffies: {
      gadget: Boolean(isOwner && matched.buffies?.gadget),
      starPower: Boolean(isOwner && matched.buffies?.starPower),
      hyperCharge: Boolean(isOwner && matched.buffies?.hyperCharge),
    },
  }
}

function toNamedItems(items) {
  return Array.isArray(items) ? items.map(pickNamedItem).filter((item) => item.id || item.name) : []
}

function pickNamedItem(item) {
  return {
    id: item?.id || 0,
    name: item?.name || '',
    level: item?.level || undefined,
  }
}

function parseBattleRank(result) {
  const match = String(result || '').match(/Rank\s+(\d+)/i)
  return match ? Number(match[1]) : undefined
}

function extractPageContext(html) {
  const match = html.match(/<script id="vike_pageContext" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('Brawl Time Ninja page context not found')
  return JSON.parse(match[1])
}

function parsePiniaState(value) {
  if (!value) return null
  return typeof value === 'string' ? JSON.parse(value) : value
}

function extractRankedIcons(html) {
  const icons = new Map()
  const matches = html.matchAll(/<img\b(?=[^>]*\bsrc="([^"]*rank_[^"]+\.png)")(?=[^>]*\balt="([^"]+)")[^>]*>/gi)

  for (const match of matches) {
    const [, src, alt] = match
    if (!src || !alt) continue
    icons.set(normalizeRankName(alt), absoluteBrawlTimeUrl(src))
  }

  return icons
}

function rankIconUrl(profile, rankName) {
  if (!rankName || !profile.rankedIcons) return ''
  return profile.rankedIcons.get(normalizeRankName(rankName)) || ''
}

function normalizeRankName(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

function absoluteBrawlTimeUrl(src) {
  return src.startsWith('http') ? src : `${BRAWL_TIME_BASE}${src}`
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function toPlayerRequest(pathname) {
  const normalizedPath = pathname.replace(/^\/api\/brawlstars/, '')
  const match = normalizedPath.match(/^\/players\/([^/]+)(\/battlelog)?\/?$/)
  if (!match) return null

  const tag = decodeURIComponent(match[1]).replace(/^#?/, '').toUpperCase()
  if (!/^[0289PYLQGRJCUV]+$/.test(tag)) return null

  return {
    tag,
    battlelog: Boolean(match[2]),
  }
}

async function debugEgressIp(request, env, cors) {
  if (!env.DEBUG_TOKEN) {
    return jsonResponse({ message: 'DEBUG_TOKEN is not configured' }, 404, cors)
  }

  const url = new URL(request.url)
  const providedToken = request.headers.get('X-Debug-Token') || url.searchParams.get('token') || ''
  if (providedToken !== env.DEBUG_TOKEN) {
    return jsonResponse({ message: 'Not found' }, 404, cors)
  }

  const response = await fetch('https://api.ipify.org?format=json', {
    headers: { Accept: 'application/json' },
  })
  const body = await response.json()

  return jsonResponse(
    {
      ip: body.ip,
      colo: request.cf?.colo || null,
      note: 'This is the current Worker egress IP for this request only; Cloudflare Workers free egress is not guaranteed to stay fixed.',
    },
    200,
    cors,
  )
}

function corsHeaders(origin, env) {
  const allowedOrigin = isAllowedOrigin(origin, env) ? origin : firstAllowedOrigin(env)

  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    Vary: 'Origin',
  }
}

function isAllowedOrigin(origin, env) {
  const allowedOrigins = allowedOriginList(env)
  if (allowedOrigins.length === 0) return true
  return allowedOrigins.includes(origin)
}

function firstAllowedOrigin(env) {
  return allowedOriginList(env)[0] || ''
}

function allowedOriginList(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
