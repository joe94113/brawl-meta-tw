<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowUpRight, BarChart3, Crosshair, ShieldAlert } from '@lucide/vue'
import AbilityGrid from '../components/AbilityGrid.vue'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'
import type { Brawler } from '../types'
import { formatCompact, formatPercent } from '../utils/format'

const route = useRoute()
const router = useRouter()
const {
  loadGameData,
  rankedBrawlers,
  selectedMode,
  modeOptions,
  modeLabel,
  roleName,
  rarityLabel,
  findBrawlerById,
  findBrawlerByKey,
  metaStatFor,
  confidenceForBrawler,
  trendForBrawler,
  modeRowsForBrawler,
  mapRowsForBrawler,
  counterRecommendations,
  strongAgainst,
  compositionCoverage,
  topTeams,
} = useBrawlData()

type BrawlerDetailTab = 'overview' | 'abilities' | 'maps' | 'counter' | 'comps'

const selectedId = ref(Number(route.params.id) || null)
const activeTab = ref<BrawlerDetailTab>('overview')
const detailTabs: Array<{ id: BrawlerDetailTab; label: string }> = [
  { id: 'overview', label: '總覽' },
  { id: 'abilities', label: '配件/能力之星' },
  { id: 'maps', label: '地圖' },
  { id: 'counter', label: 'Counter' },
  { id: 'comps', label: '搭配' },
]

const tagLabels: Record<string, string> = {
  healing: '治療',
  control: '控場',
  mobility: '機動',
  space: '區域壓制',
  range: '遠程',
  durable: '耐打',
}

onMounted(loadGameData)

watch(
  () => route.params.id,
  (id) => {
    selectedId.value = Number(id) || null
    activeTab.value = 'overview'
  },
)

watch(rankedBrawlers, (items) => {
  if (!selectedId.value && items.length > 0) selectedId.value = items[0]?.id || null
})

const selectedBrawler = computed(() => findBrawlerById(selectedId.value) || rankedBrawlers.value[0] || null)
const selectedRanked = computed(() => rankedBrawlers.value.find((brawler) => brawler.id === selectedBrawler.value?.id))
const stat = computed(() => (selectedBrawler.value ? metaStatFor(selectedBrawler.value) : null))
const confidence = computed(() => (selectedBrawler.value ? confidenceForBrawler(selectedBrawler.value) : null))
const trend = computed(() => (selectedBrawler.value ? trendForBrawler(selectedBrawler.value) : null))
const modeRows = computed(() => (selectedBrawler.value ? modeRowsForBrawler(selectedBrawler.value, 10) : []))
const bestModes = computed(() => modeRows.value.slice(0, 4))
const weakModes = computed(() => [...modeRows.value].reverse().slice(0, 3))
const topMaps = computed(() => (selectedBrawler.value ? mapRowsForBrawler(selectedBrawler.value, 8) : []))
const counterRows = computed(() => (selectedBrawler.value ? counterRecommendations(selectedBrawler.value, selectedMode.value).slice(0, 5) : []))
const preyRows = computed(() => (selectedBrawler.value ? strongAgainst(selectedBrawler.value, selectedMode.value).slice(0, 5) : []))

const compositionRows = computed(() => {
  if (!selectedBrawler.value) return []

  const withLiveTeams = topTeams.value
    .filter((team) => team.brawlerKeys.includes(selectedBrawler.value!.statKey))
    .map((team) => ({
      key: team.brawlerKeys.join('-'),
      wins: team.wins,
      source: '真實組合',
      brawlers: team.brawlerKeys.map((key) => findBrawlerByKey(key)).filter((item): item is Brawler => Boolean(item)),
    }))
    .filter((team) => team.brawlers.length >= 2)
    .slice(0, 3)

  if (withLiveTeams.length > 0) return withLiveTeams

  return rankedBrawlers.value
    .filter((brawler) => brawler.id !== selectedBrawler.value!.id)
    .slice(0, 18)
    .map((mate) => {
      const brawlers = [selectedBrawler.value!, mate]
      const coverage = compositionCoverage(brawlers)
      return {
        key: `${selectedBrawler.value!.id}-${mate.id}`,
        wins: coverage.total,
        source: '補位建議',
        brawlers,
      }
    })
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 3)
})

function openCounter() {
  if (!selectedBrawler.value) return
  void router.push({ name: 'counter', params: { id: selectedBrawler.value.id } })
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader
      eyebrow="Brawler detail"
      :title="selectedBrawler ? `${selectedBrawler.localizedName} 角色詳情` : '角色詳情'"
      note="集中查看角色勝率、趨勢、樣本可信度、最佳模式地圖、配件能力之星與對位關係。"
    />

    <div v-if="selectedBrawler" class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[360px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <aside class="dark-panel sticky top-24 self-start rounded-lg p-5 max-lg:static">
        <img class="mx-auto size-[220px] object-contain" :src="selectedBrawler.imageUrl" :alt="selectedBrawler.localizedName" @error="onImageError" />
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <span class="inline-flex min-h-7 items-center rounded-lg bg-[#ffcc00] px-3 text-xs font-black text-[#121824]">{{ selectedRanked?.liveTier || selectedBrawler.tier }} Tier</span>
          <span class="inline-flex min-h-7 items-center rounded-lg bg-[#8a2be2]/25 px-3 text-xs font-black text-[#d8b4fe]">{{ roleName(selectedBrawler.role) }}</span>
        </div>
        <h2 class="mb-1 mt-3 text-3xl font-black text-white">{{ selectedBrawler.localizedName }}</h2>
        <p class="m-0 text-slate-400">{{ selectedBrawler.name }} · {{ rarityLabel(selectedBrawler.rarityName) }}</p>
        <p class="mt-4 leading-7 text-slate-300">{{ selectedBrawler.localizedDescription }}</p>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <span class="rounded-lg bg-white/5 p-3">
            <small class="block text-xs font-black text-slate-500">近月勝率</small>
            <b class="font-score text-xl text-[#00e676]">{{ formatPercent(selectedRanked?.winRateAdj) }}</b>
          </span>
          <span class="rounded-lg bg-white/5 p-3">
            <small class="block text-xs font-black text-slate-500">使用率</small>
            <b class="font-score text-xl text-white">{{ formatPercent(selectedRanked?.useRate) }}</b>
          </span>
          <span class="rounded-lg bg-white/5 p-3">
            <small class="block text-xs font-black text-slate-500">趨勢</small>
            <b class="font-score text-xl" :class="trend?.tone">{{ trend ? `${trend.delta > 0 ? '+' : ''}${trend.delta}%` : 'N/A' }}</b>
          </span>
          <span class="rounded-lg bg-white/5 p-3">
            <small class="block text-xs font-black text-slate-500">可信度</small>
            <b class="text-xl" :class="confidence?.tone">{{ confidence?.label }}</b>
          </span>
        </div>

        <div class="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-300">
          <strong class="text-white">{{ confidence?.note }}</strong>
          <span v-if="stat?.picksEstimate"> · 樣本 {{ formatCompact(stat.picksEstimate) }} 場</span>
          <span v-else> · 目前以模型補足缺口</span>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <span v-for="tag in selectedBrawler.tags" :key="tag" class="inline-flex min-h-7 items-center rounded-lg bg-white/10 px-3 text-xs font-black text-slate-100">
            {{ tagLabels[tag] || tag }}
          </span>
        </div>

        <button type="button" class="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ffcc00] px-4 font-black text-[#121824]" @click="openCounter">
          <Crosshair class="size-5" />
          查看 Counter 實驗室
        </button>
      </aside>

      <div class="grid gap-5">
        <nav class="dark-panel sticky top-20 z-10 flex gap-2 overflow-x-auto rounded-lg p-2 max-lg:static" aria-label="角色詳情分頁">
          <button
            v-for="tab in detailTabs"
            :key="tab.id"
            type="button"
            class="min-h-10 shrink-0 rounded-lg px-4 text-sm font-black transition"
            :class="activeTab === tab.id ? 'bg-[#ffcc00] text-[#121824]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section v-if="activeTab === 'overview'" class="dark-panel rounded-lg p-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h2 class="m-0 text-xl font-black text-white">模式表現</h2>
            <label class="grid gap-1 text-sm font-black text-slate-300">
              對位模式
              <select v-model="selectedMode" class="min-h-11 min-w-[180px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
                <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ modeLabel(mode) }}</option>
              </select>
            </label>
          </div>
          <div class="mt-3 grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <article v-for="row in bestModes" :key="row.mode" class="rounded-lg border border-[#00e676]/20 bg-[#00e676]/8 p-3">
              <small class="block text-xs font-black text-slate-400">{{ modeLabel(row.mode) }}</small>
              <b class="font-score mt-1 block text-2xl text-[#00e676]">{{ row.winRate }}%</b>
              <span class="text-xs text-slate-500">適性 +{{ row.fit }}</span>
            </article>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <article v-for="row in weakModes" :key="row.mode" class="rounded-lg border border-white/10 bg-white/5 p-3">
              <small class="block text-xs font-black text-slate-500">較不建議</small>
              <b class="mt-1 block text-white">{{ modeLabel(row.mode) }}</b>
              <span class="font-score text-sm text-slate-400">{{ row.winRate }}%</span>
            </article>
          </div>
        </section>

        <section v-if="activeTab === 'abilities'" class="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
          <AbilityGrid title="配件勝率" :items="selectedBrawler.gadgets" />
          <AbilityGrid title="能力之星勝率" :items="selectedBrawler.starPowers" />
        </section>

        <section v-if="activeTab === 'maps'" class="dark-panel rounded-lg p-4">
          <h2 class="m-0 text-xl font-black text-white">最適合地圖</h2>
          <div class="mt-3 grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <RouterLink v-for="row in topMaps" :key="row.map.id" :to="`/maps/${row.map.id}`" class="grid min-h-[118px] grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 text-white no-underline hover:border-[#ffcc00]">
              <img class="size-[72px] rounded-md object-cover" :src="row.map.imageUrl" :alt="row.map.localizedName" @error="onImageError" />
              <span class="min-w-0">
                <strong class="block truncate">{{ row.map.localizedName }}</strong>
                <small class="block truncate text-slate-500">{{ modeLabel(row.map.modeName) }}</small>
                <b class="font-score text-[#00e676]">{{ row.winRate }}%</b>
              </span>
            </RouterLink>
          </div>
        </section>

        <section v-if="activeTab === 'counter'" class="dark-panel rounded-lg p-4">
          <h2 class="m-0 text-xl font-black text-white">對位關係</h2>
          <div class="mt-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
            <div class="grid gap-2">
              <h3 class="m-0 inline-flex items-center gap-2 text-base font-black text-white"><ShieldAlert class="size-5 text-[#ff1744]" /> 被誰克制</h3>
              <RouterLink v-for="item in counterRows" :key="item.brawler.id" :to="`/brawlers/${item.brawler.id}`" class="grid min-h-[74px] grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-white no-underline hover:border-[#ff1744]">
                <img class="size-14 object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" @error="onImageError" />
                <span class="min-w-0">
                  <strong class="block truncate">{{ item.brawler.localizedName }}</strong>
                  <small class="line-clamp-1 text-slate-500">{{ item.reason }}</small>
                </span>
                <b class="font-score text-[#ff1744]">{{ item.winRate }}%</b>
              </RouterLink>
            </div>
            <div class="grid gap-2">
              <h3 class="m-0 inline-flex items-center gap-2 text-base font-black text-white"><BarChart3 class="size-5 text-[#00e676]" /> 可以壓制</h3>
              <RouterLink v-for="item in preyRows" :key="item.brawler.id" :to="`/brawlers/${item.brawler.id}`" class="grid min-h-[74px] grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-white no-underline hover:border-[#00e676]">
                <img class="size-14 object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" @error="onImageError" />
                <span class="min-w-0">
                  <strong class="block truncate">{{ item.brawler.localizedName }}</strong>
                  <small class="text-slate-500">{{ roleName(item.brawler.role) }}</small>
                </span>
                <b class="font-score text-[#00e676]">{{ Math.round(item.score) }}</b>
              </RouterLink>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'comps'" class="dark-panel rounded-lg p-4">
          <h2 class="m-0 text-xl font-black text-white">推薦搭配</h2>
          <div class="mt-3 grid gap-2">
            <article v-for="team in compositionRows" :key="team.key" class="grid min-h-[82px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div class="flex min-w-0 flex-wrap gap-2">
                <RouterLink v-for="brawler in team.brawlers" :key="brawler.id" :to="`/brawlers/${brawler.id}`" class="grid size-14 place-items-center rounded-lg bg-[#121824] ring-1 ring-white/10">
                  <img class="size-12 object-contain" :src="brawler.imageUrl" :alt="brawler.localizedName" @error="onImageError" />
                </RouterLink>
              </div>
              <span class="grid justify-items-end">
                <b class="font-score text-xl text-[#ffcc00]">{{ Math.round(team.wins).toLocaleString() }}</b>
                <small class="inline-flex items-center gap-1 text-xs font-black text-slate-500">{{ team.source }} <ArrowUpRight class="size-3" /></small>
              </span>
            </article>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
