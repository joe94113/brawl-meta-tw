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
}

export interface MetaStat {
  brawlerKey: string
  winRateAdj: number
  useRate: number
  picksEstimate?: number
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
  soloVictories: number
  duoVictories: number
  '3vs3Victories': number
  club?: {
    tag: string
    name: string
  }
  brawlers: OfficialPlayerBrawler[]
}

export interface OfficialBattlePlayer {
  tag?: string
  name?: string
  brawler?: OfficialPlayerBrawler
}

export interface OfficialBattle {
  battleTime: string
  event?: {
    mode?: string
    map?: string
  }
  battle?: {
    mode?: string
    type?: string
    result?: string
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
