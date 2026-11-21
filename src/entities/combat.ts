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
import { damagePlayer } from './player';

const SUROBOYO_KO_LINES = ['MANTAP REK!', 'KESABET!', 'KO CAK!', 'WUSSS!'];

function inMeleeArc(
  px: number,
  py: number,
  aimX: number,
  aimY: number,
  tx: number,
  ty: number,
  targetRadius: number
): boolean {
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.hypot(dx, dy);
  if (dist > MELEE_REACH + targetRadius) return false;
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

      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || enemy.lastHitSwingId === player.meleeSwingId) continue;
        if (inMeleeArc(player.x, player.y, aimX, aimY, enemy.x, enemy.y, enemy.radius)) {
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

          hitEnemy(
            state,
            enemy,
            player,
            finalDmg,
            nx * (blocked ? 150 : MELEE_KNOCKBACK),
            ny * (blocked ? 150 : MELEE_KNOCKBACK),
            Math.round((blocked ? 4 : MELEE_ULT_GAIN) * player.ultGainMult),
            blocked
          );
          state.hitstopTimer = Math.max(state.hitstopTimer, 0.032);
        }
      }

      for (const crate of state.crates) {
        if (crate.hp <= 0 || crate.lastHitSwingId === player.meleeSwingId) continue;
        if (inMeleeArc(player.x, player.y, aimX, aimY, crate.x, crate.y, crate.radius)) {
          crate.lastHitSwingId = player.meleeSwingId;
          damageCrate(state, crate, MELEE_DAMAGE);
        }
      }
    }

    // 2. 360° Ultimate Vortex (Badai Sarung Suroboyo)
    if (player.ultActiveTimer > 0) {
      player.ultActiveTimer = Math.max(0, player.ultActiveTimer - dt);
      player.ultTickTimer -= dt;

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
        color: '#bae6fd',
        alpha: 0.75,
        life: 0.18,
        maxLife: 0.18,
        gravity: 0,
      });
    }

    const owner = state.players.find((p) => p.id === proj.ownerId) ?? state.players[0];

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || proj.hitIds.includes(enemy.id)) continue;
      if (circlesOverlap(proj.x, proj.y, proj.radius, enemy.x, enemy.y, enemy.radius + 4)) {
        proj.hitIds.push(enemy.id);
        proj.pierceLeft--;
        const speed = Math.hypot(proj.vx, proj.vy) || 1;
        hitEnemy(
          state,
          enemy,
          owner,
          proj.damage,
          (proj.vx / speed) * 230,
          (proj.vy / speed) * 230,
          Math.round(PROJ_ULT_GAIN * (owner?.ultGainMult ?? 1)),
          false
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

    if (
      proj.life <= 0 ||
      proj.pierceLeft <= 0 ||
      proj.x < state.cameraX - 80 ||
      proj.x > state.cameraX + 1040 ||
      proj.y < -60 ||
      proj.y > state.arenaHeight + 60
    ) {
      state.projectiles.splice(i, 1);
    }
  }

  // 4. Enemy Projectiles (Sandal, Sarung Wave, Baja Wave)
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

  // 5. Telegraphed Ground Hazards (Hujan Mercon Banting & Boss Jump Slam)
  for (let i = state.hazards.length - 1; i >= 0; i--) {
    const hz = state.hazards[i];
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

        // Damage players inside radius (jumping high can dodge slam!)
        for (const player of state.players) {
          const d = Math.hypot(player.x - hz.x, player.y - hz.y);
          if (d <= hz.radius + player.radius && (hz.kind === 'mercon' || player.z < 28)) {
            const nx = d > 1 ? (player.x - hz.x) / d : 1;
            const ny = d > 1 ? (player.y - hz.y) / d : 0;
            damagePlayer(state, player, hz.damage, nx, ny);
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

function hitEnemy(
  state: GameState,
  enemy: EnemyState,
  attacker: PlayerState | undefined,
  damage: number,
  kbX: number,
  kbY: number,
  ultGain: number,
  blocked: boolean
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
    state.koCount++;
    state.soundQueue.push('ko');

    // Award Uang Receh in Survival Mode (including Tower kills credited to all alive players!)
    if (state.mode === 'survival') {
      const baseReward =
        enemy.kind === 'zombie_gendruwo'
          ? 60
          : enemy.kind === 'zombie_tuyul'
            ? 50
            : enemy.kind === 'zombie_pocong'
              ? 35
              : enemy.kind === 'zombie_bocil'
                ? 25
                : 20;
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
}
