import type { Brawler, Tier } from '../types'

export const tiers: Tier[] = ['S+', 'S', 'A', 'B', 'C']

export const roleLabels: Record<string, string> = {
  'Damage Dealer': '輸出',
  Controller: '控場',
  Assassin: '刺客',
  Tank: '坦克',
  Marksman: '射手',
  Support: '輔助',
  Artillery: '投擲',
  Unknown: '新角色',
}

export const roleBaseScores: Record<string, number> = {
  'Damage Dealer': 68,
  Controller: 67,
  Assassin: 65,
  Marksman: 65,
  Support: 63,
  Artillery: 62,
  Tank: 61,
  Unknown: 64,
}

export const rarityScore: Record<string, number> = {
  Common: 0,
  Rare: 0.5,
  'Super Rare': 1,
  Epic: 1.4,
  Mythic: 1.8,
  Legendary: 2.2,
  'Ultra Legendary': 2.8,
}

export const editorialBoost: Record<string, number> = {
  Najia: 13,
  Damian: 13,
  Trunk: 12,
  Gigi: 11,
  Ziggy: 10,
  Sirius: 10,
  Glowbert: 9,
  Ollie: 8,
  'Jae-yong': 8,
  Finx: 8,
  Clancy: 7,
  Bolt: 7,
  Kenji: 6,
  Juju: 6,
  Moe: 6,
  Melodie: 5,
  Belle: 5,
  Gale: 5,
  Max: 4,
  Sandy: 4,
  Byron: 4,
  Stu: 4,
}

export const modeRoleWeights: Record<string, Record<string, number>> = {
  'Gem Grab': { Controller: 8, Support: 6, 'Damage Dealer': 4, Assassin: 2, Marksman: 1 },
  Heist: { 'Damage Dealer': 9, Marksman: 5, Controller: 3, Tank: 2 },
  Bounty: { Marksman: 9, Artillery: 5, Controller: 4, Assassin: 2 },
  'Brawl Ball': { Tank: 7, Assassin: 6, Controller: 5, Support: 4, 'Damage Dealer': 3 },
  Knockout: { Marksman: 8, Artillery: 6, Assassin: 5, Controller: 4 },
  Wipeout: { Marksman: 8, Assassin: 5, Artillery: 4, 'Damage Dealer': 4 },
  'Hot Zone': { Controller: 9, Support: 6, Tank: 5, 'Damage Dealer': 3 },
  'Solo Showdown': { Assassin: 7, Tank: 6, 'Damage Dealer': 5, Marksman: 3 },
  'Duo Showdown': { Assassin: 6, Support: 5, Tank: 5, 'Damage Dealer': 4 },
  Duels: { Assassin: 6, Marksman: 6, 'Damage Dealer': 5, Tank: 3 },
}

export const counterMatrix: Record<string, Record<string, number>> = {
  Assassin: { Artillery: 18, Marksman: 13, Support: 11, Controller: 5, 'Damage Dealer': 3, Unknown: 2, Tank: -9 },
  Tank: { Assassin: 12, Artillery: 5, Support: 4, 'Damage Dealer': 1, Controller: -5, Marksman: -12 },
  Marksman: { Tank: 16, 'Damage Dealer': 8, Support: 7, Controller: 4, Assassin: -8, Artillery: -6 },
  Artillery: { Controller: 10, Marksman: 7, Support: 6, Tank: -3, Assassin: -15 },
  Controller: { Tank: 14, Assassin: 10, 'Damage Dealer': 5, Support: 4, Marksman: -3, Artillery: -7 },
  Support: { Assassin: 5, Tank: 3, Controller: 1, 'Damage Dealer': -5, Marksman: -6 },
  'Damage Dealer': { Support: 9, Tank: 7, Controller: 3, Assassin: 1, Marksman: -3, Artillery: -3 },
  Unknown: { Tank: 4, Support: 4, Artillery: 3, Marksman: 3, Controller: 3, Assassin: 3, 'Damage Dealer': 3 },
}

export function tierForRank(index: number, total: number): Tier {
  const ratio = (index + 1) / Math.max(total, 1)
  if (ratio <= 0.06) return 'S+'
  if (ratio <= 0.18) return 'S'
  if (ratio <= 0.42) return 'A'
  if (ratio <= 0.72) return 'B'
  return 'C'
}

export function inferTags(role: string, description: string) {
  const source = `${role} ${description}`.toLowerCase()
  const tags: string[] = []

  if (/heal|teammate|support/.test(source)) tags.push('healing')
  if (/slow|stun|knock|control|pull|push/.test(source)) tags.push('control')
  if (/dash|jump|speed|teleport|charge/.test(source)) tags.push('mobility')
  if (/wall|throw|over|area|zone/.test(source)) tags.push('space')
  if (/range|rocket|sniper|projectile|bullet/.test(source)) tags.push('range')
  if (/shield|health|tank/.test(source)) tags.push('durable')
  if (role === 'Artillery') tags.push('space')
  if (role === 'Marksman') tags.push('range')
  if (role === 'Assassin') tags.push('mobility')
  if (role === 'Controller') tags.push('control')

  return Array.from(new Set(tags))
}

export function deterministicNoise(name: string, id: number) {
  const hash = Array.from(`${name}-${id}`).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return (hash % 70) / 10 - 2.5
}

export function releasePressure(id: number) {
  const releaseIndex = Math.max(0, id - 16000000)
  return Math.min(8, releaseIndex / 14)
}

export function roleName(role: string) {
  return roleLabels[role] || role
}

export function modeFitScore(brawler: Brawler, modeName: string) {
  if (modeName === 'All') return 0

  const weights = modeRoleWeights[modeName] || {}
  const roleWeight = weights[brawler.role] ?? 0
  const tagWeight =
    (modeName.includes('Brawl') && brawler.tags.includes('mobility') ? 2.4 : 0) +
    (modeName.includes('Knockout') && brawler.tags.includes('range') ? 2.6 : 0) +
    (modeName.includes('Heist') && brawler.tags.includes('range') ? 1.8 : 0) +
    (modeName.includes('Hot') && brawler.tags.includes('control') ? 2.8 : 0)

  return (roleWeight + tagWeight) * 0.35
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
