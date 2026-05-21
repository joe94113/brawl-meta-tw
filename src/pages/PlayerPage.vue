<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Copy, Search, Share2, Trophy } from '@lucide/vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'
import { fetchOfficialJson } from '../services/brawlStars'
import type {
  BattleLogResponse,
  OfficialBattle,
  OfficialBattlePlayer,
  OfficialPlayer,
  OfficialPlayerAccessory,
  OfficialPlayerBrawler,
} from '../types'

type BattleTeam = OfficialBattlePlayer[]
type BattlePlayerRow = {
  player: OfficialBattlePlayer
  team: BattleTeam
  teamIndex: number
  playerIndex: number
}

const route = useRoute()
const router = useRouter()
const { loadGameData, brawlers, maps, gameModes, modeLabel, modeNameFromSlug, modeSlugLabel } = useBrawlData()

const playerTag = ref(String(route.query.tag || ''))
const recentTags = ref<string[]>([])
const playerLoading = ref(false)
const playerError = ref('')
const playerProfile = ref<OfficialPlayer | null>(null)
const battleLog = ref<OfficialBattle[]>([])
const shareStatus = ref('')

const normalizedPlayerTag = computed(() => normalizeTag(playerTag.value))
const ownerHashTag = computed(() => (normalizedPlayerTag.value ? `#${normalizedPlayerTag.value}` : ''))
const canNativeShare = computed(() => typeof navigator !== 'undefined' && 'share' in navigator)

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
  const bestRank = battleLog.value
    .map((battle) => battle.battle?.rank)
    .filter((rank): rank is number => Number.isFinite(rank))
    .sort((a, b) => a - b)[0]

  return {
    total,
    wins,
    losses,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    trophyChange,
    bestRank,
  }
})

const modeRows = computed(() => {
  const counts = new Map<string, { mode: string; total: number; wins: number }>()

  for (const battle of battleLog.value) {
    const mode = battle.event?.mode || battle.battle?.mode || 'unknown'
    const row = counts.get(mode) || { mode, total: 0, wins: 0 }
    row.total += 1
    if (battle.battle?.result === 'victory') row.wins += 1
    counts.set(mode, row)
  }

  return Array.from(counts.values())
    .map((row) => ({
      ...row,
      winRate: row.total > 0 ? Math.round((row.wins / row.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || b.winRate - a.winRate)
    .slice(0, 4)
})

const usedBrawlerRows = computed(() => {
  const rows = new Map<string, { brawler: OfficialPlayerBrawler; total: number; wins: number; trophies: number }>()

  for (const battle of battleLog.value) {
    const self = battleTeams(battle)
      .flat()
      .find((player) => sameTag(player.tag, ownerHashTag.value))
    if (!self?.brawler) continue

    const key = `${self.brawler.id}-${normalizeBrawlerName(self.brawler.name)}`
    const row = rows.get(key) || { brawler: self.brawler, total: 0, wins: 0, trophies: 0 }
    row.total += 1
    row.trophies += self.brawler.trophies || 0
    if (battle.battle?.result === 'victory') row.wins += 1
    rows.set(key, row)
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      avgTrophies: row.total > 0 ? Math.round(row.trophies / row.total) : 0,
      winRate: row.total > 0 ? Math.round((row.wins / row.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || b.winRate - a.winRate)
    .slice(0, 6)
})

const collectionSummary = computed(() => {
  const owned = playerProfile.value?.brawlers || []

  return {
    total: owned.length,
    level11: owned.filter((brawler) => brawler.power >= 11).length,
    gadgets: owned.reduce((sum, brawler) => sum + (brawler.gadgets?.length || 0), 0),
    starPowers: owned.reduce((sum, brawler) => sum + (brawler.starPowers?.length || 0), 0),
    gears: owned.reduce((sum, brawler) => sum + (brawler.gears?.length || 0), 0),
    hyperCharges: owned.reduce((sum, brawler) => sum + (brawler.hyperCharges?.length || 0), 0),
  }
})

const equippedBrawlers = computed(() =>
  (playerProfile.value?.brawlers || [])
    .slice()
    .sort((a, b) => {
      const bScore = equipmentScore(b) * 10000 + b.trophies
      const aScore = equipmentScore(a) * 10000 + a.trophies
      return bScore - aScore
    })
    .slice(0, 8),
)

const playerLinks = computed(() => {
  if (!normalizedPlayerTag.value) return []

  return [
    { label: 'Brawlify 戰績總覽', href: `https://brawlify.com/stats/profile/${normalizedPlayerTag.value}` },
    { label: 'Brawlify 對戰紀錄', href: `https://brawlify.com/stats/battles/${normalizedPlayerTag.value}` },
    { label: 'Brawl Time Profile', href: `https://brawltime.ninja/profile/${normalizedPlayerTag.value}` },
  ]
})

onMounted(() => {
  loadRecentTags()
  void loadGameData()
  if (normalizedPlayerTag.value) void fetchPlayerData()
})

watch(
  () => route.query.tag,
  (tag) => {
    playerTag.value = String(tag || '')
    if (normalizedPlayerTag.value) void fetchPlayerData()
  },
)

function normalizeTag(tag: string) {
  return tag.replace('#', '').replace(/\s+/g, '').trim().toUpperCase()
}

function submitPlayerSearch() {
  if (!normalizedPlayerTag.value) return
  addRecentTag(normalizedPlayerTag.value)
  void router.push({ name: 'player', query: { tag: normalizedPlayerTag.value } })
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
      fetchOfficialJson<OfficialPlayer>(`/players/${encodedTag}`),
      fetchOfficialJson<BattleLogResponse>(`/players/${encodedTag}/battlelog`).catch(() => ({ items: [] })),
    ])

    playerProfile.value = profile
    battleLog.value = battles.items || []
  } catch (error) {
    playerError.value =
      error instanceof Error
        ? `${error.message}，請確認玩家 Tag 是否正確，或稍後再試。`
        : '玩家資料讀取失敗，請稍後再試。'
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

async function sharePlayerPage() {
  if (!playerProfile.value || !normalizedPlayerTag.value) return

  const url = playerShareUrl()
  const text = playerShareText()

  try {
    if (navigator.share) {
      await navigator.share({
        title: `荒野報馬仔｜${playerProfile.value.name}`,
        text,
        url,
      })
      shareStatus.value = '已開啟分享'
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      shareStatus.value = '已複製分享摘要'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    await navigator.clipboard?.writeText(url)
    shareStatus.value = '已複製連結'
  } finally {
    window.setTimeout(() => {
      shareStatus.value = ''
    }, 2400)
  }
}

function playerShareUrl() {
  if (typeof window === 'undefined') return ''

  const url = new URL(window.location.href)
  if (!url.hash.includes('/player')) {
    url.searchParams.set('tag', normalizedPlayerTag.value)
  }
  return url.toString()
}

function playerShareText() {
  const profile = playerProfile.value
  if (!profile) return ''

  return [
    `荒野報馬仔｜${profile.name} #${normalizedPlayerTag.value}`,
    `獎盃 ${profile.trophies.toLocaleString()} / 最高 ${profile.highestTrophies.toLocaleString()}`,
    `積分 ${rankedValue(profile.rankedRankName, profile.rankedElo)}`,
    `近期 ${battleSummary.value.total} 場勝率 ${battleSummary.value.winRate}%`,
  ].join('\n')
}

function displayBrawlerName(playerBrawler: OfficialPlayerBrawler) {
  const found = findLocalBrawler(playerBrawler)
  return found ? found.localizedName : playerBrawler.name
}

function equipmentScore(brawler: OfficialPlayerBrawler) {
  return (
    (brawler.gadgets?.length || 0) +
    (brawler.starPowers?.length || 0) +
    (brawler.gears?.length || 0) +
    (brawler.hyperCharges?.length || 0) * 2 +
    (brawler.currentWinStreak || 0) * 0.25
  )
}

function brawlerImageUrl(playerBrawler?: OfficialPlayerBrawler) {
  if (!playerBrawler) return ''
  const local = findLocalBrawler(playerBrawler)
  if (local?.imageUrl) return local.imageUrl
  return playerBrawler.id > 0 ? `https://cdn.brawlify.com/brawlers/borderless/${playerBrawler.id}.png` : ''
}

function findLocalBrawler(playerBrawler: OfficialPlayerBrawler) {
  const normalizedName = normalizeBrawlerName(playerBrawler.name)
  return (
    brawlers.value.find((brawler) => brawler.id === playerBrawler.id) ||
    brawlers.value.find((brawler) => normalizeBrawlerName(brawler.name) === normalizedName)
  )
}

function normalizeBrawlerName(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function profileIconUrl(iconId?: number) {
  return iconId ? `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png` : ''
}

function rankNameLabel(name?: string) {
  if (!name) return '未定級'
  const [tier = '', division] = name.split(/\s+/)
  const tierMap: Record<string, string> = {
    BRONZE: '青銅',
    SILVER: '白銀',
    GOLD: '黃金',
    DIAMOND: '鑽石',
    MYTHIC: '神話',
    LEGENDARY: '傳奇',
    MASTERS: '大師',
    MASTER: '大師',
  }

  return `${tierMap[tier] || tier}${division ? ` ${division}` : ''}`
}

function rankedValue(rankName?: string, elo?: number) {
  const label = rankNameLabel(rankName)
  return elo ? `${label} · ${elo.toLocaleString()} Elo` : label
}

function formatOptionalNumber(value?: number) {
  return Number.isFinite(value) ? value!.toLocaleString() : '0'
}

function abilityName(ability: OfficialPlayerAccessory, brawler: OfficialPlayerBrawler) {
  const local = findLocalBrawler(brawler)
  const normalized = normalizeBrawlerName(ability.name)
  const found = [...(local?.gadgets || []), ...(local?.starPowers || [])].find(
    (item) => item.id === ability.id || normalizeBrawlerName(item.name) === normalized,
  )

  return found?.localizedName || ability.name
}

function abilityListLabel(items: OfficialPlayerAccessory[] | undefined, brawler: OfficialPlayerBrawler, empty = '尚未持有') {
  if (!items?.length) return empty
  const names = items.slice(0, 2).map((item) => abilityName(item, brawler))
  const more = items.length > 2 ? ` +${items.length - 2}` : ''
  return `${names.join('、')}${more}`
}

function displayBattleMode(mode?: string) {
  if (!mode) return '未知模式'
  const slugLabel = localModeSlugLabel(mode)
  if (slugLabel !== mode) return slugLabel
  const translatedSlug = modeSlugLabel(mode)
  if (translatedSlug !== mode) return translatedSlug
  return modeLabel(modeNameFromSlug(mode))
}

function localModeSlugLabel(mode: string) {
  const labels: Record<string, string> = {
    gemGrab: '寶石爭奪戰',
    heist: '金庫攻防戰',
    bounty: '搶星大作戰',
    brawlBall: '亂鬥足球',
    soloShowdown: '單人荒野生死鬥',
    duoShowdown: '雙人荒野生死鬥',
    trioShowdown: '三人荒野生死鬥',
    hotZone: '據點爭奪戰',
    knockout: '極限淘汰賽',
    knockout5V5: '5v5 極限淘汰賽',
    wipeout: '積分爭奪戰',
    deathmatch: '積分爭奪戰',
    wipeout5V5: '5v5 積分爭奪戰',
    deathmatch5v5: '5v5 積分爭奪戰',
    duels: '單挑',
    basketBrawl: '亂鬥籃球',
    volleyBrawl: '亂鬥排球',
    trophyEscape: '獎盃逃脫',
  }

  return labels[mode] || mode
}

function displayMapName(mapName?: string) {
  if (!mapName) return '未知地圖'
  const found = findLocalMap(mapName)
  return found?.localizedName || mapName
}

function findLocalMap(mapName?: string) {
  if (!mapName) return null
  const normalized = normalizeMapName(mapName)
  return maps.value.find((map) => normalizeMapName(map.name) === normalized) || null
}

function battleMapImageUrl(mapName?: string) {
  return findLocalMap(mapName)?.imageUrl || ''
}

function battleModeImageUrl(mode?: string, mapName?: string) {
  const map = findLocalMap(mapName)
  if (map?.modeImageUrl) return map.modeImageUrl

  const modeName = mode ? modeNameFromSlug(mode) : ''
  return gameModes.value.find((gameMode) => gameMode.name === modeName)?.imageUrl || ''
}

function normalizeMapName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function battleTeams(battle: OfficialBattle): BattleTeam[] {
  const teams = battle.battle?.teams || []
  if (teams.length > 0) return teams
  const players = battle.battle?.players || []
  return players.length > 0 ? [players] : []
}

function isShowdownBattle(battle: OfficialBattle) {
  const mode = battle.event?.mode || battle.battle?.mode || ''
  return ['soloShowdown', 'duoShowdown', 'trioShowdown'].includes(mode) || Boolean(battle.battle?.rank && battleTeams(battle).length > 2)
}

function showdownKind(battle: OfficialBattle) {
  const mode = battle.event?.mode || battle.battle?.mode || ''
  if (mode === 'soloShowdown') return 'solo'
  if (mode === 'duoShowdown') return 'duo'
  if (mode === 'trioShowdown') return 'trio'

  const maxTeamSize = Math.max(1, ...battleTeams(battle).map((team) => team.length))
  if (maxTeamSize >= 3) return 'trio'
  if (maxTeamSize === 2) return 'duo'
  return 'solo'
}

function showdownListTitle(battle: OfficialBattle) {
  const kind = showdownKind(battle)
  if (kind === 'solo') return '單人生死鬥名單'
  if (kind === 'duo') return '雙人生死鬥隊伍'
  return '三人生死鬥隊伍'
}

function showdownListMeta(battle: OfficialBattle) {
  const kind = showdownKind(battle)
  const teams = battleTeams(battle).length
  const players = battlePlayerRows(battle).length
  const teamSize = kind === 'solo' ? 1 : kind === 'duo' ? 2 : 3
  if (kind === 'solo') return `${players} 人 · 5 欄 x 2 列`
  if (kind === 'duo') return `${teams} 隊 · 每隊 ${teamSize} 人 · 5 欄 x 2 列`
  return `${teams} 隊 · 每隊 ${teamSize} 人 · 共 ${players} 人`
}

function battlePlayerRows(battle: OfficialBattle): BattlePlayerRow[] {
  return battleTeams(battle).flatMap((team, teamIndex) =>
    team.map((player, playerIndex) => ({
      player,
      team,
      teamIndex,
      playerIndex,
    })),
  )
}

function playerRoute(player: OfficialBattlePlayer) {
  return player.tag ? { name: 'player', query: { tag: normalizeTag(player.tag) } } : { name: 'player' }
}

function sameTag(left?: string, right?: string) {
  return normalizeTag(left || '') === normalizeTag(right || '')
}

function isSelf(player: OfficialBattlePlayer) {
  return sameTag(player.tag, ownerHashTag.value)
}

function isStarPlayer(battle: OfficialBattle, player: OfficialBattlePlayer) {
  return Boolean(player.tag && battle.battle?.starPlayer?.tag && sameTag(player.tag, battle.battle.starPlayer.tag))
}

function teamHasSelf(team: BattleTeam) {
  return team.some((player) => isSelf(player))
}

function teamLabel(team: BattleTeam, index: number, battle: OfficialBattle) {
  if (teamHasSelf(team)) return '我方'
  if (battle.battle?.rank && battleTeams(battle).length > 2) return `隊伍 ${index + 1}`
  return `對手 ${index + 1}`
}

function showdownRowLabel(row: BattlePlayerRow, battle: OfficialBattle) {
  if (showdownKind(battle) === 'solo') return isSelf(row.player) ? '我方' : `對手 ${row.playerIndex + 1}`
  if (isSelf(row.player)) return '我方'
  if (teamHasSelf(row.team)) return '隊友'
  return `隊伍 ${row.teamIndex + 1}`
}

function showdownTeamLabel(team: BattleTeam, index: number) {
  return teamHasSelf(team) ? '我方隊伍' : `隊伍 ${index + 1}`
}

function showdownTeamMembersClass(battle: OfficialBattle) {
  if (showdownKind(battle) === 'trio') return 'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1.5 max-sm:grid-cols-1'
  return 'grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1.5 max-[340px]:grid-cols-1'
}

function showdownWideGridClass() {
  return 'grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1.5 max-lg:grid-cols-[repeat(3,minmax(0,1fr))] max-sm:grid-cols-[repeat(2,minmax(0,1fr))] max-[360px]:grid-cols-1'
}

function showdownPlayerRow(player: OfficialBattlePlayer, team: BattleTeam, teamIndex: number, playerIndex: number): BattlePlayerRow {
  return { player, team, teamIndex, playerIndex }
}

function formatBattleTime(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function resultLabel(battle: OfficialBattle) {
  const result = battle.battle?.result
  const rank = battle.battle?.rank
  if (rank) return `第 ${rank} 名`
  if (result === 'victory') return '勝利'
  if (result === 'defeat') return '落敗'
  if (result === 'draw') return '平手'
  return '結果未知'
}

function trophyChangeLabel(value?: number) {
  if (!Number.isFinite(value)) return ''
  if (value === 0) return '0'
  return `${value! > 0 ? '+' : ''}${value}`
}

function resultTone(result?: string) {
  if (result === 'victory') return 'text-[#00e676]'
  if (result === 'defeat') return 'text-[#ff1744]'
  return 'text-slate-300'
}

function battleResultClass(result?: string) {
  if (result === 'victory') return 'border-[#00e676]/70 shadow-[0_0_24px_rgba(0,230,118,0.14)]'
  if (result === 'defeat') return 'border-[#ff1744]/70 shadow-[0_0_24px_rgba(255,23,68,0.12)]'
  return 'border-white/10'
}

function teamClass(team: BattleTeam) {
  return teamHasSelf(team) ? 'border-[#ffcc00]/50 bg-[#ffcc00]/10' : 'border-white/10 bg-white/5'
}

function showdownRowClass(row: BattlePlayerRow) {
  return teamHasSelf(row.team) ? 'border-[#ffcc00]/45 bg-[#ffcc00]/10' : 'border-white/10 bg-[#121824]/80'
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader eyebrow="Profile scout" title="個人戰績查詢" note="輸入玩家 Tag 後，在荒野報馬仔內查看玩家資料、代表角色與近期對戰紀錄。" />

    <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] gap-5 max-sm:w-[calc(100%_-_28px)]">
      <form class="dark-panel grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-lg p-4 max-sm:grid-cols-1" @submit.prevent="submitPlayerSearch">
        <label class="grid gap-1 text-sm font-black text-slate-300">
          玩家 Tag
          <input v-model="playerTag" class="min-h-12 rounded-lg border border-white/10 bg-[#121824] px-3 text-white outline-none focus:border-[#ffcc00]" placeholder="#2PVRQGQG" />
        </label>
        <button type="submit" class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ffcc00] px-5 font-black text-[#121824]">
          <Search class="size-5" />
          查詢
        </button>
        <div v-if="recentTags.length > 0" class="col-span-2 mt-1 flex flex-wrap gap-2 max-sm:col-span-1">
          <button v-for="tag in recentTags" :key="tag" type="button" class="inline-flex min-h-9 items-center rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-black text-white" @click="useRecentTag(tag)">
            #{{ tag }}
          </button>
        </div>
      </form>

      <div class="dark-panel rounded-lg p-6 max-sm:p-4">
        <div v-if="playerProfile" class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex min-w-0 flex-wrap items-center gap-4">
            <div class="grid size-20 place-items-center overflow-hidden rounded-lg border border-[#ffcc00]/40 bg-[#121824] shadow-[0_0_24px_rgba(255,204,0,0.14)]">
              <img
                v-if="profileIconUrl(playerProfile.icon?.id)"
                class="size-full object-cover"
                :src="profileIconUrl(playerProfile.icon?.id)"
                :alt="`${playerProfile.name} 頭貼`"
                @error="onImageError"
              />
              <span v-else class="text-3xl font-black text-[#ffcc00]">{{ playerProfile.name.slice(0, 1) }}</span>
            </div>
            <div class="min-w-0">
              <h2 class="m-0 truncate text-2xl font-black text-white">{{ playerProfile.name }}</h2>
              <p class="mb-0 mt-1 text-slate-400">
                #{{ normalizedPlayerTag }}
                <span v-if="playerProfile.club"> · {{ playerProfile.club.name }}</span>
              </p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2 max-sm:w-full max-sm:items-stretch">
            <button
              type="button"
              class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#ffcc00]/35 bg-[#ffcc00]/10 px-4 text-sm font-black text-[#ffcc00] transition hover:bg-[#ffcc00]/20"
              @click="sharePlayerPage"
            >
              <Check v-if="shareStatus" class="size-4" />
              <Share2 v-else-if="canNativeShare" class="size-4" />
              <Copy v-else class="size-4" />
              {{ shareStatus || '分享戰績' }}
            </button>
          </div>
        </div>

        <h2 v-else class="m-0 text-2xl font-black text-white">{{ normalizedPlayerTag ? `#${normalizedPlayerTag}` : '輸入玩家 Tag 開始查詢' }}</h2>
        <p v-if="!playerProfile && !playerLoading && !playerError" class="mt-3 leading-7 text-slate-300">
          查詢後會在本頁顯示玩家總獎盃、代表角色、近期勝率與每場對戰陣容。
        </p>
        <div v-if="playerLoading" class="mt-5 grid gap-3">
          <div class="h-20 animate-pulse rounded-lg bg-white/10" />
          <div class="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3 max-sm:grid-cols-[repeat(2,minmax(0,1fr))]">
            <div v-for="index in 4" :key="index" class="h-20 animate-pulse rounded-lg bg-white/10" />
          </div>
        </div>
        <p v-if="playerError" class="mt-3 rounded-lg border border-[#ff1744]/40 bg-[#ff1744]/10 p-3 leading-7 text-red-100">{{ playerError }}</p>

        <div v-if="playerProfile" class="mt-5 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3 max-sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <div class="min-w-0 rounded-lg bg-white/5 p-3">
            <span class="block truncate text-xs font-black text-slate-500">帳號等級</span>
            <strong class="font-score mt-1 block truncate text-lg text-white">{{ playerProfile.expLevel }}</strong>
            <small class="mt-1 block truncate text-slate-500">{{ formatOptionalNumber(playerProfile.expPoints) }} 經驗</small>
          </div>
          <div class="min-w-0 rounded-lg bg-white/5 p-3">
            <span class="block truncate text-xs font-black text-slate-500">目前獎盃</span>
            <strong class="font-score mt-1 inline-flex max-w-full items-center gap-1 text-lg text-[#ffcc00]">
              <span class="truncate">{{ playerProfile.trophies.toLocaleString() }}</span>
              <Trophy class="size-4 shrink-0" />
            </strong>
            <span class="mt-2 block h-2 overflow-hidden rounded bg-white/10">
              <span class="block h-full bg-[#ffcc00]" :style="{ width: `${Math.min(100, (playerProfile.trophies / Math.max(playerProfile.highestTrophies, 1)) * 100)}%` }" />
            </span>
          </div>
          <div class="min-w-0 rounded-lg bg-white/5 p-3">
            <span class="block truncate text-xs font-black text-slate-500">最高獎盃</span>
            <strong class="font-score mt-1 inline-flex max-w-full items-center gap-1 text-lg text-white">
              <span class="truncate">{{ playerProfile.highestTrophies.toLocaleString() }}</span>
              <Trophy class="size-4 shrink-0 text-[#ffcc00]" />
            </strong>
          </div>
          <div class="min-w-0 rounded-lg bg-white/5 p-3">
            <span class="block truncate text-xs font-black text-slate-500">3v3 勝場</span>
            <strong class="font-score mt-1 block truncate text-lg text-[#00e676]">{{ playerProfile['3vs3Victories'].toLocaleString() }}</strong>
          </div>
        </div>

        <div v-if="playerProfile" class="mt-5 grid grid-cols-[1.1fr_0.9fr] gap-4 max-lg:grid-cols-1">
          <div class="rounded-lg border border-[#8a2be2]/30 bg-[#8a2be2]/10 p-3">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 class="m-0 text-base font-black text-white">積分排位</h3>
                <p class="mb-0 mt-1 text-xs text-slate-400">目前、賽季最高與歷史最高 Elo</p>
              </div>
              <span class="rounded-md bg-[#8a2be2]/30 px-2 py-1 text-xs font-black text-white">Ranked</span>
            </div>
            <div class="mt-3 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 max-sm:grid-cols-1">
              <span class="min-w-0 rounded-lg bg-[#121824]/80 p-2">
                <small class="block truncate text-slate-500">目前</small>
                <span class="mt-1 flex items-center gap-2">
                  <img v-if="playerProfile.rankedRankIconUrl" class="size-7 shrink-0 object-contain" :src="playerProfile.rankedRankIconUrl" :alt="rankNameLabel(playerProfile.rankedRankName)" @error="onImageError" />
                  <b class="min-w-0 break-words text-sm leading-5 text-white">{{ rankedValue(playerProfile.rankedRankName, playerProfile.rankedElo) }}</b>
                </span>
              </span>
              <span class="min-w-0 rounded-lg bg-[#121824]/80 p-2">
                <small class="block truncate text-slate-500">本季最高</small>
                <span class="mt-1 flex items-center gap-2">
                  <img v-if="playerProfile.highestSeasonRankedRankIconUrl" class="size-7 shrink-0 object-contain" :src="playerProfile.highestSeasonRankedRankIconUrl" :alt="rankNameLabel(playerProfile.highestSeasonRankedRankName)" @error="onImageError" />
                  <b class="min-w-0 break-words text-sm leading-5 text-white">{{ rankedValue(playerProfile.highestSeasonRankedRankName, playerProfile.highestSeasonRankedElo) }}</b>
                </span>
              </span>
              <span class="min-w-0 rounded-lg bg-[#121824]/80 p-2">
                <small class="block truncate text-slate-500">歷史最高</small>
                <span class="mt-1 flex items-center gap-2">
                  <img v-if="playerProfile.highestAllTimeRankedRankIconUrl" class="size-7 shrink-0 object-contain" :src="playerProfile.highestAllTimeRankedRankIconUrl" :alt="rankNameLabel(playerProfile.highestAllTimeRankedRankName)" @error="onImageError" />
                  <b class="min-w-0 break-words text-sm leading-5 text-white">{{ rankedValue(playerProfile.highestAllTimeRankedRankName, playerProfile.highestAllTimeRankedElo) }}</b>
                </span>
              </span>
            </div>
          </div>

          <div class="rounded-lg border border-white/10 p-3">
            <h3 class="m-0 text-base font-black text-white">帳號成長</h3>
            <div class="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
              <span class="min-w-0 rounded-lg bg-white/5 p-2"><small class="block truncate text-slate-500">總精通等級</small><b class="font-score block truncate text-white">{{ formatOptionalNumber(playerProfile.totalPrestigeLevel) }}</b></span>
              <span class="min-w-0 rounded-lg bg-white/5 p-2"><small class="block truncate text-slate-500">單人生死鬥</small><b class="font-score block truncate text-white">{{ playerProfile.soloVictories.toLocaleString() }}</b></span>
              <span class="min-w-0 rounded-lg bg-white/5 p-2"><small class="block truncate text-slate-500">雙人生死鬥</small><b class="font-score block truncate text-white">{{ playerProfile.duoVictories.toLocaleString() }}</b></span>
              <span class="min-w-0 rounded-lg bg-white/5 p-2"><small class="block truncate text-slate-500">冠軍挑戰資格</small><b class="block truncate text-white">{{ playerProfile.isQualifiedFromChampionshipChallenge ? '已取得' : '未取得' }}</b></span>
            </div>
          </div>
        </div>

        <div v-if="playerProfile" class="mt-5 grid grid-cols-[repeat(6,minmax(0,1fr))] gap-2 text-center max-lg:grid-cols-[repeat(3,minmax(0,1fr))] max-sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <span class="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2"><b class="font-score block truncate text-white">{{ collectionSummary.total }}</b><small class="block truncate text-slate-400">持有角色</small></span>
          <span class="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2"><b class="font-score block truncate text-[#ffcc00]">{{ collectionSummary.level11 }}</b><small class="block truncate text-slate-400">滿等角色</small></span>
          <span class="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2"><b class="font-score block truncate text-white">{{ collectionSummary.gadgets }}</b><small class="block truncate text-slate-400">配件</small></span>
          <span class="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2"><b class="font-score block truncate text-white">{{ collectionSummary.starPowers }}</b><small class="block truncate text-slate-400">能力之星</small></span>
          <span class="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2"><b class="font-score block truncate text-white">{{ collectionSummary.gears }}</b><small class="block truncate text-slate-400">裝備</small></span>
          <span class="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2"><b class="font-score block truncate text-[#8a2be2]">{{ collectionSummary.hyperCharges }}</b><small class="block truncate text-slate-400">極限威能</small></span>
        </div>

        <div v-if="playerProfile" class="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
          <div class="rounded-lg border border-white/10 p-3">
            <h3 class="m-0 text-base font-black text-white">近期對戰摘要</h3>
            <div class="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2 text-center max-sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <span class="min-w-0 rounded-lg bg-white/5 p-2"><b class="font-score block truncate text-white">{{ battleSummary.total }}</b><small class="block truncate text-slate-400">場次</small></span>
              <span class="min-w-0 rounded-lg bg-white/5 p-2"><b class="font-score block truncate text-[#00e676]">{{ battleSummary.winRate }}%</b><small class="block truncate text-slate-400">勝率</small></span>
              <span class="min-w-0 rounded-lg bg-white/5 p-2"><b class="font-score block truncate text-white">{{ battleSummary.wins }}/{{ battleSummary.losses }}</b><small class="block truncate text-slate-400">勝 / 敗</small></span>
              <span class="min-w-0 rounded-lg bg-white/5 p-2">
                <b class="font-score inline-flex items-center justify-center gap-1" :class="battleSummary.trophyChange >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]'">
                  <span class="truncate">{{ trophyChangeLabel(battleSummary.trophyChange) }}</span>
                  <Trophy class="size-3.5 shrink-0 text-[#ffcc00]" />
                </b>
                <small class="block truncate text-slate-400">獎盃變動</small>
              </span>
            </div>
          </div>

          <div class="rounded-lg border border-white/10 p-3">
            <h3 class="m-0 text-base font-black text-white">代表角色</h3>
            <div class="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 max-sm:grid-cols-1">
              <div v-for="brawler in playerTopBrawlers.slice(0, 4)" :key="brawler.id" class="grid min-h-[62px] min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-2 rounded-lg bg-white/5 p-2">
                <img v-if="brawlerImageUrl(brawler)" class="size-12 shrink-0 object-contain" :src="brawlerImageUrl(brawler)" :alt="displayBrawlerName(brawler)" @error="onImageError" />
                <span v-else class="grid size-12 place-items-center rounded-lg bg-[#121824] text-xs font-black text-slate-500">?</span>
                <span class="min-w-0">
                  <strong class="block truncate text-sm text-white">{{ displayBrawlerName(brawler) }}</strong>
                  <small class="inline-flex items-center gap-1 text-xs text-slate-400">
                    <span class="truncate">等級 {{ brawler.power }} · {{ brawler.trophies }}</span>
                    <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                  </small>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="playerProfile" class="mt-5 rounded-lg border border-white/10 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="m-0 text-base font-black text-white">角色收藏與裝備</h3>
            <span class="text-xs font-black text-slate-500">優先顯示裝備完整、連勝或獎盃較高的角色</span>
          </div>
          <div class="mt-3 grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-2 max-[360px]:grid-cols-1">
            <article v-for="brawler in equippedBrawlers" :key="brawler.id" class="grid min-h-[132px] min-w-0 grid-cols-[58px_minmax(0,1fr)] gap-3 rounded-lg bg-white/5 p-2">
              <img v-if="brawlerImageUrl(brawler)" class="size-14 shrink-0 object-contain" :src="brawlerImageUrl(brawler)" :alt="displayBrawlerName(brawler)" @error="onImageError" />
              <span v-else class="grid size-14 place-items-center rounded-lg bg-[#121824] text-xs font-black text-slate-500">?</span>
              <div class="min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <strong class="truncate text-sm text-white">{{ displayBrawlerName(brawler) }}</strong>
                  <span class="font-score text-xs font-black text-[#ffcc00]">Lv.{{ brawler.power }}</span>
                </div>
                <p class="mb-0 mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-400">
                  <span class="inline-flex items-center gap-1">
                    {{ brawler.trophies.toLocaleString() }}
                    <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                  </span>
                  <span v-if="brawler.highestTrophies" class="inline-flex items-center gap-1">
                    · 最高 {{ brawler.highestTrophies.toLocaleString() }}
                    <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                  </span>
                  <span v-if="brawler.currentWinStreak"> · 連勝 {{ brawler.currentWinStreak }}</span>
                </p>
                <p v-if="brawler.skin?.name" class="mb-0 mt-1 truncate text-xs text-slate-500">造型：{{ brawler.skin.name }}</p>
                <div class="mt-2 grid gap-1 text-[0.7rem] leading-4 text-slate-400">
                  <span class="truncate"><b class="text-slate-200">配件</b>：{{ abilityListLabel(brawler.gadgets, brawler) }}</span>
                  <span class="truncate"><b class="text-slate-200">能力之星</b>：{{ abilityListLabel(brawler.starPowers, brawler) }}</span>
                  <span class="truncate"><b class="text-slate-200">裝備</b>：{{ abilityListLabel(brawler.gears, brawler) }}</span>
                  <span class="truncate"><b class="text-slate-200">極限威能</b>：{{ abilityListLabel(brawler.hyperCharges, brawler) }}</span>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div v-if="playerProfile && battleLog.length > 0" class="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
          <div class="rounded-lg border border-white/10 p-3">
            <h3 class="m-0 text-base font-black text-white">近期模式表現</h3>
            <div class="mt-3 grid gap-2">
              <div v-for="row in modeRows" :key="row.mode" class="grid min-h-12 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-white/5 px-3">
                <span class="truncate text-sm font-black text-white">{{ displayBattleMode(row.mode) }}</span>
                <span class="font-score whitespace-nowrap text-sm font-black text-[#00e676]">{{ row.winRate }}% · {{ row.total }} 場</span>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-white/10 p-3">
            <h3 class="m-0 text-base font-black text-white">近期出戰角色</h3>
            <div class="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 max-sm:grid-cols-1">
              <div v-for="row in usedBrawlerRows" :key="`${row.brawler.id}-${row.brawler.name}`" class="grid min-h-[58px] min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white/5 p-2">
                <img v-if="brawlerImageUrl(row.brawler)" class="size-11 shrink-0 object-contain" :src="brawlerImageUrl(row.brawler)" :alt="displayBrawlerName(row.brawler)" @error="onImageError" />
                <span v-else class="grid size-11 place-items-center rounded-lg bg-[#121824] text-xs font-black text-slate-500">?</span>
                <span class="min-w-0">
                  <strong class="block truncate text-sm text-white">{{ displayBrawlerName(row.brawler) }}</strong>
                  <small class="inline-flex items-center gap-1 text-xs text-slate-400">
                    {{ row.total }} 場 · 平均 {{ row.avgTrophies }}
                    <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                  </small>
                </span>
                <b class="font-score whitespace-nowrap text-sm text-[#00e676]">{{ row.winRate }}%</b>
              </div>
            </div>
          </div>
        </div>

        <div v-if="battleLog.length > 0" class="mt-5 grid gap-3">
          <h3 class="m-0 text-base font-black text-white">近期對戰歷史</h3>
          <article v-for="battle in battleLog.slice(0, 16)" :key="battle.battleTime" class="grid gap-3 rounded-lg border bg-[#121824] p-3" :class="battleResultClass(battle.battle?.result)">
            <div class="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 max-sm:grid-cols-[64px_minmax(0,1fr)]">
              <div class="relative grid size-[76px] place-items-center overflow-hidden rounded-lg border border-white/10 bg-[#1d2330] max-sm:size-16">
                <img
                  v-if="battleMapImageUrl(battle.event?.map)"
                  class="size-full object-cover"
                  :src="battleMapImageUrl(battle.event?.map)"
                  :alt="displayMapName(battle.event?.map)"
                  @error="onImageError"
                />
                <span v-else class="text-[0.65rem] font-black text-slate-500">MAP</span>
                <span v-if="battleModeImageUrl(battle.event?.mode || battle.battle?.mode, battle.event?.map)" class="absolute bottom-1 right-1 grid size-7 place-items-center rounded-md bg-[#121824]/90 ring-1 ring-white/15">
                  <img class="size-5 object-contain" :src="battleModeImageUrl(battle.event?.mode || battle.battle?.mode, battle.event?.map)" :alt="displayBattleMode(battle.event?.mode || battle.battle?.mode)" @error="onImageError" />
                </span>
              </div>
              <div class="min-w-0">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <img
                    v-if="battleModeImageUrl(battle.event?.mode || battle.battle?.mode, battle.event?.map)"
                    class="size-5 object-contain"
                    :src="battleModeImageUrl(battle.event?.mode || battle.battle?.mode, battle.event?.map)"
                    :alt="displayBattleMode(battle.event?.mode || battle.battle?.mode)"
                    @error="onImageError"
                  />
                  <strong class="min-w-0 truncate text-white">{{ displayBattleMode(battle.event?.mode || battle.battle?.mode) }}</strong>
                </div>
                <div class="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span class="truncate text-sm text-slate-400">{{ displayMapName(battle.event?.map) }}</span>
                  <span v-if="battle.battleTime" class="text-xs text-slate-500">{{ formatBattleTime(battle.battleTime) }}</span>
                  <span v-if="battle.battle?.ranked" class="inline-flex rounded-md bg-[#8a2be2]/25 px-1.5 py-0.5 text-[0.68rem] font-black text-[#d8b4fe]">積分賽</span>
                  <span v-if="battle.event?.id" class="inline-flex rounded-md bg-white/5 px-1.5 py-0.5 text-[0.68rem] font-black text-slate-500">活動 #{{ battle.event.id }}</span>
                </div>
              </div>
              <span class="font-score justify-self-end whitespace-nowrap text-sm font-black max-sm:col-span-2 max-sm:justify-self-start" :class="resultTone(battle.battle?.result)">
                {{ resultLabel(battle) }}
                <span v-if="battle.battle?.trophyChange !== undefined" class="inline-flex items-center gap-1">
                  · {{ trophyChangeLabel(battle.battle.trophyChange) }}
                  <Trophy class="size-3.5 shrink-0 text-[#ffcc00]" />
                </span>
              </span>
            </div>

            <div v-if="isShowdownBattle(battle)" class="grid gap-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span class="text-xs font-black text-white">{{ showdownListTitle(battle) }}</span>
                <span class="text-xs font-black text-slate-400">{{ showdownListMeta(battle) }}</span>
              </div>

              <div v-if="showdownKind(battle) === 'solo'" :class="showdownWideGridClass()">
                <RouterLink
                  v-for="row in battlePlayerRows(battle)"
                  :key="`${battle.battleTime}-showdown-${row.teamIndex}-${row.playerIndex}-${row.player.tag || row.player.name}`"
                  :to="playerRoute(row.player)"
                  class="grid min-h-[58px] min-w-0 grid-cols-[38px_minmax(0,1fr)] items-center gap-2 rounded-lg border p-2 text-xs font-black text-white no-underline transition hover:border-[#ffcc00]"
                  :class="[showdownRowClass(row), isSelf(row.player) ? 'ring-1 ring-[#ffcc00]/70' : '']"
                >
                  <img
                    v-if="brawlerImageUrl(row.player.brawler)"
                    class="size-9 shrink-0 object-contain"
                    :src="brawlerImageUrl(row.player.brawler)"
                    :alt="row.player.brawler ? displayBrawlerName(row.player.brawler) : '未知角色'"
                    @error="onImageError"
                  />
                  <span v-else class="grid size-9 place-items-center rounded-lg bg-[#1d2330] text-xs font-black text-slate-500">?</span>
                  <span class="min-w-0">
                    <strong class="block truncate text-white">
                      <span v-if="isStarPlayer(battle, row.player)" class="text-[#ffcc00]">MVP · </span>{{ row.player.name || '未知玩家' }}
                    </strong>
                    <small class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-slate-400">
                      <span class="rounded bg-white/10 px-1.5 py-0.5 text-[0.65rem] font-black text-slate-300">{{ showdownRowLabel(row, battle) }}</span>
                      <span class="truncate">{{ row.player.brawler ? displayBrawlerName(row.player.brawler) : '未知角色' }}</span>
                      <span v-if="row.player.brawler?.power">· 等級 {{ row.player.brawler.power }}</span>
                      <span v-if="row.player.brawler?.trophies" class="inline-flex items-center gap-1">
                        · {{ row.player.brawler.trophies.toLocaleString() }}
                        <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                      </span>
                      <span v-if="row.player.isBigBrawler">· 大型英雄</span>
                    </small>
                  </span>
                </RouterLink>
              </div>

              <div v-else-if="showdownKind(battle) === 'duo'" :class="showdownWideGridClass()">
                <div
                  v-for="(team, teamIndex) in battleTeams(battle)"
                  :key="`${battle.battleTime}-showdown-duo-team-${teamIndex}`"
                  class="grid min-w-0 grid-rows-[repeat(2,minmax(58px,auto))] gap-1.5 rounded-lg border p-1.5"
                  :class="teamClass(team)"
                >
                  <RouterLink
                    v-for="(player, playerIndex) in team"
                    :key="`${battle.battleTime}-showdown-duo-${teamIndex}-${playerIndex}-${player.tag || player.name}`"
                    :to="playerRoute(player)"
                    class="grid min-h-[58px] min-w-0 grid-cols-[34px_minmax(0,1fr)] items-center gap-1.5 rounded-md border border-white/10 bg-[#121824]/80 p-1.5 text-[0.68rem] font-black text-white no-underline transition hover:border-[#ffcc00]"
                    :class="isSelf(player) ? 'ring-1 ring-[#ffcc00]/70' : ''"
                  >
                    <img
                      v-if="brawlerImageUrl(player.brawler)"
                      class="size-8 shrink-0 object-contain"
                      :src="brawlerImageUrl(player.brawler)"
                      :alt="player.brawler ? displayBrawlerName(player.brawler) : '未知角色'"
                      @error="onImageError"
                    />
                    <span v-else class="grid size-8 place-items-center rounded-md bg-[#1d2330] text-xs font-black text-slate-500">?</span>
                    <span class="min-w-0">
                      <strong class="block truncate text-white">
                        <span v-if="isStarPlayer(battle, player)" class="text-[#ffcc00]">MVP </span>{{ player.name || '未知玩家' }}
                      </strong>
                      <small class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-slate-400">
                        <span class="rounded bg-white/10 px-1.5 py-0.5 text-[0.62rem] font-black text-slate-300">{{ showdownRowLabel(showdownPlayerRow(player, team, teamIndex, playerIndex), battle) }}</span>
                        <span class="truncate">{{ player.brawler ? displayBrawlerName(player.brawler) : '未知角色' }}</span>
                        <span v-if="player.brawler?.power">等級 {{ player.brawler.power }}</span>
                        <span v-if="player.brawler?.trophies" class="inline-flex items-center gap-1">
                          {{ player.brawler.trophies.toLocaleString() }}
                          <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                        </span>
                      </small>
                    </span>
                  </RouterLink>
                </div>
              </div>

              <div v-else class="grid gap-1.5">
                <div
                  v-for="(team, teamIndex) in battleTeams(battle)"
                  :key="`${battle.battleTime}-showdown-team-${teamIndex}`"
                  class="grid gap-1.5 rounded-lg border p-2"
                  :class="teamClass(team)"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-black text-slate-400">{{ showdownTeamLabel(team, teamIndex) }}</span>
                    <span v-if="teamHasSelf(team)" class="text-xs font-black text-[#ffcc00]">玩家所在隊伍</span>
                  </div>
                  <div :class="showdownTeamMembersClass(battle)">
                    <RouterLink
                      v-for="(player, playerIndex) in team"
                      :key="`${battle.battleTime}-showdown-${teamIndex}-${playerIndex}-${player.tag || player.name}`"
                      :to="playerRoute(player)"
                      class="grid min-h-[58px] min-w-0 grid-cols-[38px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-white/10 bg-[#121824]/80 p-2 text-xs font-black text-white no-underline transition hover:border-[#ffcc00]"
                      :class="isSelf(player) ? 'ring-1 ring-[#ffcc00]/70' : ''"
                    >
                      <img
                        v-if="brawlerImageUrl(player.brawler)"
                        class="size-9 shrink-0 object-contain"
                        :src="brawlerImageUrl(player.brawler)"
                        :alt="player.brawler ? displayBrawlerName(player.brawler) : '未知角色'"
                        @error="onImageError"
                      />
                      <span v-else class="grid size-9 place-items-center rounded-lg bg-[#1d2330] text-xs font-black text-slate-500">?</span>
                      <span class="min-w-0">
                        <strong class="block truncate text-white">
                          <span v-if="isStarPlayer(battle, player)" class="text-[#ffcc00]">MVP · </span>{{ player.name || '未知玩家' }}
                        </strong>
                        <small class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-slate-400">
                          <span class="rounded bg-white/10 px-1.5 py-0.5 text-[0.65rem] font-black text-slate-300">{{ showdownRowLabel(showdownPlayerRow(player, team, teamIndex, playerIndex), battle) }}</span>
                          <span class="truncate">{{ player.brawler ? displayBrawlerName(player.brawler) : '未知角色' }}</span>
                          <span v-if="player.brawler?.power">· 等級 {{ player.brawler.power }}</span>
                          <span v-if="player.brawler?.trophies" class="inline-flex items-center gap-1">
                            · {{ player.brawler.trophies.toLocaleString() }}
                            <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                          </span>
                          <span v-if="player.isBigBrawler">· 大型英雄</span>
                        </small>
                      </span>
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="grid gap-2">
              <div
                v-for="(team, teamIndex) in battleTeams(battle)"
                :key="`${battle.battleTime}-${teamIndex}`"
                class="grid gap-2 rounded-lg border p-2"
                :class="teamClass(team)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-black text-slate-400">{{ teamLabel(team, teamIndex, battle) }}</span>
                  <span v-if="teamHasSelf(team)" class="text-xs font-black text-[#ffcc00]">玩家所在隊伍</span>
                </div>
                <div class="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-2">
                  <RouterLink
                    v-for="player in team"
                    :key="`${battle.battleTime}-${teamIndex}-${player.tag || player.name}`"
                    :to="playerRoute(player)"
                    class="grid min-h-[62px] min-w-0 grid-cols-[42px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-white/10 bg-[#121824]/80 p-2 text-xs font-black text-white no-underline transition hover:border-[#ffcc00]"
                    :class="isSelf(player) ? 'ring-1 ring-[#ffcc00]/70' : ''"
                  >
                    <img
                      v-if="brawlerImageUrl(player.brawler)"
                      class="size-10 shrink-0 object-contain"
                      :src="brawlerImageUrl(player.brawler)"
                      :alt="player.brawler ? displayBrawlerName(player.brawler) : '未知角色'"
                      @error="onImageError"
                    />
                    <span v-else class="grid size-10 place-items-center rounded-lg bg-[#1d2330] text-xs font-black text-slate-500">?</span>
                    <span class="min-w-0">
                      <strong class="block truncate text-white">
                        <span v-if="isStarPlayer(battle, player)" class="text-[#ffcc00]">MVP · </span>{{ player.name || '未知玩家' }}
                      </strong>
                      <small class="block truncate text-slate-400">
                        {{ player.brawler ? displayBrawlerName(player.brawler) : '未知角色' }}
                        <span v-if="player.brawler?.power"> · 等級 {{ player.brawler.power }}</span>
                        <span v-if="player.brawler?.trophies" class="inline-flex items-center gap-1">
                          · {{ player.brawler.trophies.toLocaleString() }}
                          <Trophy class="size-3 shrink-0 text-[#ffcc00]" />
                        </span>
                        <span v-if="player.isBigBrawler"> · 大型英雄</span>
                      </small>
                    </span>
                  </RouterLink>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div v-else-if="playerProfile && !playerLoading" class="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 class="m-0 text-base font-black text-white">目前沒有可顯示的近期對戰</h3>
          <p class="mb-0 mt-2 text-sm leading-6 text-slate-400">
            玩家資料已讀取成功，但資料來源暫時沒有提供 battlelog。之後資料恢復時，這裡會自動顯示每場陣容、角色頭像、獎盃變化與勝敗。
          </p>
        </div>

        <div v-if="playerLinks.length > 0" class="mt-4 flex flex-wrap gap-2">
          <a v-for="link in playerLinks" :key="link.href" :href="link.href" target="_blank" rel="noopener" class="inline-flex min-h-10 items-center rounded-lg bg-[#15161b] px-4 font-black text-white no-underline">
            {{ link.label }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
