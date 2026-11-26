import type {
  BrawlPlatform,
  BrawlStageTheme,
  ComboUltState,
  GameState,
  HeroId,
  MapTheme,
  PlayerInput,
  SlashElement,
  SlashStyle,
  SoundEvent,
  UltType,
} from '../core/types';
import type { ShopItemId } from '../modes/survival';

export type MabarRole = 'coop' | 'stick' | 'monitor';
export type MabarGameMode = 'survival' | 'brawl';

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  paletteIndex: number;
  heroId?: HeroId;
  role: MabarRole;
  isHost: boolean;
  isBot?: boolean;
  pingMs?: number;
}

export interface PlayerCompactRow {
  id: string;
  name: string;
  pal: number;
  heroId?: HeroId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  dirX: number;
  dirY?: number;
  hp: number;
  maxHp: number;
  ult: number;
  maxUlt: number;
  ultActiveTimer?: number;
  coins: number;
  animTime: number;
  knockedDown: boolean;
  ultType?: UltType;
  buffCount: number;
  invulnTimer: number;
  brawlStocks?: number;
  brawlKos?: number;
  elem?: SlashElement;
  elemLv?: number;
  meleeTimer?: number;
  dashTimer?: number;
  hitFlashTimer?: number;
}

export interface EnemyCompactRow {
  id: number;
  kind: string;
  x: number;
  y: number;
  z?: number;
  hp: number;
  maxHp: number;
  dirX: number;
  aiState: string;
  hitFlash?: number;
  stun?: number;
}

export interface CompactGameSnapshot {
  t: 'snap';
  seq: number;
  time: number;
  status: 'playing' | 'victory' | 'gameover';
  gameMode?: 'survival' | 'brawl';
  theme?: MapTheme;
  wave: number;
  phase: 'wave' | 'intermission';
  intermissionTimer: number;
  brawlRemainingTime?: number;
  brawlWinnerId?: string;
  brawlStageTheme?: BrawlStageTheme;
  brawlPlatforms?: BrawlPlatform[];
  koCount: number;
  core: {
    hp: number;
    maxHp: number;
    shieldActive: boolean;
    shieldHp: number;
    towerLevel: number;
  };
  barricades: Array<{ id: string; hp: number; maxHp: number }>;
  players: PlayerCompactRow[];
  enemies?: EnemyCompactRow[];
  projectiles?: Array<{ x: number; y: number; angle?: number; kind: string; color: string; radius: number }>;
  crates?: Array<{ id: number; x: number; y: number; z?: number; hp: number; maxHp: number; style: 'wood' | 'cardboard' | 'gold_kendi'; bobPhase?: number }>;
  pickups?: Array<{ id: number; kind: string; x: number; y: number; z: number; bobPhase: number }>;
  hazards?: Array<{ id: number; kind: string; x: number; y: number; radius: number; delay: number; maxDelay: number; flashTimer: number; detonated: boolean }>;
  slashes?: Array<{ x: number; y: number; angle: number; color: string; stripeColor: string; life: number; maxLife: number; comboStep: number; heroId?: HeroId; slashStyle?: SlashStyle; element?: SlashElement; elementLevel?: number }>;
  sounds: SoundEvent[];
  shakeIntensity: number;
  comboUlt?: ComboUltState;
}

export interface StickPersonalSnapshot {
  t: 'stick_snap';
  seq: number;
  x?: number;
  y?: number;
  hp: number;
  maxHp: number;
  ult: number;
  maxUlt: number;
  coins: number;
  reviveTickets?: number;
  stocks?: number;
  kos?: number;
  gameMode?: 'survival' | 'brawl';
  wave: number;
  phase: 'wave' | 'intermission';
  intermissionTimer: number;
  canShop: boolean;
  core?: {
    hp: number;
    maxHp: number;
    shieldActive: boolean;
    shieldHp: number;
    towerLevel: number;
  };
  barricades?: Array<{ id: string; hp: number; maxHp: number }>;
  elem?: SlashElement;
  elemLv?: number;
  soundCue?: SoundEvent;
}

export type NetMessage =
  | { t: 'join'; name: string; pal: number; role: MabarRole; heroId?: HeroId }
  | { t: 'welcome'; playerId: string; isHost: boolean; hostRole: MabarRole }
  | { t: 'lobby_update'; roomCode: string; players: LobbyPlayerInfo[]; mode?: MabarGameMode }
  | { t: 'set_mode'; mode: MabarGameMode }
  | { t: 'pick_hero'; heroId: HeroId }
  | { t: 'start_game' }
  | { t: 'input'; seq: number; input: PlayerInput }
  | { t: 'snap'; snap: CompactGameSnapshot }
  | { t: 'stick_snap'; snap: StickPersonalSnapshot }
  | { t: 'prompt_skill'; kind: 'buff' | 'ult'; choices: string[] }
  | { t: 'pick_skill'; kind: 'buff' | 'ult'; choice: string }
  | { t: 'buy_item'; itemId: ShopItemId }
  | { t: 'skip_intermission' }
  | { t: 'shop_result'; ok: boolean; message: string }
  | { t: 'ping'; timestamp: number }
  | { t: 'pong'; timestamp: number }
  | { t: 'toast'; message: string };

/**
 * Compact snapshot packer for 60 FPS local game replication
 */
export function packGameSnapshot(state: GameState, seq: number): CompactGameSnapshot {
  const surv = state.survival;
  const br = state.brawl;
  const players: PlayerCompactRow[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    pal: p.paletteIndex,
    heroId: p.heroId,
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    z: Math.round(p.z * 10) / 10,
    vx: Math.round(p.vx),
    vy: Math.round(p.vy),
    dirX: Math.round(p.dirX * 100) / 100,
    dirY: Math.round(p.dirY * 100) / 100,
    hp: Math.ceil(p.hp),
    maxHp: p.maxHp,
    ult: Math.floor(p.ult),
    maxUlt: p.maxUlt,
    ultActiveTimer: p.ultActiveTimer > 0 ? Math.round(p.ultActiveTimer * 100) / 100 : 0,
    coins: p.coins,
    animTime: Math.round(p.animTime * 100) / 100,
    knockedDown: p.knockedDown,
    ultType: p.ultType,
    buffCount: p.buffCount,
    invulnTimer: Math.round(p.invulnTimer * 10) / 10,
    brawlStocks: p.brawlStocks,
    brawlKos: p.brawlKos,
    elem: p.slashElement,
    elemLv: p.slashElementLevel,
    meleeTimer: p.meleeTimer > 0 ? Math.round(p.meleeTimer * 100) / 100 : 0,
    dashTimer: p.dashTimer > 0 ? Math.round(p.dashTimer * 100) / 100 : 0,
    hitFlashTimer: p.hitFlashTimer > 0 ? Math.round(p.hitFlashTimer * 100) / 100 : 0,
  }));

  const enemies: EnemyCompactRow[] = state.enemies.map((e) => ({
    id: e.id,
    kind: e.kind,
    x: Math.round(e.x * 10) / 10,
    y: Math.round(e.y * 10) / 10,
    z: e.z > 0 ? Math.round(e.z) : 0,
    hp: Math.ceil(e.hp),
    maxHp: e.maxHp,
    dirX: e.dirX,
    aiState: e.aiState,
    hitFlash: e.hitFlashTimer > 0 ? 1 : 0,
    stun: e.stunTimer > 0 ? 1 : 0,
  }));

  const projectiles = state.projectiles.map((pr) => ({
    x: Math.round(pr.x),
    y: Math.round(pr.y),
    angle: Math.round(pr.angle * 100) / 100,
    kind: pr.kind || 'slash',
    color: pr.color,
    radius: pr.radius,
  }));

  const crates = state.crates.map((c) => ({
    id: c.id,
    x: Math.round(c.x),
    y: Math.round(c.y),
    z: c.z ? Math.round(c.z) : 0,
    hp: Math.ceil(c.hp),
    maxHp: c.maxHp,
    style: c.style,
    bobPhase: c.bobPhase ? Math.round(c.bobPhase * 100) / 100 : 0,
  }));

  const pickups = state.pickups.map((pk) => ({
    id: pk.id,
    kind: pk.kind,
    x: Math.round(pk.x),
    y: Math.round(pk.y),
    z: Math.round(pk.z),
    bobPhase: Math.round(pk.bobPhase * 100) / 100,
  }));

  const hazards = state.hazards.map((hz) => ({
    id: hz.id,
    kind: hz.kind,
    x: Math.round(hz.x),
    y: Math.round(hz.y),
    radius: Math.round(hz.radius),
    delay: Math.round(hz.delay * 100) / 100,
    maxDelay: Math.round(hz.maxDelay * 100) / 100,
    flashTimer: Math.round(hz.flashTimer * 100) / 100,
    detonated: hz.detonated,
  }));

  const slashes = state.slashes.map((sl) => ({
    x: Math.round(sl.x),
    y: Math.round(sl.y),
    angle: Math.round(sl.angle * 100) / 100,
    color: sl.color,
    stripeColor: sl.stripeColor,
    life: Math.round(sl.life * 100) / 100,
    maxLife: sl.maxLife,
    comboStep: sl.comboStep,
    heroId: sl.heroId,
    slashStyle: sl.slashStyle,
    element: sl.element,
    elementLevel: sl.elementLevel,
  }));

  const sounds = [...state.soundQueue];

  return {
    t: 'snap',
    seq,
    time: Math.round(state.time * 100) / 100,
    status: state.status,
    gameMode: state.mode === 'brawl' ? 'brawl' : 'survival',
    theme: state.theme,
    brawlRemainingTime: br ? Math.ceil(br.remainingTime) : undefined,
    brawlWinnerId: br?.winnerId,
    brawlStageTheme: br?.stageTheme,
    brawlPlatforms: br?.platforms,
    wave: surv?.wave || 1,
    phase: surv?.phase || 'wave',
    intermissionTimer: surv ? Math.ceil(surv.intermissionTimer) : 0,
    koCount: state.koCount,
    core: {
      hp: surv ? Math.ceil(surv.core.hp) : 500,
      maxHp: surv ? surv.core.maxHp : 500,
      shieldActive: !!surv?.core.shieldActive,
      shieldHp: surv ? Math.ceil(surv.core.shieldHp) : 0,
      towerLevel: surv?.core.towerLevel || 0,
    },
    barricades: (surv?.barricades || []).map((b) => ({
      id: b.id,
      hp: Math.ceil(b.hp),
      maxHp: b.maxHp,
    })),
    players,
    enemies,
    projectiles,
    crates,
    pickups,
    hazards,
    slashes,
    sounds,
    shakeIntensity: state.shakeIntensity,
    comboUlt: state.comboUlt,
  };
}
