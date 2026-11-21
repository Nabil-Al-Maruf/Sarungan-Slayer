import { circlesOverlap, stepTopDownPhysics } from '../core/physics';
import type { EnemyKind, EnemyState, GameState } from '../core/types';
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
  const player = state.players[0];

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

    if (enemy.stunTimer > 0 || enemy.kind === 'dummy' || !player) {
      enemy.vx *= Math.pow(0.03, dt);
      enemy.vy *= Math.pow(0.03, dt);
    } else if (enemy.kind.startsWith('zombie_') && state.survival) {
      updateZombieSurvivalAI(state, enemy, dt);
    } else if (enemy.isBoss) {
      updateBossAI(state, enemy, player.x, player.y, dt);
    } else {
      updateRegularEnemyAI(state, enemy, player.x, player.y, dt);
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
          enemy.attackCooldown = enemy.isBoss ? 0.95 : 1.15;
          const dmg =
            enemy.isBoss
              ? 16
              : enemy.kind === 'zombie_gendruwo'
                ? 18
                : enemy.kind === 'elite'
                  ? 14
                  : 10;
          const dx = targetPlayer.x - enemy.x;
          const dy = targetPlayer.y - enemy.y;
          const d = Math.hypot(dx, dy) || 1;
          damagePlayer(state, targetPlayer, dmg, dx / d, dy / d);

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
      spawnEnemy(state, 'elite', Math.max(state.activeMinX + 40, boss.x - 120), 210);
      spawnEnemy(state, 'elite', Math.min(state.activeMaxX - 40, boss.x + 80), 420);
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

function updateZombieSurvivalAI(state: GameState, zombie: EnemyState, dt: number): void {
  const surv = state.survival;
  if (!surv) return;

  const coreCx = surv.core.x + surv.core.w * 0.5;
  const coreCy = surv.core.y + surv.core.h * 0.5;

  // Pocong hops rhythmically in Z and can leap right over Level 1 (Kardus) barricades!
  if (zombie.kind === 'zombie_pocong' && zombie.z === 0 && zombie.specialTimer <= 0) {
    zombie.vz = 330;
    zombie.specialTimer = 0.72;
  }

  // Check if an active barricade is blocking this zombie
  for (const bar of surv.barricades) {
    if (bar.hp <= 0) continue;
    // Pocong leaps over Level 1 cardboard barricade!
    if (zombie.kind === 'zombie_pocong' && bar.level === 1 && zombie.z > 8) {
      continue;
    }

    const bx = bar.x + bar.w * 0.5;
    const by = bar.y + bar.h * 0.5;
    const distToBar = Math.hypot(zombie.x - bx, zombie.y - by);
    if (distToBar < Math.max(bar.w, bar.h) * 0.62 + zombie.radius) {
      zombie.dirX = (bx - zombie.x) / (distToBar || 1);
      zombie.dirY = (by - zombie.y) / (distToBar || 1);
      zombie.vx *= Math.pow(0.04, dt);
      zombie.vy *= Math.pow(0.04, dt);

      if (zombie.attackCooldown <= 0) {
        zombie.attackCooldown = zombie.kind === 'zombie_gendruwo' ? 0.9 : 1.1;
        const barDmg =
          zombie.kind === 'zombie_gendruwo'
            ? 34
            : zombie.kind === 'zombie_pocong'
              ? 16
              : 12;
        bar.hp = Math.max(0, bar.hp - barDmg);
        bar.hitFlashTimer = 0.14;
        zombie.scaleX = 1.2;
        zombie.scaleY = 0.82;
        state.soundQueue.push('crate_hit');
        if (bar.hp <= 0) {
          state.soundQueue.push('crate_break');
          state.floatingTexts.push({
            x: bx,
            y: bar.y - 12,
            vy: -40,
            text: `${bar.label} JEBOL!`,
            color: '#ef4444',
            scale: 1.05,
            life: 1.2,
            maxLife: 1.2,
          });
        }
      }
      return;
    }
  }

  // Check if zombie reached the Central Core Pos Ronda
  const distToCore = Math.hypot(zombie.x - coreCx, zombie.y - coreCy);
  if (distToCore < 58 + zombie.radius) {
    zombie.dirX = (coreCx - zombie.x) / (distToCore || 1);
    zombie.dirY = (coreCy - zombie.y) / (distToCore || 1);
    zombie.vx *= Math.pow(0.04, dt);
    zombie.vy *= Math.pow(0.04, dt);

    if (zombie.attackCooldown <= 0) {
      zombie.attackCooldown = 1.05;
      const coreDmg =
        zombie.kind === 'zombie_gendruwo'
          ? 28
          : zombie.kind === 'zombie_tuyul'
            ? 18
            : 12;
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
    return;
  }

  // Otherwise march toward Core (or chase a very close player if non-tuyul)
  let targetX = coreCx;
  let targetY = coreCy;
  if (zombie.kind !== 'zombie_tuyul') {
    const alivePlayer = state.players.find(
      (p) => !p.knockedDown && Math.hypot(p.x - zombie.x, p.y - zombie.y) < 125
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

  // Slight speed scaling per wave
  const waveMult = 1 + Math.min(0.45, (surv.wave - 1) * 0.02);
  zombie.vx += (zombie.dirX * speed * waveMult - zombie.vx) * Math.min(1, dt * 7);
  zombie.vy += (zombie.dirY * speed * waveMult - zombie.vy) * Math.min(1, dt * 7);
}
