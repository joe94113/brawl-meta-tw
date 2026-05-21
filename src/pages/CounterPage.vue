<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AbilityGrid from '../components/AbilityGrid.vue'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'
import type { Brawler } from '../types'
import { formatPercent } from '../utils/format'

const route = useRoute()
const router = useRouter()
const {
  loadGameData,
  rankedBrawlers,
  selectedMode,
  modeOptions,
  roleName,
  modeLabel,
  rarityLabel,
  findBrawlerById,
  counterRecommendations: makeCounterRecommendations,
  strongAgainst: makeStrongAgainst,
} = useBrawlData()

const selectedId = ref<number | null>(Number(route.params.id) || null)

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
  },
)

watch(rankedBrawlers, (items) => {
  if (!selectedId.value && items.length > 0) selectedId.value = items[0]?.id || null
})

const selectedBrawler = computed(() => findBrawlerById(selectedId.value) || rankedBrawlers.value[0] || null)
const selectedRanked = computed(() => rankedBrawlers.value.find((brawler) => brawler.id === selectedBrawler.value?.id))
const counterRecommendations = computed(() =>
  selectedBrawler.value ? makeCounterRecommendations(selectedBrawler.value, selectedMode.value) : [],
)
const strongAgainst = computed(() =>
  selectedBrawler.value ? makeStrongAgainst(selectedBrawler.value, selectedMode.value) : [],
)

function updateSelected() {
  if (!selectedId.value) return
  void router.replace({ name: 'counter', params: { id: selectedId.value } })
}

function openBrawler(brawler: Brawler) {
  selectedId.value = brawler.id
  void router.push({ name: 'counter', params: { id: brawler.id } })
}

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader eyebrow="Counter lab" title="對戰陣容相剋建議" note="點英雄可看配件、能力之星勝率、推薦 Counter，以及這隻角色比較能壓制誰。" />

    <div class="mx-auto mb-5 flex w-[min(1180px,calc(100%_-_48px))] flex-wrap justify-end gap-3 max-sm:w-[calc(100%_-_28px)]">
      <label class="grid gap-1 text-sm font-black text-slate-300">
        模式
        <select v-model="selectedMode" class="min-h-12 min-w-[180px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
          <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ modeLabel(mode) }}</option>
        </select>
      </label>
      <label class="grid gap-1 text-sm font-black text-slate-300">
        對手角色
        <select v-model.number="selectedId" class="min-h-12 min-w-[220px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white" @change="updateSelected">
          <option v-for="brawler in rankedBrawlers" :key="brawler.id" :value="brawler.id">
            {{ brawler.localizedName }} / {{ brawler.name }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="selectedBrawler" class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[360px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <article class="dark-panel sticky top-24 self-start rounded-lg p-5 max-lg:static">
        <img class="mx-auto mb-3 size-[220px] object-contain" :src="selectedBrawler.imageUrl" :alt="selectedBrawler.localizedName" @error="onImageError" />
        <span class="inline-flex min-h-7 items-center rounded-lg bg-[#ffcc00] px-3 text-xs font-black text-[#121824]">{{ selectedRanked?.liveTier || selectedBrawler.tier }} Tier</span>
        <h2 class="mb-1 mt-3 text-2xl font-black text-white">{{ selectedBrawler.localizedName }}</h2>
        <p class="m-0 text-slate-400">{{ selectedBrawler.name }} · {{ roleName(selectedBrawler.role) }} · {{ rarityLabel(selectedBrawler.rarityName) }}</p>
        <p class="mt-4 leading-7 text-slate-300">{{ selectedBrawler.localizedDescription }}</p>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <span class="rounded-lg bg-white/5 p-2 text-center">
            <small class="block text-xs font-black text-slate-500">調整勝率</small>
            <b class="font-score text-[#00e676]">{{ formatPercent(selectedRanked?.winRateAdj) }}</b>
          </span>
          <span class="rounded-lg bg-white/5 p-2 text-center">
            <small class="block text-xs font-black text-slate-500">使用率</small>
            <b>{{ formatPercent(selectedRanked?.useRate) }}</b>
          </span>
          <span class="rounded-lg bg-white/5 p-2 text-center">
            <small class="block text-xs font-black text-slate-500">定位</small>
            <b>{{ roleName(selectedBrawler.role) }}</b>
          </span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <span v-for="tag in selectedBrawler.tags" :key="tag" class="inline-flex min-h-7 items-center rounded-lg bg-[#8a2be2]/20 px-3 text-xs font-black text-slate-100">
            {{ tagLabels[tag] || tag }}
          </span>
        </div>
        <RouterLink :to="`/brawlers/${selectedBrawler.id}`" class="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#ffcc00]/35 bg-[#ffcc00]/10 px-4 font-black text-[#ffcc00] no-underline">
          完整角色詳情
        </RouterLink>
      </article>

      <div class="grid gap-5">
        <div class="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
          <AbilityGrid title="配件勝率" :items="selectedBrawler.gadgets" />
          <AbilityGrid title="能力之星勝率" :items="selectedBrawler.starPowers" />
        </div>
        <p class="m-0 text-sm leading-6 text-slate-500">
          配件與能力之星勝率來自 Brawl Time Ninja 樣本統計；官方 API 不會在對戰紀錄中回傳實際裝備。
        </p>

        <section class="grid gap-3">
          <h2 class="m-0 text-xl font-black text-white">打 {{ selectedBrawler.localizedName }} 優先考慮</h2>
          <article v-for="item in counterRecommendations" :key="item.brawler.id" class="dark-panel-soft grid min-h-[116px] grid-cols-[74px_1fr_120px] items-center gap-4 rounded-lg p-4 max-sm:grid-cols-[64px_1fr]">
            <button type="button" class="grid size-[74px] place-items-center rounded-lg bg-[#121824] max-sm:size-16" @click="openBrawler(item.brawler)">
              <img class="size-[74px] object-contain max-sm:size-16" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" />
            </button>
            <div>
              <h3 class="m-0 text-xl font-black text-white">{{ item.brawler.localizedName }}</h3>
              <p class="mb-0 mt-1 leading-6 text-slate-300">{{ item.reason }}</p>
              <span class="mt-2 inline-flex text-xs font-black text-[#ffcc00]">{{ roleName(item.brawler.role) }} · {{ rarityLabel(item.brawler.rarityName) }}</span>
            </div>
            <div class="grid justify-items-end max-sm:col-span-2 max-sm:justify-items-start">
              <strong class="font-score text-3xl font-black text-[#00e676]">{{ item.winRate }}%</strong>
              <small class="text-xs font-black text-slate-500">推估對位勝率</small>
            </div>
          </article>
        </section>

        <section class="grid gap-3">
          <h2 class="m-0 text-xl font-black text-white">{{ selectedBrawler.localizedName }} 比較能壓制</h2>
          <div class="grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <button v-for="item in strongAgainst" :key="item.brawler.id" type="button" class="grid min-h-[86px] grid-cols-[56px_1fr_auto] items-center gap-2 rounded-lg border border-white/10 bg-[#1d2330] p-2 text-left hover:border-[#ffcc00]" @click="openBrawler(item.brawler)">
              <img class="size-14 object-contain" :src="item.brawler.imageUrl" :alt="item.brawler.localizedName" />
              <span>
                <strong class="block text-white">{{ item.brawler.localizedName }}</strong>
                <small class="text-slate-500">{{ roleName(item.brawler.role) }}</small>
              </span>
              <b class="font-score text-[#00e676]">{{ Math.round(item.score) }}</b>
            </button>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
