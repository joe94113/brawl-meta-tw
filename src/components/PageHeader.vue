<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  note?: string
}>()
</script>

<template>
  <div class="mx-auto mb-7 flex w-[min(1180px,calc(100%_-_48px))] items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-sm:w-[calc(100%_-_28px)]">
    <div>
      <p class="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#ffcc00]">{{ eyebrow }}</p>
      <h1 class="m-0 text-[2.3rem] font-black leading-tight text-white max-sm:text-[1.9rem]">{{ title }}</h1>
    </div>
    <p v-if="note" class="m-0 max-w-[520px] leading-7 text-slate-300">{{ note }}</p>
  </div>
</template>
