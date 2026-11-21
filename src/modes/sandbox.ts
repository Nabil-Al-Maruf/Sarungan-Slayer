import { ARENA_MAX_X, ARENA_MIN_X, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import type { GameState, PlayerInput } from '../core/types';
import { resolveCombat } from '../entities/combat';
import { spawnCrate, updateCratesAndPickups } from '../entities/crate';
import { spawnEnemy, updateEnemies } from '../entities/enemyFactory';
import { createPlayer, updatePlayer } from '../entities/player';

export function createSandboxState(paletteIndex = 0, customName?: string): GameState {
  const state: GameState = {
    mode: 'sandbox',
    theme: 'tambak',
    stageNumber: 1,
    stageTitle: 'ARENA LATIHAN • KAMPUNG TAMBAK',
    status: 'playing',
    time: 0,
    arenaWidth: VIRTUAL_WIDTH,
    arenaHeight: VIRTUAL_HEIGHT,
    cameraX: 0,
    activeMinX: ARENA_MIN_X,
    activeMaxX: ARENA_MAX_X,
    goPromptTimer: 0,
    storyZones: [],
    obstacles: [
      { x: 432, y: 274, w: 96, h: 48, kind: 'pos_ronda', label: 'POS RONDA' },
      { x: 112, y: 185, w: 40, h: 28, kind: 'tree' },
      { x: 785, y: 192, w: 66, h: 34, kind: 'gerobak', label: 'TAHU TEK' },
    ],
    players: [createPlayer('p1', 260, 345, paletteIndex, customName)],
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
    crateSpawnTimer: 6,
    enemyRespawnTimer: 2,
  };

  spawnEnemy(state, 'bocil', 670, 330);
  spawnEnemy(state, 'bocil', 720, 435);
  spawnEnemy(state, 'dummy', 625, 225);

  spawnCrate(state, 220, 235);
  spawnCrate(state, 480, 425);

  return state;
}

export function stepSandbox(state: GameState, input: PlayerInput, dt: number): void {
  state.soundQueue.length = 0;

  if (state.shakeTimer > 0) {
    state.shakeTimer = Math.max(0, state.shakeTimer - dt);
  }

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  state.time += dt;

  const player = state.players[0];
  if (player) {
    updatePlayer(state, player, input, dt);
  }

  resolveCombat(state, dt);
  updateEnemies(state, dt);

  if (state.enemies.length < 3) {
    state.enemyRespawnTimer -= dt;
    if (state.enemyRespawnTimer <= 0) {
      state.enemyRespawnTimer = 1.8;
      const hasDummy = state.enemies.some((e) => e.kind === 'dummy');
      if (!hasDummy) {
        spawnEnemy(state, 'dummy', 625, 225);
      } else {
        const spots = [
          { x: 90, y: 390 },
          { x: 860, y: 360 },
          { x: 760, y: 460 },
          { x: 180, y: 470 },
        ];
        const s = spots[Math.floor(Math.random() * spots.length)];
        spawnEnemy(state, 'bocil', s.x, s.y);
      }
    }
  }

  updateCratesAndPickups(state, dt);

  if (state.crates.length < 2) {
    state.crateSpawnTimer -= dt;
    if (state.crateSpawnTimer <= 0) {
      state.crateSpawnTimer = 6.5;
      const spots = [
        { x: 220, y: 235 },
        { x: 480, y: 425 },
        { x: 720, y: 270 },
        { x: 310, y: 440 },
      ];
      const s = spots[Math.floor(Math.random() * spots.length)];
      spawnCrate(state, s.x, s.y, 120);
    }
  }

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
