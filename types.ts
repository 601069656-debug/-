
export enum Role {
  WARLORD = '诸侯 (Warlord)',
  OFFICER = '将领 (General)',
  STRATEGIST = '谋士 (Strategist)',
  CIVILIAN = '在野 (Vagrant)'
}

export enum TroopType {
  INFANTRY = '步卒',
  CAVALRY = '骑兵',
  ARCHER = '弓手',
  NAVY = '水军',
  SPECIAL = '奇兵',
  UNKNOWN = '???'
}

export enum HistoricalPeriod {
  YELLOW_TURBAN = '黄巾起义 (184 AD)',
  ANTI_DONG_ZHUO = '讨伐董卓 (190 AD)',
  WARLORDS_CHAOS = '群雄逐鹿 (194 AD)',
  GUANDU = '官渡之战 (200 AD)',
  CHIBI = '赤壁之战 (208 AD)',
  THREE_KINGDOMS = '三国鼎立 (220 AD)',
  NORTHERN_EXPEDITION = '诸葛北伐 (227 AD)',
  FALL_OF_THREE = '晋灭三国 (263-280 AD)',
  CUSTOM = '自定义剧本 (Custom)'
}

export interface Character {
  name: string;
  styleName?: string; // 字 (e.g., 玄德, 云长)
  nativePlace?: string; // 籍贯 (e.g., 谯县, 常山)
  gender: string;
  age: string;
  birthDate?: string; // 出生生辰 (e.g., 光和四年仲秋八月十五日)
  appearance: string; // 仪表描述
  biography?: string; // 个人志/生平摘要
  
  // 核心属性
  socialIdentity: string; // 出身背景 (e.g., 门阀子弟, 寒门庶民, 边塞豪强)
  lineage?: string; // 家族世系
  alignment: string; // 志向目标 (e.g., 兴复汉室, 割据一方, 辅佐明君)
  personality: string; // 性格特征
  
  // 能力参数 (六项基本属性)
  attributes: {
    command: number;    // 统率
    martial: number;    // 武力
    vitality: number;   // 体力
    intelligence: number; // 智谋
    politics: number;   // 政治
    charisma: number;   // 魅力
  };
  specialty: string; // 战法/特技 (e.g., 奇袭, 屯田, 辩才)
  troopType: TroopType; // 擅长兵种
  tactics?: string; // 兵法计略
  politicalInfluence?: string; // 政治影响力
  
  // 地势与资源
  prestige: number; // 声望 (0-100)
  allegiance?: string; // 归属势力 (若为在野则为空)
  territory?: string; // 领地/驻地
  forces?: string; // 兵马规模
  funds?: string; // 金钱
  provisions?: string; // 粮食
  popularity?: string; // 民心
  bond?: string; // 信任度/羁绊
  
  // 实时状态
  hp: string;
  items?: string[]; // 随身器物
  currentStatus?: string; // 当前状态
  coreIntent?: string; // 核心意图/政务
  setting: HistoricalPeriod; // 所处剧本
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
  groundingMetadata?: {
    searchQueries?: string[];
    groundingChunks?: {
      web?: {
        uri: string;
        title: string;
      };
    }[];
  };
  snapshot?: {
    gaiaState?: GaiaState;
    npcProfiles?: NPCProfile[];
    logs?: LogSummary[];
  };
}

export enum GameStatus {
  START_MENU = 'START_MENU',
  CREATION = 'CREATION',
  STAGE_SETUP = 'STAGE_SETUP',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface NPCRecord {
  id: string;
  content: string; // Event description or dialogue
  timestamp: string; // Time from the story
  location?: string; // Place from the story
}

export interface NPCProfile {
  id: string;
  name: string;
  nativePlace?: string; // 籍贯
  hasAppeared?: boolean; // 是否登场（与主角相遇）
  appearanceTime?: string; // 登场时间
  appearanceLocation?: string; // 登场地点
  aiGeneratedRecord: string; // AI 自动更新的记录
  userNotes: string; // 玩家手动补充/修正的记录
  status: string; // 参数状态 (Parameters, Troop, etc.)
  attributes?: {
    command: number;    // 统率
    martial: number;    // 武力
    vitality: number;   // 体力
    intelligence: number; // 智谋
    politics: number;   // 政治
    charisma: number;   // 魅力
  };
  parameters?: string; // Legacy/Display name for parameters
  specialties?: string; // 特技与战法
  inventory?: string; // 随身器物
  tags: string[]; // Small tags for efficiency
  records: NPCRecord[]; // History of interactions
  hiddenNotes?: string; // Internal state/event flags for AI (e.g. [Captured: True])
  lastUpdated: number;
  isTrueNameUnlocked?: boolean;
  bondLevel: number; // 0-5
  resistance: 'Low' | 'Medium' | 'High' | 'Extreme';
  nextMilestone: string;
}

export interface GameEvent {
  title: string;
  description: string;
  dialogues: string[];
  notes?: string;
}

export interface DayEvents {
  date: string;
  time?: string;
  location?: string;
  events: GameEvent[];
}

export interface NPCUpdate {
  name: string;
  placeId: string;
  isMajorEvent: boolean;
  recordUpdate: string;
  isNew: boolean;
  status?: string;
  attributes?: {
    command: number;    // 统率 (Command)
    martial: number;    // 武力 (Martial)
    vitality: number;   // 体力 (Vitality)
    intelligence: number; // 智谋 (Intelligence)
    politics: number;   // 政治 (Politics)
    charisma: number;   // 魅力 (Charisma)
  };
  parameters?: string;
  specialties?: string;
  inventory?: string;
  tags?: string[];
  records?: NPCRecord[];
  bondLevel?: number;
}

export interface LogSummary {
  id: string;
  timestamp: number;
  title: string;
  date: string;
  days: DayEvents[];
  npcUpdates?: NPCUpdate[];
}

export interface GaiaState {
  provinces: {
    [provinceName: string]: {
      food_provisions: number;
      max_storage: number;
      stability: number;
      status: string;
    }
  };
  lastUpdated: number;
}

export interface GameState {
  status: GameStatus;
  character: Character | null;
  history: Message[];
  isLoading: boolean;
  isCharacterSheetOpen: boolean;
  isCompendiumOpen: boolean;
  isLogModalOpen: boolean;
  npcProfiles: NPCProfile[];
  logs: LogSummary[];
  stageSettings?: string;
  selectedStages?: string[];
  difficulty: 'normal' | 'grand';
  gaiaState?: GaiaState;
}