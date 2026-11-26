import {
  MELEE_ARC_COS,
  MELEE_DAMAGE,
  MELEE_KNOCKBACK,
  MELEE_REACH,
  MELEE_ULT_GAIN,
  PROJ_ULT_GAIN,
  ULT_DAMAGE_PER_TICK,
  ULT_KNOCKBACK,
  ULT_RADIUS,
  ULT_TICK_INTERVAL,
} from '../core/constants';
import { circlesOverlap } from '../core/physics';
import type { EnemyState, GameState, PlayerState } from '../core/types';
import { damageCrate } from './crate';
import { explodePetasan } from './enemyFactory';
import { damagePlayer } from './player';

const SUROBOYO_KO_LINES = ['MANTAP REK!', 'KESABET!', 'KO CAK!', 'WUSSS!'];

function inMeleeArc(
  px: number,
  py: number,
  aimX: number,
  aimY: number,
  tx: number,
  ty: number,
  targetRadius: number,
  extraReach = 0
): boolean {
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.hypot(dx, dy);
  if (dist > MELEE_REACH + extraReach + targetRadius) return false;
  if (dist < 22) return true;
  const dot = (dx / dist) * aimX + (dy / dist) * aimY;
  return dot >= MELEE_ARC_COS;
}

export function resolveCombat(state: GameState, dt: number): void {
  for (const player of state.players) {
    // 1. 8-Way Melee Arc Hitbox (Kibas Sarung)
    if (player.meleeTimer > 0.05) {
      const aimX = Math.cos(player.meleeAngle);
      const aimY = Math.sin(player.meleeAngle);
      const elem = player.slashElement || 'none';
      const elemLevel = player.slashElementLevel || 1;
      const extraReach = elem === 'badai' ? 18 * elemLevel : 0;

      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || enemy.lastHitSwingId === player.meleeSwingId) continue;
        if (inMeleeArc(player.x, player.y, aimX, aimY, enemy.x, enemy.y, enemy.radius, extraReach)) {
          enemy.lastHitSwingId = player.meleeSwingId;
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          const nx = dx / d;
          const ny = dy / d;

          // Perisai Kardus blocks frontal melee attacks!
          let finalDmg = Math.round(MELEE_DAMAGE * player.dmgMult);
          let blocked = false;
          if (enemy.kind === 'perisai_kardus') {
            const facingDot = nx * enemy.dirX + ny * enemy.dirY;
            if (facingDot < -0.35) {
              finalDmg = 5;
              blocked = true;
            }
          }

          // Elemental Attack Augmentation
          if (!blocked && elem !== 'none') {
            if (elem === 'petir') {
              finalDmg += 6 * elemLevel;
              enemy.stunTimer = Math.max(enemy.stunTimer, 0.28 * elemLevel);
              for (let k = 0; k < 5; k++) {
                state.particles.push({
                  x: enemy.x + (Math.random() - 0.5) * 16,
                  y: enemy.y + (Math.random() - 0.5) * 16,
                  z: 14,
                  vx: (Math.random() - 0.5) * 180,
                  vy: (Math.random() - 0.5) * 180,
                  vz: 60 + Math.random() * 80,
                  size: 2.5 + Math.random() * 2,
                  color: Math.random() < 0.6 ? '#38bdf8' : '#facc15',
                  alpha: 1,
                  life: 0.16 + Math.random() * 0.1,
                  maxLife: 0.26,
                  gravity: 0,
                });
              }
            } else if (elem === 'api') {
              finalDmg += 8 * elemLevel;
              for (let k = 0; k < 6; k++) {
                state.particles.push({
                  x: enemy.x + (Math.random() - 0.5) * 16,
                  y: enemy.y + (Math.random() - 0.5) * 16,
                  z: 12,
                  vx: (Math.random() - 0.5) * 140,
                  vy: (Math.random() - 0.5) * 140,
                  vz: 80 + Math.random() * 90,
                  size: 3 + Math.random() * 2.5,
                  color: Math.random() < 0.5 ? '#f97316' : '#ef4444',
                  alpha: 1,
                  life: 0.22 + Math.random() * 0.12,
                  maxLife: 0.34,
                  gravity: -70,
                });
              }
            } else if (elem === 'suci') {
              finalDmg += 5 * elemLevel;
              player.hp = Math.min(player.maxHp, player.hp + 3 * elemLevel);
              player.ult = Math.min(player.maxUlt, player.ult + 6 * elemLevel);
              for (let k = 0; k < 5; k++) {
                state.particles.push({
                  x: enemy.x + (Math.random() - 0.5) * 16,
                  y: enemy.y + (Math.random() - 0.5) * 16,
                  z: 14,
                  vx: (Math.random() - 0.5) * 100,
                  vy: (Math.random() - 0.5) * 100,
                  vz: 50 + Math.random() * 70,
                  size: 2.5 + Math.random() * 2,
                  color: '#facc15',
                  alpha: 1,
                  life: 0.2 + Math.random() * 0.1,
                  maxLife: 0.3,
                  gravity: -30,
                });
              }
            }
          }

          const knockbackBase = blocked ? 150 : MELEE_KNOCKBACK * (elem === 'badai' ? 1 + 0.25 * elemLevel : 1);
          hitEnemy(
            state,
            enemy,
            player,
            finalDmg,
            nx * knockbackBase,
            ny * knockbackBase,
            Math.round((blocked ? 4 : MELEE_ULT_GAIN) * player.ultGainMult),
            blocked
          );
          state.hitstopTimer = Math.max(state.hitstopTimer, 0.032);
        }
      }

      for (const crate of state.crates) {
        if (crate.hp <= 0 || crate.lastHitSwingId === player.meleeSwingId) continue;
        if (inMeleeArc(player.x, player.y, aimX, aimY, crate.x, crate.y, crate.radius, extraReach)) {
          crate.lastHitSwingId = player.meleeSwingId;
          damageCrate(state, crate, MELEE_DAMAGE);
        }
      }
    }

    // 2. 360° Ultimate Vortex (Badai Sarung Suroboyo)
    if (player.ultActiveTimer > 0) {
      player.ultActiveTimer = Math.max(0, player.ultActiveTimer - dt);
      const uType = player.ultType ?? 'gasing';

      if (uType === 'gasing' || uType === 'selendang') {
        player.ultTickTimer -= dt;

        // Suction Vacuum: Whirlwind pulls nearby enemies towards the center!
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const d = Math.hypot(dx, dy);
          if (d > 18 && d <= ULT_RADIUS + 95) {
            const pullForce = (1 - d / (ULT_RADIUS + 95)) * 260;
            enemy.x -= (dx / d) * pullForce * dt;
            enemy.y -= (dy / d) * pullForce * dt;
          }
        }

        const angle = state.time * 18 + Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * (ULT_RADIUS - 24);
        state.particles.push({
          x: player.x + Math.cos(angle) * dist,
          y: player.y + Math.sin(angle) * (dist * 0.72),
          z: 10 + Math.random() * 24,
          vx: -Math.sin(angle) * 240,
          vy: Math.cos(angle) * 160,
          vz: 40 + Math.random() * 60,
          size: 4 + Math.random() * 4,
          color: Math.random() < 0.5 ? '#fde047' : '#38bdf8',
          alpha: 0.9,
          life: 0.24,
          maxLife: 0.24,
          gravity: 0,
        });

        if (player.ultTickTimer <= 0) {
          player.ultTickTimer = ULT_TICK_INTERVAL;
          state.soundQueue.push('ult_tick');
          state.shakeTimer = Math.max(state.shakeTimer, 0.08);
          state.shakeIntensity = Math.max(state.shakeIntensity, 3);

          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const d = Math.hypot(dx, dy);
            if (d <= ULT_RADIUS + enemy.radius) {
              const nx = d > 0.1 ? dx / d : 1;
              const ny = d > 0.1 ? dy / d : 0;
              hitEnemy(
                state,
                enemy,
                player,
                Math.round(ULT_DAMAGE_PER_TICK * player.dmgMult),
                nx * ULT_KNOCKBACK,
                ny * ULT_KNOCKBACK,
                0,
                false
              );
            }
          }

          for (const crate of state.crates) {
            if (crate.hp <= 0) continue;
            const d = Math.hypot(crate.x - player.x, crate.y - player.y);
            if (d <= ULT_RADIUS + crate.radius) {
              damageCrate(state, crate, ULT_DAMAGE_PER_TICK);
            }
          }
        }

        // Final Tornado Burst Release when duration expires!
        if (player.ultActiveTimer <= 0) {
          state.soundQueue.push('crate_break');
          state.shakeTimer = 0.35;
          state.shakeIntensity = 8;
          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const d = Math.hypot(dx, dy);
            if (d <= ULT_RADIUS + 60) {
              const nx = d > 0.1 ? dx / d : 1;
              const ny = d > 0.1 ? dy / d : 0;
              hitEnemy(
                state,
                enemy,
                player,
                Math.round(65 * player.dmgMult),
                nx * 420,
                ny * 420,
                160,
                false
              );
            }
          }
        }
      }
    }
  }

  // 3. Player Projectiles (Sabetan Angin Pecut — pierces up to 3 targets & bypasses cardboard shield)
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.life -= dt;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    if (Math.random() < 0.7) {
      state.particles.push({
        x: proj.x + (Math.random() - 0.5) * 14,
        y: proj.y + (Math.random() - 0.5) * 10,
        z: 18,
        vx: -proj.vx * 0.14,
        vy: -proj.vy * 0.14,
        vz: 10,
        size: 3 + Math.random() * 3,
        color: proj.kind === 'mercon' ? '#f97316' : proj.kind === 'naga' ? '#ef4444' : '#bae6fd',
        alpha: 0.75,
        life: 0.18,
        maxLife: 0.18,
        gravity: 0,
      });
    }

    const isTower = proj.ownerId === 'tower';
    const owner = isTower ? undefined : (state.players.find((p) => p.id === proj.ownerId) ?? state.players[0]);

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || proj.hitIds.includes(enemy.id)) continue;
      if (circlesOverlap(proj.x, proj.y, proj.radius, enemy.x, enemy.y, enemy.radius + 4)) {
        proj.hitIds.push(enemy.id);
        proj.pierceLeft--;
        const speed = Math.hypot(proj.vx, proj.vy) || 1;

        let projDmg = proj.damage;
        // Buto Ijo is exceptionally weak to Pecut whip attacks!
        if (enemy.kind === 'zombie_buto_ijo') {
          projDmg = Math.round(projDmg * 1.45);
          state.floatingTexts.push({
            x: enemy.x,
            y: enemy.y - 48,
            vy: -40,
            text: 'LEMAH PECUT! ⚡',
            color: '#38bdf8',
            scale: 0.95,
            life: 0.7,
            maxLife: 0.7,
          });
        }

        // Naga Barong pushes and sweeps enemies forward with its flight trajectory!
        const knockX = proj.kind === 'naga' ? (proj.vx / speed) * 380 : (proj.vx / speed) * 230;
        const knockY = proj.kind === 'naga' ? (proj.vy / speed) * 380 : (proj.vy / speed) * 230;

        hitEnemy(
          state,
          enemy,
          owner,
          projDmg,
          knockX,
          knockY,
          isTower ? 0 : Math.round(PROJ_ULT_GAIN * (owner?.ultGainMult ?? 1)),
          false,
          isTower ? 'tower' : undefined
        );
        if (proj.pierceLeft <= 0) break;
      }
    }

    for (const crate of state.crates) {
      if (crate.hp <= 0 || proj.hitIds.includes(crate.id)) continue;
      if (circlesOverlap(proj.x, proj.y, proj.radius, crate.x, crate.y, crate.radius)) {
        proj.hitIds.push(crate.id);
        damageCrate(state, crate, proj.damage);
      }
    }

    const expired =
      proj.life <= 0 ||
      proj.pierceLeft <= 0 ||
      proj.x < state.cameraX - 80 ||
      proj.x > state.cameraX + 1040 ||
      proj.y < -60 ||
      proj.y > state.arenaHeight + 60;

    if (expired) {
      if (proj.kind === 'mercon') {
        state.soundQueue.push('crate_break');
        state.shakeTimer = Math.max(state.shakeTimer, 0.4);
        state.shakeIntensity = Math.max(state.shakeIntensity, 9);
        // Explosion fireball damage to all enemies within 85px
        for (const e of state.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - proj.x, e.y - proj.y);
          if (d <= 85 + e.radius) {
            const nx = d > 0.1 ? (e.x - proj.x) / d : 1;
            const ny = d > 0.1 ? (e.y - proj.y) / d : 0;
            hitEnemy(state, e, owner, proj.damage, nx * 350, ny * 350, 20, false);
          }
        }
        // Spawn lingering fire crater hazard (burns for 3.5s)
        state.hazards.push({
          id: state.nextEntityId++,
          kind: 'fire_crater',
          ownerId: proj.ownerId,
          x: proj.x,
          y: proj.y,
          radius: 75,
          delay: 0,
          maxDelay: 0,
          damage: Math.round(40 * (owner?.dmgMult ?? 1)),
          detonated: true,
          flashTimer: 3.5,
        });
        // Fiery explosion particles
        for (let k = 0; k < 18; k++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * 180;
          state.particles.push({
            x: proj.x,
            y: proj.y,
            z: 10,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd * 0.7,
            vz: 120 + Math.random() * 140,
            size: 5 + Math.random() * 4,
            color: k % 2 === 0 ? '#f97316' : '#fef08a',
            alpha: 1,
            life: 0.45,
            maxLife: 0.45,
            gravity: 550,
          });
        }
      }
      state.projectiles.splice(i, 1);
    }
  }

  // 4. Enemy Projectiles (Sandal, Sarung Wave, Baja Wave, Acid Spit)
  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const ep = state.enemyProjectiles[i];
    ep.life -= dt;
    ep.x += ep.vx * dt;
    ep.y += ep.vy * dt;
    ep.angle += ep.spin * dt;

    let hit = false;
    for (const player of state.players) {
      if (
        player.z < 26 &&
        circlesOverlap(ep.x, ep.y, ep.radius, player.x, player.y, player.radius)
      ) {
        const spd = Math.hypot(ep.vx, ep.vy) || 1;
        damagePlayer(state, player, ep.damage, ep.vx / spd, ep.vy / spd);
        hit = true;
        break;
      }
    }

    // Acid Spit creates a sizzling toxic puddle on contact or expiration!
    if (ep.kind === 'acid_spit' && (hit || ep.life <= 0)) {
      state.hazards.push({
        id: state.nextEntityId++,
        kind: 'acid_puddle',
        x: ep.x,
        y: ep.y,
        radius: 46,
        delay: 0,
        maxDelay: 3.5,
        damage: 6,
        detonated: true,
        flashTimer: 3.5,
      });
      state.soundQueue.push('crate_hit');
    }

    if (
      hit ||
      ep.life <= 0 ||
      ep.x < state.cameraX - 100 ||
      ep.x > state.cameraX + 1060 ||
      ep.y < -60 ||
      ep.y > state.arenaHeight + 60
    ) {
      state.enemyProjectiles.splice(i, 1);
    }
  }

  // 5. Telegraphed Ground Hazards (Hujan Mercon Banting, Boss Jump Slam & Acid Puddles)
  for (let i = state.hazards.length - 1; i >= 0; i--) {
    const hz = state.hazards[i];

    // Player Fire Hazards (Fire Crater & Naga Flame) burn and incinerate ENEMIES!
    if (hz.kind === 'fire_crater' || hz.kind === 'naga_flame') {
      hz.flashTimer -= dt;
      if (Math.random() < 0.45) {
        state.particles.push({
          x: hz.x + (Math.random() - 0.5) * (hz.radius * 1.4),
          y: hz.y + (Math.random() - 0.5) * (hz.radius * 0.9),
          z: 4,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          vz: 35 + Math.random() * 45,
          size: 3 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#f97316' : '#facc15',
          alpha: 0.9,
          life: 0.35,
          maxLife: 0.35,
          gravity: -20,
        });
      }

      const pOwner = state.players.find((p) => p.id === hz.ownerId) ?? state.players[0];
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        const d = Math.hypot(enemy.x - hz.x, enemy.y - hz.y);
        if (d <= hz.radius + enemy.radius) {
          const burnDmg = Math.round(hz.damage * dt * 2.8);
          if (burnDmg > 0) {
            enemy.hp = Math.max(0, enemy.hp - burnDmg);
            enemy.hitFlashTimer = 0.1;
            if (Math.random() < 0.1) {
              state.floatingTexts.push({
                x: enemy.x,
                y: enemy.y - enemy.z - 35,
                vy: -35,
                text: '🔥',
                color: '#f97316',
                scale: 0.85,
                life: 0.6,
                maxLife: 0.6,
              });
            }
            if (enemy.hp <= 0) {
              state.soundQueue.push('ko');
              if (state.mode === 'survival' && pOwner) {
                const reward = Math.round(20 * (pOwner.coinMult ?? 1));
                pOwner.coins += reward;
              }
            }
          }
        }
      }

      if (hz.flashTimer <= 0) {
        state.hazards.splice(i, 1);
      }
      continue;
    }

    // Acid puddles linger and deal continuous caustic damage & slime slow
    if (hz.kind === 'acid_puddle') {
      hz.flashTimer -= dt;
      if (Math.random() < 0.35) {
        state.particles.push({
          x: hz.x + (Math.random() - 0.5) * (hz.radius * 1.4),
          y: hz.y + (Math.random() - 0.5) * (hz.radius * 0.9),
          z: 3,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          vz: 15 + Math.random() * 20,
          size: 2.5 + Math.random() * 2,
          color: Math.random() < 0.5 ? '#22c55e' : '#84cc16',
          alpha: 0.85,
          life: 0.3,
          maxLife: 0.3,
          gravity: -20,
        });
      }

      // Damage & slow players standing on acid
      for (const player of state.players) {
        if (player.knockedDown || player.z > 14) continue;
        const d = Math.hypot(player.x - hz.x, player.y - hz.y);
        if (d <= hz.radius + player.radius) {
          damagePlayer(state, player, Math.round(hz.damage * dt * 3), 0, 0);
          player.speedMult = Math.max(0.65, player.speedMult * 0.92);
        }
      }

      // Damage barricades touching acid
      if (state.survival) {
        for (const bar of state.survival.barricades) {
          if (bar.hp <= 0) continue;
          const bx = bar.x + bar.w * 0.5;
          const by = bar.y + bar.h * 0.5;
          if (Math.hypot(hz.x - bx, hz.y - by) <= hz.radius + Math.max(bar.w, bar.h) * 0.5) {
            bar.hp = Math.max(0, bar.hp - hz.damage * dt * 2.5);
            bar.hitFlashTimer = 0.08;
          }
        }
      }

      if (hz.flashTimer <= 0) {
        state.hazards.splice(i, 1);
      }
      continue;
    }

    if (!hz.detonated) {
      hz.delay -= dt;
      if (hz.delay <= 0) {
        hz.detonated = true;
        hz.flashTimer = 0.24;
        state.soundQueue.push('crate_break');
        state.shakeTimer = Math.max(state.shakeTimer, 0.14);
        state.shakeIntensity = Math.max(state.shakeIntensity, 5);

        // Explosion particles
        for (let k = 0; k < 14; k++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 80 + Math.random() * 190;
          state.particles.push({
            x: hz.x,
            y: hz.y,
            z: 8,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd * 0.7,
            vz: 110 + Math.random() * 160,
            size: 5 + Math.random() * 4,
            color: k % 2 === 0 ? '#f97316' : '#fef08a',
            alpha: 1,
            life: 0.35 + Math.random() * 0.15,
            maxLife: 0.5,
            gravity: 640,
          });
        }

        // Damage players inside radius (jumping high can dodge slam; player hazards don't hurt players!)
        if (!hz.ownerId || !hz.ownerId.startsWith('p')) {
          for (const player of state.players) {
            const d = Math.hypot(player.x - hz.x, player.y - hz.y);
            if (d <= hz.radius + player.radius && (hz.kind === 'mercon' || player.z < 28)) {
              const nx = d > 1 ? (player.x - hz.x) / d : 1;
              const ny = d > 1 ? (player.y - hz.y) / d : 0;
              damagePlayer(state, player, hz.damage, nx, ny);
            }
          }
        }

        // Damage barricades inside hazard blast radius
        if (state.survival) {
          for (const bar of state.survival.barricades) {
            if (bar.hp <= 0) continue;
            const bx = bar.x + bar.w * 0.5;
            const by = bar.y + bar.h * 0.5;
            if (Math.hypot(hz.x - bx, hz.y - by) <= hz.radius + Math.max(bar.w, bar.h) * 0.5) {
              bar.hp = Math.max(0, bar.hp - hz.damage);
              bar.hitFlashTimer = 0.15;
            }
          }
        }
      }
    } else {
      hz.flashTimer -= dt;
      if (hz.flashTimer <= 0) {
        state.hazards.splice(i, 1);
      }
    }
  }
}

export function getZombieCoinReward(kind: string): number {
  switch (kind) {
    case 'zombie_dukun':
      return 90;
    case 'zombie_buto_ijo':
      return 80;
    case 'zombie_gendruwo':
      return 60;
    case 'zombie_tuyul':
      return 50;
    case 'zombie_kuntilanak':
      return 40;
    case 'zombie_petasan':
      return 35;
    case 'zombie_pocong':
      return 35;
    case 'zombie_bocil':
      return 25;
    default:
      return 20;
  }
}

/**
 * Handle kills caused by automated base defense systems (Tower, Barrier Duri Lv.4, or Tameng Gaib Pos Warkop).
 * The bounty is split equally among ALL players in the room for fair co-op economy!
 */
export function handleDefenseKill(
  state: GameState,
  enemy: EnemyState,
  source: 'tower' | 'barrier' | 'shield'
): void {
  enemy.hp = 0;
  state.koCount++;
  state.soundQueue.push('ko');

  if (enemy.kind === 'zombie_petasan') {
    explodePetasan(state, enemy);
  }

  if (state.mode === 'survival') {
    const isBoss = enemy.isBoss;
    const wave = state.survival?.wave ?? 10;
    const baseReward = isBoss ? Math.round(250 + wave * 15) : getZombieCoinReward(enemy.kind);
    const label =
      source === 'tower'
        ? 'TOWER'
        : source === 'barrier'
          ? 'TEMBOK DURI'
          : 'TAMENG GAIB';

    const eligible = state.players.filter((p) => !p.knockedDown);
    const recipients = eligible.length > 0 ? eligible : state.players;
    const count = Math.max(1, recipients.length);
    const splitBase = Math.ceil(baseReward / count);

    for (const p of recipients) {
      const reward = Math.round(splitBase * (p.coinMult ?? 1));
      p.coins += reward;
      state.floatingTexts.push({
        x: p.x,
        y: p.y - p.z - 68,
        vy: -48,
        text: `+${reward} (${label} 🤝)`,
        color: '#fde047',
        scale: 0.95,
        life: 0.95,
        maxLife: 0.95,
      });
    }

    state.floatingTexts.push({
      x: enemy.x,
      y: enemy.y - enemy.z - 72,
      vy: -55,
      text: isBoss
        ? `👑 BOSS TUMBANG! +${baseReward} DIBAGI RATA! 👑`
        : `+${baseReward} (${label} DIBAGI RATA 🤝)`,
      color: isBoss ? '#4ade80' : '#38bdf8',
      scale: isBoss ? 1.35 : 1.05,
      life: isBoss ? 1.6 : 0.95,
      maxLife: isBoss ? 1.6 : 0.95,
    });

    if (isBoss) {
      // Drop refreshments
      state.pickups.push({
        id: state.nextEntityId++,
        kind: 'es_teh',
        x: enemy.x - 24,
        y: enemy.y,
        z: 20,
        vx: -40,
        vy: 0,
        vz: 80,
        radius: 12,
        life: 25.0,
        bobPhase: 0,
      });
      state.pickups.push({
        id: state.nextEntityId++,
        kind: 'kopi_giras',
        x: enemy.x + 24,
        y: enemy.y,
        z: 20,
        vx: 40,
        vy: 0,
        vz: 80,
        radius: 12,
        life: 25.0,
        bobPhase: Math.PI,
      });
    }
  }

  // KO death particles
  for (let i = 0; i < 14; i++) {
    state.particles.push({
      x: enemy.x,
      y: enemy.y,
      z: 18,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.5) * 200,
      vz: 100 + Math.random() * 160,
      size: 4 + Math.random() * 4,
      color: i % 2 === 0 ? enemy.shirtColor : '#fde047',
      alpha: 1,
      life: 0.45 + Math.random() * 0.2,
      maxLife: 0.65,
      gravity: 600,
    });
  }
}

export function hitEnemy(
  state: GameState,
  enemy: EnemyState,
  attacker: PlayerState | undefined,
  damage: number,
  kbX: number,
  kbY: number,
  ultGain: number,
  blocked: boolean,
  defenseSource?: 'tower' | 'barrier' | 'shield'
): void {
  enemy.hp -= damage;
  enemy.hitFlashTimer = 0.12;
  if (!enemy.isBoss) {
    enemy.stunTimer = blocked ? 0.1 : 0.24;
    enemy.vx = kbX;
    enemy.vy = kbY;
    enemy.vz = blocked ? 40 : 145;
  } else {
    // Bosses resist heavy knockback/stun
    enemy.vx += kbX * 0.2;
    enemy.vy += kbY * 0.2;
  }
  enemy.scaleX = 1.24;
  enemy.scaleY = 0.76;

  if (attacker && ultGain > 0 && attacker.ultActiveTimer <= 0) {
    attacker.ult = Math.min(attacker.maxUlt, attacker.ult + ultGain);
  }

  state.soundQueue.push(blocked ? 'crate_hit' : 'hit');
  state.shakeTimer = Math.max(state.shakeTimer, 0.09);
  state.shakeIntensity = Math.max(state.shakeIntensity, blocked ? 2 : 4);

  state.floatingTexts.push({
    x: enemy.x + (Math.random() - 0.5) * 14,
    y: enemy.y - enemy.z - (enemy.isBoss ? 68 : 42),
    vy: -65,
    text: blocked ? `BLOKIR (${damage})` : `${damage}`,
    color: blocked ? '#cbd5e1' : '#fef08a',
    scale: blocked ? 0.9 : 1,
    life: 0.65,
    maxLife: 0.65,
  });

  for (let i = 0; i < (blocked ? 4 : 8); i++) {
    state.particles.push({
      x: enemy.x,
      y: enemy.y,
      z: 20,
      vx: kbX * 0.4 + (Math.random() - 0.5) * 180,
      vy: kbY * 0.4 + (Math.random() - 0.5) * 140,
      vz: 80 + Math.random() * 140,
      size: 3 + Math.random() * 4,
      color: blocked ? '#d6b283' : i % 2 === 0 ? '#fde047' : '#ffffff',
      alpha: 1,
      life: 0.28 + Math.random() * 0.14,
      maxLife: 0.42,
      gravity: 540,
    });
  }

  if (enemy.hp <= 0) {
    if (defenseSource) {
      handleDefenseKill(state, enemy, defenseSource);
      return;
    }

    state.koCount++;
    state.soundQueue.push('ko');

    // Petasan detonates upon death if not already exploded!
    if (enemy.kind === 'zombie_petasan') {
      explodePetasan(state, enemy);
    }

    // Award Uang Receh in Survival Mode for individual player kills
    if (state.mode === 'survival') {
      if (enemy.isBoss) {
        // Massive Boss Victory Jackpot shared equally across all players!
        const wave = state.survival?.wave ?? 10;
        const bossJackpot = Math.round(250 + wave * 15);
        const eligible = state.players.filter((p) => !p.knockedDown);
        const recipients = eligible.length > 0 ? eligible : state.players;
        const count = Math.max(1, recipients.length);
        const splitJackpot = Math.ceil(bossJackpot / count);

        for (const p of recipients) {
          const reward = Math.round(splitJackpot * (p.coinMult ?? 1));
          p.coins += reward;
          state.floatingTexts.push({
            x: p.x,
            y: p.y - p.z - 75,
            vy: -48,
            text: `+${reward} JACKPOT BOSS 👑`,
            color: '#facc15',
            scale: 1.15,
            life: 1.4,
            maxLife: 1.4,
          });
        }

        // Drop 2 refreshments (Es Teh + Kopi Giras)
        state.pickups.push({
          id: state.nextEntityId++,
          kind: 'es_teh',
          x: enemy.x - 24,
          y: enemy.y,
          z: 20,
          vx: -40,
          vy: 0,
          vz: 80,
          radius: 12,
          life: 25.0,
          bobPhase: 0,
        });
        state.pickups.push({
          id: state.nextEntityId++,
          kind: 'kopi_giras',
          x: enemy.x + 24,
          y: enemy.y,
          z: 20,
          vx: 40,
          vy: 0,
          vz: 80,
          radius: 12,
          life: 25.0,
          bobPhase: Math.PI,
        });

        state.floatingTexts.push({
          x: enemy.x,
          y: enemy.y - enemy.z - 90,
          vy: -45,
          text: `👑 BOSS TUMBANG! +${bossJackpot} RECEH! 👑`,
          color: '#4ade80',
          scale: 1.4,
          life: 1.8,
          maxLife: 1.8,
        });
      } else {
        const baseReward = getZombieCoinReward(enemy.kind);
        const recipient = attacker ?? state.players[0];
        if (recipient) {
          const reward = Math.round(baseReward * (recipient.coinMult ?? 1));
          recipient.coins += reward;
          state.floatingTexts.push({
            x: enemy.x,
            y: enemy.y - enemy.z - 72,
            vy: -55,
            text: `+${reward} RECEH`,
            color: '#fde047',
            scale: 1.0,
            life: 0.95,
            maxLife: 0.95,
          });
        }
      }
    }

    const line = enemy.isBoss
      ? 'BOSS TUMBANG! JOSS!'
      : SUROBOYO_KO_LINES[Math.floor(Math.random() * SUROBOYO_KO_LINES.length)];
    state.floatingTexts.push({
      x: enemy.x,
      y: enemy.y - enemy.z - (enemy.isBoss ? 78 : 54),
      vy: -50,
      text: line,
      color: enemy.isBoss ? '#4ade80' : '#fb923c',
      scale: enemy.isBoss ? 1.4 : 1.15,
      life: enemy.isBoss ? 1.5 : 0.9,
      maxLife: enemy.isBoss ? 1.5 : 0.9,
    });

    for (let i = 0; i < (enemy.isBoss ? 28 : 14); i++) {
      state.particles.push({
        x: enemy.x,
        y: enemy.y,
        z: 18,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 0.5) * 240,
        vz: 120 + Math.random() * 200,
        size: 5 + Math.random() * 5,
        color: i % 2 === 0 ? enemy.shirtColor : '#fde047',
        alpha: 1,
        life: 0.5 + Math.random() * 0.25,
        maxLife: 0.75,
        gravity: 650,
      });
    }
  }

  // Potato device performance safeguard: cap particles & floating texts to avoid GC spikes
  if (state.particles.length > 120) {
    state.particles.splice(0, state.particles.length - 120);
  }
  if (state.floatingTexts.length > 25) {
    state.floatingTexts.splice(0, state.floatingTexts.length - 25);
  }
}
