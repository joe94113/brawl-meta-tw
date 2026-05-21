<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MetaSourceNote from '../components/MetaSourceNote.vue'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'

const route = useRoute()
const router = useRouter()
const {
  loadGameData,
  maps,
  selectedMap,
  selectedMapId,
  selectedMode,
  modeOptions,
  roleName,
  modeLabel,
  mapRateRows,
  metaSnapshot,
  metaError,
  liveMetaCount,
} = useBrawlData()

const mapSearch = ref(String(route.query.q || ''))

onMounted(loadGameData)

watch(
  () => route.query.q,
  (query) => {
    mapSearch.value = String(query || '')
  },
)

const visibleMaps = computed(() => {
  const query = mapSearch.value.trim().toLowerCase()

  return maps.value
    .filter((map) => !map.disabled)
    .filter((map) => selectedMode.value === 'All' || map.modeName === selectedMode.value)
    .filter(
      (map) =>
        !query ||
        map.name.toLowerCase().includes(query) ||
        map.localizedName.toLowerCase().includes(query) ||
        map.localizedEnvironmentName.toLowerCase().includes(query),
    )
    .slice(0, 80)
})

const rows = computed(() => mapRateRows())

function selectMapId() {
  const map = selectedMap.value
  if (map) selectedMode.value = map.modeName
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
    <PageHeader
      eyebrow="Map win rates"
      title="地圖英雄勝率"
      note="目前以真實全服調整勝率為底，再依模式定位與地形關鍵字修正。"
    />

    <div class="mx-auto mb-5 grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[1fr_auto] gap-4 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <MetaSourceNote :snapshot="metaSnapshot" :live-count="liveMetaCount" :error="metaError" />
      <div class="flex flex-wrap justify-end gap-3 max-lg:justify-start">
        <label class="grid gap-1 text-sm font-black text-slate-300">
          模式
          <select v-model="selectedMode" class="min-h-12 min-w-[208px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
            <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ modeLabel(mode) }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm font-black text-slate-300">
          地圖
          <select v-model="selectedMapId" class="min-h-12 min-w-[208px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white" @change="selectMapId">
            <option :value="null">依模式總覽</option>
            <option v-for="map in visibleMaps" :key="map.id" :value="map.id">{{ map.localizedName }}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[320px_1fr] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <aside class="dark-panel rounded-lg p-4">
        <img v-if="selectedMap" class="aspect-square w-full rounded-lg bg-slate-100 object-cover" :src="selectedMap.imageUrl" :alt="selectedMap.localizedName" />
        <div v-else class="grid aspect-square w-full place-items-center rounded-lg bg-[#15161b] p-5 text-center text-white">
          選一張地圖查看模式權重
        </div>
        <h2 class="mb-1 mt-4 text-2xl font-black text-white">{{ selectedMap?.localizedName || modeLabel(selectedMode) }}</h2>
        <p class="m-0 leading-7 text-slate-300">
          {{ selectedMap ? `${modeLabel(selectedMap.modeName)} · ${selectedMap.localizedEnvironmentName}` : '目前為模式總覽' }}
        </p>
        <p class="mt-3 rounded-lg bg-white/5 p-3 text-sm leading-6 text-slate-300">
          表格會標示真實來源與推估來源；地圖專屬細分資料等找到穩定公開端點後可直接替換。
        </p>
      </aside>

      <div class="dark-panel overflow-hidden rounded-lg">
        <div class="grid grid-cols-[64px_1fr_92px_92px_92px] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-slate-400 max-sm:grid-cols-[48px_1fr_72px]">
          <span>#</span>
          <span>角色</span>
          <span class="max-sm:hidden">來源</span>
          <span>勝率</span>
          <span class="max-sm:hidden">使用率</span>
        </div>
        <button
          v-for="(row, index) in rows"
          :key="row.brawler.id"
          type="button"
          class="grid w-full grid-cols-[64px_1fr_92px_92px_92px] items-center gap-3 border-b border-white/5 px-4 py-3 text-left text-white transition hover:bg-white/5 max-sm:grid-cols-[48px_1fr_72px]"
          @click="inspectBrawler(row.brawler.id)"
        >
          <span class="font-black text-slate-500">#{{ index + 1 }}</span>
          <span class="flex min-w-0 items-center gap-3">
            <img class="size-12 object-contain" :src="row.brawler.imageUrl" :alt="row.brawler.localizedName" @error="onImageError" />
            <span class="min-w-0">
              <strong class="block truncate">{{ row.brawler.localizedName }}</strong>
              <small class="text-slate-500">{{ roleName(row.brawler.role) }} · {{ row.brawler.rarityName }}</small>
            </span>
          </span>
          <span class="font-black max-sm:hidden">{{ row.dataSource === 'live' ? '真實' : '推估' }}</span>
          <span class="font-score font-black text-[#00e676]">{{ row.winRate }}%</span>
          <span class="font-black max-sm:hidden">{{ row.pickRate }}%</span>
        </button>
      </div>
    </div>
  </section>
</template>
