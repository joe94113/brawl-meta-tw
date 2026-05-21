<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import { Search, Trophy } from '@lucide/vue'
import MetaSourceNote from '../components/MetaSourceNote.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
import { useBrawlData } from '../composables/useBrawlData'
import { canonicalModeSlug, isHomeActiveModeSlug } from '../data/modeFilters'
import type { MapItem } from '../types'
import { formatPercent } from '../utils/format'

type CommandSuggestion = {
  key: string
  type: '英雄' | '地圖' | '玩家'
  label: string
  note: string
  imageUrl: string
  to: RouteLocationRaw
}

const router = useRouter()
const {
  loading,
  loadGameData,
  brawlers,
  heroBrawlers,
  metaLeaders,
  brawlerCount,
  activeMapCount,
  modeCount,
  metaSnapshot,
  metaError,
  liveMetaCount,
  activeEvents,
  maps,
  gameModes,
  mapRecommendedBrawlers,
  modeLabel,
  modeSlugLabel,
  modeNameFromSlug,
  rarityLabel,
} = useBrawlData()

const commandQuery = ref('')

const todayLabel = new Intl.DateTimeFormat('zh-TW', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date())

const versionLabel = computed(() => {
  const value = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit' }).format(new Date())
  return `${value} 月平衡調整後 Meta`
})

const heroVisualBrawlers = computed(() => heroBrawlers.value.slice(0, 4))

const activeMapCards = computed(() =>
  activeEvents.value.filter((event) => isHomeActiveModeSlug(event.mode)).slice(0, 6).map((event) => {
    const map = maps.value.find((item) => String(item.id) === event.id || normalizeMapName(item.name) === normalizeMapName(event.map))
    const fallbackModeName = modeNameFromSlug(canonicalModeSlug(event.mode))
    const modeName = fallbackModeName || map?.modeName || event.mode
    const gameMode = gameModes.value.find((mode) => mode.name === fallbackModeName || mode.name === map?.modeName)
    const scoringMap = map || fallbackMapForEvent(event.id, event.map, modeName, gameMode?.imageUrl || '')
    const picks = mapRecommendedBrawlers(scoringMap, 3)

    return {
      ...event,
      mapId: map?.id || event.id,
      mapLabel: map?.localizedName || event.map,
      environmentLabel: map?.localizedEnvironmentName || '',
      modeLabel: modeLabel(fallbackModeName) || (map ? modeLabel(map.modeName) : modeSlugLabel(event.mode)),
      modeIconUrl: gameMode?.imageUrl || map?.modeImageUrl || '',
      mapImageUrl: map?.imageUrl || '',
      picks,
    }
  }),
)

onMounted(loadGameData)

const commandSuggestions = computed<CommandSuggestion[]>(() => {
  const query = commandQuery.value.trim()
  if (!query) return []

  const suggestions: CommandSuggestion[] = [
    ...brawlers.value
      .filter((brawler) => commandMatches(query, brawler.localizedName, brawler.name))
      .slice(0, 4)
      .map((brawler) => ({
        key: `brawler-${brawler.id}`,
        type: '英雄' as const,
        label: brawler.localizedName,
        note: `${brawler.name} · ${rarityLabel(brawler.rarityName)}`,
        imageUrl: brawler.imageUrl,
        to: { name: 'brawler-detail', params: { id: brawler.id } },
      })),
    ...maps.value
      .filter((map) => commandMatches(query, map.localizedName, map.name))
      .slice(0, 4)
      .map((map) => ({
        key: `map-${map.id}`,
        type: '地圖' as const,
        label: map.localizedName,
        note: modeLabel(map.modeName),
        imageUrl: map.imageUrl || map.modeImageUrl,
        to: { name: 'map-detail', params: { id: map.id } },
      })),
  ]

  if (looksLikePlayerTag(query)) {
    suggestions.unshift({
      key: `player-${normalizePlayerTag(query)}`,
      type: '玩家' as const,
      label: `#${normalizePlayerTag(query)}`,
      note: '個人戰績',
      imageUrl: '',
      to: { name: 'player', query: { tag: normalizePlayerTag(query) } },
    })
  }

  return suggestions.slice(0, 6)
})

function runCommandSearch() {
  const query = commandQuery.value.trim()
  if (!query) return

  const exactBrawler = brawlers.value.find((brawler) => commandEquals(query, brawler.localizedName, brawler.name))
  if (exactBrawler) {
    void router.push({ name: 'brawler-detail', params: { id: exactBrawler.id } })
    return
  }

  const exactMap = maps.value.find((map) => commandEquals(query, map.localizedName, map.name))
  if (exactMap) {
    void router.push({ name: 'map-detail', params: { id: exactMap.id } })
    return
  }

  const firstSuggestion = commandSuggestions.value.find((suggestion) => suggestion.type !== '玩家')
  if (firstSuggestion && !looksLikePlayerTag(query)) {
    void router.push(firstSuggestion.to)
    return
  }

  if (looksLikePlayerTag(query)) {
    void router.push({ name: 'player', query: { tag: normalizePlayerTag(query) } })
    return
  }

  void router.push({ name: 'meta', query: { q: query } })
}

function goCommandSuggestion(suggestion: (typeof commandSuggestions.value)[number]) {
  void router.push(suggestion.to)
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}

function normalizeMapName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeCommandKey(value: string) {
  return value.toLowerCase().replace(/[#\s_-]+/g, '')
}

function commandMatches(query: string, ...targets: string[]) {
  const key = normalizeCommandKey(query)
  return targets.some((target) => normalizeCommandKey(target).includes(key))
}

function commandEquals(query: string, ...targets: string[]) {
  const key = normalizeCommandKey(query)
  return targets.some((target) => normalizeCommandKey(target) === key)
}

function normalizePlayerTag(value: string) {
  return value.replace('#', '').replace(/\s+/g, '').toUpperCase()
}

function looksLikePlayerTag(value: string) {
  const tag = normalizePlayerTag(value)
  return value.trim().startsWith('#') || (/^[A-Z0-9]{3,}$/.test(tag) && /\d/.test(tag))
}

function fallbackMapForEvent(id: string, name: string, modeName: string, modeImageUrl: string): MapItem {
  return {
    id: Number(id) || 0,
    name,
    localizedName: name,
    disabled: false,
    link: '',
    imageUrl: '',
    environmentName: name,
    localizedEnvironmentName: '',
    modeName,
    modeColor: '#8a2be2',
    modeImageUrl,
  }
}
</script>

<template>
  <section class="hero-texture relative grid min-h-[650px] items-center overflow-hidden text-white max-lg:min-h-[720px] max-sm:min-h-[760px]">
    <div class="pointer-events-none absolute -right-28 bottom-[-54px] flex w-[48%] min-w-[520px] items-end justify-end drop-shadow-2xl max-lg:-right-44 max-lg:min-w-[620px] max-lg:opacity-45">
      <img
        v-for="(brawler, index) in heroVisualBrawlers"
        :key="brawler.id"
        :src="brawler.portraitUrl"
        :alt="brawler.localizedName"
        class="-ml-8 w-[30%] min-w-[132px] max-w-[190px] object-contain"
        :class="{ '-translate-y-8': index % 2 === 1, 'translate-y-4': index % 3 === 0 }"
        @error="onImageError"
      />
    </div>

    <div class="relative z-10 mx-auto w-[min(1180px,calc(100%_-_48px))] py-20 max-sm:w-[calc(100%_-_28px)]">
      <p class="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#ffcc00]">Brawl Stars draft intelligence · Taiwan edition</p>
      <h1 class="m-0 max-w-[760px] text-[4.6rem] font-black leading-[0.98] max-lg:text-[3.2rem] max-sm:text-[2.5rem]">
        荒野報馬仔
      </h1>

      <div class="dark-panel mt-8 w-[min(760px,100%)] rounded-lg p-4 accent-ring">
        <form class="grid grid-cols-[auto_1fr_auto] items-center gap-3 max-sm:grid-cols-1" role="search" @submit.prevent="runCommandSearch">
          <span class="grid size-12 place-items-center rounded-lg bg-[#ffcc00] text-[#121824] max-sm:hidden">
            <Search class="size-6" />
          </span>
          <label class="relative block">
            <input v-model="commandQuery" class="min-h-14 w-full rounded-lg border border-white/10 bg-[#121824] px-4 text-lg font-black text-white outline-none ring-[#ffcc00]/30 focus:ring-4" placeholder="搜尋英雄、地圖或玩家 Tag" />
          </label>
          <button type="submit" class="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#ffcc00] px-6 font-black text-[#121824]">
            <Trophy class="size-5" />
            搜尋
          </button>
        </form>
        <div v-if="commandSuggestions.length > 0" class="mt-3 grid gap-2">
          <button
            v-for="suggestion in commandSuggestions"
            :key="suggestion.key"
            type="button"
            class="grid min-h-[58px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition hover:border-[#ffcc00]"
            @click="goCommandSuggestion(suggestion)"
          >
            <span class="grid size-11 place-items-center overflow-hidden rounded-lg bg-[#121824]">
              <img v-if="suggestion.imageUrl" class="size-full object-cover" :src="suggestion.imageUrl" :alt="suggestion.label" @error="onImageError" />
              <Search v-else class="size-5 text-[#ffcc00]" />
            </span>
            <span class="min-w-0">
              <strong class="block truncate text-sm text-white">{{ suggestion.label }}</strong>
              <small class="block truncate text-xs font-black text-slate-500">{{ suggestion.note }}</small>
            </span>
            <span class="rounded-lg bg-[#121824] px-2 py-1 text-[0.68rem] font-black text-[#ffcc00]">{{ suggestion.type }}</span>
          </button>
        </div>
      </div>

      <div class="mt-7 flex flex-wrap gap-3">
        <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ brawlerCount }}</strong> 角色</span>
        <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ activeMapCount }}</strong> 可用地圖</span>
        <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ modeCount }}</strong> 模式</span>
        <span class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-slate-200"><strong class="text-white">{{ todayLabel }}</strong> 讀取</span>
      </div>
    </div>
  </section>

  <section class="bg-[#121824] py-[72px]">
    <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
      <div>
        <p class="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#ffcc00]">Meta bulletin</p>
        <h2 class="m-0 text-[2.3rem] font-black leading-tight text-white">荒野 meta 報馬仔</h2>
        <p class="mt-2 text-slate-400">當前版本：{{ versionLabel }}</p>
      </div>
      <RouterLink to="/meta" class="inline-flex min-h-11 items-center rounded-lg bg-[#ffcc00] px-5 font-black text-[#121824] no-underline">
        查看完整 Meta 榜
      </RouterLink>
    </div>

    <div class="mx-auto mb-4 w-[min(1180px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_28px)]">
      <MetaSourceNote :snapshot="metaSnapshot" :live-count="liveMetaCount" :error="metaError" />
    </div>

    <div v-if="loading" class="mx-auto w-[min(1180px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_28px)]">
      <SkeletonBlock :rows="5" />
    </div>
    <div v-else class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-5 gap-4 max-lg:grid-cols-2 max-sm:w-[calc(100%_-_28px)] max-sm:grid-cols-1">
      <RouterLink v-for="(entry, index) in metaLeaders" :key="entry.id" :to="`/brawlers/${entry.id}`" class="dark-panel relative grid min-h-[260px] content-end gap-3 overflow-hidden rounded-lg p-4 text-white no-underline hover:border-[#ffcc00]">
        <span class="absolute left-4 top-4 text-xl font-black">#{{ index + 1 }}</span>
        <img class="absolute right-[-18px] top-5 size-[150px] object-contain" :src="entry.imageUrl" :alt="entry.localizedName" @error="onImageError" />
        <div>
          <h3 class="m-0 text-xl font-black">{{ entry.localizedName }}</h3>
          <p class="mt-1 text-sm text-slate-400">{{ entry.name }} · {{ rarityLabel(entry.rarityName) }}</p>
        </div>
        <strong class="font-score text-3xl font-black text-[#00e676]">{{ formatPercent(entry.winRateAdj) }}</strong>
      </RouterLink>
    </div>
  </section>

  <section class="bg-[#1d2330] py-[72px]">
    <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
      <div>
        <p class="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#8a2be2]">Active maps</p>
        <h2 class="m-0 text-[2.3rem] font-black leading-tight text-white">當日焦點地圖</h2>
      </div>
      <RouterLink to="/maps" class="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-5 font-black text-white no-underline">查看地圖資料</RouterLink>
    </div>

    <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:w-[calc(100%_-_28px)] max-sm:grid-cols-1">
      <article v-for="event in activeMapCards" :key="`${event.id}-${event.powerplay}`" class="dark-panel overflow-hidden rounded-lg p-0">
        <div class="relative aspect-[16/9] overflow-hidden bg-[#121824]">
          <img v-if="event.mapImageUrl" class="size-full object-cover" :src="event.mapImageUrl" :alt="event.mapLabel" @error="onImageError" />
          <div v-else class="size-full bg-[linear-gradient(135deg,#121824,#263143)]" />
          <div class="absolute inset-0 bg-gradient-to-t from-[#121824] via-[#121824]/35 to-transparent" />
          <img
            v-if="event.modeIconUrl"
            class="absolute left-3 top-3 size-11 rounded-lg bg-[#121824]/80 p-1.5 ring-1 ring-white/15"
            :src="event.modeIconUrl"
            :alt="event.modeLabel"
            @error="onImageError"
          />
          <div class="absolute inset-x-4 bottom-4">
            <span class="inline-flex min-h-7 items-center rounded-lg bg-[#ffcc00] px-2 text-xs font-black text-[#121824]">{{ event.modeLabel }}</span>
            <h3 class="mb-0 mt-2 text-xl font-black text-white">{{ event.mapLabel }}</h3>
            <p v-if="event.environmentLabel" class="mb-0 mt-1 truncate text-xs font-black text-slate-300">{{ event.environmentLabel }}</p>
          </div>
        </div>
        <div class="grid gap-2 p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-black text-slate-400">此圖推薦</span>
            <RouterLink :to="`/maps/${event.mapId}`" class="text-xs font-black text-[#ffcc00] no-underline">地圖詳情</RouterLink>
          </div>
          <div class="flex gap-2">
            <RouterLink v-for="pick in event.picks" :key="pick.brawler.id" :to="`/brawlers/${pick.brawler.id}`" class="relative grid size-16 place-items-center rounded-lg bg-[#121824] ring-1 ring-white/10">
              <img class="size-12 object-contain" :src="pick.brawler.imageUrl" :alt="pick.brawler.localizedName" @error="onImageError" />
              <span class="absolute bottom-1 right-1 rounded bg-[#00e676] px-1 font-score text-[10px] font-black text-[#121824]">{{ Math.round(pick.winRate) }}</span>
            </RouterLink>
          </div>
          <p class="m-0 text-xs leading-5 text-slate-500">依模式定位、地圖環境與近 30 天勝率重新排序。</p>
        </div>
      </article>
    </div>
  </section>
</template>
