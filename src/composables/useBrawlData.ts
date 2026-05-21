import { computed, ref } from 'vue'
import type {
  AbilityMetaStat,
  Ability,
  ApiBrawler,
  ApiGameMode,
  ApiMap,
  Brawler,
  GameMode,
  MapItem,
  MapMetaStat,
  MetaSnapshot,
  RankedBrawler,
} from '../types'
import {
  average,
  clamp,
  counterMatrix,
  deterministicNoise,
  editorialBoost,
  inferTags,
  modeFitScore,
  rarityScore,
  releasePressure,
  roleBaseScores,
  roleName,
  tierForRank,
} from '../data/metaRules'
import { fetchBrawlers, fetchGameModes, fetchMaps } from '../services/brawlify'
import { fetchMetaSnapshot } from '../services/brawlTime'
import { fetchTranslationIndex, type TranslationIndex } from '../services/localization'
import { cleanText } from '../utils/format'
import { brawlerStatKey } from '../utils/keys'
import { modeLabel, modeNameFromSlug, modeSlugLabel, rarityLabel } from '../data/twLabels'

const loading = ref(false)
const loadError = ref('')
const metaError = ref('')
const brawlers = ref<Brawler[]>([])
const maps = ref<MapItem[]>([])
const gameModes = ref<GameMode[]>([])
const metaSnapshot = ref<MetaSnapshot | null>(null)
const selectedMode = ref('All')
const selectedMapId = ref<number | null>(null)

let loadPromise: Promise<void> | null = null

export function useBrawlData() {
  const metaByKey = computed(() => {
    const result = new Map<string, MetaSnapshot['stats'][number]>()
    for (const stat of metaSnapshot.value?.stats || []) result.set(stat.brawlerKey, stat)
    return result
  })

  const rankedBrawlers = computed<RankedBrawler[]>(() => {
    const ranked = brawlers.value
      .map((brawler) => {
        const stat = metaByKey.value.get(brawler.statKey)

        return {
          ...brawler,
          liveScore: Math.round(scoreForMode(brawler, selectedMode.value) * 10) / 10,
          liveTier: 'B' as const,
          winRateAdj: stat?.winRateAdj,
          useRate: stat?.useRate,
          picksEstimate: stat?.picksEstimate,
          dataSource: stat ? ('live' as const) : ('fallback' as const),
        }
      })
      .sort((a, b) => b.liveScore - a.liveScore)

    return ranked.map((brawler, index) => ({
      ...brawler,
      liveTier: tierForRank(index, ranked.length),
    }))
  })

  const modeOptions = computed(() => [
    'All',
    ...Array.from(new Set(gameModes.value.filter((mode) => !mode.disabled).map((mode) => mode.name))),
  ])

  const roleOptions = computed(() => ['All', ...Array.from(new Set(brawlers.value.map((brawler) => brawler.role)))])

  const selectedMap = computed(() => {
    if (!selectedMapId.value) return null
    return maps.value.find((map) => map.id === selectedMapId.value) || null
  })

  const heroBrawlers = computed(() => rankedBrawlers.value.slice(0, 6))
  const metaLeaders = computed(() => rankedBrawlers.value.slice(0, 5))
  const brawlerCount = computed(() => brawlers.value.length)
  const activeMapCount = computed(() => maps.value.filter((map) => !map.disabled).length)
  const modeCount = computed(() => gameModes.value.filter((mode) => !mode.disabled).length)
  const liveMetaCount = computed(() => rankedBrawlers.value.filter((brawler) => brawler.dataSource === 'live').length)
  const activeEvents = computed(() => metaSnapshot.value?.activeEvents || [])
  const topTeams = computed(() => metaSnapshot.value?.topTeams || [])

  async function loadGameData() {
    if (loadPromise) return loadPromise

    loading.value = true
    loadError.value = ''
    metaError.value = ''

    loadPromise = (async () => {
      try {
        const [translationIndex, brawlerResponse, mapResponse, modeResponse, metaResult] = await Promise.all([
          fetchTranslationIndex(),
          fetchBrawlers(),
          fetchMaps(),
          fetchGameModes(),
          fetchMetaSnapshot().catch((error) => {
            metaError.value = error instanceof Error ? error.message : '真實勝率資料暫時無法讀取'
            return null
          }),
        ])

        brawlers.value = buildBrawlers(brawlerResponse.list, translationIndex, metaResult)
        maps.value = buildMaps(mapResponse.list, translationIndex)
        gameModes.value = buildModes(modeResponse.list)
        metaSnapshot.value = metaResult
      } catch (error) {
        loadError.value = error instanceof Error ? error.message : 'Brawlify game-data API 暫時無法讀取'
      } finally {
        loading.value = false
      }
    })()

    return loadPromise
  }

  function findBrawlerById(id?: number | string | null) {
    if (!id) return null
    return brawlers.value.find((brawler) => brawler.id === Number(id)) || null
  }

  function findBrawlerByQuery(query: string) {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return null

    return (
      brawlers.value.find((brawler) =>
        [brawler.name, brawler.localizedName, brawler.role].some((value) => value.toLowerCase().includes(normalized)),
      ) || null
    )
  }

  function findMapById(id?: number | string | null) {
    if (!id) return null
    return maps.value.find((map) => map.id === Number(id)) || null
  }

  function findBrawlerByKey(key: string) {
    return brawlers.value.find((brawler) => brawler.statKey === key) || null
  }

  function scoreForMode(brawler: Brawler, modeName: string) {
    const stat = metaByKey.value.get(brawler.statKey)
    if (stat) return clamp(stat.winRateAdj + modeFitScore(brawler, modeName), 35, 86)
    if (metaSnapshot.value?.stats.length) return 44 + modeFitScore(brawler, modeName) * 0.5

    return brawler.metaScore + modeFitScore(brawler, modeName) * 2.4
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
      return `${attackerRole}控場能限制 ${target.localizedName} 的進場節奏`
    }

    if (attacker.tags.includes('range') && target.role === 'Tank') {
      return `${attackerRole}射程能先消耗坦克血線`
    }

    if (attacker.tags.includes('mobility') && target.role === 'Artillery') {
      return `${attackerRole}能切入投擲角的安全距離`
    }

    return `${attackerRole}對 ${targetRole} 有較好的換血與站位主導權`
  }

  function counterRecommendations(target: Brawler, modeName = selectedMode.value) {
    return brawlers.value
      .filter((brawler) => brawler.id !== target.id)
      .map((brawler) => {
        const score = counterScore(brawler, target, modeName)
        const winRate = Math.round(
          clamp(50 + (score - 50) * 0.58 + (scoreForMode(brawler, modeName) - scoreForMode(target, modeName)) * 0.12, 47, 69),
        )

        return { brawler, score, winRate, reason: counterReason(brawler, target) }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }

  function strongAgainst(target: Brawler, modeName = selectedMode.value) {
    return brawlers.value
      .filter((brawler) => brawler.id !== target.id)
      .map((brawler) => ({
        brawler,
        score: counterScore(target, brawler, modeName),
        reason: counterReason(target, brawler),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }

  function metaStatFor(brawler: Brawler) {
    return metaByKey.value.get(brawler.statKey) || null
  }

  function confidenceForBrawler(brawler: Brawler) {
    const picks = metaStatFor(brawler)?.picksEstimate || 0
    if (picks >= 500000) return { label: '高', tone: 'text-[#00e676]', score: 3, note: '樣本充足' }
    if (picks >= 80000) return { label: '中', tone: 'text-[#ffcc00]', score: 2, note: '可參考' }
    if (picks > 0) return { label: '低', tone: 'text-[#ff1744]', score: 1, note: '樣本偏少' }
    return { label: '推估', tone: 'text-slate-400', score: 0, note: '缺少真實樣本' }
  }

  function trendForBrawler(brawler: Brawler) {
    const stat = metaStatFor(brawler)
    if (stat?.trendDelta !== undefined) {
      const delta = Math.round(stat.trendDelta * 10) / 10
      return {
        delta,
        label: delta > 0.8 ? '升溫' : delta < -0.8 ? '降溫' : '持平',
        tone: delta > 0.8 ? 'text-[#00e676]' : delta < -0.8 ? 'text-[#ff1744]' : 'text-slate-300',
      }
    }

    const seed = deterministicNoise(brawler.name, brawler.id) * 0.22
    const raw = stat
      ? (stat.winRateAdj - 50) * 0.055 + (stat.useRate - 2.2) * 0.18 + seed
      : (brawler.metaScore - 64) * 0.08 + seed
    const delta = Math.round(clamp(raw, -4.8, 4.8) * 10) / 10

    return {
      delta,
      label: delta > 0.8 ? '升溫' : delta < -0.8 ? '降溫' : '持平',
      tone: delta > 0.8 ? 'text-[#00e676]' : delta < -0.8 ? 'text-[#ff1744]' : 'text-slate-300',
    }
  }

  function modeRowsForBrawler(brawler: Brawler, limit = 8) {
    return modeOptions.value
      .filter((mode) => mode !== 'All')
      .map((mode) => {
        const score = scoreForMode(brawler, mode)
        const stat = metaStatFor(brawler)
        return {
          mode,
          score: Math.round(score),
          winRate: Math.round(clamp((stat?.winRateAdj ?? 50) + modeFitScore(brawler, mode) * 0.85, 42, 76) * 10) / 10,
          fit: Math.round(modeFitScore(brawler, mode) * 10) / 10,
        }
      })
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limit)
  }

  function mapRowsForBrawler(brawler: Brawler, limit = 8) {
    return maps.value
      .filter((map) => !map.disabled)
      .map((map) => {
        const rows = mapRateRows(map, 80)
        const rowIndex = rows.findIndex((item) => item.brawler.id === brawler.id)
        const row = rowIndex >= 0 ? rows[rowIndex] : null
        const score = scoreForMap(brawler, map)

        return {
          map,
          rank: row ? rowIndex + 1 : undefined,
          score,
          winRate: row?.winRate ?? estimateMapWinRate(brawler, score, map),
          pickRate: row?.pickRate ?? 0,
          dataSource: row?.dataSource ?? ('fallback' as const),
        }
      })
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limit)
  }

  function compositionCoverage(roster: Brawler[]) {
    const hasRole = (roles: string[]) => roster.some((brawler) => roles.includes(brawler.role))
    const hasTag = (tags: string[]) => roster.some((brawler) => brawler.tags.some((tag) => tags.includes(tag)))
    const countRole = (roles: string[]) => roster.filter((brawler) => roles.includes(brawler.role)).length

    const rows = [
      { key: 'damage', label: '輸出火力', value: hasRole(['Damage Dealer', 'Marksman']) ? 82 : countRole(['Controller']) ? 66 : 48 },
      { key: 'control', label: '控場能力', value: hasRole(['Controller']) || hasTag(['control', 'space']) ? 84 : 52 },
      { key: 'range', label: '遠程壓力', value: hasRole(['Marksman', 'Artillery']) || hasTag(['range']) ? 80 : 50 },
      { key: 'sustain', label: '續戰生存', value: hasRole(['Support', 'Tank']) || hasTag(['healing', 'durable']) ? 78 : 46 },
      { key: 'mobility', label: '開戰機動', value: hasRole(['Assassin', 'Tank']) || hasTag(['mobility']) ? 76 : 48 },
      { key: 'antiTank', label: '對坦能力', value: hasRole(['Marksman', 'Controller', 'Damage Dealer']) ? 78 : 45 },
    ]
    const total = Math.round(average(rows.map((row) => row.value)))

    return { rows, total }
  }

  function compositionWarnings(roster: Brawler[]) {
    const coverage = compositionCoverage(roster)
    return coverage.rows
      .filter((row) => row.value < 58)
      .map((row) => `缺少${row.label}`)
      .slice(0, 3)
  }

  function terrainFitScore(brawler: Brawler, map: MapItem | null, modeName: string) {
    const environment = `${map?.environmentName || ''} ${map?.name || ''}`.toLowerCase()
    let terrainBonus = 0

    if (/mine|arcade|hub|zone|temple|station|warehouse|stadium|center/.test(environment) && brawler.tags.includes('control')) terrainBonus += 1.8
    if (/canyon|beach|default|outback|shoot|open|rooftop|plaza/.test(environment) && brawler.tags.includes('range')) terrainBonus += 1.7
    if (/jungle|bio|forest|swamp|grass|bush|snake|hideout|meadow|garden/.test(environment) && ['Tank', 'Assassin'].includes(brawler.role)) terrainBonus += 1.8
    if (/wall|maze|mine|cavern|factory/.test(environment) && brawler.role === 'Artillery') terrainBonus += 1.3
    if (modeName.includes('Brawl') && brawler.tags.includes('mobility')) terrainBonus += 1.3
    if (modeName === 'Heist' && ['Damage Dealer', 'Marksman'].includes(brawler.role)) terrainBonus += 1.5
    if (modeName === 'Hot Zone' && ['Controller', 'Support'].includes(brawler.role)) terrainBonus += 1.4

    return terrainBonus + mapLayoutVariantScore(brawler, map)
  }

  function scoreForMap(brawler: Brawler, map: MapItem | null = selectedMap.value) {
    const modeName = map?.modeName || selectedMode.value
    return Math.round(clamp(scoreForMode(brawler, modeName) + terrainFitScore(brawler, map, modeName), 35, 88) * 10) / 10
  }

  function estimateMapWinRate(brawler: Brawler, score: number, targetMap: MapItem | null = selectedMap.value) {
    const modeName = targetMap?.modeName || selectedMode.value
    const live = metaByKey.value.get(brawler.statKey)?.winRateAdj
    const baseline = live ?? 49 + (score - 62) * 0.42

    return Math.round(clamp(baseline + terrainFitScore(brawler, targetMap, modeName) * 0.75 + modeFitScore(brawler, modeName) * 0.25, 43, 76) * 10) / 10
  }

  function mapRateRows(targetMap: MapItem | null = selectedMap.value, limit = 36) {
    const liveRows = mapStatRowsFor(targetMap)
    if (liveRows.length > 0) {
      return liveRows
        .map((row) => {
          const brawler = findBrawlerByKey(row.brawlerKey)
          if (!brawler) return null

          return {
            brawler,
            score: Math.round(scoreForMap(brawler, targetMap)),
            winRate: Math.round(row.winRateAdj * 10) / 10,
            pickRate: Math.round(row.useRate * 10) / 10,
            dataSource: 'live' as const,
          }
        })
        .filter((row) => row !== null)
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, limit)
    }

    const mode = targetMap?.modeName || selectedMode.value

    return brawlers.value
      .map((brawler) => {
        const score = fallbackMapRankingScore(brawler, targetMap, mode)
        const stat = metaByKey.value.get(brawler.statKey)
        const pickRate = stat?.useRate ?? clamp(2.4 + (score - 62) * 0.18, 0.8, 18)

        return {
          brawler,
          score: Math.round(score),
          winRate: estimateMapWinRate(brawler, score),
          pickRate: Math.round(pickRate * 10) / 10,
          dataSource: stat ? ('live' as const) : ('fallback' as const),
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  function mapRecommendedBrawlers(map: MapItem | null, limit = 3) {
    return mapRateRows(map, limit)
  }

  function mapStatRowsFor(map: MapItem | null) {
    if (!map) return []

    const mapKey = normalizeStatMapName(map.name)
    return (metaSnapshot.value?.mapStats || []).filter(
      (stat) => stat.eventId === String(map.id) || normalizeStatMapName(stat.mapName) === mapKey,
    )
  }

  function fallbackMapRankingScore(brawler: Brawler, map: MapItem | null, modeName: string) {
    const live = metaByKey.value.get(brawler.statKey)?.winRateAdj ?? brawler.metaScore
    const fit = modeFitScore(brawler, modeName) * 9 + terrainFitScore(brawler, map, modeName) * 8

    return Math.round(clamp(live * 0.42 + fit, 35, 95) * 10) / 10
  }

  return {
    loading,
    loadError,
    metaError,
    brawlers,
    maps,
    gameModes,
    metaSnapshot,
    selectedMode,
    selectedMapId,
    selectedMap,
    rankedBrawlers,
    modeOptions,
    roleOptions,
    heroBrawlers,
    metaLeaders,
    brawlerCount,
    activeMapCount,
    modeCount,
    liveMetaCount,
    activeEvents,
    topTeams,
    loadGameData,
    findBrawlerById,
    findBrawlerByQuery,
    findMapById,
    findBrawlerByKey,
    scoreForMode,
    scoreForMap,
    counterScore,
    counterRecommendations,
    strongAgainst,
    metaStatFor,
    confidenceForBrawler,
    trendForBrawler,
    modeRowsForBrawler,
    mapRowsForBrawler,
    compositionCoverage,
    compositionWarnings,
    mapRateRows,
    mapRecommendedBrawlers,
    roleName,
    modeLabel,
    modeSlugLabel,
    modeNameFromSlug,
    rarityLabel,
  }
}

function buildBrawlers(list: ApiBrawler[], translations: TranslationIndex, metaResult: MetaSnapshot | null): Brawler[] {
  const abilityStatsById = new Map((metaResult?.abilityStats || []).map((stat) => [stat.abilityId, stat]))
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
        localizedName: translations.translate(brawler.name),
        statKey: brawlerStatKey(brawler.name),
        role,
        rarityName,
        rarityColor: brawler.rarity?.color || '#8aa0ad',
        description,
        localizedDescription: translations.translate(description),
        imageUrl: brawler.imageUrl || brawler.imageUrl2 || '',
        portraitUrl: brawler.imageUrl2 || brawler.imageUrl || '',
        link: brawler.link || `https://brawlify.com/brawlers/${brawler.id}`,
        tier: 'B' as const,
        metaScore: Math.round(baseScore * 10) / 10,
        tags: inferTags(role, description),
        starPowers: localizeAbilities(brawler.starPowers || [], translations, abilityStatsById),
        gadgets: localizeAbilities(brawler.gadgets || [], translations, abilityStatsById),
      }
    })
    .sort((a, b) => b.metaScore - a.metaScore)

  return scored.map((brawler, index) => ({
    ...brawler,
    tier: tierForRank(index, scored.length),
  }))
}

function localizeAbilities(abilities: Ability[], translations: TranslationIndex, abilityStatsById: Map<number, AbilityMetaStat>) {
  return abilities.map((ability) => ({
    ...ability,
    localizedName: translations.translate(ability.name),
    localizedDescription: translations.translate(cleanText(ability.description || '')),
    winRateAdj: abilityStatsById.get(ability.id)?.winRateAdj,
    useRate: abilityStatsById.get(ability.id)?.useRate,
    picks: abilityStatsById.get(ability.id)?.picks,
  }))
}

function mapLayoutVariantScore(brawler: Brawler, map: MapItem | null) {
  if (!map) return 0

  const fallbackProfile = { roles: ['Controller', 'Support'], tags: ['control', 'healing'] }
  const profiles = [
    { roles: ['Marksman', 'Artillery'], tags: ['range', 'space'] },
    fallbackProfile,
    { roles: ['Tank', 'Assassin'], tags: ['durable', 'mobility'] },
    { roles: ['Damage Dealer', 'Controller'], tags: ['control', 'range'] },
  ]
  const profile = profiles[Math.abs(map.id) % profiles.length] || fallbackProfile
  let score = 0

  if (profile.roles.includes(brawler.role)) score += 1.4
  if (brawler.tags.some((tag) => profile.tags.includes(tag))) score += 0.9

  return score
}

function normalizeStatMapName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function buildMaps(list: ApiMap[], translations: TranslationIndex): MapItem[] {
  return list.map((map) => ({
    id: map.id,
    name: map.name,
    localizedName: translations.translate(map.name),
    disabled: Boolean(map.disabled),
    link: map.link || `https://brawlify.com/maps/${map.id}`,
    imageUrl: map.imageUrl || '',
    environmentName: map.environment?.name || 'Unknown',
    localizedEnvironmentName: translations.translate(map.environment?.name || 'Unknown'),
    modeName: map.gameMode?.name || 'Unknown',
    modeColor: map.gameMode?.color || '#2db8ff',
    modeImageUrl: map.gameMode?.imageUrl || map.gameMode?.imageUrl2 || '',
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
