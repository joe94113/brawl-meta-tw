export const modeLabels: Record<string, string> = {
  All: '全部',
  'Gem Grab': '寶石爭奪戰',
  Heist: '金庫攻防',
  Bounty: '搶星大作戰',
  'Brawl Ball': '亂鬥足球',
  'Solo Showdown': '單人生死鬥',
  'Duo Showdown': '雙人荒野生死鬥',
  'Hot Zone': '據點爭奪戰',
  Knockout: '淘汰賽',
  Wipeout: '極限淘汰賽',
  Duels: '決鬥',
  'Basket Brawl': '亂鬥籃球',
  'Volley Brawl': '亂鬥排球',
  'Brawl Ball 5v5': '5v5 亂鬥足球',
  'Gem Grab 5v5': '5v5 寶石爭奪',
  'Knockout 5v5': '5v5 淘汰賽',
  'Paint Brawl': '顏料大亂鬥',
  'Trio Showdown': '三人生死鬥',
  'Brawl Hockey': '亂鬥冰球',
  'Treasure Hunt': '寶藏獵人',
  'Safe Blast': '保險箱爆破',
}

export const modeSlugLabels: Record<string, string> = {
  gemGrab: '寶石爭奪戰',
  heist: '金庫攻防',
  bounty: '搶星大作戰',
  brawlBall: '亂鬥足球',
  soloShowdown: '單人生死鬥',
  duoShowdown: '雙人荒野生死鬥',
  hotZone: '據點爭奪戰',
  knockout: '淘汰賽',
  wipeout: '極限淘汰賽',
  deathmatch: '極限淘汰賽',
  brawlBall5V5: '5v5 亂鬥足球',
  gemGrab5V5: '5v5 寶石爭奪',
  knockout5V5: '5v5 淘汰賽',
  basketBrawl: '亂鬥籃球',
  volleyBrawl: '亂鬥排球',
  trioShowdown: '三人生死鬥',
  treasureHunt: '寶藏獵人',
}

export const modeSlugToName: Record<string, string> = {
  gemGrab: 'Gem Grab',
  heist: 'Heist',
  bounty: 'Bounty',
  brawlBall: 'Brawl Ball',
  soloShowdown: 'Solo Showdown',
  duoShowdown: 'Duo Showdown',
  hotZone: 'Hot Zone',
  knockout: 'Knockout',
  wipeout: 'Wipeout',
  deathmatch: 'Wipeout',
  brawlBall5V5: 'Brawl Ball 5v5',
  gemGrab5V5: 'Gem Grab 5v5',
  knockout5V5: 'Knockout 5v5',
  basketBrawl: 'Basket Brawl',
  volleyBrawl: 'Volley Brawl',
  trioShowdown: 'Trio Showdown',
  treasureHunt: 'Treasure Hunt',
}

export const rarityLabels: Record<string, string> = {
  Common: '普通',
  Rare: '稀有',
  'Super Rare': '超稀有',
  Epic: '史詩',
  Mythic: '神話',
  Legendary: '傳奇',
  'Ultra Legendary': '究極傳奇',
  Unknown: '未知',
}

export function modeLabel(value: string) {
  return modeLabels[value] || value
}

export function modeSlugLabel(value: string) {
  return modeSlugLabels[value] || value
}

export function modeNameFromSlug(value: string) {
  return modeSlugToName[value] || value
}

export function rarityLabel(value: string) {
  return rarityLabels[value] || value
}
