<script setup lang="ts">
defineProps<{
  rows?: number
}>()
</script>

<template>
  <div class="dark-panel grid gap-3 rounded-lg p-4">
    <span v-for="row in rows || 4" :key="row" class="h-5 animate-pulse rounded bg-white/10" :class="row === 1 ? 'w-2/3' : 'w-full'" />
  </div>
</template>
