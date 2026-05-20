export function formatPercent(value?: number, digits = 1) {
  if (value === undefined || Number.isNaN(value)) return 'N/A'
  return `${value.toFixed(digits)}%`
}

export function formatCompact(value?: number) {
  if (value === undefined || Number.isNaN(value)) return 'N/A'
  return new Intl.NumberFormat('zh-TW', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
