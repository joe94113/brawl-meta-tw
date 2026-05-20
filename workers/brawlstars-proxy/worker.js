const API_BASE = 'https://api.brawlstars.com/v1'

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

    if (!env.BRAWL_STARS_TOKEN) {
      return jsonResponse({ message: 'BRAWL_STARS_TOKEN is not configured' }, 500, cors)
    }

    if (!isAllowedOrigin(origin, env)) {
      return jsonResponse({ message: 'Origin not allowed' }, 403, cors)
    }

    const upstreamPath = toPlayerApiPath(new URL(request.url).pathname)
    if (!upstreamPath) {
      return jsonResponse({ message: 'Only /players/:tag and /players/:tag/battlelog are supported' }, 404, cors)
    }

    const upstream = await fetch(`${API_BASE}${upstreamPath}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.BRAWL_STARS_TOKEN}`,
      },
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors,
        'Cache-Control': upstream.ok ? 'public, max-age=30' : 'no-store',
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    })
  },
}

function toPlayerApiPath(pathname) {
  const normalizedPath = pathname.replace(/^\/api\/brawlstars/, '')
  const match = normalizedPath.match(/^\/players\/([^/]+)(\/battlelog)?\/?$/)
  if (!match) return ''

  const tag = decodeURIComponent(match[1]).replace(/^#?/, '#').toUpperCase()
  if (!/^#[0289PYLQGRJCUV]+$/.test(tag)) return ''

  return `/players/${encodeURIComponent(tag)}${match[2] || ''}`
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
      'Content-Type': 'application/json',
    },
  })
}
