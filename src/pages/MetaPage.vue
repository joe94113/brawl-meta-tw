<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrawlerTile from '../components/BrawlerTile.vue'
import MetaSourceNote from '../components/MetaSourceNote.vue'
import PageHeader from '../components/PageHeader.vue'
import { useBrawlData } from '../composables/useBrawlData'
import { tiers } from '../data/metaRules'
import type { Brawler, RankedBrawler } from '../types'
import SkeletonBlock from '../components/SkeletonBlock.vue'

const route = useRoute()
const router = useRouter()
const {
  loading,
  loadError,
  loadGameData,
  rankedBrawlers,
  roleOptions,
  modeOptions,
  selectedMode,
  roleName,
  modeLabel,
  metaSnapshot,
  metaError,
  liveMetaCount,
  confidenceForBrawler,
  trendForBrawler,
} = useBrawlData()

const roleFilter = ref('All')
const tierSearch = ref(String(route.query.q || ''))
const rankFilter = ref('all')

onMounted(loadGameData)

watch(
  () => route.query.q,
  (query) => {
    tierSearch.value = String(query || '')
  },
)

const filteredRankedBrawlers = computed(() => {
  const query = tierSearch.value.trim().toLowerCase()

  return rankedBrawlers.value.filter((brawler) => {
    const roleMatched = roleFilter.value === 'All' || brawler.role === roleFilter.value
    const queryMatched =
      !query ||
      brawler.name.toLowerCase().includes(query) ||
      brawler.localizedName.toLowerCase().includes(query) ||
      brawler.role.toLowerCase().includes(query)

    return roleMatched && queryMatched
  })
})

const tierGroups = computed(() =>
  tiers.map((tier) => ({
    tier,
    list: filteredRankedBrawlers.value.filter((brawler) => brawler.liveTier === tier),
  })),
)

const trendRows = computed(() =>
  rankedBrawlers.value
    .map((brawler) => ({
      brawler,
      trend: trendForBrawler(brawler),
      confidence: confidenceForBrawler(brawler),
    }))
    .sort((a, b) => Math.abs(b.trend.delta) - Math.abs(a.trend.delta))
    .slice(0, 6),
)

function selectBrawler(brawler: Brawler | RankedBrawler) {
  void router.push({ name: 'brawler-detail', params: { id: brawler.id } })
}

function tierBadgeClass(tier: string) {
  const classes: Record<string, string> = {
    'S+': 'bg-[#ffcc00] shadow-[0_0_28px_rgba(255,204,0,0.35)]',
    S: 'bg-[#ffcf3f]',
    A: 'bg-[#8a2be2] text-white shadow-[0_0_24px_rgba(138,43,226,0.32)]',
    B: 'bg-[#00bcd4]',
    C: 'bg-[#bbc5d0]',
  }
  return classes[tier]
}
</script>

<template>
  <section class="bg-[#121824] py-[72px]">
    <PageHeader
      eyebrow="Meta board"
      title="角色排名：S+ / S / A / B / C"
      note="分級以近月 Adjusted Win Rate 為主，並用模式定位做小幅修正。"
    />

    <div class="sticky top-[86px] z-20 mx-auto mb-4 grid w-[min(1180px,calc(100%_-_48px))] grid-cols-[1fr_auto] gap-4 rounded-lg bg-[#121824]/88 py-3 backdrop-blur max-lg:static max-lg:grid-cols-1 max-sm:w-[calc(100%_-_28px)]">
      <MetaSourceNote :snapshot="metaSnapshot" :live-count="liveMetaCount" :error="metaError" />
      <div class="flex flex-wrap justify-end gap-3 max-lg:justify-start">
        <label class="grid gap-1 text-sm font-black text-slate-300">
          模式
          <select v-model="selectedMode" class="min-h-12 min-w-[168px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
            <option v-for="mode in modeOptions" :key="mode" :value="mode">{{ modeLabel(mode) }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm font-black text-slate-300">
          階級
          <select v-model="rankFilter" class="min-h-12 min-w-[168px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
            <option value="all">全部</option>
            <option value="diamond">鑽石~神話</option>
            <option value="master">傳奇~大師</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm font-black text-slate-300">
          定位
          <select v-model="roleFilter" class="min-h-12 min-w-[168px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white">
            <option v-for="role in roleOptions" :key="role" :value="role">
              {{ role === 'All' ? '全部' : roleName(role) }}
            </option>
          </select>
        </label>
        <label class="grid gap-1 text-sm font-black text-slate-300">
          快搜
          <input v-model="tierSearch" class="min-h-12 min-w-[168px] rounded-lg border border-white/10 bg-[#1d2330] px-3 text-white" placeholder="角色 / 定位" />
        </label>
      </div>
    </div>

    <div v-if="loading" class="mx-auto w-[min(1180px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_28px)]">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else-if="loadError" class="mx-auto rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
      {{ loadError }}
    </div>

    <div v-else class="mx-auto grid w-[min(1180px,calc(100%_-_48px))] gap-4 max-sm:w-[calc(100%_-_28px)]">
      <section class="dark-panel rounded-lg p-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="m-0 text-xl font-black text-white">Meta 變化趨勢</h2>
            <p class="mb-0 mt-1 text-sm leading-6 text-slate-400">依近月勝率、使用率與樣本量計算升溫指標，樣本不足會標示可信度。</p>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-6 gap-2 max-lg:grid-cols-3 max-sm:grid-cols-2">
          <button
            v-for="row in trendRows"
            :key="row.brawler.id"
            type="button"
            class="grid min-h-[112px] content-start justify-items-center rounded-lg border border-white/10 bg-white/5 p-2 text-white transition hover:border-[#ffcc00]"
            @click="selectBrawler(row.brawler)"
          >
            <img class="size-14 object-contain" :src="row.brawler.imageUrl" :alt="row.brawler.localizedName" />
            <strong class="mt-1 max-w-full truncate text-sm">{{ row.brawler.localizedName }}</strong>
            <span class="font-score text-sm font-black" :class="row.trend.tone">
              {{ row.trend.delta > 0 ? '+' : '' }}{{ row.trend.delta }}%
            </span>
            <small class="text-[0.68rem] font-black" :class="row.confidence.tone">可信度 {{ row.confidence.label }}</small>
          </button>
        </div>
      </section>

      <article v-for="group in tierGroups" :key="group.tier" class="dark-panel grid min-h-[120px] grid-cols-[96px_1fr] gap-4 rounded-lg p-4 max-sm:grid-cols-1">
        <div class="grid min-h-24 place-items-center rounded-lg text-[#17191f]" :class="tierBadgeClass(group.tier)">
          <strong class="text-[2.7rem] leading-none">{{ group.tier }}</strong>
          <span class="text-xs font-black">{{ group.list.length }} 位英雄</span>
        </div>
        <TransitionGroup name="tier" tag="div" class="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
          <BrawlerTile v-for="brawler in group.list" :key="brawler.id" :brawler="brawler" @select="selectBrawler" />
        </TransitionGroup>
      </article>
    </div>
  </section>
</template>
