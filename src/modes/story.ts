import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import type { GameState, MapTheme, Obstacle, PlayerInput, StoryZone } from '../core/types';
import { resolveCombat } from '../entities/combat';
import { spawnCrate, updateCratesAndPickups } from '../entities/crate';
import { spawnEnemy, updateEnemies } from '../entities/enemyFactory';
import { createPlayer, updatePlayer } from '../entities/player';

const STORAGE_KEY = 'arek_slayer_story_progress_v1';

export interface StoryProgress {
  unlockedStage: 1 | 2 | 3;
  clearedStages: number[];
}

export function loadStoryProgress(): StoryProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoryProgress>;
      const unlocked = parsed.unlockedStage === 3 ? 3 : parsed.unlockedStage === 2 ? 2 : 1;
      const cleared = Array.isArray(parsed.clearedStages) ? parsed.clearedStages : [];
      return { unlockedStage: unlocked, clearedStages: cleared };
    }
  } catch {
    // Ignore storage errors
  }
  return { unlockedStage: 1, clearedStages: [] };
}

export function saveStageCleared(stage: 1 | 2 | 3): StoryProgress {
  const prog = loadStoryProgress();
  if (!prog.clearedStages.includes(stage)) {
    prog.clearedStages.push(stage);
  }
  if (stage === 1 && prog.unlockedStage < 2) prog.unlockedStage = 2;
  if (stage === 2 && prog.unlockedStage < 3) prog.unlockedStage = 3;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
  } catch {
    // Ignore storage errors
  }
  return prog;
}

interface StageConfig {
  theme: MapTheme;
  title: string;
  obstacles: Obstacle[];
  crates: Array<{ x: number; y: number }>;
  zones: StoryZone[];
}

function getStageConfig(stage: 1 | 2 | 3): StageConfig {
  if (stage === 1) {
    return {
      theme: 'tambak',
      title: 'STAGE 1 • GANG TAMBAK & KENJERAN',
      obstacles: [
        { x: 430, y: 200, w: 40, h: 28, kind: 'tree' },
        { x: 1360, y: 245, w: 96, h: 48, kind: 'pos_ronda', label: 'POS TAMBAK' },
        { x: 2240, y: 185, w: 66, h: 34, kind: 'gerobak', label: 'ES TEH' },
      ],
      crates: [
        { x: 520, y: 420 },
        { x: 1180, y: 215 },
        { x: 1960, y: 435 },
        { x: 2420, y: 210 },
      ],
      zones: [
        {
          triggerX: 280,
          lockMinX: 36,
          lockMaxX: 930,
          triggered: false,
          cleared: false,
          isBossZone: false,
          spawns: [
            { kind: 'bocil', x: 760, y: 260 },
            { kind: 'bocil', x: 820, y: 410 },
            { kind: 'pelempar_sandal', x: 870, y: 330 },
          ],
        },
        {
          triggerX: 1150,
          lockMinX: 960,
          lockMaxX: 1890,
          triggered: false,
          cleared: false,
          isBossZone: false,
          spawns: [
            { kind: 'bocil', x: 1680, y: 215 },
            { kind: 'bocil', x: 1750, y: 445 },
            { kind: 'pelempar_sandal', x: 1800, y: 280 },
            { kind: 'pelempar_sandal', x: 1820, y: 390 },
          ],
        },
        {
          triggerX: 2080,
          lockMinX: 1920,
          lockMaxX: 2844,
          triggered: false,
          cleared: false,
          isBossZone: true,
          spawns: [
            { kind: 'boss_koordinator', x: 2660, y: 330 },
            { kind: 'bocil', x: 2560, y: 215 },
            { kind: 'pelempar_sandal', x: 2740, y: 445 },
          ],
        },
      ],
    };
  }

  if (stage === 2) {
    return {
      theme: 'tunjungan',
      title: 'STAGE 2 • KAWASAN JALAN TUNJUNGAN',
      obstacles: [
        { x: 460, y: 185, w: 66, h: 34, kind: 'gerobak', label: 'TAHU TEK' },
        { x: 1420, y: 190, w: 66, h: 34, kind: 'gerobak', label: 'LONTONG' },
        { x: 2300, y: 188, w: 66, h: 34, kind: 'gerobak', label: 'KOPI GIRAS' },
      ],
      crates: [
        { x: 640, y: 430 },
        { x: 1240, y: 440 },
        { x: 1920, y: 225 },
        { x: 2480, y: 440 },
      ],
      zones: [
        {
          triggerX: 280,
          lockMinX: 36,
          lockMaxX: 930,
          triggered: false,
          cleared: false,
          isBossZone: false,
          spawns: [
            { kind: 'pelari_cepat', x: 780, y: 240 },
            { kind: 'pelari_cepat', x: 840, y: 420 },
            { kind: 'perisai_kardus', x: 740, y: 330 },
          ],
        },
        {
          triggerX: 1150,
          lockMinX: 960,
          lockMaxX: 1890,
          triggered: false,
          cleared: false,
          isBossZone: false,
          spawns: [
            { kind: 'perisai_kardus', x: 1690, y: 260 },
            { kind: 'perisai_kardus', x: 1710, y: 400 },
            { kind: 'pelari_cepat', x: 1810, y: 220 },
            { kind: 'pelempar_sandal', x: 1830, y: 435 },
          ],
        },
        {
          triggerX: 2080,
          lockMinX: 1920,
          lockMaxX: 2844,
          triggered: false,
          cleared: false,
          isBossZone: true,
          spawns: [
            { kind: 'boss_tunjungan', x: 2660, y: 330 },
            { kind: 'pelari_cepat', x: 2560, y: 225 },
            { kind: 'perisai_kardus', x: 2580, y: 435 },
          ],
        },
      ],
    };
  }

  // Stage 3: Jembatan Suramadu (Malam Hari)
  return {
    theme: 'suramadu',
    title: 'STAGE 3 • JEMBATAN SURAMADU (MALAM)',
    obstacles: [
      { x: 640, y: 215, w: 64, h: 24, kind: 'barrier' },
      { x: 1520, y: 405, w: 64, h: 24, kind: 'barrier' },
      { x: 2340, y: 215, w: 64, h: 24, kind: 'barrier' },
    ],
    crates: [
      { x: 540, y: 425 },
      { x: 1320, y: 215 },
      { x: 1980, y: 430 },
      { x: 2450, y: 435 },
    ],
    zones: [
      {
        triggerX: 280,
        lockMinX: 36,
        lockMaxX: 930,
        triggered: false,
        cleared: false,
        isBossZone: false,
        spawns: [
          { kind: 'elite', x: 790, y: 255 },
          { kind: 'pelari_cepat', x: 840, y: 415 },
          { kind: 'perisai_kardus', x: 750, y: 340 },
          { kind: 'pelempar_sandal', x: 865, y: 325 },
        ],
      },
      {
        triggerX: 1150,
        lockMinX: 960,
        lockMaxX: 1890,
        triggered: false,
        cleared: false,
        isBossZone: false,
        spawns: [
          { kind: 'elite', x: 1700, y: 225 },
          { kind: 'elite', x: 1760, y: 435 },
          { kind: 'perisai_kardus', x: 1680, y: 330 },
          { kind: 'pelempar_sandal', x: 1825, y: 310 },
        ],
      },
      {
        triggerX: 2080,
        lockMinX: 1920,
        lockMaxX: 2844,
        triggered: false,
        cleared: false,
        isBossZone: true,
        spawns: [
          { kind: 'boss_suramadu', x: 2670, y: 330 },
          { kind: 'elite', x: 2560, y: 225 },
        ],
      },
    ],
  };
}

export function createStoryState(
  stageNumber: 1 | 2 | 3,
  paletteIndex = 0,
  customName?: string
): GameState {
  const cfg = getStageConfig(stageNumber);
  const arenaWidth = VIRTUAL_WIDTH * 3; // 2880px 3-zone Surabaya corridor

  const state: GameState = {
    mode: 'story',
    theme: cfg.theme,
    stageNumber,
    stageTitle: cfg.title,
    status: 'playing',
    time: 0,
    arenaWidth,
    arenaHeight: VIRTUAL_HEIGHT,
    cameraX: 0,
    activeMinX: 36,
    activeMaxX: arenaWidth - 36,
    goPromptTimer: 0,
    storyZones: cfg.zones,
    obstacles: cfg.obstacles,
    players: [createPlayer('p1', 120, 340, paletteIndex, customName)],
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

  for (const c of cfg.crates) {
    spawnCrate(state, c.x, c.y);
  }

  return state;
}

export function stepStory(state: GameState, input: PlayerInput, dt: number): void {
  state.soundQueue.length = 0;

  if (state.status !== 'playing') {
    return;
  }

  if (state.shakeTimer > 0) state.shakeTimer = Math.max(0, state.shakeTimer - dt);
  if (state.goPromptTimer > 0) state.goPromptTimer = Math.max(0, state.goPromptTimer - dt);

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  state.time += dt;

  const player = state.players[0];
  if (!player) return;

  // 1. Check Story Encounter Zone Triggers & Locks
  let lockedZone: StoryZone | undefined;
  for (const z of state.storyZones) {
    if (!z.triggered && player.x >= z.triggerX) {
      z.triggered = true;
      for (const sp of z.spawns) {
        spawnEnemy(state, sp.kind, sp.x, sp.y);
      }
      if (z.isBossZone) {
        state.soundQueue.push('ult_start');
        state.shakeTimer = Math.max(state.shakeTimer, 0.25);
        state.shakeIntensity = Math.max(state.shakeIntensity, 6);
        state.floatingTexts.push({
          x: z.lockMinX + 480,
          y: 220,
          vy: -25,
          text: 'AWAS BOSS MUNCUL!',
          color: '#ef4444',
          scale: 1.45,
          life: 1.8,
          maxLife: 1.8,
        });
      }
    }

    if (z.triggered && !z.cleared) {
      lockedZone = z;
      break;
    }
  }

  if (lockedZone) {
    state.activeMinX = lockedZone.lockMinX;
    state.activeMaxX = lockedZone.lockMaxX;
    if (state.enemies.length === 0) {
      lockedZone.cleared = true;
      state.activeMinX = 36;
      state.activeMaxX = state.arenaWidth - 36;

      if (lockedZone.isBossZone) {
        state.status = 'victory';
        saveStageCleared(state.stageNumber);
        state.soundQueue.push('pickup_kopi');
      } else {
        state.goPromptTimer = 3.2;
        state.soundQueue.push('pickup_heal');
      }
    }
  } else {
    state.activeMinX = 36;
    state.activeMaxX = state.arenaWidth - 36;
  }

  // 2. Smooth Horizontal Camera Follow
  const targetCamX = lockedZone
    ? lockedZone.lockMinX - 36
    : Math.max(0, Math.min(state.arenaWidth - VIRTUAL_WIDTH, player.x - VIRTUAL_WIDTH * 0.38));
  state.cameraX += (targetCamX - state.cameraX) * Math.min(1, dt * 6.5);
  state.cameraX = Math.max(0, Math.min(state.arenaWidth - VIRTUAL_WIDTH, state.cameraX));

  // 3. Update Player, Combat, Enemies, Crates & VFX
  updatePlayer(state, player, input, dt);
  resolveCombat(state, dt);
  updateEnemies(state, dt);
  updateCratesAndPickups(state, dt);

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
