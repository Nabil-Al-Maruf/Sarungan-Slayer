import { circlesOverlap, stepTopDownPhysics } from '../core/physics';
import type { EnemyKind, EnemyState, GameState } from '../core/types';
import { getZombieDealtDmgMatchup } from '../core/zombieMatchups';
import { BARRICADE_MAX_HP } from '../modes/survival';
import { handleDefenseKill } from './combat';
import { damagePlayer } from './player';

interface EnemySpec {
  name: string;
  hp: number;
  radius: number;
  isBoss: boolean;
  shirtColor: string;
  sarungColor: string;
}

const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
  dummy: {
    name: 'Samsak Kampung',
    hp: 110,
    radius: 16,
    isBoss: false,
    shirtColor: '#64748b',
    sarungColor: '#cbd5e1',
  },
  bocil: {
    name: 'Bocil Sarung',
    hp: 65,
    radius: 14,
    isBoss: false,
    shirtColor: '#f97316',
    sarungColor: '#0ea5e9',
  },
  pelempar_sandal: {
    name: 'Pelempar Sandal',
    hp: 75,
    radius: 15,
    isBoss: false,
    shirtColor: '#84cc16',
    sarungColor: '#ca8a04',
  },
  pelari_cepat: {
    name: 'Geng Pelari Cepat',
    hp: 70,
    radius: 14,
    isBoss: false,
    shirtColor: '#ec4899',
    sarungColor: '#1e293b',
  },
  perisai_kardus: {
    name: 'Perisai Kardus',
    hp: 120,
    radius: 17,
    isBoss: false,
    shirtColor: '#a855f7',
    sarungColor: '#d97706',
  },
  elite: {
    name: 'Pasukan Elite',
    hp: 115,
    radius: 16,
    isBoss: false,
    shirtColor: '#dc2626',
    sarungColor: '#facc15',
  },
  boss_koordinator: {
    name: 'CAK KOORDINATOR KAMPUNG SEBELAH',
    hp: 420,
    radius: 26,
    isBoss: true,
    shirtColor: '#16a34a',
    sarungColor: '#facc15',
  },
  boss_tunjungan: {
    name: 'JAGOAN SARUNG TUNJUNGAN',
    hp: 540,
    radius: 26,
    isBoss: true,
    shirtColor: '#f59e0b',
    sarungColor: '#dc2626',
  },
  boss_suramadu: {
    name: 'RAJA SARUNG BAJA SURAMADU',
    hp: 700,
    radius: 28,
    isBoss: true,
    shirtColor: '#334155',
    sarungColor: '#38bdf8',
  },
  zombie_warga: {
    name: 'Zombie Warga',
    hp: 70,
    radius: 15,
    isBoss: false,
    shirtColor: '#65a30d',
    sarungColor: '#3f6212',
  },
  zombie_bocil: {
    name: 'Zombie Bocil',
    hp: 48,
    radius: 12,
    isBoss: false,
    shirtColor: '#84cc16',
    sarungColor: '#15803d',
  },
  zombie_pocong: {
    name: 'Zombie Pocong',
    hp: 90,
    radius: 15,
    isBoss: false,
    shirtColor: '#e2e8f0',
    sarungColor: '#cbd5e1',
  },
  zombie_gendruwo: {
    name: 'Zombie Gendruwo',
    hp: 210,
    radius: 22,
    isBoss: false,
    shirtColor: '#581c87',
    sarungColor: '#7f1d1d',
  },
  zombie_tuyul: {
    name: 'Zombie Tuyul',
    hp: 65,
    radius: 12,
    isBoss: false,
    shirtColor: '#a3e635',
    sarungColor: '#facc15',
  },
  zombie_kuntilanak: {
    name: 'Kuntilanak Terbang',
    hp: 85,
    radius: 15,
    isBoss: false,
    shirtColor: '#f8fafc',
    sarungColor: '#e2e8f0',
  },
  zombie_petasan: {
    name: 'Bocil Petasan',
    hp: 55,
    radius: 13,
    isBoss: false,
    shirtColor: '#dc2626',
    sarungColor: '#991b1b',
  },
  zombie_buto_ijo: {
    name: 'Buto Ijo Lendir',
    hp: 300,
    radius: 23,
    isBoss: false,
    shirtColor: '#15803d',
    sarungColor: '#4c1d95',
  },
  zombie_dukun: {
    name: 'Mbah Dukun Santet',
    hp: 135,
    radius: 16,
    isBoss: false,
    shirtColor: '#1e1b4b',
    sarungColor: '#78350f',
  },
};

export function spawnEnemy(
  state: GameState,
  kind: EnemyKind,
  x: number,
  y: number
): EnemyState {
  const spec = ENEMY_SPECS[kind];
  const enemy: EnemyState = {
    id: state.nextEntityId++,
    kind,
    name: spec.name,
    isBoss: spec.isBoss,
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: spec.radius,
    dirX: -1,
    dirY: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    hitFlashTimer: 0,
    stunTimer: 0,
    attackCooldown: 1.0,
    specialTimer: spec.isBoss ? 2.0 : 1.6 + Math.random() * 0.8,
    aiState: 'chase',
    aiTimer: 0,
    phase: 1,
    summonedReinforcements: false,
    lastHitSwingId: -1,
    scaleX: 1,
    scaleY: 1,
    animTime: Math.random() * 10,
    shirtColor: spec.shirtColor,
    sarungColor: spec.sarungColor,
  };
  state.enemies.push(enemy);
  return enemy;
}

export function updateEnemies(state: GameState, dt: number): void {
  // Find closest alive player for AI targeting
  const alivePlayers = state.players.filter((p) => !p.knockedDown);

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    if (enemy.hp <= 0) {
      state.enemies.splice(i, 1);
      continue;
    }

    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
    if (enemy.stunTimer > 0) enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
    if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    if (enemy.specialTimer > 0) enemy.specialTimer = Math.max(0, enemy.specialTimer - dt);

    const targetPlayer =
      alivePlayers.length > 0
        ? alivePlayers.reduce((closest, p) => {
            const d1 = Math.hypot(p.x - enemy.x, p.y - enemy.y);
            const d2 = Math.hypot(closest.x - enemy.x, closest.y - enemy.y);
            return d1 < d2 ? p : closest;
          }, alivePlayers[0])
        : state.players[0];

    if (enemy.stunTimer > 0 || enemy.kind === 'dummy' || !targetPlayer) {
      enemy.vx *= Math.pow(0.03, dt);
      enemy.vy *= Math.pow(0.03, dt);
    } else if (enemy.kind.startsWith('zombie_') && state.survival) {
      updateZombieSurvivalAI(state, enemy, dt);
    } else if (enemy.isBoss) {
      updateBossAI(state, enemy, targetPlayer.x, targetPlayer.y, dt);
    } else {
      updateRegularEnemyAI(state, enemy, targetPlayer.x, targetPlayer.y, dt);
    }

    // Contact bump damage against all alive players
    if (enemy.kind !== 'dummy' && enemy.attackCooldown <= 0 && enemy.z < 22) {
      for (const targetPlayer of state.players) {
        if (targetPlayer.knockedDown || targetPlayer.z >= 22) continue;
        if (
          circlesOverlap(
            enemy.x,
            enemy.y,
            enemy.radius,
            targetPlayer.x,
            targetPlayer.y,
            targetPlayer.radius
          )
        ) {
          // Petasan detonates upon contact!
          if (enemy.kind === 'zombie_petasan') {
            explodePetasan(state, enemy);
            break;
          }

          enemy.attackCooldown = enemy.isBoss ? 0.95 : 1.15;
          const baseDmg =
            enemy.isBoss
              ? 16
              : enemy.kind === 'zombie_buto_ijo'
                ? 22
                : enemy.kind === 'zombie_gendruwo'
                  ? 18
                  : enemy.kind === 'zombie_kuntilanak'
                    ? 14
                    : enemy.kind === 'elite'
                      ? 14
                      : 10;
          const zMatchup = getZombieDealtDmgMatchup(enemy.kind, targetPlayer.heroId);
          const dmg = Math.max(1, Math.round(baseDmg * zMatchup.mult));
          const dx = targetPlayer.x - enemy.x;
          const dy = targetPlayer.y - enemy.y;
          const d = Math.hypot(dx, dy) || 1;
          damagePlayer(state, targetPlayer, dmg, dx / d, dy / d);

          if (zMatchup.relation === 'strong') {
            state.floatingTexts.push({
              x: targetPlayer.x,
              y: targetPlayer.y - targetPlayer.z - 56,
              vy: -48,
              text: `⚠️ COUNTER ZOMBIE (-${dmg})!`,
              color: '#f87171',
              scale: 0.95,
              life: 0.85,
              maxLife: 0.85,
            });
          }

          // Tuyul steals a bit of Uang Receh on hit!
          if (enemy.kind === 'zombie_tuyul' && targetPlayer.coins > 0) {
            const stolen = Math.min(targetPlayer.coins, 15);
            targetPlayer.coins -= stolen;
            state.floatingTexts.push({
              x: targetPlayer.x,
              y: targetPlayer.y - 64,
              vy: -45,
              text: `-${stolen} DICURI TUYUL!`,
              color: '#facc15',
              scale: 0.92,
              life: 0.9,
              maxLife: 0.9,
            });
          }
          break;
        }
      }
    }

    stepTopDownPhysics(enemy, dt, state.obstacles, state.activeMinX, state.activeMaxX);
    enemy.scaleX += (1 - enemy.scaleX) * Math.min(1, dt * 14);
    enemy.scaleY += (1 - enemy.scaleY) * Math.min(1, dt * 14);
    const spd = Math.hypot(enemy.vx, enemy.vy);
    enemy.animTime += dt * (spd > 15 ? 11 : 3);
  }
}

function updateRegularEnemyAI(
  state: GameState,
  enemy: EnemyState,
  px: number,
  py: number,
  dt: number
): void {
  const dx = px - enemy.x;
  const dy = py - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  enemy.dirX = dx / d;
  enemy.dirY = dy / d;

  if (enemy.kind === 'pelempar_sandal') {
    // Keep ranged spacing (~200–270px) and throw spinning flip-flops!
    let desiredSpd = 0;
    if (d > 265) desiredSpd = 105;
    else if (d < 165) desiredSpd = -85;

    enemy.vx += (enemy.dirX * desiredSpd - enemy.vx) * Math.min(1, dt * 6);
    enemy.vy += (enemy.dirY * desiredSpd - enemy.vy) * Math.min(1, dt * 6);

    if (enemy.specialTimer <= 0 && d < 460) {
      enemy.specialTimer = 2.2 + Math.random() * 0.6;
      enemy.scaleX = 1.2;
      enemy.scaleY = 0.84;
      state.soundQueue.push('kibas');
      state.enemyProjectiles.push({
        id: state.nextEntityId++,
        kind: 'sandal',
        x: enemy.x + enemy.dirX * 16,
        y: enemy.y + enemy.dirY * 12,
        vx: enemy.dirX * 310,
        vy: enemy.dirY * 310,
        angle: Math.atan2(enemy.dirY, enemy.dirX),
        spin: 14,
        radius: 12,
        damage: 11,
        life: 1.8,
        maxLife: 1.8,
        color: '#22c55e',
      });
    }
    return;
  }

  let speed = 105;
  if (enemy.kind === 'pelari_cepat') speed = 175;
  else if (enemy.kind === 'perisai_kardus') speed = 82;
  else if (enemy.kind === 'elite') speed = 165;

  if (d > 22) {
    enemy.vx += (enemy.dirX * speed - enemy.vx) * Math.min(1, dt * 7);
    enemy.vy += (enemy.dirY * speed - enemy.vy) * Math.min(1, dt * 7);
  } else {
    enemy.vx *= Math.pow(0.05, dt);
    enemy.vy *= Math.pow(0.05, dt);
  }
}

function updateBossAI(
  state: GameState,
  boss: EnemyState,
  px: number,
  py: number,
  dt: number
): void {
  const dx = px - boss.x;
  const dy = py - boss.y;
  const d = Math.hypot(dx, dy) || 1;

  // Stage 3 Boss Phase 2 transition (< 50% HP)
  if (boss.kind === 'boss_suramadu' && boss.phase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.phase = 2;
    boss.scaleX = 1.35;
    boss.scaleY = 0.72;
    state.soundQueue.push('ult_start');
    state.shakeTimer = Math.max(state.shakeTimer, 0.35);
    state.shakeIntensity = Math.max(state.shakeIntensity, 7);
    state.floatingTexts.push({
      x: boss.x,
      y: boss.y - 84,
      vy: -35,
      text: 'FASE 2: SARUNG BAJA AMUK!',
      color: '#38bdf8',
      scale: 1.3,
      life: 1.6,
      maxLife: 1.6,
    });

    if (!boss.summonedReinforcements) {
      boss.summonedReinforcements = true;
      if (state.survival) {
        spawnEnemy(state, 'zombie_gendruwo', Math.max(120, boss.x - 90), 220);
        spawnEnemy(state, 'zombie_gendruwo', Math.min(840, boss.x + 90), 220);
      } else {
        spawnEnemy(state, 'elite', Math.max(state.activeMinX + 40, boss.x - 120), 210);
        spawnEnemy(state, 'elite', Math.min(state.activeMaxX - 40, boss.x + 80), 420);
      }
    }
  }

  // Boss Barricade & Core destruction in Survival Mode
  if (state.survival) {
    const surv = state.survival;
    for (const bar of surv.barricades) {
      if (bar.hp <= 0) continue;
      const bx = bar.x + bar.w * 0.5;
      const by = bar.y + bar.h * 0.5;
      const dist = Math.hypot(boss.x - bx, boss.y - by);
      if (dist < Math.max(bar.w, bar.h) * 0.6 + boss.radius) {
        if (boss.aiState === 'dash') {
          // Dash smashes through barricade!
          bar.hp = Math.max(0, bar.hp - 55);
          bar.hitFlashTimer = 0.2;
          state.soundQueue.push('crate_break');
          state.shakeTimer = Math.max(state.shakeTimer, 0.2);
          state.shakeIntensity = Math.max(state.shakeIntensity, 6);
        } else if (boss.attackCooldown <= 0) {
          boss.attackCooldown = 1.0;
          bar.hp = Math.max(0, bar.hp - 35);
          bar.hitFlashTimer = 0.15;
          state.soundQueue.push('crate_hit');
        }
        if (bar.hp <= 0) {
          bar.hp = 0;
          bar.level = 1;
          bar.maxHp = BARRICADE_MAX_HP[1];
          state.soundQueue.push('crate_break');
          state.floatingTexts.push({
            x: bx,
            y: bar.y - 12,
            vy: -40,
            text: `${bar.label} DIHANCURKAN BOSS!`,
            color: '#ef4444',
            scale: 1.1,
            life: 1.4,
            maxLife: 1.4,
          });
        }
      }
    }

    const coreCx = surv.core.x + surv.core.w * 0.5;
    const coreCy = surv.core.y + surv.core.h * 0.5;
    if (Math.hypot(boss.x - coreCx, boss.y - coreCy) < 64 + boss.radius) {
      if (boss.attackCooldown <= 0) {
        boss.attackCooldown = 1.1;
        const bDmg = 38;
        if (surv.core.shieldActive && surv.core.shieldHp > 0) {
          surv.core.shieldHp = Math.max(0, surv.core.shieldHp - bDmg);
          surv.core.hitFlashTimer = 0.18;
          state.soundQueue.push('hit');
          state.floatingTexts.push({
            x: coreCx,
            y: surv.core.y - 30,
            vy: -40,
            text: `-${bDmg} TAMENG (HANTAMAN BOSS!)`,
            color: '#38bdf8',
            scale: 1.05,
            life: 0.9,
            maxLife: 0.9,
          });
          if (surv.core.shieldHp <= 0) {
            surv.core.shieldActive = false;
            state.soundQueue.push('crate_break');
          }
        } else {
          surv.core.hp = Math.max(0, surv.core.hp - bDmg);
          surv.core.hitFlashTimer = 0.18;
          state.soundQueue.push('player_hurt');
          state.shakeTimer = Math.max(state.shakeTimer, 0.2);
          state.shakeIntensity = Math.max(state.shakeIntensity, 6);
          state.floatingTexts.push({
            x: coreCx,
            y: surv.core.y - 25,
            vy: -45,
            text: `-${bDmg} POS RONDA (HANTAMAN BOSS!)`,
            color: '#ef4444',
            scale: 1.1,
            life: 0.9,
            maxLife: 0.9,
          });
          if (surv.core.hp <= 0) {
            state.status = 'gameover';
            state.soundQueue.push('ko');
          }
        }
      }
    }
  }

  // Handle active boss special states
  if (boss.aiState === 'windup') {
    boss.aiTimer -= dt;
    boss.vx *= Math.pow(0.01, dt);
    boss.vy *= Math.pow(0.01, dt);
    boss.dirX = dx / d;
    boss.dirY = dy / d;
    if (boss.aiTimer <= 0) {
      boss.aiState = 'dash';
      boss.aiTimer = 0.32;
      boss.vx = boss.dirX * (boss.phase === 2 ? 520 : 450);
      boss.vy = boss.dirY * (boss.phase === 2 ? 520 : 450);
      state.soundQueue.push('dash');
    }
    return;
  }

  if (boss.aiState === 'dash') {
    boss.aiTimer -= dt;
    if (boss.aiTimer <= 0) {
      boss.aiState = 'chase';
      boss.specialTimer = boss.phase === 2 ? 1.5 : 2.1;
    }
    return;
  }

  if (boss.aiState === 'jump_slam') {
    boss.aiTimer -= dt;
    if (boss.z === 0 && boss.aiTimer <= 0.15) {
      boss.aiState = 'chase';
      boss.specialTimer = boss.phase === 2 ? 1.6 : 2.2;
    }
    return;
  }

  // Default chase movement
  boss.dirX = dx / d;
  boss.dirY = dy / d;
  const chaseSpeed = boss.phase === 2 ? 140 : 112;
  if (d > 48) {
    boss.vx += (boss.dirX * chaseSpeed - boss.vx) * Math.min(1, dt * 6);
    boss.vy += (boss.dirY * chaseSpeed - boss.vy) * Math.min(1, dt * 6);
  } else {
    boss.vx *= Math.pow(0.05, dt);
    boss.vy *= Math.pow(0.05, dt);
  }

  // Trigger special attack
  if (boss.specialTimer <= 0) {
    const roll = Math.random();

    if (boss.kind === 'boss_koordinator') {
      if (roll < 0.5) {
        // Jump Slam onto player's position
        boss.aiState = 'jump_slam';
        boss.aiTimer = 0.72;
        boss.vz = 500;
        boss.vx = (px - boss.x) * 1.45;
        boss.vy = (py - boss.y) * 1.45;
        state.soundQueue.push('jump');
        state.hazards.push({
          id: state.nextEntityId++,
          kind: 'slam',
          x: px,
          y: py,
          radius: 74,
          delay: 0.68,
          maxDelay: 0.68,
          damage: 20,
          detonated: false,
          flashTimer: 0,
        });
      } else {
        // Pecutan Sarung Jarak Jauh (3-way wave)
        boss.specialTimer = 2.3;
        fireWaveSpread(state, boss, 3, 0.28, 330, 'sarung_wave', '#4ade80', 14);
      }
    } else if (boss.kind === 'boss_tunjungan') {
      if (roll < 0.5) {
        // Dash Beruntun
        boss.aiState = 'windup';
        boss.aiTimer = 0.34;
        boss.hitFlashTimer = 0.25;
        state.floatingTexts.push({
          x: boss.x,
          y: boss.y - 72,
          vy: -35,
          text: 'AWAS DASH!',
          color: '#fb923c',
          scale: 1.05,
          life: 0.6,
          maxLife: 0.6,
        });
      } else {
        // Hujan Mercon Banting (5 telegraphed red blast circles)
        boss.specialTimer = 2.5;
        state.soundQueue.push('pecut');
        state.floatingTexts.push({
          x: boss.x,
          y: boss.y - 72,
          vy: -35,
          text: 'HUJAN MERCON!',
          color: '#ef4444',
          scale: 1.1,
          life: 0.85,
          maxLife: 0.85,
        });
        for (let k = 0; k < 5; k++) {
          const hx =
            k === 0
              ? px
              : state.activeMinX + 70 + Math.random() * (state.activeMaxX - state.activeMinX - 140);
          const hy = k === 0 ? py : 165 + Math.random() * 310;
          state.hazards.push({
            id: state.nextEntityId++,
            kind: 'mercon',
            x: hx,
            y: hy,
            radius: 56,
            delay: 0.85 + k * 0.12,
            maxDelay: 0.85 + k * 0.12,
            damage: 18,
            detonated: false,
            flashTimer: 0,
          });
        }
      }
    } else if (boss.kind === 'boss_suramadu') {
      if (roll < 0.36) {
        // Steel Sarung 5-way fan
        boss.specialTimer = boss.phase === 2 ? 1.7 : 2.2;
        fireWaveSpread(
          state,
          boss,
          boss.phase === 2 ? 5 : 3,
          0.24,
          370,
          'baja_wave',
          '#38bdf8',
          16
        );
      } else if (roll < 0.68) {
        // Steel Dash
        boss.aiState = 'windup';
        boss.aiTimer = boss.phase === 2 ? 0.25 : 0.34;
        boss.hitFlashTimer = 0.22;
      } else {
        // Suramadu Thunder Slam + Mercon
        boss.specialTimer = boss.phase === 2 ? 1.9 : 2.5;
        for (let k = 0; k < (boss.phase === 2 ? 6 : 4); k++) {
          const hx =
            k === 0
              ? px
              : state.activeMinX + 70 + Math.random() * (state.activeMaxX - state.activeMinX - 140);
          const hy = k === 0 ? py : 165 + Math.random() * 310;
          state.hazards.push({
            id: state.nextEntityId++,
            kind: 'mercon',
            x: hx,
            y: hy,
            radius: 60,
            delay: 0.8 + k * 0.1,
            maxDelay: 0.8 + k * 0.1,
            damage: 20,
            detonated: false,
            flashTimer: 0,
          });
        }
      }
    }
  }
}

function fireWaveSpread(
  state: GameState,
  boss: EnemyState,
  count: number,
  stepAngle: number,
  speed: number,
  kind: 'sarung_wave' | 'baja_wave',
  color: string,
  damage: number
): void {
  const baseAngle = Math.atan2(boss.dirY, boss.dirX);
  const half = (count - 1) * 0.5;
  state.soundQueue.push('pecut');

  for (let k = 0; k < count; k++) {
    const a = baseAngle + (k - half) * stepAngle;
    state.enemyProjectiles.push({
      id: state.nextEntityId++,
      kind,
      x: boss.x + Math.cos(a) * 24,
      y: boss.y + Math.sin(a) * 18,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      angle: a,
      spin: 0,
      radius: 16,
      damage,
      life: 2.0,
      maxLife: 2.0,
      color,
    });
  }
}

export function explodePetasan(state: GameState, petasan: EnemyState): void {
  if (petasan.hp <= 0 && petasan.aiState === 'jump_slam') return;
  petasan.hp = 0;
  petasan.aiState = 'jump_slam';

  const ex = petasan.x;
  const ey = petasan.y;
  const radius = 68;
  const damage = 34;

  state.soundQueue.push('crate_break');
  state.shakeTimer = Math.max(state.shakeTimer, 0.22);
  state.shakeIntensity = Math.max(state.shakeIntensity, 6);

  state.floatingTexts.push({
    x: ex,
    y: ey - 32,
    vy: -55,
    text: 'DORRR! 💥',
    color: '#ef4444',
    scale: 1.35,
    life: 1.0,
    maxLife: 1.0,
  });

  // Fiery explosion particles
  for (let k = 0; k < 18; k++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 70 + Math.random() * 210;
    state.particles.push({
      x: ex,
      y: ey,
      z: 10,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd * 0.75,
      vz: 80 + Math.random() * 180,
      size: 4 + Math.random() * 4,
      color: k % 3 === 0 ? '#ef4444' : k % 3 === 1 ? '#f97316' : '#fde047',
      alpha: 1,
      life: 0.35 + Math.random() * 0.2,
      maxLife: 0.55,
      gravity: 520,
    });
  }

  // Damage players caught in blast
  for (const player of state.players) {
    if (player.knockedDown || player.z >= 24) continue;
    const d = Math.hypot(player.x - ex, player.y - ey);
    if (d <= radius + player.radius) {
      const nx = d > 1 ? (player.x - ex) / d : 1;
      const ny = d > 1 ? (player.y - ey) / d : 0;
      damagePlayer(state, player, damage, nx, ny);
    }
  }

  // Damage barricades caught in blast (+50% blast damage)
  if (state.survival) {
    for (const bar of state.survival.barricades) {
      if (bar.hp <= 0) continue;
      const bx = bar.x + bar.w * 0.5;
      const by = bar.y + bar.h * 0.5;
      if (Math.hypot(ex - bx, ey - by) <= radius + Math.max(bar.w, bar.h) * 0.5) {
        bar.hp = Math.max(0, bar.hp - damage * 1.5);
        bar.hitFlashTimer = 0.18;
      }
    }
    // Damage Core
    const coreCx = state.survival.core.x + state.survival.core.w * 0.5;
    const coreCy = state.survival.core.y + state.survival.core.h * 0.5;
    if (Math.hypot(ex - coreCx, ey - coreCy) <= radius + 55) {
      if (state.survival.core.shieldActive && state.survival.core.shieldHp > 0) {
        state.survival.core.shieldHp = Math.max(0, state.survival.core.shieldHp - damage);
        state.survival.core.hitFlashTimer = 0.15;
      } else {
        state.survival.core.hp = Math.max(0, state.survival.core.hp - damage);
        state.survival.core.hitFlashTimer = 0.15;
      }
    }
  }

  // Chain reaction: damage OTHER zombies in blast radius!
  for (const other of state.enemies) {
    if (other === petasan || other.hp <= 0) continue;
    const d = Math.hypot(other.x - ex, other.y - ey);
    if (d <= radius + other.radius) {
      const nx = d > 1 ? (other.x - ex) / d : 1;
      const ny = d > 1 ? (other.y - ey) / d : 0;
      other.hp = Math.max(0, other.hp - 28);
      other.hitFlashTimer = 0.18;
      other.vx += nx * 220;
      other.vy += ny * 220;
      if (other.kind === 'zombie_petasan' && other.hp <= 0) {
        explodePetasan(state, other);
      }
    }
  }
}

function updateZombieSurvivalAI(state: GameState, zombie: EnemyState, dt: number): void {
  const surv = state.survival;
  if (!surv) return;

  const coreCx = surv.core.x + surv.core.w * 0.5;
  const coreCy = surv.core.y + surv.core.h * 0.5;

  // 1. Unique Zombie Inherent Movement & Physics
  if (zombie.kind === 'zombie_pocong') {
    // Pocong hops rhythmically in Z
    if (zombie.z === 0 && zombie.specialTimer <= 0) {
      zombie.vz = 330;
      zombie.specialTimer = 0.72;
    }
  } else if (zombie.kind === 'zombie_kuntilanak') {
    // Kuntilanak floats continuously above ground!
    zombie.z = 22 + Math.sin(state.time * 5 + zombie.id) * 5;
    if (Math.random() < 0.25) {
      state.particles.push({
        x: zombie.x + (Math.random() - 0.5) * 12,
        y: zombie.y + (Math.random() - 0.5) * 8,
        z: 6,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 15,
        vz: 10,
        size: 3,
        color: '#bae6fd',
        alpha: 0.6,
        life: 0.35,
        maxLife: 0.35,
        gravity: 0,
      });
    }

    // Teleport Shriek ("HIHIHIHI! 👻") every 3.8s if target is far
    zombie.specialTimer -= dt;
    const distToCoreEarly = Math.hypot(coreCx - zombie.x, coreCy - zombie.y);
    if (zombie.specialTimer <= 0 && distToCoreEarly > 110) {
      zombie.specialTimer = 3.6 + Math.random() * 0.8;
      state.soundQueue.push('kibas');
      state.floatingTexts.push({
        x: zombie.x,
        y: zombie.y - 48,
        vy: -40,
        text: 'HIHIHIHI! 👻',
        color: '#e0f2fe',
        scale: 1.1,
        life: 0.9,
        maxLife: 0.9,
      });
      // Teleport forward along movement direction
      zombie.x += zombie.dirX * 95;
      zombie.y += zombie.dirY * 95;
      for (let k = 0; k < 8; k++) {
        state.particles.push({
          x: zombie.x,
          y: zombie.y,
          z: 18,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          vz: 30,
          size: 3.5,
          color: '#ffffff',
          alpha: 0.8,
          life: 0.3,
          maxLife: 0.3,
          gravity: 0,
        });
      }
    }

    // Scream slow wave every 4.5s against nearby players
    zombie.aiTimer -= dt;
    if (zombie.aiTimer <= 0) {
      for (const p of state.players) {
        if (!p.knockedDown && Math.hypot(p.x - zombie.x, p.y - zombie.y) < 130) {
          zombie.aiTimer = 4.5;
          state.soundQueue.push('ult_start');
          state.floatingTexts.push({
            x: zombie.x,
            y: zombie.y - 50,
            vy: -40,
            text: 'JERITAN KUNTI! 😱',
            color: '#38bdf8',
            scale: 1.05,
            life: 1.0,
            maxLife: 1.0,
          });
          const pdx = p.x - zombie.x;
          const pdy = p.y - zombie.y;
          const pd = Math.hypot(pdx, pdy) || 1;
          p.vx += (pdx / pd) * 220;
          p.vy += (pdy / pd) * 220;
          p.hitFlashTimer = 0.15;
          break;
        }
      }
    }
  } else if (zombie.kind === 'zombie_petasan') {
    // Sputtering fuse spark particles
    if (Math.random() < 0.45) {
      state.particles.push({
        x: zombie.x + (Math.random() - 0.5) * 8,
        y: zombie.y - 28,
        z: 14,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        vz: 40 + Math.random() * 50,
        size: 2.5,
        color: Math.random() < 0.5 ? '#facc15' : '#ef4444',
        alpha: 1,
        life: 0.25,
        maxLife: 0.25,
        gravity: 300,
      });
    }
  } else if (zombie.kind === 'zombie_buto_ijo') {
    // Ranged toxic acid spit
    zombie.specialTimer -= dt;
    const dCore = Math.hypot(coreCx - zombie.x, coreCy - zombie.y);
    if (zombie.specialTimer <= 0 && dCore >= 110 && dCore <= 320) {
      zombie.specialTimer = 3.4 + Math.random() * 0.8;
      state.soundQueue.push('kibas');
      state.floatingTexts.push({
        x: zombie.x,
        y: zombie.y - 54,
        vy: -35,
        text: 'SEMBURAN ASAM! 🧪',
        color: '#4ade80',
        scale: 0.95,
        life: 0.8,
        maxLife: 0.8,
      });
      state.enemyProjectiles.push({
        id: state.nextEntityId++,
        kind: 'acid_spit',
        x: zombie.x + zombie.dirX * 20,
        y: zombie.y + zombie.dirY * 16,
        vx: zombie.dirX * 240,
        vy: zombie.dirY * 240,
        angle: Math.atan2(zombie.dirY, zombie.dirX),
        spin: 6,
        radius: 13,
        damage: 16,
        life: 1.25,
        maxLife: 1.25,
        color: '#22c55e',
      });
    }
  } else if (zombie.kind === 'zombie_dukun') {
    // Shaman Frenzy Mantra & Necromancy
    zombie.specialTimer -= dt;
    if (zombie.specialTimer <= 0) {
      zombie.specialTimer = 5.0 + Math.random() * 1.0;
      state.soundQueue.push('ult_tick');
      state.floatingTexts.push({
        x: zombie.x,
        y: zombie.y - 50,
        vy: -40,
        text: 'MANTRA SANTET! 🔮',
        color: '#c084fc',
        scale: 1.1,
        life: 1.0,
        maxLife: 1.0,
      });

      // Purple expanding mystical ring
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        state.particles.push({
          x: zombie.x + Math.cos(ang) * 16,
          y: zombie.y + Math.sin(ang) * 12,
          z: 14,
          vx: Math.cos(ang) * 90,
          vy: Math.sin(ang) * 60,
          vz: 20,
          size: 4,
          color: '#c084fc',
          alpha: 0.9,
          life: 0.45,
          maxLife: 0.45,
          gravity: 0,
        });
      }

      // Buff all nearby zombies (Heal +25 HP)
      for (const other of state.enemies) {
        if (other.hp > 0 && Math.hypot(other.x - zombie.x, other.y - zombie.y) < 190) {
          other.hp = Math.min(other.maxHp, other.hp + 25);
          other.hitFlashTimer = 0.15;
          other.scaleX = 1.2;
          other.scaleY = 0.8;
        }
      }
    }

    // Bangkit Kubur (Resurrect minion)
    zombie.aiTimer -= dt;
    if (zombie.aiTimer <= 0) {
      zombie.aiTimer = 8.5 + Math.random() * 2.0;
      if (state.enemies.length < 24) {
        const minionKind = Math.random() < 0.5 ? 'zombie_warga' : 'zombie_bocil';
        const mx = zombie.x + (Math.random() - 0.5) * 50;
        const my = zombie.y + (Math.random() - 0.5) * 50;
        spawnEnemy(state, minionKind, mx, my);
        state.soundQueue.push('crate_break');
        state.floatingTexts.push({
          x: mx,
          y: my - 30,
          vy: -35,
          text: 'BANGKIT REK! ⚰️',
          color: '#a855f7',
          scale: 0.95,
          life: 0.9,
          maxLife: 0.9,
        });
        for (let k = 0; k < 6; k++) {
          state.particles.push({
            x: mx,
            y: my,
            z: 5,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            vz: 60 + Math.random() * 60,
            size: 3,
            color: '#78350f',
            alpha: 1,
            life: 0.4,
            maxLife: 0.4,
            gravity: 400,
          });
        }
      }
    }
  }

  // 2. Barricade Interactions
  for (const bar of surv.barricades) {
    if (bar.hp <= 0) continue;
    // Kuntilanak floats freely over all ground barricades!
    if (zombie.kind === 'zombie_kuntilanak') continue;
    // Pocong leaps over Level 1 cardboard barricade!
    if (zombie.kind === 'zombie_pocong' && bar.level === 1 && zombie.z > 8) {
      continue;
    }

    const bx = bar.x + bar.w * 0.5;
    const by = bar.y + bar.h * 0.5;
    const distToBar = Math.hypot(zombie.x - bx, zombie.y - by);
    if (distToBar < Math.max(bar.w, bar.h) * 0.62 + zombie.radius) {
      // Petasan explodes immediately on reaching barricades!
      if (zombie.kind === 'zombie_petasan') {
        explodePetasan(state, zombie);
        return;
      }

      zombie.dirX = (bx - zombie.x) / (distToBar || 1);
      zombie.dirY = (by - zombie.y) / (distToBar || 1);
      zombie.vx *= Math.pow(0.04, dt);
      zombie.vy *= Math.pow(0.04, dt);

      if (zombie.attackCooldown <= 0) {
        zombie.attackCooldown =
          zombie.kind === 'zombie_buto_ijo'
            ? 1.2
            : zombie.kind === 'zombie_gendruwo'
              ? 0.9
              : 1.1;
        const barDmg =
          zombie.kind === 'zombie_buto_ijo'
            ? 40
            : zombie.kind === 'zombie_gendruwo'
              ? 34
              : zombie.kind === 'zombie_pocong'
                ? 16
                : 12;
        bar.hp = Math.max(0, bar.hp - barDmg);
        bar.hitFlashTimer = 0.14;
        zombie.scaleX = 1.2;
        zombie.scaleY = 0.82;
        state.soundQueue.push('crate_hit');

        // Level 4 Barricade Thorns contact recoil damage to attacking zombie!
        if (bar.level === 4) {
          const thornDmg = 20;
          zombie.hp = Math.max(0, zombie.hp - thornDmg);
          zombie.hitFlashTimer = 0.16;
          state.soundQueue.push('hit');
          state.floatingTexts.push({
            x: zombie.x,
            y: zombie.y - 30,
            vy: -35,
            text: `-${thornDmg} DURI!`,
            color: '#facc15',
            scale: 0.95,
            life: 0.8,
            maxLife: 0.8,
          });
          for (let k = 0; k < 4; k++) {
            state.particles.push({
              x: bx,
              y: by,
              z: 10,
              vx: (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              vz: Math.random() * 60 + 20,
              size: 3,
              color: '#facc15',
              gravity: 300,
              life: 0.35,
              maxLife: 0.35,
              alpha: 1,
            });
          }

          if (zombie.hp <= 0) {
            handleDefenseKill(state, zombie, 'barrier');
            return;
          }
        }

        if (bar.hp <= 0) {
          bar.hp = 0;
          bar.level = 1;
          bar.maxHp = BARRICADE_MAX_HP[1];
          state.soundQueue.push('crate_break');
          state.floatingTexts.push({
            x: bx,
            y: bar.y - 12,
            vy: -40,
            text: `${bar.label} JEBOL! (RESET KE LV.1)`,
            color: '#ef4444',
            scale: 1.05,
            life: 1.3,
            maxLife: 1.3,
          });
        }
      }
      return;
    }
  }

  // 3. Central Pos Warkop Core Interactions
  const distToCore = Math.hypot(zombie.x - coreCx, zombie.y - coreCy);
  if (distToCore < 58 + zombie.radius) {
    // Petasan detonates upon reaching core!
    if (zombie.kind === 'zombie_petasan') {
      explodePetasan(state, zombie);
      return;
    }

    zombie.dirX = (coreCx - zombie.x) / (distToCore || 1);
    zombie.dirY = (coreCy - zombie.y) / (distToCore || 1);
    zombie.vx *= Math.pow(0.04, dt);
    zombie.vy *= Math.pow(0.04, dt);

    if (zombie.attackCooldown <= 0) {
      zombie.attackCooldown = 1.05;
      const coreDmg =
        zombie.kind === 'zombie_buto_ijo'
          ? 32
          : zombie.kind === 'zombie_gendruwo'
            ? 28
            : zombie.kind === 'zombie_tuyul'
              ? 18
              : zombie.kind === 'zombie_kuntilanak'
                ? 16
                : 12;

      // 1-Wave Energy Shield (Tameng Gaib) absorbs damage & deals contact damage to zombies
      if (surv.core.shieldActive && surv.core.shieldHp > 0) {
        surv.core.shieldHp = Math.max(0, surv.core.shieldHp - coreDmg);
        surv.core.hitFlashTimer = 0.15;
        state.soundQueue.push('hit');

        // Contact damage to zombie from energy shield
        const shieldZombDmg = 14;
        zombie.hp = Math.max(0, zombie.hp - shieldZombDmg);
        zombie.hitFlashTimer = 0.16;

        state.floatingTexts.push({
          x: coreCx + (Math.random() - 0.5) * 20,
          y: surv.core.y - 28,
          vy: -40,
          text: `-${coreDmg} TAMENG (${Math.ceil(surv.core.shieldHp)}/${surv.core.shieldMaxHp})`,
          color: '#38bdf8',
          scale: 0.95,
          life: 0.8,
          maxLife: 0.8,
        });
        state.floatingTexts.push({
          x: zombie.x,
          y: zombie.y - 28,
          vy: -35,
          text: `-${shieldZombDmg} SENGATAN!`,
          color: '#06b6d4',
          scale: 0.9,
          life: 0.75,
          maxLife: 0.75,
        });

        if (zombie.hp <= 0) {
          handleDefenseKill(state, zombie, 'shield');
          return;
        }

        if (surv.core.shieldHp <= 0) {
          surv.core.shieldActive = false;
          state.soundQueue.push('crate_break');
          state.floatingTexts.push({
            x: coreCx,
            y: surv.core.y - 45,
            vy: -40,
            text: 'TAMENG GAIB PECAH!',
            color: '#ef4444',
            scale: 1.1,
            life: 1.3,
            maxLife: 1.3,
          });
        }
      } else {
        surv.core.hp = Math.max(0, surv.core.hp - coreDmg);
        surv.core.hitFlashTimer = 0.15;
        state.soundQueue.push('player_hurt');
        state.shakeTimer = Math.max(state.shakeTimer, 0.1);
        state.shakeIntensity = Math.max(state.shakeIntensity, 3);
        state.floatingTexts.push({
          x: coreCx + (Math.random() - 0.5) * 20,
          y: surv.core.y - 24,
          vy: -45,
          text: `-${coreDmg} POS RONDA!`,
          color: '#f87171',
          scale: 0.95,
          life: 0.75,
          maxLife: 0.75,
        });

        if (surv.core.hp <= 0) {
          state.status = 'gameover';
          state.shakeTimer = 0;
          state.shakeIntensity = 0;
          state.hitstopTimer = 0;
          state.soundQueue.push('ko');
        }
      }
    }
    return;
  }

  // 4. Target Acquisition & Pathfinding
  let targetX = coreCx;
  let targetY = coreCy;

  // Dukun stays at support distance (~220px)
  if (zombie.kind === 'zombie_dukun' && distToCore < 220) {
    targetX = zombie.x - (coreCx - zombie.x);
    targetY = zombie.y - (coreCy - zombie.y);
  } else if (zombie.kind !== 'zombie_tuyul') {
    const alivePlayer = state.players.find(
      (p) => !p.knockedDown && Math.hypot(p.x - zombie.x, p.y - zombie.y) < 130
    );
    if (alivePlayer) {
      targetX = alivePlayer.x;
      targetY = alivePlayer.y;
    }
  }

  const dx = targetX - zombie.x;
  const dy = targetY - zombie.y;
  const d = Math.hypot(dx, dy) || 1;
  zombie.dirX = dx / d;
  zombie.dirY = dy / d;

  let speed = 78;
  if (zombie.kind === 'zombie_bocil') speed = 138;
  else if (zombie.kind === 'zombie_pocong') speed = zombie.z > 0 ? 128 : 28;
  else if (zombie.kind === 'zombie_gendruwo') speed = 64;
  else if (zombie.kind === 'zombie_tuyul') speed = 168;
  else if (zombie.kind === 'zombie_petasan') speed = 165;
  else if (zombie.kind === 'zombie_kuntilanak') speed = 92;
  else if (zombie.kind === 'zombie_buto_ijo') speed = 56;
  else if (zombie.kind === 'zombie_dukun') speed = 72;

  // Slight speed scaling per wave
  const waveMult = 1 + Math.min(0.45, (surv.wave - 1) * 0.02);
  zombie.vx += (zombie.dirX * speed * waveMult - zombie.vx) * Math.min(1, dt * 7);
  zombie.vy += (zombie.dirY * speed * waveMult - zombie.vy) * Math.min(1, dt * 7);
}
