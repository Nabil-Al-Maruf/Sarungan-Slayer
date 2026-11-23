import type {
  GameState,
  PlayerInput,
  SoundEvent,
  UltType,
} from '../core/types';
import type { ShopItemId } from '../modes/survival';

export type MabarRole = 'coop' | 'stick' | 'monitor';

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  paletteIndex: number;
  role: MabarRole;
  isHost: boolean;
  pingMs?: number;
}

export interface PlayerCompactRow {
  id: string;
  name: string;
  pal: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  dirX: number;
  hp: number;
  maxHp: number;
  ult: number;
  maxUlt: number;
  coins: number;
  animTime: number;
  knockedDown: boolean;
  ultType?: UltType;
  buffCount: number;
  invulnTimer: number;
}

export interface EnemyCompactRow {
  id: number;
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dirX: number;
  aiState: string;
}

export interface CompactGameSnapshot {
  t: 'snap';
  seq: number;
  time: number;
  status: 'playing' | 'victory' | 'gameover';
  wave: number;
  phase: 'wave' | 'intermission';
  intermissionTimer: number;
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
  projectiles?: Array<{ x: number; y: number; kind: string; color: string; radius: number }>;
  sounds: SoundEvent[];
  shakeIntensity: number;
}

export interface StickPersonalSnapshot {
  t: 'stick_snap';
  seq: number;
  hp: number;
  maxHp: number;
  ult: number;
  maxUlt: number;
  coins: number;
  wave: number;
  phase: 'wave' | 'intermission';
  intermissionTimer: number;
  canShop: boolean;
  soundCue?: SoundEvent;
}

export type NetMessage =
  | { t: 'join'; name: string; pal: number; role: MabarRole }
  | { t: 'welcome'; playerId: string; isHost: boolean; hostRole: MabarRole }
  | { t: 'lobby_update'; roomCode: string; players: LobbyPlayerInfo[] }
  | { t: 'start_game' }
  | { t: 'input'; seq: number; input: PlayerInput }
  | { t: 'snap'; snap: CompactGameSnapshot }
  | { t: 'stick_snap'; snap: StickPersonalSnapshot }
  | { t: 'prompt_skill'; kind: 'buff' | 'ult'; choices: string[] }
  | { t: 'pick_skill'; kind: 'buff' | 'ult'; choice: string }
  | { t: 'buy_item'; itemId: ShopItemId }
  | { t: 'skip_intermission' }
  | { t: 'ping'; timestamp: number }
  | { t: 'pong'; timestamp: number }
  | { t: 'toast'; message: string };

/**
 * Compact snapshot packer for 60 FPS local game replication
 */
export function packGameSnapshot(state: GameState, seq: number): CompactGameSnapshot {
  const surv = state.survival;
  const players: PlayerCompactRow[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    pal: p.paletteIndex,
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    z: Math.round(p.z * 10) / 10,
    vx: Math.round(p.vx),
    vy: Math.round(p.vy),
    dirX: p.dirX,
    hp: Math.ceil(p.hp),
    maxHp: p.maxHp,
    ult: Math.floor(p.ult),
    maxUlt: p.maxUlt,
    coins: p.coins,
    animTime: Math.round(p.animTime * 100) / 100,
    knockedDown: p.knockedDown,
    ultType: p.ultType,
    buffCount: p.buffCount,
    invulnTimer: Math.round(p.invulnTimer * 10) / 10,
  }));

  const enemies: EnemyCompactRow[] = state.enemies.map((e) => ({
    id: e.id,
    kind: e.kind,
    x: Math.round(e.x * 10) / 10,
    y: Math.round(e.y * 10) / 10,
    hp: Math.ceil(e.hp),
    maxHp: e.maxHp,
    dirX: e.dirX,
    aiState: e.aiState,
  }));

  const projectiles = state.projectiles.map((pr) => ({
    x: Math.round(pr.x),
    y: Math.round(pr.y),
    kind: pr.kind || 'slash',
    color: pr.color,
    radius: pr.radius,
  }));

  const sounds = [...state.soundQueue];

  return {
    t: 'snap',
    seq,
    time: Math.round(state.time * 100) / 100,
    status: state.status,
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
    sounds,
    shakeIntensity: state.shakeIntensity,
  };
}
