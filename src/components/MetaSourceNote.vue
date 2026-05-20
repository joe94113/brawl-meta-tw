<script setup lang="ts">
import type { MetaSnapshot } from '../types'

defineProps<{
  snapshot: MetaSnapshot | null
  liveCount: number
  error?: string
}>()
</script>

<template>
  <div class="dark-panel-soft rounded-lg p-3 text-sm leading-6 text-slate-300">
    <template v-if="snapshot">
      真實天梯資料：Brawl Time Ninja Adjusted Win Rate / Use Rate，{{ snapshot.windowLabel || '近月窗口' }}，已對上 {{ liveCount }} 位英雄。
    </template>
    <template v-else-if="error">
      真實勝率暫時無法讀取：{{ error }}。目前會以角色定位與模式權重暫代。
    </template>
    <template v-else>
      正在讀取真實勝率資料...
    </template>
  </div>
</template>
