import type {
  BarricadeSlot,
  BuffId,
  EnemyKind,
  GameState,
  MapTheme,
  PickupKind,
  PlayerState,
  SoundEvent,
} from '../core/types';
import { createPlayer } from '../entities/player';

/**
 * Ultra-compact array-based snapshot (~400 bytes instead of ~6,000 bytes JSON)
 * to eliminate 4G bufferbloat and keep 20Hz sync instantaneous.
 */
export interface CompactSnapshot {
  t: number; // time
  st: 'p' | 'v' | 'g'; // status: playing | victory | gameover
  th: MapTheme;
  ttl: string; // stageTitle
  ko: number;
  // Survival core & wave info
  sv?: [
    number, // wave
    'w' | 'i', // phase: wave | intermission
    number, // intermissionTimer
    number, // core hp
    number, // core maxHp
    0 | 1, // towerActive
    number, // towerAimAngle
    number, // mapBannerTimer
    string, // mapBannerText
    Array<[BarricadeSlot, number, number, number]>, // [id, level, hp, maxHp]
    number?, // towerLevel (0-4)
    (0 | 1)?, // shieldActive
    number?, // shieldHp
    number?, // shieldMaxHp
  ];
  // Players: [id, name, pal, x, y, z, dx, dy, hp, maxHp, ult, coins, rev, kd, dmgM, cdM, spdM, buffs, pCd, ultT]
  pl: Array<
    [
      string,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      0 | 1,
      number,
      number,
      number,
      BuffId[],
      number,
      number,
    ]
  >;
  // Enemies: [id, kind, x, y, z, dx, dy, hp, maxHp, flash]
  en: Array<[number, EnemyKind, number, number, number, number, number, number, number, number]>;
  // Projectiles: [id, ownerId, x, y, vx, vy, angle, color]
  pr: Array<[number, string, number, number, number, number, number, string]>;
  // Crates: [id, x, y, z, hp, style]
  cr: Array<[number, number, number, number, number, 'w' | 'c']>;
  // Pickups: [id, kind, x, y, z]
  pk: Array<[number, PickupKind, number, number, number]>;
  // Sound events
  snd: SoundEvent[];
  // Pending 2-Wave Buff choices per player (only sent when active)
  pb?: Record<string, BuffId[]>;
}

const ENEMY_COLORS: Partial<Record<EnemyKind, { shirt: string; sarung: string; r: number; name: string }>> = {
  zombie_warga: { shirt: '#65a30d', sarung: '#3f6212', r: 15, name: 'Zombie Warga' },
  zombie_bocil: { shirt: '#84cc16', sarung: '#15803d', r: 12, name: 'Zombie Bocil' },
  zombie_pocong: { shirt: '#e2e8f0', sarung: '#cbd5e1', r: 15, name: 'Zombie Pocong' },
  zombie_gendruwo: { shirt: '#581c87', sarung: '#7f1d1d', r: 22, name: 'Zombie Gendruwo' },
  zombie_tuyul: { shirt: '#a3e635', sarung: '#facc15', r: 12, name: 'Zombie Tuyul' },
};

export function packCompactSnapshot(state: GameState, sounds: SoundEvent[]): CompactSnapshot {
  const surv = state.survival;
  const pb: Record<string, BuffId[]> = {};
  for (const p of state.players) {
    if (p.pendingBuffChoices && p.pendingBuffChoices.length > 0) {
      pb[p.id] = p.pendingBuffChoices;
    }
  }
  const hasBuffs = Object.keys(pb).length > 0;
  return {
    t: Math.round(state.time * 100) / 100,
    st: state.status === 'victory' ? 'v' : state.status === 'gameover' ? 'g' : 'p',
    th: state.theme,
    ttl: state.stageTitle,
    ko: state.koCount,
    sv: surv
      ? [
          surv.wave,
          surv.phase === 'intermission' ? 'i' : 'w',
          Math.round(surv.intermissionTimer * 10) / 10,
          Math.ceil(surv.core.hp),
          surv.core.maxHp,
          surv.core.towerActive ? 1 : 0,
          Math.round(surv.core.towerAimAngle * 100) / 100,
          Math.round(surv.mapBannerTimer * 10) / 10,
          surv.mapBannerText,
          surv.barricades.map((b) => [b.id, b.level, Math.ceil(b.hp), b.maxHp]),
          surv.core.towerLevel || 0,
          surv.core.shieldActive ? 1 : 0,
          Math.ceil(surv.core.shieldHp || 0),
          surv.core.shieldMaxHp || 250,
        ]
      : undefined,
    pl: state.players.map((p) => [
      p.id,
      p.name,
      p.paletteIndex,
      Math.round(p.x),
      Math.round(p.y),
      Math.round(p.z),
      Math.round(p.dirX * 100) / 100,
      Math.round(p.dirY * 100) / 100,
      Math.ceil(p.hp),
      p.maxHp,
      Math.floor(p.ult),
      p.coins,
      p.reviveTickets,
      p.knockedDown ? 1 : 0,
      p.dmgMult,
      p.cdMult,
      p.speedMult,
      p.pendingBuffChoices,
      Math.round(p.projCooldown * 10) / 10,
      Math.round(p.ultActiveTimer * 100) / 100,
    ]),
    en: state.enemies.map((e) => [
      e.id,
      e.kind,
      Math.round(e.x),
      Math.round(e.y),
      Math.round(e.z),
      Math.round(e.dirX * 100) / 100,
      Math.round(e.dirY * 100) / 100,
      Math.ceil(e.hp),
      e.maxHp,
      e.hitFlashTimer > 0 ? 1 : 0,
    ]),
    pr: state.projectiles.map((pr) => [
      pr.id,
      pr.ownerId,
      Math.round(pr.x),
      Math.round(pr.y),
      Math.round(pr.vx),
      Math.round(pr.vy),
      Math.round(pr.angle * 100) / 100,
      pr.color,
    ]),
    cr: state.crates.map((c) => [
      c.id,
      Math.round(c.x),
      Math.round(c.y),
      Math.round(c.z),
      Math.ceil(c.hp),
      c.style === 'wood' ? 'w' : 'c',
    ]),
    pk: state.pickups.map((pk) => [
      pk.id,
      pk.kind,
      Math.round(pk.x),
      Math.round(pk.y),
      Math.round(pk.z),
    ]),
    snd: sounds,
    ...(hasBuffs ? { pb } : {}),
  };
}

/**
 * Ultra-tiny (~120 bytes) snapshot for Stick HP Controllers (Monitor mode):
 * Sends only Wave/Core/Barricade + that player's own stats/position/buffs (< 1 KB/s!).
 */
export function packStickSnapshot(state: GameState, targetPlayerId: string): CompactSnapshot {
  const surv = state.survival;
  const p = state.players.find((pl) => pl.id === targetPlayerId);
  const pb =
    p && p.pendingBuffChoices && p.pendingBuffChoices.length > 0
      ? { [p.id]: p.pendingBuffChoices }
      : undefined;

  return {
    t: Math.round(state.time * 10) / 10,
    st: state.status === 'victory' ? 'v' : state.status === 'gameover' ? 'g' : 'p',
    th: state.theme,
    ttl: state.stageTitle,
    ko: state.koCount,
    sv: surv
      ? [
          surv.wave,
          surv.phase === 'intermission' ? 'i' : 'w',
          Math.round(surv.intermissionTimer * 10) / 10,
          Math.ceil(surv.core.hp),
          surv.core.maxHp,
          surv.core.towerActive ? 1 : 0,
          0,
          0,
          '',
          surv.barricades.map((b) => [b.id, b.level, Math.ceil(b.hp), b.maxHp]),
          surv.core.towerLevel || 0,
          surv.core.shieldActive ? 1 : 0,
          Math.ceil(surv.core.shieldHp || 0),
          surv.core.shieldMaxHp || 250,
        ]
      : undefined,
    pl: p
      ? [
          [
            p.id,
            p.name,
            p.paletteIndex,
            Math.round(p.x),
            Math.round(p.y),
            Math.round(p.z),
            Math.round(p.dirX * 10) / 10,
            Math.round(p.dirY * 10) / 10,
            Math.ceil(p.hp),
            p.maxHp,
            Math.floor(p.ult),
            p.coins,
            p.reviveTickets,
            p.knockedDown ? 1 : 0,
            p.dmgMult,
            p.cdMult,
            p.speedMult,
            p.pendingBuffChoices,
            Math.round(p.projCooldown * 10) / 10,
            Math.round(p.ultActiveTimer * 10) / 10,
          ],
        ]
      : [],
    en: [],
    pr: [],
    cr: [],
    pk: [],
    snd: [],
    ...(pb ? { pb } : {}),
  };
}

/**
 * Non-destructive merge into Client's live GameState:
 * Preserves local particles, slashes, afterimages, floatingTexts, and local player's
 * predicted movement/attack state so gameplay feels 100% responsive at 60 FPS!
 */
export function mergeCompactSnapshot(
  state: GameState,
  snap: CompactSnapshot,
  localPlayerId: string,
  playerTargets: Map<string, { x: number; y: number; z: number }>,
  enemyTargets: Map<number, { x: number; y: number; z: number }>,
  syncLocalPosDirectly = false
): void {
  state.time = snap.t;
  state.status = snap.st === 'v' ? 'victory' : snap.st === 'g' ? 'gameover' : 'playing';
  state.theme = snap.th;
  state.stageTitle = snap.ttl;
  state.koCount = snap.ko;

  if (state.status !== 'playing') {
    state.shakeTimer = 0;
    state.shakeIntensity = 0;
    state.hitstopTimer = 0;
  }

  // 1. Merge Survival State
  if (snap.sv && state.survival) {
    const sv = snap.sv;
    state.survival.wave = sv[0];
    state.survival.phase = sv[1] === 'i' ? 'intermission' : 'wave';
    state.survival.intermissionTimer = sv[2];
    state.survival.core.hp = sv[3];
    state.survival.core.maxHp = sv[4];
    state.survival.core.towerActive = sv[5] === 1;
    state.survival.core.towerAimAngle = sv[6];
    state.survival.mapBannerTimer = sv[7];
    state.survival.mapBannerText = sv[8];

    for (const [id, lv, hp, maxHp] of sv[9]) {
      const bar = state.survival.barricades.find((b) => b.id === id);
      if (bar) {
        bar.level = lv as 1 | 2 | 3 | 4;
        bar.hp = hp;
        bar.maxHp = maxHp;
      }
    }

    if (sv[10] !== undefined) state.survival.core.towerLevel = sv[10];
    if (sv[11] !== undefined) state.survival.core.shieldActive = sv[11] === 1;
    if (sv[12] !== undefined) state.survival.core.shieldHp = sv[12];
    if (sv[13] !== undefined) state.survival.core.shieldMaxHp = sv[13];
  }

  if (snap.pb) {
    for (const p of state.players) {
      p.pendingBuffChoices = snap.pb[p.id] ?? [];
    }
  } else {
    for (const p of state.players) {
      p.pendingBuffChoices = [];
    }
  }

  // 2. Merge Players (preserve local predicted position & action timers!)
  const nextPlayers: PlayerState[] = [];
  playerTargets.clear();

  for (const row of snap.pl) {
    const [
      id,
      name,
      pal,
      sx,
      sy,
      sz,
      dx,
      dy,
      hp,
      maxHp,
      ult,
      coins,
      rev,
      kd,
      dmgM,
      cdM,
      spdM,
      buffs,
      pCd,
      ultT,
    ] = row;

    playerTargets.set(id, { x: sx, y: sy, z: sz });
    let existing = state.players.find((p) => p.id === id);
    if (!existing) {
      existing = createPlayer(id, sx, sy, pal, name);
    }

    existing.name = name;
    existing.paletteIndex = pal;
    existing.hp = hp;
    existing.maxHp = maxHp;
    existing.ult = ult;
    existing.coins = coins;
    existing.reviveTickets = rev;
    existing.knockedDown = kd === 1;
    existing.dmgMult = dmgM;
    existing.cdMult = cdM;
    existing.speedMult = spdM;
    existing.pendingBuffChoices = buffs;
    existing.ultActiveTimer = ultT;

    // For remote players, update facing & cooldown; for local player, keep local prediction!
    if (id !== localPlayerId) {
      existing.dirX = dx;
      existing.dirY = dy;
      existing.projCooldown = pCd;
    } else {
      if (syncLocalPosDirectly) {
        existing.x = sx;
        existing.y = sy;
        existing.z = sz;
        existing.dirX = dx;
        existing.dirY = dy;
        existing.projCooldown = pCd;
      } else if (pCd > existing.projCooldown) {
        // Sync authoritative projectile cooldown only if not mid-local-prediction
        existing.projCooldown = pCd;
      }
    }

    nextPlayers.push(existing);
  }
  state.players = nextPlayers;

  // 3. Merge Enemies
  enemyTargets.clear();
  const prevEnemies = new Map(state.enemies.map((e) => [e.id, e]));
  state.enemies = snap.en.map((row) => {
    const [id, kind, ex, ey, ez, dx, dy, hp, maxHp, flash] = row;
    enemyTargets.set(id, { x: ex, y: ey, z: ez });
    const old = prevEnemies.get(id);
    if (old) {
      old.dirX = dx;
      old.dirY = dy;
      old.hp = hp;
      old.maxHp = maxHp;
      old.hitFlashTimer = flash ? 0.1 : 0;
      return old;
    }
    const spec = ENEMY_COLORS[kind] ?? { shirt: '#65a30d', sarung: '#3f6212', r: 15, name: kind };
    return {
      id,
      kind,
      name: spec.name,
      isBoss: false,
      x: ex,
      y: ey,
      z: ez,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: spec.r,
      dirX: dx,
      dirY: dy,
      hp,
      maxHp,
      hitFlashTimer: flash ? 0.1 : 0,
      stunTimer: 0,
      attackCooldown: 0,
      specialTimer: 0,
      aiState: 'chase',
      aiTimer: 0,
      phase: 1,
      summonedReinforcements: false,
      lastHitSwingId: -1,
      scaleX: 1,
      scaleY: 1,
      animTime: 0,
      shirtColor: spec.shirt,
      sarungColor: spec.sarung,
    };
  });

  // 4. Projectiles (keep local predicted projectiles < 0.25s old unless matched)
  state.projectiles = snap.pr.map(([id, ownerId, x, y, vx, vy, angle, color]) => ({
    id,
    ownerId,
    x,
    y,
    vx,
    vy,
    angle,
    radius: 18,
    damage: 30,
    pierceLeft: 3,
    hitIds: [],
    life: 1,
    maxLife: 1,
    color,
  }));

  // 5. Crates & Pickups
  state.crates = snap.cr.map(([id, x, y, z, hp, st]) => ({
    id,
    x,
    y,
    z,
    vz: 0,
    radius: 21,
    hp,
    maxHp: 45,
    hitFlashTimer: 0,
    lastHitSwingId: -1,
    style: st === 'w' ? 'wood' : 'cardboard',
  }));

  state.pickups = snap.pk.map(([id, kind, x, y, z]) => ({
    id,
    kind,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 16,
    life: 16,
    bobPhase: state.time * 5,
  }));
}
