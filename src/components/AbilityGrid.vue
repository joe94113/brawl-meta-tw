<script setup lang="ts">
import type { Ability } from '../types'

defineProps<{
  title: string
  items: Ability[]
}>()

function onImageError(event: Event) {
  ;(event.target as HTMLImageElement).style.opacity = '0'
}
</script>

<template>
  <section class="dark-panel-soft rounded-lg p-3">
    <h3 class="m-0 text-base font-black text-white">{{ title }}</h3>
    <div class="mt-3 grid gap-2">
      <article v-for="item in items" :key="item.id" class="grid min-h-[68px] grid-cols-[46px_1fr] items-center gap-3 rounded-lg border border-white/10 bg-[#1d2330] p-2">
        <img class="size-[46px] object-contain" :src="item.imageUrl" :alt="item.localizedName || item.name" @error="onImageError" />
        <div class="min-w-0">
          <strong class="block truncate text-sm text-white">{{ item.localizedName || item.name }}</strong>
          <p v-if="item.localizedDescription" class="m-0 mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
            {{ item.localizedDescription }}
          </p>
        </div>
      </article>
      <p v-if="items.length === 0" class="m-0 text-sm text-slate-500">目前沒有資料</p>
    </div>
  </section>
</template>
