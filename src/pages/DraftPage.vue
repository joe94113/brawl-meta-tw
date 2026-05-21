<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'
import { average } from '../data/metaRules'
import type { Brawler, DraftLane } from '../types'

const route = useRoute()
const router = useRouter()
const {
  loadGameData,
  rankedBrawlers,
  brawlers,
  maps,
  selectedMap,
  selectedMapId,
  selectedMode,
  modeOptions,
  roleName,
  modeLabel,
  scoreForMode,
  scoreForMap,
  mapRateRows,
  counterScore,
  counterRecommendations,
  compositionCoverage,
  compositionWarnings,
} = useBrawlData()

const draftLane = ref<DraftLane>('enemy')
const enemyPicks = ref<number[]>([])
const allyPicks = ref<number[]>([])
const bans = ref<number[]>([])

onMounted(async () => {
  await loadGameData()
  const mapId = Number(route.query.map)
  if (mapId) {
    selectedMapId.value = mapId
    if (selectedMap.value) selectedMode.value = selectedMap.value.modeName
  }
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

const visibleMaps = computed(() =>
  maps.value
    .filter((map) => !map.disabled)
    .filter((map) => selectedMode.value === 'All' || map.modeName === selectedMode.value)
    .slice(0, 80),
)

const allyCoverage = computed(() => compositionCoverage(allyRoster.value))
const allyWarnings = computed(() => compositionWarnings(allyRoster.value))
const enemyCounterRows = computed(() =>
  enemyRoster.value
    .flatMap((enemy) =>
      counterRecommendations(enemy, selectedMap.value?.modeName || selectedMode.value)
        .slice(0, 3)
        .map((row) => ({ ...row, target: enemy })),
    )
    .filter((row) => !isDrafted(row.brawler.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5),
)
const mapPowerPicks = computed(() =>
  selectedMap.value
    ? mapRateRows(selectedMap.value, 5)
    : rankedBrawlers.value.slice(0, 5).map((brawler) => ({
        brawler,
        winRate: Math.round((brawler.winRateAdj || brawler.liveScore) * 10) / 10,
      })),
)

function idsToBrawlers(ids: number[]) {
  return ids
    .map((id) => brawlers.value.find((brawler) => brawler.id === id))
    .filter((brawler): brawler is Brawler => Boolean(brawler))
}

function isDrafted(id: number) {
  return allyPicks.value.includes(id) || enemyPicks.value.includes(id) || bans.value.includes(id)
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

function selectDraftMap() {
  if (selectedMap.value) selectedMode.value = selectedMap.value.modeName
}

function draftState(id: number) {
  if (enemyPicks.value.includes(id)) return '敵方'
  if (allyPicks.value.includes(id)) return '我方'
  if (bans.value.includes(id)) return 'Ban'
  return ''
}

function draftScore(candidate: Brawler) {
  const enemyPressure =
    enemyRoster.value.length > 0
      ? average(enemyRoster.value.map((enemy) => counterScore(candidate, enemy, selectedMode.value)))
      : 50
  const allyFit =
    allyRoster.value.length > 0 ? average(allyRoster.value.map((ally) => synergyScore(candidate, ally))) : 50

  const mapScore = selectedMap.value ? scoreForMap(candidate, selectedMap.value) : scoreForMode(candidate, selectedMode.value)

  return mapScore * 0.74 + enemyPressure * 0.62 + allyFit * 0.34
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

  return Math.min(72, Math.max(34, score))
}

function draftReason(candidate: Brawler) {
  if (enemyRoster.value.length > 0) {
    const target = enemyRoster.value
      .map((enemy) => ({ enemy, score: counterScore(candidate, enemy, selectedMode.value) }))
      .sort((a, b) => b.score - a.score)[0]

    return target
      ? `主要壓制 ${target.enemy.localizedName}，同時保有 ${selectedMode.value === 'All' ? '泛用' : selectedMode.value} 強度`
      : '泛用度高，適合補足陣容'
  }

  if (allyRoster.value.length > 0) return `和我方 ${allyRoster.value[0]?.localizedName} 有角色分工互補`
  return `${roleName(candidate.role)}定位穩，適合早選或後手補位`
}

function inspectBrawler(brawler: Brawler) {
  void router.push({ name: 'counter', params: { id: brawler.id } })
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader eyebrow="BrawlPick TW" title="荒野選角指南" note="針對鑽石以上 Ban/Pick 階段，依敵方、我方與 Ban 位即時推薦選角。" />

    <div class="mx-auto mb-5 flex w-[min(1180px,calc(100%_-_48px))] flex-wrap justify-end gap-3 max-sm:w-[calc(100%_-_28px)]">
      <label class="grid gap-1 text-sm font-black text-slate-300">
        模式
        <select v-model="selectedMode" class="min-h-12 min-w-[168px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
          <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ modeLabel(mode) }}</option>
        </select>
      </label>
      <label class="grid gap-1 text-sm font-black text-slate-300">
        地圖
        <select v-model="selectedMapId" class="min-h-12 min-w-[208px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white" @change="selectDraftMap">
          <option :value="null">依模式推薦</option>
          <option v-for="map in visibleMaps" :key="map.id" :value="map.id">{{ map.localizedName }}</option>
        </select>
      </label>
      <button type="button" class="self-end rounded-lg bg-[#ffcc00] px-5 py-3 font-black text-[#121824]" @click="clearDraft">清空</button>
    </div>

    <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <div class="dark-panel rounded-lg p-4">
        <div class="mb-4 flex flex-wrap gap-2">
          <button v-for="lane in ['enemy', 'ally', 'ban']" :key="lane" type="button" class="min-h-10 rounded-lg border px-4 font-bold" :class="draftLane === lane ? 'border-[#f7c948] bg-[#f7c948] text-[#121318]' : 'border-[#15161b] bg-[#15161b] text-white'" @click="draftLane = lane as DraftLane">
            {{ lane === 'enemy' ? '敵方 Pick' : lane === 'ally' ? '我方 Pick' : 'Ban 位' }}
          </button>
        </div>

        <div class="mb-4 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          <div v-for="lane in [
            { title: '敵方', items: enemyRoster },
            { title: '我方', items: allyRoster },
            { title: 'Ban', items: banRoster },
          ]" :key="lane.title" class="min-h-28 rounded-lg border border-white/10 bg-white/5 p-3">
            <h3 class="mb-3 mt-0 text-base font-black text-white">{{ lane.title }}</h3>
            <div class="flex flex-wrap gap-2">
              <button v-for="brawler in lane.items" :key="brawler.id" type="button" class="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 bg-[#121824] px-2 text-xs font-black text-white" @click="removeFromDraft(brawler.id)">
                <img class="size-7 object-contain" :src="brawler.imageUrl" :alt="brawler.localizedName" />
                {{ brawler.localizedName }}
              </button>
              <span v-if="lane.items.length === 0" class="text-sm text-slate-500">尚未選擇</span>
            </div>
          </div>
        </div>

        <section class="mb-4 grid grid-cols-[minmax(0,1fr)_320px] gap-3 max-lg:grid-cols-1">
          <div class="rounded-lg border border-white/10 bg-white/5 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="m-0 text-base font-black text-white">陣容評分器</h3>
              <strong class="font-score text-2xl text-[#ffcc00]">{{ allyCoverage.total }}</strong>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-2">
              <span v-for="row in allyCoverage.rows" :key="row.key" class="rounded-lg bg-[#121824]/80 p-2">
                <small class="block truncate text-xs font-black text-slate-500">{{ row.label }}</small>
                <b class="font-score text-lg" :class="row.value >= 70 ? 'text-[#00e676]' : row.value >= 58 ? 'text-[#ffcc00]' : 'text-[#ff1744]'">{{ row.value }}</b>
              </span>
            </div>
            <p class="mb-0 mt-3 text-sm leading-6 text-slate-400">
              {{ allyWarnings.length ? `補位提醒：${allyWarnings.join('、')}` : '目前我方陣容分工均衡，可以依對位或地圖補強。' }}
            </p>
          </div>

          <div class="rounded-lg border border-white/10 bg-white/5 p-3">
            <h3 class="m-0 text-base font-black text-white">{{ selectedMap ? '本圖強勢角色' : '模式強勢角色' }}</h3>
            <div class="mt-3 grid gap-2">
              <button v-for="row in mapPowerPicks" :key="row.brawler.id" type="button" class="grid min-h-12 grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#121824]/80 p-2 text-left" @click="toggleDraftBrawler(row.brawler)">
                <img class="size-10 object-contain" :src="row.brawler.imageUrl" :alt="row.brawler.localizedName" @error="onImageError" />
                <span class="min-w-0">
                  <strong class="block truncate text-sm text-white">{{ row.brawler.localizedName }}</strong>
                  <small class="text-slate-500">{{ roleName(row.brawler.role) }}</small>
                </span>
                <b class="font-score text-[#00e676]">{{ row.winRate }}%</b>
              </button>
              <p v-if="mapPowerPicks.length === 0" class="m-0 text-sm text-slate-500">選擇地圖後會顯示本圖強勢角色。</p>
            </div>
          </div>
        </section>

        <div class="grid max-h-[580px] grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-2 overflow-auto pr-1">
          <button
            v-for="brawler in rankedBrawlers"
            :key="brawler.id"
            type="button"
            class="relative grid min-h-[98px] content-start justify-items-center overflow-hidden rounded-lg border bg-[#1d2330] px-2 py-2 text-white transition hover:border-[#ffcc00]"
            :class="isDrafted(brawler.id) ? 'border-[#ffcc00] bg-[#2a2a20]' : 'border-white/10'"
            @click="toggleDraftBrawler(brawler)"
            @dblclick="inspectBrawler(brawler)"
          >
            <img class="size-14 object-contain" :src="brawler.imageUrl" :alt="brawler.localizedName" @error="onImageError" />
            <span class="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-black">{{ brawler.localizedName }}</span>
            <small v-if="draftState(brawler.id)" class="absolute right-1 top-1 rounded-md bg-[#15161b] px-1.5 py-1 text-[0.65rem] font-black text-white">{{ draftState(brawler.id) }}</small>
          </button>
        </div>
      </div>

      <aside class="dark-panel sticky top-24 grid gap-3 self-start rounded-lg p-4 max-lg:static">
        <h3 class="m-0 text-base font-black text-white">這場建議 Pick</h3>
        <article v-for="item in draftRecommendations" :key="item.brawler.id" class="grid min-h-[72px] grid-cols-[52px_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <img class="size-[52px] object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" />
          <div>
            <strong class="block">{{ item.brawler.localizedName }}</strong>
                <span class="mt-1 block text-xs leading-5 text-slate-400">{{ item.reason }}</span>
              </div>
          <b class="font-score text-[#00e676]">{{ Math.round(item.score) }}</b>
        </article>

        <h3 class="mb-0 mt-2 text-base font-black text-white">優先 Ban</h3>
        <article v-for="item in banRecommendations" :key="item.brawler.id" class="grid min-h-[72px] grid-cols-[52px_1fr_auto] items-center gap-3 rounded-lg border border-[#ff1744]/25 bg-[#ff1744]/8 p-2.5">
          <img class="size-[52px] object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" />
          <div>
            <strong class="block">{{ item.brawler.localizedName }}</strong>
                <span class="mt-1 block text-xs leading-5 text-slate-400">{{ item.reason }}</span>
              </div>
          <b class="font-score text-[#ff1744]">{{ Math.round(item.score) }}</b>
        </article>

        <h3 class="mb-0 mt-2 text-base font-black text-white">敵方 Counter 補位</h3>
        <article v-for="item in enemyCounterRows" :key="`${item.target.id}-${item.brawler.id}`" class="grid min-h-[72px] grid-cols-[52px_1fr_auto] items-center gap-3 rounded-lg border border-[#00e676]/25 bg-[#00e676]/8 p-2.5">
          <img class="size-[52px] object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" />
          <div>
            <strong class="block">{{ item.brawler.localizedName }}</strong>
            <span class="mt-1 block text-xs leading-5 text-slate-400">用來處理 {{ item.target.localizedName }}</span>
          </div>
          <b class="font-score text-[#00e676]">{{ Math.round(item.score) }}</b>
        </article>
      </aside>
    </div>
  </section>
</template>
