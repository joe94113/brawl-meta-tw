<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'

const router = useRouter()
const { loadGameData, maps, selectedMode, selectedMapId, modeOptions, modeLabel } = useBrawlData()
const mapSearch = ref('')

onMounted(loadGameData)

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

function selectMap(id: number) {
  selectedMapId.value = id
  void router.push({ name: 'map-detail', params: { id } })
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader eyebrow="Map data" title="地圖與模式資料" note="用 Brawlify game-data 顯示目前可用地圖、模式與環境圖資。" />

    <div class="mx-auto mb-5 flex w-[min(1180px,calc(100%_-_48px))] flex-wrap justify-end gap-3 max-sm:w-[calc(100%_-_28px)]">
      <label class="grid gap-1 text-sm font-black text-slate-300">
        模式
        <select v-model="selectedMode" class="min-h-12 min-w-[208px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
          <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ modeLabel(mode) }}</option>
        </select>
      </label>
      <label class="grid gap-1 text-sm font-black text-slate-300">
        地圖搜尋
        <input v-model="mapSearch" class="min-h-12 min-w-[208px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white" placeholder="堅石礦井" />
      </label>
    </div>

    <div class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 max-sm:w-[calc(100%_-_28px)]">
      <button v-for="map in visibleMaps" :key="map.id" type="button" class="dark-panel grid min-h-[254px] gap-2 rounded-lg p-2.5 text-left transition hover:-translate-y-0.5 hover:border-[#ffcc00]" @click="selectMap(map.id)">
        <img class="aspect-square w-full rounded-lg bg-slate-100 object-cover" :src="map.imageUrl" :alt="map.localizedName" @error="onImageError" />
        <span class="text-xs font-black" :style="{ color: map.modeColor }">{{ modeLabel(map.modeName) }}</span>
        <strong class="text-white">{{ map.localizedName }}</strong>
        <small class="text-slate-500">{{ map.name }} · {{ map.localizedEnvironmentName }}</small>
      </button>
    </div>
  </section>
</template>
