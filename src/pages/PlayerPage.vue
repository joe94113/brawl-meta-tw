<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'
import { fetchJson } from '../services/brawlify'
import type { BattleLogResponse, OfficialBattle, OfficialBattlePlayer, OfficialPlayer, OfficialPlayerBrawler } from '../types'

const route = useRoute()
const router = useRouter()
const { loadGameData, brawlers, modeLabel, modeNameFromSlug, modeSlugLabel } = useBrawlData()

const playerTag = ref(String(route.query.tag || ''))
const recentTags = ref<string[]>([])
const playerLoading = ref(false)
const playerError = ref('')
const playerProfile = ref<OfficialPlayer | null>(null)
const battleLog = ref<OfficialBattle[]>([])

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
      fetchJson<OfficialPlayer>(`/api/brawlstars/players/${encodedTag}`),
      fetchJson<BattleLogResponse>(`/api/brawlstars/players/${encodedTag}/battlelog`).catch(() => ({ items: [] })),
    ])

    playerProfile.value = profile
    battleLog.value = battles.items || []
  } catch (error) {
    playerError.value =
      error instanceof Error
        ? `${error.message}。請確認玩家 tag 是否正確，或稍後再試。`
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

function displayBrawlerName(playerBrawler: OfficialPlayerBrawler) {
  const found = brawlers.value.find((brawler) => brawler.id === playerBrawler.id)
  return found ? found.localizedName : playerBrawler.name
}

function brawlerImageUrl(playerBrawler?: OfficialPlayerBrawler) {
  if (!playerBrawler) return ''
  return brawlers.value.find((brawler) => brawler.id === playerBrawler.id)?.imageUrl || ''
}

function profileIconUrl(iconId?: number) {
  return iconId ? `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png` : ''
}

function displayBattleMode(mode?: string) {
  if (!mode) return '未知模式'
  const slugLabel = modeSlugLabel(mode)
  if (slugLabel !== mode) return slugLabel
  return modeLabel(modeNameFromSlug(mode))
}

function battlePlayers(battle: OfficialBattle) {
  const teams = battle.battle?.teams || []
  if (teams.length > 0) return teams.flat().slice(0, 6)
  return (battle.battle?.players || []).slice(0, 6)
}

function playerRoute(player: OfficialBattlePlayer) {
  return player.tag ? { name: 'player', query: { tag: player.tag } } : { name: 'player' }
}

function isStarPlayer(battle: OfficialBattle, player: OfficialBattlePlayer) {
  return Boolean(player.tag && battle.battle?.starPlayer?.tag === player.tag)
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}

function battleResultClass(result?: string) {
  if (result === 'victory') return 'border-[#00e676]/70 shadow-[0_0_24px_rgba(0,230,118,0.14)]'
  if (result === 'defeat') return 'border-[#ff1744]/70 shadow-[0_0_24px_rgba(255,23,68,0.12)]'
  return 'border-white/10'
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader eyebrow="Profile scout" title="個人戰績查詢" note="輸入玩家 Tag 後，可查看官方玩家資料、代表角色與近期對戰摘要。" />

    <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[360px_1fr] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <form class="dark-panel grid content-start gap-3 rounded-lg p-4" @submit.prevent="submitPlayerSearch">
        <label class="grid gap-1 text-sm font-black text-slate-300">
          玩家 Tag
          <input v-model="playerTag" class="min-h-12 rounded-lg border border-white/10 bg-[#121824] px-3 text-white" placeholder="#2PP 或 2PP" />
        </label>
        <button type="submit" class="min-h-12 rounded-lg bg-[#ffcc00] px-5 font-black text-[#121824]">查詢</button>
        <div v-if="recentTags.length > 0" class="mt-2 flex flex-wrap gap-2">
          <button v-for="tag in recentTags" :key="tag" type="button" class="inline-flex min-h-9 items-center rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-black text-white" @click="useRecentTag(tag)">
            #{{ tag }}
          </button>
        </div>
      </form>

      <div class="dark-panel rounded-lg p-6">
        <div v-if="playerProfile" class="flex flex-wrap items-center gap-4">
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
            <p class="mb-0 mt-1 text-slate-400">#{{ normalizedPlayerTag }}<span v-if="playerProfile.club"> · {{ playerProfile.club.name }}</span></p>
          </div>
        </div>
        <h2 v-else class="m-0 text-2xl font-black text-white">{{ normalizedPlayerTag ? `#${normalizedPlayerTag}` : '輸入玩家 Tag 開始查詢' }}</h2>
        <p v-if="!playerProfile && !playerLoading && !playerError" class="mt-3 leading-7 text-slate-300">
          查詢後會讀取官方玩家資料與最近 25 場 battle log，並保留外部深連結方便交叉查看。
        </p>
        <p v-if="playerLoading" class="mt-3 leading-7 text-slate-300">正在讀取官方 API...</p>
        <p v-if="playerError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 leading-7 text-red-700">{{ playerError }}</p>

        <div v-if="playerProfile" class="mt-5 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          <div class="rounded-lg bg-white/5 p-3">
            <span class="text-xs font-black text-slate-500">經驗等級</span>
            <strong class="font-score mt-1 block text-lg text-white">{{ playerProfile.expLevel }}</strong>
          </div>
          <div class="rounded-lg bg-white/5 p-3">
            <span class="text-xs font-black text-slate-500">目前盃數</span>
            <strong class="font-score mt-1 block text-lg text-[#ffcc00]">{{ playerProfile.trophies.toLocaleString() }}</strong>
            <span class="mt-2 block h-2 overflow-hidden rounded bg-white/10"><span class="block h-full bg-[#ffcc00]" :style="{ width: `${Math.min(100, (playerProfile.trophies / Math.max(playerProfile.highestTrophies, 1)) * 100)}%` }" /></span>
          </div>
          <div class="rounded-lg bg-white/5 p-3">
            <span class="text-xs font-black text-slate-500">最高盃數</span>
            <strong class="font-score mt-1 block text-lg text-white">{{ playerProfile.highestTrophies.toLocaleString() }}</strong>
          </div>
          <div class="rounded-lg bg-white/5 p-3">
            <span class="text-xs font-black text-slate-500">3v3 勝場</span>
            <strong class="font-score mt-1 block text-lg text-[#00e676]">{{ playerProfile['3vs3Victories'].toLocaleString() }}</strong>
          </div>
        </div>

        <div v-if="playerProfile" class="mt-5 grid grid-cols-[1fr_1fr] gap-4 max-lg:grid-cols-1">
          <div class="rounded-lg border border-white/10 p-3">
            <h3 class="m-0 text-base font-black text-white">近期對戰摘要</h3>
            <div class="mt-3 grid grid-cols-4 gap-2 text-center max-sm:grid-cols-2">
              <span class="rounded-lg bg-white/5 p-2"><b class="font-score block text-white">{{ battleSummary.total }}</b><small class="text-slate-400">場次</small></span>
              <span class="rounded-lg bg-white/5 p-2"><b class="font-score block text-[#00e676]">{{ battleSummary.winRate }}%</b><small class="text-slate-400">勝率</small></span>
              <span class="rounded-lg bg-white/5 p-2"><b class="font-score block text-white">{{ battleSummary.wins }}</b><small class="text-slate-400">勝</small></span>
              <span class="rounded-lg bg-white/5 p-2"><b class="font-score block text-[#ffcc00]">{{ battleSummary.trophyChange }}</b><small class="text-slate-400">盃變動</small></span>
            </div>
          </div>
          <div class="rounded-lg border border-white/10 p-3">
            <h3 class="m-0 text-base font-black text-white">代表角色</h3>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <div v-for="brawler in playerTopBrawlers.slice(0, 4)" :key="brawler.id" class="grid min-h-[62px] grid-cols-[48px_1fr] items-center gap-2 rounded-lg bg-white/5 p-2">
                <img v-if="brawlerImageUrl(brawler)" class="size-12 object-contain" :src="brawlerImageUrl(brawler)" :alt="displayBrawlerName(brawler)" @error="onImageError" />
                <span v-else class="grid size-12 place-items-center rounded-lg bg-[#121824] text-xs font-black text-slate-500">?</span>
                <span class="min-w-0">
                  <strong class="block truncate text-sm text-white">{{ displayBrawlerName(brawler) }}</strong>
                  <small class="text-xs text-slate-400">等級 {{ brawler.power }} · {{ brawler.trophies }} 盃</small>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="battleLog.length > 0" class="mt-5 grid gap-3">
          <h3 class="m-0 text-base font-black text-white">近期對戰歷史</h3>
          <article v-for="battle in battleLog.slice(0, 12)" :key="battle.battleTime" class="grid gap-3 rounded-lg border bg-[#121824] p-3" :class="battleResultClass(battle.battle?.result)">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong class="text-white">{{ displayBattleMode(battle.event?.mode || battle.battle?.mode) }}</strong>
                <span class="ml-2 text-sm text-slate-400">{{ battle.event?.map || 'Unknown Map' }}</span>
              </div>
              <span class="font-score text-sm font-black" :class="battle.battle?.result === 'victory' ? 'text-[#00e676]' : battle.battle?.result === 'defeat' ? 'text-[#ff1744]' : 'text-slate-300'">
                {{ battle.battle?.result || 'rank' }} {{ battle.battle?.trophyChange ? `${battle.battle.trophyChange > 0 ? '+' : ''}${battle.battle.trophyChange}` : '' }}
              </span>
            </div>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
              <RouterLink
                v-for="player in battlePlayers(battle)"
                :key="`${battle.battleTime}-${player.tag || player.name}`"
                :to="playerRoute(player)"
                class="grid min-h-[62px] grid-cols-[42px_1fr] items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs font-black text-white no-underline transition hover:border-[#ffcc00]"
              >
                <img
                  v-if="brawlerImageUrl(player.brawler)"
                  class="size-10 object-contain"
                  :src="brawlerImageUrl(player.brawler)"
                  :alt="player.brawler ? displayBrawlerName(player.brawler) : '未知角色'"
                  @error="onImageError"
                />
                <span v-else class="grid size-10 place-items-center rounded-lg bg-[#121824] text-xs font-black text-slate-500">?</span>
                <span class="min-w-0">
                  <strong class="block truncate text-white">
                    <span v-if="isStarPlayer(battle, player)" class="text-[#ffcc00]">MVP · </span>{{ player.name || '未知玩家' }}
                  </strong>
                  <small class="block truncate text-slate-400">
                    {{ player.brawler ? displayBrawlerName(player.brawler) : '未知角色' }}
                    <span v-if="player.brawler"> · 等級 {{ player.brawler.power }}</span>
                  </small>
                </span>
              </RouterLink>
            </div>
          </article>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <a v-for="link in playerLinks" :key="link.href" :href="link.href" target="_blank" rel="noopener" class="inline-flex min-h-10 items-center rounded-lg bg-[#15161b] px-4 font-black text-white no-underline">
            {{ link.label }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
