export const homeActiveModeSlugs = new Set([
  'gemGrab',
  'heist',
  'bounty',
  'brawlBall',
  'soloShowdown',
  'duoShowdown',
  'hotZone',
  'knockout',
  'wipeout',
  'wipeout5V5',
  'trioWipeout',
  'brawlBall5V5',
  'gemGrab5V5',
  'knockout5V5',
  'trioShowdown',
  'trophyEscape',
])

const modeSlugAliases: Record<string, string> = {
  deathmatch: 'wipeout',
  deathmatch5v5: 'wipeout5V5',
  trophyThieves: 'trophyEscape',
}

export function canonicalModeSlug(value: string) {
  return modeSlugAliases[value] || value
}

export function isHomeActiveModeSlug(value: string) {
  return homeActiveModeSlugs.has(canonicalModeSlug(value))
}
