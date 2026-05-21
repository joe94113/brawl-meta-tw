<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Crosshair, Map, Medal, Search, Shield, Swords, Trophy, User } from '@lucide/vue'

const route = useRoute()

const navItems = [
  { path: '/', label: '首頁', group: 'home', icon: Search },
  { path: '/meta', label: 'Meta 榜', group: 'meta', icon: Trophy },
  { path: '/draft', label: '選角指南', group: 'draft', icon: Shield },
  { path: '/counter', label: 'Counter', group: 'counter', icon: Crosshair },
  { path: '/player', label: '戰績查詢', group: 'player', icon: User },
  { path: '/maps/winrates', label: '地圖勝率', group: 'maprates', icon: Medal },
  { path: '/maps', label: '地圖資料', group: 'maps', icon: Map },
]

const activeGroup = computed(() => {
  if (route.path.startsWith('/counter')) return 'counter'
  if (route.path.startsWith('/brawlers')) return 'meta'
  if (route.path.startsWith('/maps/winrates')) return 'maprates'
  if (route.path.startsWith('/maps')) return 'maps'
  if (route.path.startsWith('/draft')) return 'draft'
  if (route.path.startsWith('/player')) return 'player'
  if (route.path.startsWith('/meta')) return 'meta'
  return 'home'
})
</script>

<template>
  <div class="min-h-screen overflow-x-hidden bg-[#121824] text-slate-100">
    <header
      class="sticky top-0 z-30 flex flex-col gap-3 border-b border-white/10 bg-[#121824]/95 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-7"
    >
      <RouterLink class="flex min-w-[210px] items-center gap-3 text-white no-underline" to="/">
        <span class="grid size-11 place-items-center rounded-lg border-2 border-[#ffcc00] bg-[#ffcc00] font-black text-[#121824] shadow-[0_0_22px_rgba(255,204,0,0.38)]">
          <Swords class="size-6" />
        </span>
        <span>
          <strong class="block leading-tight">荒野報馬仔</strong>
          <small class="mt-1 block text-xs leading-tight text-slate-400">Brawl Meta TW</small>
        </span>
      </RouterLink>

      <nav class="flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0" aria-label="主要分頁">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-bold text-white no-underline transition"
          :class="
            activeGroup === item.group
              ? 'border-[#ffcc00] bg-[#ffcc00] text-[#121824]'
              : 'border-white/15 bg-white/10 hover:bg-white/15'
          "
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <RouterView />
  </div>
</template>
