import { ARENA_MAX_X, ARENA_MIN_X, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import type {
  BarricadeSlot,
  BarricadeState,
  EnemyKind,
  GameState,
  MapTheme,
  PlayerInput,
  PlayerState,
} from '../core/types';
import { resolveCombat } from '../entities/combat';
import { spawnCrate, updateCratesAndPickups } from '../entities/crate';
import { spawnEnemy, updateEnemies } from '../entities/enemyFactory';
import { createPlayer, updatePlayer } from '../entities/player';

const BEST_WAVE_KEY = 'arek_slayer_survival_best_v1';

export type ShopItemId =
  | 'barricade_left'
  | 'barricade_top'
  | 'barricade_right'
  | 'tiket_revive'
  | 'es_teh_jumbo'
  | 'kopi_pekat';

export const BARRICADE_MAX_HP: Record<1 | 2 | 3, number> = {
  1: 120,
  2: 240,
  3: 400,
};

export const BARRICADE_TIER_NAME: Record<1 | 2 | 3, string> = {
  1: 'Tumpukan Kardus',
  2: 'Pagar Bambu',
  3: 'Gerobak Besi',
};

export function loadBestWave(): number {
  try {
    const raw = localStorage.getItem(BEST_WAVE_KEY);
    return raw ? Math.max(0, Number(raw) || 0) : 0;
  } catch {
    return 0;
  }
}

export function saveBestWave(wave: number): void {
  try {
    const prev = loadBestWave();
    if (wave > prev) {
      localStorage.setItem(BEST_WAVE_KEY, String(wave));
    }
  } catch {
    // Ignore storage errors
  }
}

export function getThemeForWave(wave: number): { theme: MapTheme; locationName: string } {
  const block = Math.floor((wave - 1) / 10) % 3;
  if (block === 0) return { theme: 'tambak', locationName: 'KAMPUNG TAMBAK' };
  if (block === 1) return { theme: 'tunjungan', locationName: 'ALUN-ALUN TUNJUNGAN' };
  return { theme: 'suramadu', locationName: 'TANJUNG PERAK • SURAMADU' };
}

export function createSurvivalState(
  paletteIndex = 0,
  roster?: Array<{ id: string; paletteIndex: number }>
): GameState {
  const { theme, locationName } = getThemeForWave(1);

  const core = {
    x: 432,
    y: 288,
    w: 96,
    h: 50,
    hp: 500,
    maxHp: 500,
    hitFlashTimer: 0,
  };

  const barricades: BarricadeState[] = [
    {
      id: 'left',
      label: 'BARRICADE KIRI',
      x: 230,
      y: 286,
      w: 28,
      h: 82,
      level: 1,
      hp: BARRICADE_MAX_HP[1],
      maxHp: BARRICADE_MAX_HP[1],
      hitFlashTimer: 0,
    },
    {
      id: 'top',
      label: 'BARRICADE ATAS',
      x: 434,
      y: 180,
      w: 92,
      h: 26,
      level: 1,
      hp: BARRICADE_MAX_HP[1],
      maxHp: BARRICADE_MAX_HP[1],
      hitFlashTimer: 0,
    },
    {
      id: 'right',
      label: 'BARRICADE KANAN',
      x: 702,
      y: 286,
      w: 28,
      h: 82,
      level: 1,
      hp: BARRICADE_MAX_HP[1],
      maxHp: BARRICADE_MAX_HP[1],
      hitFlashTimer: 0,
    },
  ];

  const spawnPoints = [
    { x: 370, y: 345 },
    { x: 590, y: 345 },
    { x: 480, y: 405 },
    { x: 370, y: 255 },
    { x: 590, y: 255 },
  ];

  const players =
    roster && roster.length > 0
      ? roster.map((r, idx) => {
          const pt = spawnPoints[idx % spawnPoints.length];
          return createPlayer(r.id, pt.x, pt.y, r.paletteIndex);
        })
      : [createPlayer('p1', 370, 345, paletteIndex)];

  const state: GameState = {
    mode: 'survival',
    theme,
    stageNumber: 1,
    stageTitle: `WAVE 1 • ${locationName}`,
    status: 'playing',
    time: 0,
    arenaWidth: VIRTUAL_WIDTH,
    arenaHeight: VIRTUAL_HEIGHT,
    cameraX: 0,
    activeMinX: ARENA_MIN_X,
    activeMaxX: ARENA_MAX_X,
    goPromptTimer: 0,
    storyZones: [],
    survival: {
      wave: 1,
      phase: 'wave',
      intermissionTimer: 0,
      zombiesRemainingToSpawn: 5 + players.length * 2,
      spawnTimer: 1.0,
      core,
      barricades,
      mapBannerTimer: 2.6,
      mapBannerText: `WAVE 1 • ${locationName}`,
    },
    obstacles: [],
    players,
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    hazards: [],
    crates: [],
    pickups: [],
    particles: [],
    slashes: [],
    floatingTexts: [],
    soundQueue: [],
    shakeTimer: 0,
    shakeIntensity: 0,
    hitstopTimer: 0,
    koCount: 0,
    nextEntityId: 1,
    crateSpawnTimer: 10,
    enemyRespawnTimer: 0,
  };

  spawnCrate(state, 330, 425);
  return state;
}

export function canOpenWarung(state: GameState, player: PlayerState): boolean {
  const surv = state.survival;
  if (!surv) return false;
  if (surv.phase === 'intermission') return true;
  const cx = surv.core.x + surv.core.w * 0.5;
  const cy = surv.core.y + surv.core.h * 0.5;
  return Math.hypot(player.x - cx, player.y - cy) <= 130;
}

export function getBarricadeActionInfo(bar: BarricadeState): {
  actionLabel: string;
  cost: number;
  disabled: boolean;
} {
  if (bar.hp <= 0) {
    return { actionLabel: `Bangun Ulang (${BARRICADE_TIER_NAME[bar.level]})`, cost: 60, disabled: false };
  }
  if (bar.hp < bar.maxHp) {
    return { actionLabel: `Perbaiki Penuh (Lv.${bar.level})`, cost: 40, disabled: false };
  }
  if (bar.level < 3) {
    const nextLv = (bar.level + 1) as 2 | 3;
    const cost = nextLv === 2 ? 90 : 150;
    return {
      actionLabel: `Upgrade → Lv.${nextLv} ${BARRICADE_TIER_NAME[nextLv]}`,
      cost,
      disabled: false,
    };
  }
  return { actionLabel: 'MAKSIMAL (Lv.3 Penuh)', cost: 0, disabled: true };
}

export function buyShopItem(
  state: GameState,
  player: PlayerState,
  itemId: ShopItemId
): { ok: boolean; message: string } {
  const surv = state.survival;
  if (!surv) return { ok: false, message: 'Bukan mode Survival' };

  if (itemId.startsWith('barricade_')) {
    const slot = itemId.replace('barricade_', '') as BarricadeSlot;
    const bar = surv.barricades.find((b) => b.id === slot);
    if (!bar) return { ok: false, message: 'Barricade tidak ditemukan' };

    const info = getBarricadeActionInfo(bar);
    if (info.disabled) return { ok: false, message: 'Barricade sudah maksimal!' };
    if (player.coins < info.cost) return { ok: false, message: 'Uang Receh kurang rek!' };

    player.coins -= info.cost;
    if (bar.hp <= 0 || bar.hp < bar.maxHp) {
      bar.hp = bar.maxHp;
    } else if (bar.level < 3) {
      bar.level = (bar.level + 1) as 2 | 3;
      bar.maxHp = BARRICADE_MAX_HP[bar.level];
      bar.hp = bar.maxHp;
    }
    state.soundQueue.push('pickup_heal');
    state.floatingTexts.push({
      x: bar.x + bar.w * 0.5,
      y: bar.y - 12,
      vy: -40,
      text: `${bar.label} LV.${bar.level}!`,
      color: '#4ade80',
      scale: 1.05,
      life: 1.1,
      maxLife: 1.1,
    });
    return { ok: true, message: `${bar.label} diperkuat!` };
  }

  if (itemId === 'tiket_revive') {
    const cost = 100;
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };

    // If a teammate is knocked down, revive them immediately; else store ticket!
    const downed = state.players.find((p) => p.knockedDown);
    player.coins -= cost;
    if (downed) {
      downed.knockedDown = false;
      downed.hp = downed.maxHp;
      downed.invulnTimer = 2.0;
      state.soundQueue.push('pickup_kopi');
      return { ok: true, message: 'Rekan tim berhasil dihidupkan!' };
    }
    player.reviveTickets++;
    state.soundQueue.push('pickup_kopi');
    return { ok: true, message: `Tiket Revive dibeli (Total: ${player.reviveTickets})` };
  }

  if (itemId === 'es_teh_jumbo') {
    const cost = 55;
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };
    player.coins -= cost;
    player.hp = player.maxHp;
    surv.core.hp = Math.min(surv.core.maxHp, surv.core.hp + 150);
    state.soundQueue.push('pickup_heal');
    state.floatingTexts.push({
      x: player.x,
      y: player.y - 54,
      vy: -45,
      text: 'ES TEH JUMBO! FULL HP + POS!',
      color: '#4ade80',
      scale: 1.05,
      life: 1.1,
      maxLife: 1.1,
    });
    return { ok: true, message: 'HP Penuh + Pos Ronda +150 HP!' };
  }

  if (itemId === 'kopi_pekat') {
    const cost = 75;
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };
    player.coins -= cost;
    player.ult = player.maxUlt;
    state.soundQueue.push('pickup_kopi');
    state.floatingTexts.push({
      x: player.x,
      y: player.y - 54,
      vy: -45,
      text: 'KOPI PEKAT! ULTIMATE 100%!',
      color: '#fde047',
      scale: 1.08,
      life: 1.1,
      maxLife: 1.1,
    });
    return { ok: true, message: 'Bar Ultimate langsung 100%!' };
  }

  return { ok: false, message: 'Item tidak dikenal' };
}

export function skipIntermission(state: GameState): void {
  const surv = state.survival;
  if (!surv || surv.phase !== 'intermission') return;
  surv.intermissionTimer = 0.05;
}

function pickZombieKindForWave(wave: number): EnemyKind {
  const pool: EnemyKind[] = ['zombie_warga', 'zombie_bocil'];
  if (wave >= 5) pool.push('zombie_pocong');
  if (wave >= 11) pool.push('zombie_gendruwo');
  if (wave >= 21) pool.push('zombie_tuyul');

  return pool[Math.floor(Math.random() * pool.length)];
}

function spawnSurvivalZombie(state: GameState, wave: number): void {
  const kind = pickZombieKindForWave(wave);
  // Spawn from 3 symmetrical lanes (Left, Top Gate, Right)
  const lane = Math.floor(Math.random() * 3);
  let sx = 46;
  let sy = 325;
  if (lane === 0) {
    sx = 42;
    sy = 250 + Math.random() * 170;
  } else if (lane === 1) {
    sx = 415 + Math.random() * 130;
    sy = 142;
  } else {
    sx = VIRTUAL_WIDTH - 42;
    sy = 250 + Math.random() * 170;
  }

  const z = spawnEnemy(state, kind, sx, sy);
  // Scale HP slightly each wave
  const hpMult = 1 + (wave - 1) * 0.1;
  z.hp = Math.round(z.hp * hpMult);
  z.maxHp = z.hp;
}

const IDLE_INPUT: PlayerInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  jumpPressed: false,
  dashPressed: false,
  meleePressed: false,
  projPressed: false,
  ultPressed: false,
  shopPressed: false,
};

export function stepSurvival(
  state: GameState,
  inputs: PlayerInput | Record<string, PlayerInput>,
  dt: number
): void {
  state.soundQueue.length = 0;
  const surv = state.survival;
  if (!surv || state.status !== 'playing') return;

  if (state.shakeTimer > 0) state.shakeTimer = Math.max(0, state.shakeTimer - dt);
  if (surv.core.hitFlashTimer > 0) surv.core.hitFlashTimer = Math.max(0, surv.core.hitFlashTimer - dt);
  if (surv.mapBannerTimer > 0) surv.mapBannerTimer = Math.max(0, surv.mapBannerTimer - dt);
  for (const bar of surv.barricades) {
    if (bar.hitFlashTimer > 0) bar.hitFlashTimer = Math.max(0, bar.hitFlashTimer - dt);
  }

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  state.time += dt;

  // 1. Update All Players (1..5 players in Mabar Survival)
  const isSingleInput = 'up' in inputs;
  for (const player of state.players) {
    if (player.knockedDown) continue;
    const pInput = isSingleInput
      ? (inputs as PlayerInput)
      : (inputs as Record<string, PlayerInput>)[player.id] ?? IDLE_INPUT;
    updatePlayer(state, player, pInput, dt);
  }

  // 2. Wave / Intermission State Machine
  if (surv.phase === 'wave') {
    if (surv.zombiesRemainingToSpawn > 0) {
      surv.spawnTimer -= dt;
      if (surv.spawnTimer <= 0) {
        spawnSurvivalZombie(state, surv.wave);
        surv.zombiesRemainingToSpawn--;
        const baseInterval = Math.max(0.45, 1.55 - surv.wave * 0.055);
        surv.spawnTimer = baseInterval * (0.75 + Math.random() * 0.5);
      }
    } else if (state.enemies.length === 0) {
      // Wave cleared! Enter 10s Intermission (Warung buka!)
      saveBestWave(surv.wave);
      surv.phase = 'intermission';
      surv.intermissionTimer = 10.0;
      state.soundQueue.push('pickup_kopi');
      surv.mapBannerText = `WAVE ${surv.wave} BERES! JEDA WARUNG 10 DETIK`;
      surv.mapBannerTimer = 2.8;
    }
  } else {
    surv.intermissionTimer -= dt;
    if (surv.intermissionTimer <= 0) {
      surv.wave++;
      surv.phase = 'wave';
      surv.zombiesRemainingToSpawn = 5 + surv.wave * 2;
      surv.spawnTimer = 0.8;

      const { theme, locationName } = getThemeForWave(surv.wave);
      const changedMap = theme !== state.theme;
      state.theme = theme;
      state.stageTitle = `WAVE ${surv.wave} • ${locationName}`;

      if (changedMap) {
        state.soundQueue.push('ult_start');
        surv.mapBannerText = `PINDAH LOKASI: ${locationName}!`;
        surv.mapBannerTimer = 3.5;
        // Bonus heal core slightly on map rotation!
        surv.core.hp = Math.min(surv.core.maxHp, surv.core.hp + 100);
      } else {
        surv.mapBannerText = `WAVE ${surv.wave} DIMULAI!`;
        surv.mapBannerTimer = 2.0;
      }
    }
  }

  // 3. Resolve Combat, Enemies & Crates
  resolveCombat(state, dt);
  updateEnemies(state, dt);
  updateCratesAndPickups(state, dt);

  // Periodic logistics crate drop
  if (state.crates.length < 2) {
    state.crateSpawnTimer -= dt;
    if (state.crateSpawnTimer <= 0) {
      state.crateSpawnTimer = 11.5;
      const spots = [
        { x: 330, y: 425 },
        { x: 630, y: 425 },
        { x: 340, y: 240 },
        { x: 620, y: 240 },
      ];
      const s = spots[Math.floor(Math.random() * spots.length)];
      spawnCrate(state, s.x, s.y, 120);
    }
  }

  // 4. Visual effects
  for (let i = state.slashes.length - 1; i >= 0; i--) {
    state.slashes[i].life -= dt;
    if (state.slashes[i].life <= 0) state.slashes.splice(i, 1);
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.vz -= p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z = Math.max(0, p.z + p.vz * dt);
    p.alpha = Math.max(0, p.life / p.maxLife);
  }

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.life -= dt;
    if (ft.life <= 0) {
      state.floatingTexts.splice(i, 1);
      continue;
    }
    ft.y += ft.vy * dt;
    ft.vy *= Math.pow(0.25, dt);
  }
}
