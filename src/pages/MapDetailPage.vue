<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'
import { tiers } from '../data/metaRules'
import type { Brawler } from '../types'

const route = useRoute()
const router = useRouter()
const {
  loadGameData,
  maps,
  rankedBrawlers,
  selectedMapId,
  selectedMode,
  selectedMap,
  mapRateRows,
  topTeams,
  findBrawlerByKey,
  counterRecommendations,
  confidenceForBrawler,
  compositionCoverage,
  compositionWarnings,
  roleName,
  modeLabel,
} = useBrawlData()

const counterTargetId = ref<number | null>(null)

onMounted(async () => {
  await loadGameData()
  syncRouteMap()
  selectDefaultCounterTarget()
})

watch(
  () => route.params.id,
  () => syncRouteMap(),
)

watch(rankedBrawlers, (items) => {
  if (!counterTargetId.value && items.length > 0) selectDefaultCounterTarget()
})

const rows = computed(() => mapRateRows())
const mapTierGroups = computed(() =>
  tiers.map((tier, index) => ({
    tier,
    list: rows.value.slice(index * 6, index * 6 + 6),
  })),
)
const topBans = computed(() => rows.value.slice(0, 5))
const topRole = computed(() => {
  const counts = new Map<string, number>()
  for (const row of rows.value.slice(0, 12)) counts.set(row.brawler.role, (counts.get(row.brawler.role) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
})

const avgBattleTime = computed(() => {
  const mode = selectedMap.value?.modeName || selectedMode.value
  if (mode.includes('Brawl')) return '2:05'
  if (mode.includes('Heist')) return '1:45'
  if (mode.includes('Knockout')) return '1:20'
  return '2:10'
})

const compositionRows = computed(() =>
  topTeams.value
    .map((team) => ({
      ...team,
      brawlers: team.brawlerKeys.map((key) => findBrawlerByKey(key)).filter((item): item is Brawler => Boolean(item)),
    }))
    .filter((team) => team.brawlers.length >= 3)
    .slice(0, 4),
)

const counterTarget = computed(() => rankedBrawlers.value.find((brawler) => brawler.id === counterTargetId.value) || null)
const counterRows = computed(() => (counterTarget.value ? counterRecommendations(counterTarget.value, selectedMap.value?.modeName || selectedMode.value).slice(0, 3) : []))
const mapCoverage = computed(() => compositionCoverage(topBans.value.slice(0, 3).map((row) => row.brawler)))
const mapWarnings = computed(() => compositionWarnings(topBans.value.slice(0, 3).map((row) => row.brawler)))
const averageConfidence = computed(() => {
  const scores = topBans.value.map((row) => confidenceForBrawler(row.brawler).score)
  if (scores.length === 0) return '推估'
  const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length
  if (avg >= 2.5) return '高'
  if (avg >= 1.4) return '中'
  return '低'
})

function syncRouteMap() {
  const id = Number(route.params.id)
  const map = maps.value.find((item) => item.id === id)
  if (!map) return
  selectedMapId.value = map.id
  selectedMode.value = map.modeName
}

function selectDefaultCounterTarget() {
  counterTargetId.value = topBans.value[0]?.brawler.id || rankedBrawlers.value[0]?.id || null
}

function inspectBrawler(id: number) {
  void router.push({ name: 'brawler-detail', params: { id } })
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader eyebrow="Map draft helper" :title="selectedMap?.localizedName || '地圖詳情'" note="地圖資訊、Top Bans、常見組合與 Counter 查詢集中在同一頁。" />

    <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[430px_1fr] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <aside class="dark-panel rounded-lg p-4">
        <img v-if="selectedMap" class="aspect-square w-full rounded-lg bg-slate-900 object-cover" :src="selectedMap.imageUrl" :alt="selectedMap.localizedName" @error="onImageError" />
        <div v-else class="grid aspect-square place-items-center rounded-lg bg-white/5">找不到地圖</div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <span class="rounded-lg bg-white/5 p-3">
            <small class="block text-xs font-black text-slate-500">模式</small>
            <b class="inline-flex items-center gap-2 text-white">
              <img v-if="selectedMap?.modeImageUrl" class="size-6 object-contain" :src="selectedMap.modeImageUrl" :alt="modeLabel(selectedMap.modeName)" @error="onImageError" />
              {{ modeLabel(selectedMap?.modeName || selectedMode) }}
            </b>
          </span>
          <span class="rounded-lg bg-white/5 p-3">
            <small class="block text-xs font-black text-slate-500">平均時長</small>
            <b class="font-score text-[#ffcc00]">{{ avgBattleTime }}</b>
          </span>
          <span class="rounded-lg bg-white/5 p-3">
            <small class="block text-xs font-black text-slate-500">熱門定位</small>
            <b class="text-white">{{ roleName(topRole) }}</b>
          </span>
        </div>
        <div class="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <small class="block text-xs font-black text-slate-500">資料可信度</small>
          <b class="mt-1 block text-white">{{ averageConfidence }}</b>
          <p class="mb-0 mt-2 text-sm leading-6 text-slate-400">Top Bans 會同時參考近月勝率、地圖適性與樣本量。</p>
        </div>
        <RouterLink
          :to="{ name: 'draft', query: selectedMap ? { map: selectedMap.id } : {} }"
          class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#ffcc00] px-4 font-black text-[#121824] no-underline"
        >
          用這張圖開選角助手
        </RouterLink>
      </aside>

      <div class="grid gap-5">
        <section class="dark-panel rounded-lg p-4">
          <h2 class="m-0 text-xl font-black text-white">推薦禁用 Top Bans</h2>
          <div class="mt-3 grid grid-cols-5 gap-2 max-md:grid-cols-3 max-sm:grid-cols-2">
            <button v-for="row in topBans" :key="row.brawler.id" type="button" class="grid min-h-[126px] justify-items-center rounded-lg border border-[#ff1744]/25 bg-[#ff1744]/8 p-2 hover:border-[#ff1744]" @click="inspectBrawler(row.brawler.id)">
              <img class="size-16 object-contain" :src="row.brawler.imageUrl" :alt="row.brawler.localizedName" />
              <strong class="mt-1 text-sm text-white">{{ row.brawler.localizedName }}</strong>
              <span class="font-score text-[#00e676]">{{ row.winRate }}%</span>
            </button>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <span v-for="item in mapCoverage.rows.slice(0, 3)" :key="item.key" class="rounded-lg bg-white/5 p-3">
              <small class="block text-xs font-black text-slate-500">{{ item.label }}</small>
              <b class="font-score text-lg text-white">{{ item.value }}</b>
            </span>
          </div>
          <p v-if="mapWarnings.length" class="mb-0 mt-3 rounded-lg border border-[#ff1744]/25 bg-[#ff1744]/8 p-3 text-sm leading-6 text-red-100">
            若前三手都放出來，仍要注意：{{ mapWarnings.join('、') }}。
          </p>
        </section>

        <section class="dark-panel rounded-lg p-4">
          <h2 class="m-0 text-xl font-black text-white">地圖角色分級</h2>
          <div class="mt-3 grid gap-2">
            <article v-for="group in mapTierGroups" :key="group.tier" class="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2">
              <strong class="grid min-h-12 place-items-center rounded-lg bg-[#ffcc00] text-xl font-black text-[#121824]">{{ group.tier }}</strong>
              <div class="flex min-w-0 flex-wrap gap-2">
                <button v-for="row in group.list" :key="row.brawler.id" type="button" class="grid size-14 place-items-center rounded-lg bg-[#121824] ring-1 ring-white/10 hover:ring-[#ffcc00]" @click="inspectBrawler(row.brawler.id)">
                  <img class="size-12 object-contain" :src="row.brawler.imageUrl" :alt="row.brawler.localizedName" @error="onImageError" />
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="dark-panel rounded-lg p-4">
          <h2 class="m-0 text-xl font-black text-white">最佳組合 Top Compositions</h2>
          <div class="mt-3 grid gap-2">
            <article v-for="team in compositionRows" :key="team.brawlerKeys.join('-')" class="grid min-h-[78px] grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div class="flex gap-2">
                <button v-for="brawler in team.brawlers" :key="brawler.id" type="button" class="grid size-14 place-items-center rounded-lg bg-[#121824]" @click="inspectBrawler(brawler.id)">
                  <img class="size-12 object-contain" :src="brawler.imageUrl" :alt="brawler.localizedName" />
                </button>
              </div>
              <b class="font-score text-[#ffcc00]">{{ Math.round(team.wins).toLocaleString() }}</b>
            </article>
          </div>
        </section>

        <section class="dark-panel rounded-lg p-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h2 class="m-0 text-xl font-black text-white">Counter 查詢器</h2>
            <label class="grid gap-1 text-sm font-black text-slate-300">
              對手選了誰？
              <select v-model.number="counterTargetId" class="min-h-11 min-w-[220px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
                <option v-for="brawler in rankedBrawlers" :key="brawler.id" :value="brawler.id">{{ brawler.localizedName }}</option>
              </select>
            </label>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <button v-for="item in counterRows" :key="item.brawler.id" type="button" class="grid min-h-[112px] grid-cols-[64px_1fr] items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 text-left hover:border-[#00e676]" @click="inspectBrawler(item.brawler.id)">
              <img class="size-16 object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" />
              <span>
                <strong class="block text-white">{{ item.brawler.localizedName }}</strong>
                <small class="text-slate-400">{{ item.winRate }}% 對位</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
