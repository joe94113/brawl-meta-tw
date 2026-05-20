<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

type Tier = 'S' | 'A' | 'B' | 'C' | 'D'
type SearchType = 'brawler' | 'player' | 'map'
type DraftLane = 'enemy' | 'ally' | 'ban'

interface NamedValue {
  id: number
  name: string
  color?: string
}

interface Ability {
  id: number
  name: string
  description?: string
  imageUrl?: string
  released?: boolean
}

interface ApiBrawler {
  id: number
  name: string
  released: boolean
  link?: string
  imageUrl?: string
  imageUrl2?: string
  class?: NamedValue
  rarity?: NamedValue
  description?: string
  starPowers?: Ability[]
  gadgets?: Ability[]
}

interface Brawler {
  id: number
  name: string
  role: string
  rarityName: string
  rarityColor: string
  description: string
  imageUrl: string
  portraitUrl: string
  link: string
  tier: Tier
  metaScore: number
  tags: string[]
  starPowers: Ability[]
  gadgets: Ability[]
}

interface ApiGameMode {
  id: number
  name: string
  disabled?: boolean
  color?: string
  bgColor?: string
  imageUrl?: string
  imageUrl2?: string
  shortDescription?: string
  description?: string
  sort1?: number
}

interface GameMode {
  id: number
  name: string
  disabled: boolean
  color: string
  bgColor: string
  imageUrl: string
  shortDescription: string
  sort1: number
}

interface ApiMap {
  id: number
  name: string
  disabled?: boolean
  link?: string
  imageUrl?: string
  environment?: NamedValue & { imageUrl?: string }
  gameMode?: ApiGameMode
}

interface MapItem {
  id: number
  name: string
  disabled: boolean
  link: string
  imageUrl: string
  environmentName: string
  modeName: string
  modeColor: string
}

interface RankedBrawler extends Brawler {
  liveScore: number
  liveTier: Tier
}

interface OfficialPlayerBrawler {
  id: number
  name: string
  power: number
  rank: number
  trophies: number
  highestTrophies: number
}

interface OfficialPlayer {
  tag: string
  name: string
  trophies: number
  highestTrophies: number
  expLevel: number
  soloVictories: number
  duoVictories: number
  '3vs3Victories': number
  club?: {
    tag: string
    name: string
  }
  brawlers: OfficialPlayerBrawler[]
}

interface OfficialBattle {
  battleTime: string
  event?: {
    mode?: string
    map?: string
  }
  battle?: {
    mode?: string
    type?: string
    result?: string
    duration?: number
    trophyChange?: number
    rank?: number
  }
}

interface BattleLogResponse {
  items: OfficialBattle[]
}

const API_BASE = 'https://api.brawlify.com/v1'
const tiers: Tier[] = ['S', 'A', 'B', 'C', 'D']

const sectionTabs = [
  { id: 'home', label: '首頁' },
  { id: 'tier', label: 'Meta 榜' },
  { id: 'draft', label: '選角指南' },
  { id: 'counter', label: 'Counter' },
  { id: 'player', label: '戰績查詢' },
  { id: 'maprates', label: '地圖勝率' },
  { id: 'maps', label: '地圖資料' },
] as const

const roleLabels: Record<string, string> = {
  'Damage Dealer': '輸出',
  Controller: '控場',
  Assassin: '刺客',
  Tank: '坦克',
  Marksman: '射手',
  Support: '輔助',
  Artillery: '投擲',
  Unknown: '新角色',
}

const roleBaseScores: Record<string, number> = {
  'Damage Dealer': 68,
  Controller: 67,
  Assassin: 65,
  Marksman: 65,
  Support: 63,
  Artillery: 62,
  Tank: 61,
  Unknown: 64,
}

const rarityScore: Record<string, number> = {
  Common: 0,
  Rare: 0.5,
  'Super Rare': 1,
  Epic: 1.4,
  Mythic: 1.8,
  Legendary: 2.2,
  'Ultra Legendary': 2.8,
}

const editorialBoost: Record<string, number> = {
  Najia: 13,
  Trunk: 12,
  Gigi: 11,
  Ziggy: 10,
  Sirius: 10,
  Glowbert: 9,
  Ollie: 8,
  'Jae-yong': 8,
  Finx: 8,
  Clancy: 7,
  'Starr Nova': 7,
  Bolt: 7,
  Kenji: 6,
  Juju: 6,
  Moe: 6,
  Melodie: 5,
  Belle: 5,
  Gale: 5,
  Max: 4,
  Sandy: 4,
  Byron: 4,
  Stu: 4,
}

const modeRoleWeights: Record<string, Record<string, number>> = {
  'Gem Grab': { Controller: 8, Support: 6, 'Damage Dealer': 4, Assassin: 2, Marksman: 1 },
  Heist: { 'Damage Dealer': 9, Marksman: 5, Controller: 3, Tank: 2 },
  Bounty: { Marksman: 9, Artillery: 5, Controller: 4, Assassin: 2 },
  'Brawl Ball': { Tank: 7, Assassin: 6, Controller: 5, Support: 4, 'Damage Dealer': 3 },
  Knockout: { Marksman: 8, Artillery: 6, Assassin: 5, Controller: 4 },
  Wipeout: { Marksman: 8, Assassin: 5, Artillery: 4, 'Damage Dealer': 4 },
  'Hot Zone': { Controller: 9, Support: 6, Tank: 5, 'Damage Dealer': 3 },
  'Solo Showdown': { Assassin: 7, Tank: 6, 'Damage Dealer': 5, Marksman: 3 },
  'Duo Showdown': { Assassin: 6, Support: 5, Tank: 5, 'Damage Dealer': 4 },
  Duels: { Assassin: 6, Marksman: 6, 'Damage Dealer': 5, Tank: 3 },
}

const counterMatrix: Record<string, Record<string, number>> = {
  Assassin: { Artillery: 18, Marksman: 13, Support: 11, Controller: 5, 'Damage Dealer': 3, Unknown: 2, Tank: -9 },
  Tank: { Assassin: 12, Artillery: 5, Support: 4, 'Damage Dealer': 1, Controller: -5, Marksman: -12 },
  Marksman: { Tank: 16, 'Damage Dealer': 8, Support: 7, Controller: 4, Assassin: -8, Artillery: -6 },
  Artillery: { Controller: 10, Marksman: 7, Support: 6, Tank: -3, Assassin: -15 },
  Controller: { Tank: 14, Assassin: 10, 'Damage Dealer': 5, Support: 4, Marksman: -3, Artillery: -7 },
  Support: { Assassin: 5, Tank: 3, Controller: 1, 'Damage Dealer': -5, Marksman: -6 },
  'Damage Dealer': { Support: 9, Tank: 7, Controller: 3, Assassin: 1, Marksman: -3, Artillery: -3 },
  Unknown: { Tank: 4, Support: 4, Artillery: 3, Marksman: 3, Controller: 3, Assassin: 3, 'Damage Dealer': 3 },
}

const activeSection = ref<(typeof sectionTabs)[number]['id']>('home')
const loading = ref(true)
const loadError = ref('')
const brawlers = ref<Brawler[]>([])
const maps = ref<MapItem[]>([])
const gameModes = ref<GameMode[]>([])

const searchType = ref<SearchType>('brawler')
const globalSearch = ref('')
const roleFilter = ref('All')
const tierSearch = ref('')
const selectedMode = ref('All')
const selectedMapId = ref<number | null>(null)
const selectedBrawlerId = ref<number | null>(null)
const mapSearch = ref('')

const playerTag = ref('')
const recentTags = ref<string[]>([])
const playerLoading = ref(false)
const playerError = ref('')
const playerProfile = ref<OfficialPlayer | null>(null)
const battleLog = ref<OfficialBattle[]>([])

const draftLane = ref<DraftLane>('enemy')
const enemyPicks = ref<number[]>([])
const allyPicks = ref<number[]>([])
const bans = ref<number[]>([])

const todayLabel = new Intl.DateTimeFormat('zh-TW', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date())

onMounted(() => {
  loadRecentTags()
  loadGameData()
})

watch(brawlers, (items) => {
  if (!selectedBrawlerId.value && items.length > 0) {
    selectedBrawlerId.value = items[0]?.id ?? null
  }
})

async function loadGameData() {
  loading.value = true
  loadError.value = ''

  try {
    const [brawlerResponse, mapResponse, modeResponse] = await Promise.all([
      fetchJson<{ list: ApiBrawler[] }>(`${API_BASE}/brawlers`),
      fetchJson<{ list: ApiMap[] }>(`${API_BASE}/maps`),
      fetchJson<{ list: ApiGameMode[] }>(`${API_BASE}/gamemodes`),
    ])

    brawlers.value = buildBrawlers(brawlerResponse.list)
    maps.value = buildMaps(mapResponse.list)
    gameModes.value = buildModes(modeResponse.list)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Brawlify game-data API 暫時無法讀取'
  } finally {
    loading.value = false
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`API ${response.status}: ${url}`)
  return response.json() as Promise<T>
}

function buildBrawlers(list: ApiBrawler[]): Brawler[] {
  const scored = list
    .filter((brawler) => brawler.released)
    .map((brawler) => {
      const role = brawler.class?.name || 'Unknown'
      const rarityName = brawler.rarity?.name || 'Unknown'
      const description = cleanText(brawler.description || '')
      const baseScore =
        (roleBaseScores[role] ?? 62) +
        (rarityScore[rarityName] ?? 1) +
        (editorialBoost[brawler.name] ?? 0) +
        releasePressure(brawler.id) +
        deterministicNoise(brawler.name, brawler.id)

      return {
        id: brawler.id,
        name: brawler.name,
        role,
        rarityName,
        rarityColor: brawler.rarity?.color || '#8aa0ad',
        description,
        imageUrl: brawler.imageUrl || brawler.imageUrl2 || '',
        portraitUrl: brawler.imageUrl2 || brawler.imageUrl || '',
        link: brawler.link || `https://brawlify.com/brawlers/${brawler.id}`,
        tier: 'B' as Tier,
        metaScore: Math.round(baseScore * 10) / 10,
        tags: inferTags(role, description),
        starPowers: brawler.starPowers || [],
        gadgets: brawler.gadgets || [],
      }
    })
    .sort((a, b) => b.metaScore - a.metaScore)

  return scored.map((brawler, index) => ({
    ...brawler,
    tier: tierForRank(index, scored.length),
  }))
}

function buildMaps(list: ApiMap[]): MapItem[] {
  return list.map((map) => ({
    id: map.id,
    name: map.name,
    disabled: Boolean(map.disabled),
    link: map.link || `https://brawlify.com/maps/${map.id}`,
    imageUrl: map.imageUrl || '',
    environmentName: map.environment?.name || 'Unknown',
    modeName: map.gameMode?.name || 'Unknown',
    modeColor: map.gameMode?.color || '#2db8ff',
  }))
}

function buildModes(list: ApiGameMode[]): GameMode[] {
  return list
    .map((mode) => ({
      id: mode.id,
      name: mode.name,
      disabled: Boolean(mode.disabled),
      color: mode.color || '#2db8ff',
      bgColor: mode.bgColor || '#132033',
      imageUrl: mode.imageUrl || mode.imageUrl2 || '',
      shortDescription: mode.shortDescription || mode.description || '',
      sort1: mode.sort1 ?? 999,
    }))
    .sort((a, b) => a.sort1 - b.sort1)
}

function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function deterministicNoise(name: string, id: number) {
  const hash = Array.from(`${name}-${id}`).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return (hash % 70) / 10 - 2.5
}

function releasePressure(id: number) {
  const releaseIndex = Math.max(0, id - 16000000)
  return Math.min(8, releaseIndex / 14)
}

function tierForRank(index: number, total: number): Tier {
  const ratio = (index + 1) / Math.max(total, 1)
  if (ratio <= 0.15) return 'S'
  if (ratio <= 0.35) return 'A'
  if (ratio <= 0.65) return 'B'
  if (ratio <= 0.85) return 'C'
  return 'D'
}

function inferTags(role: string, description: string) {
  const source = `${role} ${description}`.toLowerCase()
  const tags: string[] = []

  if (/heal|teammate|support/.test(source)) tags.push('healing')
  if (/slow|stun|knock|control|pull|push/.test(source)) tags.push('control')
  if (/dash|jump|speed|teleport|charge/.test(source)) tags.push('mobility')
  if (/wall|throw|over|area|zone/.test(source)) tags.push('space')
  if (/range|rocket|sniper|projectile|bullet/.test(source)) tags.push('range')
  if (/shield|health|tank/.test(source)) tags.push('durable')
  if (role === 'Artillery') tags.push('space')
  if (role === 'Marksman') tags.push('range')
  if (role === 'Assassin') tags.push('mobility')
  if (role === 'Controller') tags.push('control')

  return Array.from(new Set(tags))
}

const modeOptions = computed(() => [
  'All',
  ...Array.from(new Set(gameModes.value.filter((mode) => !mode.disabled).map((mode) => mode.name))),
])

const roleOptions = computed(() => [
  'All',
  ...Array.from(new Set(brawlers.value.map((brawler) => brawler.role))),
])

const selectedMap = computed(() => {
  if (!selectedMapId.value) return null
  return maps.value.find((map) => map.id === selectedMapId.value) || null
})

const visibleMaps = computed(() => {
  const query = mapSearch.value.trim().toLowerCase()

  return maps.value
    .filter((map) => !map.disabled)
    .filter((map) => selectedMode.value === 'All' || map.modeName === selectedMode.value)
    .filter((map) => !query || map.name.toLowerCase().includes(query))
    .slice(0, 24)
})

const selectedBrawler = computed(() => {
  if (selectedBrawlerId.value) {
    const found = brawlers.value.find((brawler) => brawler.id === selectedBrawlerId.value)
    if (found) return found
  }

  return rankedBrawlers.value[0] || null
})

const rankedBrawlers = computed<RankedBrawler[]>(() => {
  const ranked = brawlers.value
    .map((brawler) => ({
      ...brawler,
      liveScore: Math.round(scoreForMode(brawler, selectedMode.value) * 10) / 10,
      liveTier: 'B' as Tier,
    }))
    .sort((a, b) => b.liveScore - a.liveScore)

  return ranked.map((brawler, index) => ({
    ...brawler,
    liveTier: tierForRank(index, ranked.length),
  }))
})

const filteredRankedBrawlers = computed(() => {
  const query = tierSearch.value.trim().toLowerCase()

  return rankedBrawlers.value.filter((brawler) => {
    const roleMatched = roleFilter.value === 'All' || brawler.role === roleFilter.value
    const queryMatched =
      !query ||
      brawler.name.toLowerCase().includes(query) ||
      brawler.role.toLowerCase().includes(query)

    return roleMatched && queryMatched
  })
})

const tierGroups = computed(() =>
  tiers.map((tier) => ({
    tier,
    list: filteredRankedBrawlers.value.filter((brawler) => brawler.liveTier === tier),
  })),
)

const heroBrawlers = computed(() => rankedBrawlers.value.slice(0, 6))
const metaLeaders = computed(() => rankedBrawlers.value.slice(0, 5))
const brawlerCount = computed(() => brawlers.value.length)
const activeMapCount = computed(() => maps.value.filter((map) => !map.disabled).length)
const modeCount = computed(() => gameModes.value.filter((mode) => !mode.disabled).length)

const counterRecommendations = computed(() => {
  const target = selectedBrawler.value
  if (!target) return []

  return brawlers.value
    .filter((brawler) => brawler.id !== target.id)
    .map((brawler) => {
      const score = counterScore(brawler, target, selectedMode.value)
      const winRate = Math.round(
        clamp(
          50 +
            (score - 50) * 0.58 +
            (scoreForMode(brawler, selectedMode.value) - scoreForMode(target, selectedMode.value)) * 0.12,
          47,
          69,
        ),
      )

      return { brawler, score, winRate, reason: counterReason(brawler, target) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
})

const allyRoster = computed(() => idsToBrawlers(allyPicks.value))
const enemyRoster = computed(() => idsToBrawlers(enemyPicks.value))
const banRoster = computed(() => idsToBrawlers(bans.value))

const draftRecommendations = computed(() =>
  brawlers.value
    .filter((brawler) => !isDrafted(brawler.id))
    .map((brawler) => ({
      brawler,
      score: Math.round(draftScore(brawler) * 10) / 10,
      reason: draftReason(brawler),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10),
)

const banRecommendations = computed(() =>
  brawlers.value
    .filter((brawler) => !allyPicks.value.includes(brawler.id) && !enemyPicks.value.includes(brawler.id))
    .map((brawler) => {
      const allyRisk =
        allyRoster.value.length > 0
          ? average(allyRoster.value.map((ally) => counterScore(brawler, ally, selectedMode.value)))
          : 50

      return {
        brawler,
        score: Math.round((scoreForMode(brawler, selectedMode.value) + allyRisk * 0.55) * 10) / 10,
        reason:
          allyRoster.value.length > 0
            ? '對我方陣容壓力高，先 Ban 可降風險'
            : '版本強勢且泛用，適合優先封鎖',
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6),
)

const normalizedPlayerTag = computed(() => normalizeTag(playerTag.value))
const playerTopBrawlers = computed(() =>
  (playerProfile.value?.brawlers || [])
    .slice()
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, 8),
)
const battleSummary = computed(() => {
  const total = battleLog.value.length
  const wins = battleLog.value.filter((battle) => battle.battle?.result === 'victory').length
  const losses = battleLog.value.filter((battle) => battle.battle?.result === 'defeat').length
  const trophyChange = battleLog.value.reduce((sum, battle) => sum + (battle.battle?.trophyChange || 0), 0)

  return {
    total,
    wins,
    losses,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    trophyChange,
  }
})
const playerLinks = computed(() => {
  if (!normalizedPlayerTag.value) return []

  return [
    { label: 'Brawlify 戰績總覽', href: `https://brawlify.com/stats/profile/${normalizedPlayerTag.value}` },
    { label: '近期對戰紀錄', href: `https://brawlify.com/stats/battles/${normalizedPlayerTag.value}` },
    { label: '玩家公開頁', href: `https://brawlify.com/player/${normalizedPlayerTag.value}` },
  ]
})

const mapRateRows = computed(() => {
  const mode = selectedMap.value?.modeName || selectedMode.value

  return brawlers.value
    .map((brawler) => {
      const score = scoreForMode(brawler, mode)
      const winRate = estimateMapWinRate(brawler, score)
      const pickRate = clamp(2.4 + (score - 62) * 0.18, 0.8, 18)

      return {
        brawler,
        score: Math.round(score),
        winRate,
        pickRate: Math.round(pickRate * 10) / 10,
      }
    })
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 36)
})

function scoreForMode(brawler: Brawler, modeName: string) {
  if (modeName === 'All') return brawler.metaScore

  const weights = modeRoleWeights[modeName] || {}
  const modeWeight = weights[brawler.role] ?? 0
  const tagWeight =
    (modeName.includes('Brawl') && brawler.tags.includes('mobility') ? 2.4 : 0) +
    (modeName.includes('Knockout') && brawler.tags.includes('range') ? 2.6 : 0) +
    (modeName.includes('Heist') && brawler.tags.includes('range') ? 1.8 : 0) +
    (modeName.includes('Hot') && brawler.tags.includes('control') ? 2.8 : 0)

  return brawler.metaScore + modeWeight + tagWeight
}

function counterScore(attacker: Brawler, target: Brawler, modeName: string) {
  const roleScore = counterMatrix[attacker.role]?.[target.role] ?? 0
  const tagScore =
    (attacker.tags.includes('control') && target.tags.includes('mobility') ? 5 : 0) +
    (attacker.tags.includes('range') && target.tags.includes('durable') ? 4 : 0) +
    (attacker.tags.includes('mobility') && target.tags.includes('space') ? 5 : 0) +
    (attacker.tags.includes('space') && target.role === 'Tank' ? -3 : 0) +
    (attacker.tags.includes('healing') && target.role === 'Damage Dealer' ? -2 : 0)
  const modeScore = (scoreForMode(attacker, modeName) - scoreForMode(target, modeName)) * 0.14

  return Math.round(clamp(50 + roleScore + tagScore + modeScore, 30, 82) * 10) / 10
}

function counterReason(attacker: Brawler, target: Brawler) {
  const attackerRole = roleName(attacker.role)
  const targetRole = roleName(target.role)

  if (attacker.tags.includes('control') && target.tags.includes('mobility')) {
    return `${attackerRole}控場能限制 ${target.name} 的進場節奏`
  }

  if (attacker.tags.includes('range') && target.role === 'Tank') {
    return `${attackerRole}射程能先消耗坦克血線`
  }

  if (attacker.tags.includes('mobility') && target.role === 'Artillery') {
    return `${attackerRole}能切入投擲角的安全距離`
  }

  return `${attackerRole}對 ${targetRole} 有較好的換血與站位主導權`
}

function draftScore(candidate: Brawler) {
  const enemyPressure =
    enemyRoster.value.length > 0
      ? average(enemyRoster.value.map((enemy) => counterScore(candidate, enemy, selectedMode.value)))
      : 50
  const allyFit =
    allyRoster.value.length > 0 ? average(allyRoster.value.map((ally) => synergyScore(candidate, ally))) : 50

  return (
    scoreForMode(candidate, selectedMode.value) * 0.72 +
    enemyPressure * 0.62 +
    allyFit * 0.32 -
    (bans.value.includes(candidate.id) ? 999 : 0)
  )
}

function synergyScore(candidate: Brawler, ally: Brawler) {
  let score = 50

  if (candidate.role === ally.role) score -= candidate.role === 'Damage Dealer' ? 1 : 5
  if (candidate.role === 'Support' && ['Tank', 'Assassin'].includes(ally.role)) score += 12
  if (ally.role === 'Support' && ['Tank', 'Assassin'].includes(candidate.role)) score += 12
  if (candidate.role === 'Controller' && ['Marksman', 'Damage Dealer'].includes(ally.role)) score += 7
  if (ally.role === 'Controller' && ['Marksman', 'Damage Dealer'].includes(candidate.role)) score += 7
  if (candidate.tags.includes('healing') && ally.tags.includes('durable')) score += 7
  if (candidate.tags.includes('range') && ally.tags.includes('control')) score += 6
  if (candidate.tags.includes('mobility') && ally.role === 'Artillery') score += 4

  return clamp(score, 34, 72)
}

function draftReason(candidate: Brawler) {
  if (enemyRoster.value.length > 0) {
    const target = enemyRoster.value
      .map((enemy) => ({ enemy, score: counterScore(candidate, enemy, selectedMode.value) }))
      .sort((a, b) => b.score - a.score)[0]

    return target
      ? `主要壓制 ${target.enemy.name}，同時保有 ${selectedMode.value === 'All' ? '泛用' : selectedMode.value} 強度`
      : '泛用度高，適合補足陣容'
  }

  if (allyRoster.value.length > 0) return `和我方 ${allyRoster.value[0]?.name} 有角色分工互補`
  return `${roleName(candidate.role)}定位穩，適合早選或後手補位`
}

function estimateMapWinRate(brawler: Brawler, score: number) {
  const map = selectedMap.value
  const environment = map?.environmentName.toLowerCase() || ''
  let terrainBonus = 0

  if (/mine|arcade|hub|zone/.test(environment) && brawler.tags.includes('control')) terrainBonus += 1.4
  if (/canyon|beach|default|station/.test(environment) && brawler.tags.includes('range')) terrainBonus += 1.3
  if (/jungle|bio|forest|swamp/.test(environment) && ['Tank', 'Assassin'].includes(brawler.role)) terrainBonus += 1.4
  if ((map?.modeName || selectedMode.value).includes('Brawl') && brawler.tags.includes('mobility')) terrainBonus += 1.2

  return Math.round(clamp(49 + (score - 62) * 0.42 + terrainBonus, 43, 67) * 10) / 10
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roleName(role: string) {
  return roleLabels[role] || role
}

function idsToBrawlers(ids: number[]) {
  return ids
    .map((id) => brawlers.value.find((brawler) => brawler.id === id))
    .filter((brawler): brawler is Brawler => Boolean(brawler))
}

function isDrafted(id: number) {
  return allyPicks.value.includes(id) || enemyPicks.value.includes(id) || bans.value.includes(id)
}

function setSection(section: (typeof sectionTabs)[number]['id']) {
  activeSection.value = section
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

function runGlobalSearch() {
  const query = globalSearch.value.trim()
  if (!query) return

  if (searchType.value === 'player') {
    playerTag.value = query
    submitPlayerSearch()
    return
  }

  if (searchType.value === 'map') {
    const found = maps.value.find((map) => map.name.toLowerCase().includes(query.toLowerCase()))
    mapSearch.value = query
    if (found) {
      selectedMapId.value = found.id
      selectedMode.value = found.modeName
    }
    setSection('maprates')
    return
  }

  const found = brawlers.value.find((brawler) => brawler.name.toLowerCase().includes(query.toLowerCase()))
  if (found) {
    selectedBrawlerId.value = found.id
    tierSearch.value = found.name
  } else {
    tierSearch.value = query
  }
  setSection('counter')
}

function selectBrawler(brawler: Brawler, section: 'tier' | 'counter' = 'counter') {
  selectedBrawlerId.value = brawler.id
  setSection(section)
}

function selectMap(map: MapItem) {
  selectedMapId.value = map.id
  selectedMode.value = map.modeName
  setSection('maprates')
}

function toggleDraftBrawler(brawler: Brawler) {
  const target = draftLane.value
  removeFromDraft(brawler.id)

  if (target === 'enemy') enemyPicks.value = [...enemyPicks.value, brawler.id].slice(-3)
  if (target === 'ally') allyPicks.value = [...allyPicks.value, brawler.id].slice(-3)
  if (target === 'ban') bans.value = [...bans.value, brawler.id].slice(-6)
}

function removeFromDraft(id: number) {
  enemyPicks.value = enemyPicks.value.filter((item) => item !== id)
  allyPicks.value = allyPicks.value.filter((item) => item !== id)
  bans.value = bans.value.filter((item) => item !== id)
}

function clearDraft() {
  enemyPicks.value = []
  allyPicks.value = []
  bans.value = []
}

function draftState(id: number) {
  if (enemyPicks.value.includes(id)) return '敵方'
  if (allyPicks.value.includes(id)) return '我方'
  if (bans.value.includes(id)) return 'Ban'
  return ''
}

function normalizeTag(tag: string) {
  return tag.replace('#', '').replace(/\s+/g, '').trim().toUpperCase()
}

function submitPlayerSearch() {
  if (!normalizedPlayerTag.value) return
  addRecentTag(normalizedPlayerTag.value)
  setSection('player')
  void fetchPlayerData()
}

async function fetchPlayerData() {
  if (!normalizedPlayerTag.value) return

  playerLoading.value = true
  playerError.value = ''
  playerProfile.value = null
  battleLog.value = []

  const encodedTag = encodeURIComponent(`#${normalizedPlayerTag.value}`)

  try {
    const [profile, battles] = await Promise.all([
      fetchJson<OfficialPlayer>(`/api/brawlstars/players/${encodedTag}`),
      fetchJson<BattleLogResponse>(`/api/brawlstars/players/${encodedTag}/battlelog`).catch(() => ({ items: [] })),
    ])

    playerProfile.value = profile
    battleLog.value = battles.items || []
  } catch (error) {
    playerError.value =
      error instanceof Error
        ? `${error.message}。請確認 token 的 IP 白名單與玩家 tag 是否正確。`
        : '官方 API 暫時無法讀取。'
  } finally {
    playerLoading.value = false
  }
}

function loadRecentTags() {
  try {
    recentTags.value = JSON.parse(localStorage.getItem('brawlpick:recent-tags') || '[]')
  } catch {
    recentTags.value = []
  }
}

function addRecentTag(tag: string) {
  recentTags.value = [tag, ...recentTags.value.filter((item) => item !== tag)].slice(0, 5)
  localStorage.setItem('brawlpick:recent-tags', JSON.stringify(recentTags.value))
}

function useRecentTag(tag: string) {
  playerTag.value = tag
  submitPlayerSearch()
}

function onImageError(event: Event) {
  const image = event.target as HTMLImageElement
  image.style.opacity = '0'
}

function tierBadgeClass(tier: Tier) {
  const classes: Record<Tier, string> = {
    S: 'bg-[#ffcf3f]',
    A: 'bg-[#53d489]',
    B: 'bg-[#49a8ff]',
    C: 'bg-[#ff8a4b]',
    D: 'bg-[#bbc5d0]',
  }
  return classes[tier]
}
</script>

<template>
  <div class="min-h-screen overflow-x-hidden bg-[#f4f6f8] text-[#16181d]">
    <header
      class="sticky top-0 z-30 flex flex-col gap-3 border-b border-white/10 bg-[#0f1116]/95 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-7"
    >
      <a class="flex min-w-[210px] items-center gap-3 text-white no-underline" href="#top" @click.prevent="setSection('home')">
        <span class="grid size-11 place-items-center rounded-lg border-2 border-[#101114] bg-[#f7c948] font-black text-[#13151a]">BP</span>
        <span>
          <strong class="block leading-tight">BrawlPick TW</strong>
          <small class="mt-1 block text-xs leading-tight text-slate-400">荒野 meta 報馬仔</small>
        </span>
      </a>

      <nav class="flex flex-wrap gap-2 lg:justify-end" aria-label="主要分頁">
        <button
          v-for="tab in sectionTabs"
          :key="tab.id"
          type="button"
          class="min-h-10 rounded-lg border px-3 text-sm font-bold transition"
          :class="
            activeSection === tab.id
              ? 'border-[#f7c948] bg-[#f7c948] text-[#121318]'
              : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
          "
          @click="setSection(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>

    <section v-if="activeSection === 'home'" id="top" class="hero-texture relative grid min-h-[640px] items-center overflow-hidden text-white max-lg:min-h-[680px] max-sm:min-h-[720px]">
      <div class="pointer-events-none absolute -right-24 bottom-[-34px] flex w-[62%] min-w-[680px] items-end justify-end drop-shadow-2xl max-lg:-right-44 max-lg:min-w-[620px] max-lg:opacity-45">
        <img
          v-for="(brawler, index) in heroBrawlers"
          :key="brawler.id"
          :src="brawler.portraitUrl"
          :alt="brawler.name"
          class="-ml-10 w-[24%] min-w-[138px] max-w-[210px] object-contain"
          :class="{ '-translate-y-8': index % 2 === 1, 'translate-y-4': index % 3 === 0 }"
          @error="onImageError"
        />
      </div>

      <div class="relative z-10 mx-auto w-[min(1180px,calc(100%_-_48px))] py-20 max-sm:w-[calc(100%_-_28px)]">
        <p class="mb-3 text-xs font-black uppercase text-[#f7c948]">Brawl Stars draft intelligence · Taiwan edition</p>
        <h1 class="m-0 max-w-[760px] text-[4.6rem] font-black leading-[0.98] max-lg:text-[3.2rem] max-sm:text-[2.5rem]">
          鑽石以上 Ban/Pick，開局前先看這張。
        </h1>
        <p class="mt-6 max-w-[620px] text-[1.08rem] leading-8 text-slate-200 max-sm:text-base">
          以 Brawlify game-data 與官方 API 讀取角色、地圖、模式、玩家資料，整理成台灣玩家選角工具。
        </p>

        <div class="mt-9 w-[min(700px,100%)] rounded-lg border border-white/20 bg-white/10 p-3">
          <div class="mb-3 flex gap-2" aria-label="搜尋類型">
            <button
              v-for="type in ['brawler', 'player', 'map']"
              :key="type"
              type="button"
              class="min-h-10 rounded-lg border px-4 font-bold"
              :class="searchType === type ? 'border-[#f7c948] bg-[#f7c948] text-[#121318]' : 'border-white/15 bg-white/10 text-white'"
              @click="searchType = type as SearchType"
            >
              {{ type === 'brawler' ? '角色' : type === 'player' ? '玩家' : '地圖' }}
            </button>
          </div>

          <form class="grid grid-cols-[1fr_auto] gap-3 max-sm:grid-cols-1" role="search" @submit.prevent="runGlobalSearch">
            <input
              v-model="globalSearch"
              class="min-h-12 rounded-lg border border-slate-200 bg-white px-4 text-[#17191f] outline-none"
              :placeholder="
                searchType === 'player'
                  ? '輸入玩家 Tag，例如 #2PP'
                  : searchType === 'map'
                    ? '輸入地圖名稱，例如 Hard Rock Mine'
                    : '輸入角色名稱，例如 Piper'
              "
            />
            <button type="submit" class="min-h-12 rounded-lg bg-[#ff4d5d] px-6 font-black text-white">搜尋</button>
          </form>
        </div>

        <div class="mt-7 flex flex-wrap gap-3">
          <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ brawlerCount }}</strong> 角色</span>
          <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ activeMapCount }}</strong> 可用地圖</span>
          <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ modeCount }}</strong> 模式</span>
          <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ todayLabel }}</strong> 讀取</span>
        </div>
      </div>
    </section>

    <main>
      <section v-if="activeSection === 'home' || activeSection === 'tier'" id="tier" class="bg-white py-[72px]">
        <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
          <div>
            <p class="mb-3 text-xs font-black uppercase text-[#b24719]">Meta board</p>
            <h2 class="m-0 text-[2.3rem] font-black leading-tight">角色排名：S / A / B / C / D</h2>
          </div>
          <div class="flex flex-wrap justify-end gap-3 max-lg:justify-start">
            <label class="grid gap-1 text-sm font-black text-slate-600">
              模式
              <select v-model="selectedMode" class="min-h-12 min-w-[168px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]">
                <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ mode }}</option>
              </select>
            </label>
            <label class="grid gap-1 text-sm font-black text-slate-600">
              定位
              <select v-model="roleFilter" class="min-h-12 min-w-[168px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]">
                <option v-for="role in roleOptions" :key="role" :value="role">
                  {{ role === 'All' ? '全部' : roleName(role) }}
                </option>
              </select>
            </label>
            <label class="grid gap-1 text-sm font-black text-slate-600">
              快搜
              <input v-model="tierSearch" class="min-h-12 min-w-[168px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]" placeholder="角色 / 定位" />
            </label>
          </div>
        </div>

        <div v-if="loading" class="mx-auto w-[min(1180px,calc(100%_-_48px))] rounded-lg border border-slate-200 bg-slate-50 p-6 max-sm:w-[calc(100%_-_28px)]">
          正在讀取 Brawlify game-data...
        </div>
        <div v-else-if="loadError" class="mx-auto flex w-[min(1180px,calc(100%_-_48px))] items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 max-sm:w-[calc(100%_-_28px)]">
          {{ loadError }}
          <button type="button" class="rounded-lg bg-[#ff4d5d] px-5 py-3 font-black text-white" @click="loadGameData">重試</button>
        </div>

        <div v-else class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] gap-4 max-sm:w-[calc(100%_-_28px)]">
          <article v-for="group in tierGroups" :key="group.tier" class="grid min-h-[120px] grid-cols-[96px_1fr] gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 max-sm:grid-cols-1">
            <div class="grid min-h-24 place-items-center rounded-lg text-[#17191f]" :class="tierBadgeClass(group.tier)">
              <strong class="text-[2.7rem] leading-none">{{ group.tier }}</strong>
              <span class="text-xs font-black">{{ group.list.length }} picks</span>
            </div>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
              <button
                v-for="brawler in group.list"
                :key="brawler.id"
                type="button"
                class="relative grid min-h-[108px] content-start justify-items-center overflow-hidden rounded-lg border border-slate-200 bg-white px-2 py-2 text-[#17191f] transition hover:-translate-y-0.5 hover:border-[#ff4d5d]"
                @click="selectBrawler(brawler, 'counter')"
              >
                <img class="size-16 object-contain" :src="brawler.imageUrl" :alt="brawler.name" @error="onImageError" />
                <span class="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-black">{{ brawler.name }}</span>
                <small class="absolute right-1.5 top-1.5 grid min-h-6 min-w-7 place-items-center rounded-md bg-[#15161b] text-[0.7rem] font-black text-white">
                  {{ Math.round(brawler.liveScore) }}
                </small>
              </button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="activeSection === 'home'" class="bg-[#fff4cf] py-[72px]">
        <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
          <div>
            <p class="mb-3 text-xs font-black uppercase text-[#b24719]">Meta bulletin</p>
            <h2 class="m-0 text-[2.3rem] font-black leading-tight">荒野 meta 報馬仔</h2>
          </div>
          <p class="m-0 max-w-[500px] leading-7 text-slate-600">
            目前採 BrawlPick 指數排序：角色定位、模式權重、新版本壓力與策展權重。
          </p>
        </div>

        <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-5 gap-4 max-lg:grid-cols-2 max-sm:w-[calc(100%_-_28px)] max-sm:grid-cols-1">
          <article v-for="(entry, index) in metaLeaders" :key="entry.id" class="relative grid min-h-[260px] content-end gap-3 overflow-hidden rounded-lg border-2 border-[#15161b] bg-white p-4">
            <span class="absolute left-4 top-4 text-xl font-black">#{{ index + 1 }}</span>
            <img class="absolute right-[-18px] top-5 size-[150px] object-contain" :src="entry.imageUrl" :alt="entry.name" @error="onImageError" />
            <div>
              <h3 class="m-0 text-xl font-black">{{ entry.name }}</h3>
              <p class="mt-1 text-sm text-slate-600">{{ roleName(entry.role) }} · {{ entry.rarityName }}</p>
            </div>
            <strong class="text-3xl font-black text-[#ff4d5d]">{{ Math.round(entry.liveScore) }}</strong>
          </article>
        </div>
      </section>

      <section v-if="activeSection === 'draft'" id="draft" class="bg-[#eef9f7] py-[72px]">
        <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
          <div>
            <p class="mb-3 text-xs font-black uppercase text-[#b24719]">BrawlPick TW</p>
            <h2 class="m-0 text-[2.3rem] font-black leading-tight">荒野選角指南</h2>
          </div>
          <div class="flex flex-wrap gap-3">
            <label class="grid gap-1 text-sm font-black text-slate-600">
              模式
              <select v-model="selectedMode" class="min-h-12 min-w-[168px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]">
                <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ mode }}</option>
              </select>
            </label>
            <button type="button" class="self-end rounded-lg bg-[#15161b] px-5 py-3 font-black text-white" @click="clearDraft">清空</button>
          </div>
        </div>

        <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="mb-4 flex flex-wrap gap-2">
              <button type="button" class="min-h-10 rounded-lg border px-4 font-bold" :class="draftLane === 'enemy' ? 'border-[#f7c948] bg-[#f7c948] text-[#121318]' : 'border-[#15161b] bg-[#15161b] text-white'" @click="draftLane = 'enemy'">
                敵方 Pick
              </button>
              <button type="button" class="min-h-10 rounded-lg border px-4 font-bold" :class="draftLane === 'ally' ? 'border-[#f7c948] bg-[#f7c948] text-[#121318]' : 'border-[#15161b] bg-[#15161b] text-white'" @click="draftLane = 'ally'">
                我方 Pick
              </button>
              <button type="button" class="min-h-10 rounded-lg border px-4 font-bold" :class="draftLane === 'ban' ? 'border-[#f7c948] bg-[#f7c948] text-[#121318]' : 'border-[#15161b] bg-[#15161b] text-white'" @click="draftLane = 'ban'">
                Ban 位
              </button>
            </div>

            <div class="mb-4 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <div v-for="lane in [
                { title: '敵方', items: enemyRoster },
                { title: '我方', items: allyRoster },
                { title: 'Ban', items: banRoster },
              ]" :key="lane.title" class="min-h-28 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 class="mb-3 mt-0 text-base font-black">{{ lane.title }}</h3>
                <div class="flex flex-wrap gap-2">
                  <button v-for="brawler in lane.items" :key="brawler.id" type="button" class="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-black" @click="removeFromDraft(brawler.id)">
                    <img class="size-7 object-contain" :src="brawler.imageUrl" :alt="brawler.name" />
                    {{ brawler.name }}
                  </button>
                  <span v-if="lane.items.length === 0" class="text-sm text-slate-500">尚未選擇</span>
                </div>
              </div>
            </div>

            <div class="grid max-h-[580px] grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-2 overflow-auto pr-1">
              <button
                v-for="brawler in rankedBrawlers.slice(0, 72)"
                :key="brawler.id"
                type="button"
                class="relative grid min-h-[98px] content-start justify-items-center overflow-hidden rounded-lg border bg-white px-2 py-2 transition hover:border-[#ff4d5d]"
                :class="isDrafted(brawler.id) ? 'border-[#ff4d5d] bg-[#fff1f3]' : 'border-slate-200'"
                @click="toggleDraftBrawler(brawler)"
              >
                <img class="size-14 object-contain" :src="brawler.imageUrl" :alt="brawler.name" @error="onImageError" />
                <span class="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-black">{{ brawler.name }}</span>
                <small v-if="draftState(brawler.id)" class="absolute right-1 top-1 rounded-md bg-[#15161b] px-1.5 py-1 text-[0.65rem] font-black text-white">{{ draftState(brawler.id) }}</small>
              </button>
            </div>
          </div>

          <aside class="sticky top-24 grid gap-3 self-start rounded-lg border border-slate-200 bg-white p-4 max-lg:static">
            <h3 class="m-0 text-base font-black">這場建議 Pick</h3>
            <article v-for="item in draftRecommendations" :key="item.brawler.id" class="grid min-h-[72px] grid-cols-[52px_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <img class="size-[52px] object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.name" />
              <div>
                <strong class="block">{{ item.brawler.name }}</strong>
                <span class="mt-1 block text-xs leading-5 text-slate-600">{{ item.reason }}</span>
              </div>
              <b class="text-[#ff4d5d]">{{ Math.round(item.score) }}</b>
            </article>

            <h3 class="mb-0 mt-2 text-base font-black">優先 Ban</h3>
            <article v-for="item in banRecommendations" :key="item.brawler.id" class="grid min-h-[72px] grid-cols-[52px_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-[#fff8ed] p-2.5">
              <img class="size-[52px] object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.name" />
              <div>
                <strong class="block">{{ item.brawler.name }}</strong>
                <span class="mt-1 block text-xs leading-5 text-slate-600">{{ item.reason }}</span>
              </div>
              <b class="text-[#ff4d5d]">{{ Math.round(item.score) }}</b>
            </article>
          </aside>
        </div>
      </section>

      <section v-if="activeSection === 'counter'" id="counter" class="bg-white py-[72px]">
        <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
          <div>
            <p class="mb-3 text-xs font-black uppercase text-[#b24719]">Counter lab</p>
            <h2 class="m-0 text-[2.3rem] font-black leading-tight">對戰陣容相剋建議</h2>
          </div>
          <label class="grid gap-1 text-sm font-black text-slate-600">
            對手角色
            <select v-model.number="selectedBrawlerId" class="min-h-12 min-w-[208px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]">
              <option v-for="brawler in rankedBrawlers" :key="brawler.id" :value="brawler.id">
                {{ brawler.name }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="selectedBrawler" class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[360px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
          <article class="sticky top-24 self-start rounded-lg border border-slate-200 bg-white p-5 max-lg:static">
            <img class="mx-auto mb-3 size-[220px] object-contain" :src="selectedBrawler.imageUrl" :alt="selectedBrawler.name" @error="onImageError" />
            <span class="inline-flex min-h-7 items-center rounded-lg bg-[#f7c948] px-3 text-xs font-black">{{ selectedBrawler.tier }} Tier</span>
            <h3 class="mb-1 mt-3 text-2xl font-black">{{ selectedBrawler.name }}</h3>
            <p class="m-0 text-slate-600">{{ roleName(selectedBrawler.role) }} · {{ selectedBrawler.rarityName }}</p>
            <p class="mt-4 leading-7 text-slate-600">{{ selectedBrawler.description }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-for="tag in selectedBrawler.tags" :key="tag" class="inline-flex min-h-7 items-center rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-700">{{ tag }}</span>
            </div>
          </article>

          <div class="grid gap-3">
            <article v-for="item in counterRecommendations" :key="item.brawler.id" class="grid min-h-[116px] grid-cols-[74px_1fr_120px] items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 max-sm:grid-cols-[64px_1fr]">
              <img class="size-[74px] object-contain max-sm:size-16" :src="item.brawler.imageUrl" :alt="item.brawler.name" />
              <div>
                <h3 class="m-0 text-xl font-black">{{ item.brawler.name }}</h3>
                <p class="mb-0 mt-1 leading-6 text-slate-600">{{ item.reason }}</p>
                <span class="mt-2 inline-flex text-xs font-black text-[#8a450c]">{{ roleName(item.brawler.role) }} · {{ item.brawler.rarityName }}</span>
              </div>
              <div class="grid justify-items-end max-sm:col-span-2 max-sm:justify-items-start">
                <strong class="text-3xl font-black text-[#ff4d5d]">{{ item.winRate }}%</strong>
                <small class="text-xs font-black text-slate-500">推估對位勝率</small>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section v-if="activeSection === 'player'" id="player" class="bg-[#f8f2ff] py-[72px]">
        <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
          <div>
            <p class="mb-3 text-xs font-black uppercase text-[#b24719]">Profile scout</p>
            <h2 class="m-0 text-[2.3rem] font-black leading-tight">個人戰績查詢</h2>
          </div>
        </div>

        <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[360px_1fr] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
          <form class="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4" @submit.prevent="submitPlayerSearch">
            <label class="grid gap-1 text-sm font-black text-slate-600">
              玩家 Tag
              <input v-model="playerTag" class="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]" placeholder="#2PP 或 2PP" />
            </label>
            <button type="submit" class="min-h-12 rounded-lg bg-[#ff4d5d] px-5 font-black text-white">查詢</button>
          </form>

          <div class="rounded-lg border border-slate-200 bg-white p-6">
            <h3 class="m-0 text-2xl font-black">{{ normalizedPlayerTag ? `#${normalizedPlayerTag}` : '輸入玩家 Tag 開始查詢' }}</h3>
            <p v-if="!playerProfile && !playerLoading && !playerError" class="mt-3 leading-7 text-slate-600">
              輸入 tag 後會讀取官方玩家資料與最近 25 場 battle log；下方仍保留 Brawlify 深連結方便交叉查看。
            </p>
            <p v-if="playerLoading" class="mt-3 leading-7 text-slate-600">正在讀取官方 API...</p>
            <p v-if="playerError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 leading-7 text-red-700">{{ playerError }}</p>

            <div v-if="playerProfile" class="mt-5 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
              <div class="rounded-lg bg-slate-50 p-3">
                <span class="text-xs font-black text-slate-500">玩家</span>
                <strong class="mt-1 block text-lg">{{ playerProfile.name }}</strong>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <span class="text-xs font-black text-slate-500">目前盃數</span>
                <strong class="mt-1 block text-lg">{{ playerProfile.trophies.toLocaleString() }}</strong>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <span class="text-xs font-black text-slate-500">最高盃數</span>
                <strong class="mt-1 block text-lg">{{ playerProfile.highestTrophies.toLocaleString() }}</strong>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <span class="text-xs font-black text-slate-500">3v3 勝場</span>
                <strong class="mt-1 block text-lg">{{ playerProfile['3vs3Victories'].toLocaleString() }}</strong>
              </div>
            </div>

            <div v-if="playerProfile" class="mt-5 grid grid-cols-[1fr_1fr] gap-4 max-lg:grid-cols-1">
              <div class="rounded-lg border border-slate-200 p-3">
                <h4 class="m-0 text-base font-black">近期對戰摘要</h4>
                <div class="mt-3 grid grid-cols-4 gap-2 text-center max-sm:grid-cols-2">
                  <span class="rounded-lg bg-[#eef9f7] p-2"><b class="block">{{ battleSummary.total }}</b><small>場次</small></span>
                  <span class="rounded-lg bg-[#eef9f7] p-2"><b class="block">{{ battleSummary.winRate }}%</b><small>勝率</small></span>
                  <span class="rounded-lg bg-[#eef9f7] p-2"><b class="block">{{ battleSummary.wins }}</b><small>勝</small></span>
                  <span class="rounded-lg bg-[#eef9f7] p-2"><b class="block">{{ battleSummary.trophyChange }}</b><small>盃變動</small></span>
                </div>
              </div>
              <div class="rounded-lg border border-slate-200 p-3">
                <h4 class="m-0 text-base font-black">代表角色</h4>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <div v-for="brawler in playerTopBrawlers.slice(0, 4)" :key="brawler.id" class="rounded-lg bg-slate-50 p-2">
                    <strong class="block text-sm">{{ brawler.name }}</strong>
                    <span class="text-xs text-slate-600">Power {{ brawler.power }} · {{ brawler.trophies }} 盃</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <a v-for="link in playerLinks" :key="link.href" :href="link.href" target="_blank" rel="noopener" class="inline-flex min-h-10 items-center rounded-lg bg-[#15161b] px-4 font-black text-white no-underline">
                {{ link.label }}
              </a>
            </div>
            <div v-if="recentTags.length > 0" class="mt-4 flex flex-wrap gap-2">
              <span class="inline-flex items-center font-black text-slate-500">最近查詢</span>
              <button v-for="tag in recentTags" :key="tag" type="button" class="inline-flex min-h-10 items-center rounded-lg border border-[#15161b] bg-white px-3 font-black" @click="useRecentTag(tag)">
                #{{ tag }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeSection === 'maprates'" id="maprates" class="bg-[#fff4cf] py-[72px]">
        <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
          <div>
            <p class="mb-3 text-xs font-black uppercase text-[#b24719]">Map win rates</p>
            <h2 class="m-0 text-[2.3rem] font-black leading-tight">地圖英雄勝率</h2>
          </div>
          <div class="flex flex-wrap gap-3">
            <label class="grid gap-1 text-sm font-black text-slate-600">
              模式
              <select v-model="selectedMode" class="min-h-12 min-w-[208px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]">
                <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ mode }}</option>
              </select>
            </label>
            <label class="grid gap-1 text-sm font-black text-slate-600">
              地圖
              <select v-model="selectedMapId" class="min-h-12 min-w-[208px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]">
                <option :value="null">依模式總覽</option>
                <option v-for="map in visibleMaps" :key="map.id" :value="map.id">{{ map.name }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[320px_1fr] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
          <aside class="rounded-lg border-2 border-[#15161b] bg-white p-4">
            <img v-if="selectedMap" class="aspect-square w-full rounded-lg bg-slate-100 object-cover" :src="selectedMap.imageUrl" :alt="selectedMap.name" />
            <div v-else class="grid aspect-square w-full place-items-center rounded-lg bg-[#15161b] p-5 text-center text-white">
              選一張地圖查看模式權重
            </div>
            <h3 class="mb-1 mt-4 text-2xl font-black">{{ selectedMap?.name || selectedMode }}</h3>
            <p class="m-0 leading-7 text-slate-600">
              {{ selectedMap ? `${selectedMap.modeName} · ${selectedMap.environmentName}` : '目前為模式總覽' }}
            </p>
            <p class="mt-3 rounded-lg bg-[#fff8ed] p-3 text-sm leading-6 text-slate-700">
              Brawlify 目前 map stats 多數為空時，本站會用模式定位與地形關鍵字推估勝率；未來讀到真實 stats 可直接替換。
            </p>
          </aside>

          <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div class="grid grid-cols-[64px_1fr_92px_92px_92px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 max-sm:grid-cols-[48px_1fr_72px]">
              <span>#</span>
              <span>角色</span>
              <span class="max-sm:hidden">Pick 指數</span>
              <span>勝率</span>
              <span class="max-sm:hidden">使用率</span>
            </div>
            <button
              v-for="(row, index) in mapRateRows"
              :key="row.brawler.id"
              type="button"
              class="grid w-full grid-cols-[64px_1fr_92px_92px_92px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-[#fff8ed] max-sm:grid-cols-[48px_1fr_72px]"
              @click="selectBrawler(row.brawler, 'counter')"
            >
              <span class="font-black text-slate-500">#{{ index + 1 }}</span>
              <span class="flex min-w-0 items-center gap-3">
                <img class="size-12 object-contain" :src="row.brawler.imageUrl" :alt="row.brawler.name" />
                <span class="min-w-0">
                  <strong class="block truncate">{{ row.brawler.name }}</strong>
                  <small class="text-slate-500">{{ roleName(row.brawler.role) }} · {{ row.brawler.rarityName }}</small>
                </span>
              </span>
              <span class="font-black max-sm:hidden">{{ row.score }}</span>
              <span class="font-black text-[#ff4d5d]">{{ row.winRate }}%</span>
              <span class="font-black max-sm:hidden">{{ row.pickRate }}%</span>
            </button>
          </div>
        </div>
      </section>

      <section v-if="activeSection === 'maps'" id="maps" class="bg-white py-[72px]">
        <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
          <div>
            <p class="mb-3 text-xs font-black uppercase text-[#b24719]">Map data</p>
            <h2 class="m-0 text-[2.3rem] font-black leading-tight">地圖與模式資料</h2>
          </div>
          <label class="grid gap-1 text-sm font-black text-slate-600">
            地圖搜尋
            <input v-model="mapSearch" class="min-h-12 min-w-[208px] rounded-lg border border-slate-300 bg-white px-3 text-[#17191f]" placeholder="Hard Rock Mine" />
          </label>
        </div>

        <div v-if="selectedMap" class="mx-auto mb-5 grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[240px_1fr] items-center gap-5 rounded-lg border border-slate-200 bg-white p-4 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
          <img class="aspect-square w-full rounded-lg bg-slate-100 object-cover max-lg:max-w-[260px]" :src="selectedMap.imageUrl" :alt="selectedMap.name" />
          <div>
            <span class="mb-2 inline-flex font-black" :style="{ color: selectedMap.modeColor }">{{ selectedMap.modeName }}</span>
            <h3 class="m-0 text-2xl font-black">{{ selectedMap.name }}</h3>
            <p class="mt-2 leading-7 text-slate-600">{{ selectedMap.environmentName }} 環境 · 可搭配上方選角器切換模式權重。</p>
            <a :href="selectedMap.link" target="_blank" rel="noopener" class="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#15161b] px-4 font-black text-white no-underline">
              在 Brawlify 查看地圖
            </a>
          </div>
        </div>

        <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 max-sm:w-[calc(100%_-_28px)]">
          <button v-for="map in visibleMaps" :key="map.id" type="button" class="grid min-h-[254px] gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:border-[#ff4d5d]" @click="selectMap(map)">
            <img class="aspect-square w-full rounded-lg bg-slate-100 object-cover" :src="map.imageUrl" :alt="map.name" @error="onImageError" />
            <span class="text-xs font-black" :style="{ color: map.modeColor }">{{ map.modeName }}</span>
            <strong>{{ map.name }}</strong>
          </button>
        </div>
      </section>

    </main>
  </div>
</template>
