<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Search, Trophy } from '@lucide/vue'
import MetaSourceNote from '../components/MetaSourceNote.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
import { useBrawlData } from '../composables/useBrawlData'
import { formatPercent } from '../utils/format'

const router = useRouter()
const {
  loading,
  loadGameData,
  heroBrawlers,
  metaLeaders,
  brawlerCount,
  activeMapCount,
  modeCount,
  metaSnapshot,
  metaError,
  liveMetaCount,
  activeEvents,
  rankedBrawlers,
  maps,
  scoreForMode,
  modeSlugLabel,
  modeNameFromSlug,
  rarityLabel,
} = useBrawlData()

const playerTag = ref('')
const quickSearch = ref('')

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
  activeEvents.value.slice(0, 6).map((event) => {
    const modeName = modeNameFromSlug(event.mode)
    const map = maps.value.find((item) => String(item.id) === event.id || item.name === event.map)
    const picks = rankedBrawlers.value
      .slice()
      .sort((a, b) => scoreForMode(b, modeName) - scoreForMode(a, modeName))
      .slice(0, 3)

    return {
      ...event,
      mapLabel: map?.localizedName || event.map,
      modeLabel: modeSlugLabel(event.mode),
      picks,
    }
  }),
)

onMounted(loadGameData)

function runPlayerSearch() {
  const tag = playerTag.value.replace('#', '').trim()
  if (!tag) return
  void router.push({ name: 'player', query: { tag: `#${tag}` } })
}

function runQuickSearch(kind: 'brawler' | 'map') {
  const query = quickSearch.value.trim()
  if (!query) return
  void router.push(kind === 'map' ? { name: 'maprates', query: { q: query } } : { name: 'meta', query: { q: query } })
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
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
      <p class="mt-6 max-w-[620px] text-[1.08rem] leading-8 text-slate-200 max-sm:text-base">
        以真實天梯勝率、角色配件能力之星、地圖模式與對位模型，整理給台灣玩家的荒野亂鬥選角工具。
      </p>

      <div class="dark-panel mt-9 w-[min(760px,100%)] rounded-lg p-4 accent-ring">
        <form class="grid grid-cols-[auto_1fr_auto] items-center gap-3 max-sm:grid-cols-1" role="search" @submit.prevent="runPlayerSearch">
          <span class="grid size-12 place-items-center rounded-lg bg-[#ffcc00] text-[#121824] max-sm:hidden">
            <Search class="size-6" />
          </span>
          <label class="relative block">
            <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-500">#</span>
            <input v-model="playerTag" class="min-h-14 w-full rounded-lg border border-white/10 bg-[#121824] px-4 pl-10 text-lg font-black text-white outline-none ring-[#ffcc00]/30 focus:ring-4" placeholder="輸入玩家 Tag" />
          </label>
          <button type="submit" class="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#ffcc00] px-6 font-black text-[#121824]">
            <Trophy class="size-5" />
            查戰績
          </button>
        </form>
        <div class="mt-3 grid grid-cols-[1fr_auto_auto] gap-2 max-sm:grid-cols-1">
          <input v-model="quickSearch" class="min-h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#8a2be2]" placeholder="快搜英雄或地圖" />
          <button type="button" class="rounded-lg border border-white/15 px-4 text-sm font-black text-white" @click="runQuickSearch('brawler')">英雄</button>
          <button type="button" class="rounded-lg border border-white/15 px-4 text-sm font-black text-white" @click="runQuickSearch('map')">地圖</button>
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
      <RouterLink v-for="(entry, index) in metaLeaders" :key="entry.id" :to="`/counter/${entry.id}`" class="dark-panel relative grid min-h-[260px] content-end gap-3 overflow-hidden rounded-lg p-4 text-white no-underline hover:border-[#ffcc00]">
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
      <article v-for="event in activeMapCards" :key="`${event.id}-${event.powerplay}`" class="dark-panel grid gap-3 rounded-lg p-4">
        <div>
          <span class="text-xs font-black text-[#ffcc00]">{{ event.modeLabel }}</span>
          <h3 class="mb-0 mt-1 text-xl font-black text-white">{{ event.mapLabel }}</h3>
        </div>
        <div class="flex gap-2">
          <RouterLink v-for="brawler in event.picks" :key="brawler.id" :to="`/counter/${brawler.id}`" class="grid size-14 place-items-center rounded-lg bg-[#121824] ring-1 ring-white/10">
            <img class="size-12 object-contain" :src="brawler.imageUrl" :alt="brawler.localizedName" @error="onImageError" />
          </RouterLink>
        </div>
      </article>
    </div>
  </section>
</template>
