export type Tier = 'S+' | 'S' | 'A' | 'B' | 'C'
export type SearchType = 'brawler' | 'player' | 'map'
export type DraftLane = 'enemy' | 'ally' | 'ban'
export type SectionId = 'home' | 'tier' | 'draft' | 'counter' | 'player' | 'maprates' | 'maps'

export interface NamedValue {
  id: number
  name: string
  color?: string
}

export interface Ability {
  id: number
  name: string
  localizedName?: string
  description?: string
  localizedDescription?: string
  imageUrl?: string
  released?: boolean
  winRateAdj?: number
  useRate?: number
  picks?: number
  picksEstimate?: number
}

export interface ApiBrawler {
  id: number
  name: string
  released: boolean
  link?: string
  imageUrl?: string
  imageUrl2?: string
  class?: NamedValue
  rarity?: NamedValue
  description?: string
  starPowers?: Ability[]
  gadgets?: Ability[]
}

export interface Brawler {
  id: number
  name: string
  localizedName: string
  statKey: string
  role: string
  rarityName: string
  rarityColor: string
  description: string
  localizedDescription: string
  imageUrl: string
  portraitUrl: string
  link: string
  tier: Tier
  metaScore: number
  tags: string[]
  starPowers: Ability[]
  gadgets: Ability[]
}

export interface ApiGameMode {
  id: number
  name: string
  disabled?: boolean
  color?: string
  bgColor?: string
  imageUrl?: string
  imageUrl2?: string
  shortDescription?: string
  description?: string
  sort1?: number
}

export interface GameMode {
  id: number
  name: string
  disabled: boolean
  color: string
  bgColor: string
  imageUrl: string
  shortDescription: string
  sort1: number
}

export interface ApiMap {
  id: number
  name: string
  disabled?: boolean
  link?: string
  imageUrl?: string
  environment?: NamedValue & { imageUrl?: string }
  gameMode?: ApiGameMode
}

export interface MapItem {
  id: number
  name: string
  localizedName: string
  disabled: boolean
  link: string
  imageUrl: string
  environmentName: string
  localizedEnvironmentName: string
  modeName: string
  modeColor: string
  modeImageUrl: string
}

export interface MetaStat {
  brawlerKey: string
  winRateAdj: number
  useRate: number
  picksEstimate?: number
  previousWinRateAdj?: number
  trendDelta?: number
}

export interface MapMetaStat {
  eventId: string
  mapName: string
  modeSlug: string
  brawlerKey: string
  winRateAdj: number
  useRate: number
}

export type AbilityMetaType = 'gadget' | 'starPower'

export interface AbilityMetaStat {
  type: AbilityMetaType
  abilityId: number
  abilityName: string
  brawlerKey: string
  winRateAdj: number
  useRate?: number
  picks?: number
}

export interface MetaTeam {
  brawlerKeys: string[]
  wins: number
}

export interface ActiveEvent {
  id: string
  map: string
  mode: string
  powerplay: boolean
}

export interface MetaSnapshot {
  stats: MetaStat[]
  mapStats?: MapMetaStat[]
  abilityStats?: AbilityMetaStat[]
  topTeams: MetaTeam[]
  activeEvents: ActiveEvent[]
  windowStart?: string
  windowLabel?: string
  sampleSize?: number
  lastUpdated?: string
  sourceUrl: string
}

export interface RankedBrawler extends Brawler {
  liveScore: number
  liveTier: Tier
  winRateAdj?: number
  useRate?: number
  picksEstimate?: number
  dataSource: 'live' | 'fallback'
}

export interface OfficialPlayerBrawler {
  id: number
  name: string
  power: number
  rank: number
  trophies: number
  highestTrophies: number
  prestigeLevel?: number
  currentWinStreak?: number
  maxWinStreak?: number
  skin?: OfficialPlayerAccessory
  gadgets?: OfficialPlayerAccessory[]
  starPowers?: OfficialPlayerAccessory[]
  gears?: OfficialPlayerAccessory[]
  hyperCharges?: OfficialPlayerAccessory[]
  buffies?: {
    gadget?: boolean
    starPower?: boolean
    hyperCharge?: boolean
  }
}

export interface OfficialPlayerAccessory {
  id: number
  name: string
  level?: number
}

export interface OfficialPlayer {
  tag: string
  name: string
  nameColor?: string
  icon?: {
    id: number
  }
  trophies: number
  highestTrophies: number
  expLevel: number
  expPoints?: number
  rankedRank?: number
  rankedRankName?: string
  rankedRankIconUrl?: string
  rankedElo?: number
  rankedSeasonId?: string
  highestSeasonRankedRank?: number
  highestSeasonRankedRankName?: string
  highestSeasonRankedRankIconUrl?: string
  highestSeasonRankedElo?: number
  highestAllTimeRankedRank?: number
  highestAllTimeRankedRankName?: string
  highestAllTimeRankedRankIconUrl?: string
  highestAllTimeRankedElo?: number
  soloVictories: number
  duoVictories: number
  '3vs3Victories': number
  totalPrestigeLevel?: number
  bestRoboRumbleTime?: number
  bestTimeAsBigBrawler?: number
  isQualifiedFromChampionshipChallenge?: boolean
  club?: {
    tag: string
    name: string
  }
  brawlers: OfficialPlayerBrawler[]
}

export interface OfficialBattlePlayer {
  tag?: string
  name?: string
  isBigBrawler?: boolean
  brawler?: OfficialPlayerBrawler
}

export interface OfficialBattle {
  battleTime: string
  event?: {
    id?: number
    mode?: string
    modeId?: number
    map?: string
  }
  battle?: {
    mode?: string
    type?: string
    result?: string
    rawResult?: string
    ranked?: boolean
    duration?: number
    trophyChange?: number
    rank?: number
    starPlayer?: {
      tag?: string
      name?: string
      brawler?: OfficialPlayerBrawler
    }
    teams?: Array<Array<OfficialBattlePlayer>>
    players?: OfficialBattlePlayer[]
  }
}

export interface BattleLogResponse {
  items: OfficialBattle[]
}
