<script setup lang="ts">
import type { Brawler, RankedBrawler } from '../types'
import { formatPercent } from '../utils/format'

const props = defineProps<{
  brawler: Brawler | RankedBrawler
  compact?: boolean
}>()

const emit = defineEmits<{
  select: [brawler: Brawler | RankedBrawler]
}>()

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <button
    type="button"
    class="group relative grid content-start justify-items-center overflow-hidden rounded-lg border border-white/10 bg-[#1d2330] px-2 py-2 text-white transition hover:-translate-y-0.5 hover:border-[#ffcc00]"
    :class="compact ? 'min-h-[96px]' : 'min-h-[116px]'"
    @click="emit('select', props.brawler)"
  >
    <img class="size-16 object-contain" :src="brawler.imageUrl" :alt="brawler.localizedName" @error="onImageError" />
    <span class="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-black">{{ brawler.localizedName }}</span>
    <small v-if="'winRateAdj' in brawler && brawler.winRateAdj" class="font-score mt-0.5 text-[0.78rem] font-black text-[#00e676]">
      {{ formatPercent(brawler.winRateAdj) }}
    </small>
    <small v-else-if="'liveScore' in brawler" class="absolute right-1.5 top-1.5 grid min-h-6 min-w-7 place-items-center rounded-md bg-[#15161b] text-[0.7rem] font-black text-white">
      {{ Math.round(brawler.liveScore) }}
    </small>
    <span
      v-if="'winRateAdj' in brawler && brawler.winRateAdj"
      class="pointer-events-none absolute inset-x-1.5 bottom-1.5 translate-y-2 rounded-md bg-[#121824]/95 px-2 py-1 text-[0.68rem] font-black text-slate-100 opacity-0 ring-1 ring-white/10 transition group-hover:translate-y-0 group-hover:opacity-100"
    >
      勝率 {{ formatPercent(brawler.winRateAdj) }}｜選擇 {{ formatPercent(brawler.useRate) }}
    </span>
  </button>
</template>
