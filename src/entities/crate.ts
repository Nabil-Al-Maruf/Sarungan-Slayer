import {
  CRATE_HP,
  CRATE_SIZE,
  PICKUP_HEAL_AMOUNT,
  PICKUP_KOPI_ULT,
  Z_GRAVITY,
} from '../core/constants';
import { circlesOverlap } from '../core/physics';
import type { CrateState, GameState, PickupKind } from '../core/types';

export function spawnCrate(state: GameState, x: number, y: number, dropHeight = 0): CrateState {
  const crate: CrateState = {
    id: state.nextEntityId++,
    x,
    y,
    z: dropHeight,
    vz: 0,
    radius: CRATE_SIZE * 0.52,
    hp: CRATE_HP,
    maxHp: CRATE_HP,
    hitFlashTimer: 0,
    lastHitSwingId: -1,
    style: Math.random() < 0.5 ? 'wood' : 'cardboard',
  };
  state.crates.push(crate);
  return crate;
}

export function damageCrate(state: GameState, crate: CrateState, dmg: number): void {
  crate.hp -= dmg;
  crate.hitFlashTimer = 0.1;
  crate.vz = 90;

  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: crate.x,
      y: crate.y,
      z: 16,
      vx: (Math.random() - 0.5) * 220,
      vy: (Math.random() - 0.5) * 160,
      vz: 100 + Math.random() * 130,
      size: 4 + Math.random() * 4,
      color: crate.style === 'wood' ? '#d97706' : '#c28f5c',
      alpha: 1,
      life: 0.35 + Math.random() * 0.2,
      maxLife: 0.55,
      gravity: 760,
    });
  }

  if (crate.hp <= 0) {
    state.soundQueue.push('crate_break');
    state.shakeTimer = Math.max(state.shakeTimer, 0.12);
    state.shakeIntensity = Math.max(state.shakeIntensity, 4);

    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x: crate.x,
        y: crate.y,
        z: 18,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 0.5) * 240,
        vz: 140 + Math.random() * 190,
        size: 5 + Math.random() * 5,
        color: i % 2 === 0 ? '#b45309' : '#f59e0b',
        alpha: 1,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        gravity: 840,
      });
    }

    const kind: PickupKind = Math.random() < 0.5 ? 'es_teh' : 'kopi_giras';
    state.pickups.push({
      id: state.nextEntityId++,
      kind,
      x: crate.x,
      y: crate.y,
      z: 12,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 70,
      vz: 240,
      radius: 16,
      life: 16,
      bobPhase: Math.random() * Math.PI * 2,
    });
  } else {
    state.soundQueue.push('crate_hit');
  }
}

export function updateCratesAndPickups(state: GameState, dt: number): void {
  // Update crates Z-drop
  for (let i = state.crates.length - 1; i >= 0; i--) {
    const c = state.crates[i];
    if (c.hp <= 0) {
      state.crates.splice(i, 1);
      continue;
    }
    if (c.hitFlashTimer > 0) c.hitFlashTimer = Math.max(0, c.hitFlashTimer - dt);

    if (c.z > 0 || c.vz > 0) {
      c.vz -= Z_GRAVITY * dt;
      c.z += c.vz * dt;
      if (c.z <= 0) {
        c.z = 0;
        c.vz = 0;
      }
    }
  }

  // Update pickups
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const item = state.pickups[i];
    item.life -= dt;
    item.bobPhase += dt * 5;
    if (item.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }

    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.vx *= Math.pow(0.06, dt);
    item.vy *= Math.pow(0.06, dt);

    if (item.z > 0 || item.vz > 0) {
      item.vz -= Z_GRAVITY * 0.8 * dt;
      item.z += item.vz * dt;
      if (item.z <= 0) {
        item.z = 0;
        item.vz = 0;
      }
    }

    // Player collection
    let collected = false;
    for (const player of state.players) {
      if (circlesOverlap(player.x, player.y, player.radius + 6, item.x, item.y, item.radius)) {
        if (item.kind === 'es_teh') {
          const before = player.hp;
          player.hp = Math.min(player.maxHp, player.hp + PICKUP_HEAL_AMOUNT);
          const healed = Math.round(player.hp - before);
          state.soundQueue.push('pickup_heal');
          state.floatingTexts.push({
            x: player.x,
            y: player.y - player.z - 52,
            vy: -55,
            text: healed > 0 ? `+${healed} HP ES TEH!` : 'SEGER POLL!',
            color: '#4ade80',
            scale: 1.05,
            life: 0.95,
            maxLife: 0.95,
          });
        } else {
          player.ult = Math.min(player.maxUlt, player.ult + PICKUP_KOPI_ULT);
          state.soundQueue.push('pickup_kopi');
          state.floatingTexts.push({
            x: player.x,
            y: player.y - player.z - 52,
            vy: -55,
            text: `+${PICKUP_KOPI_ULT}% KOPI GIRAS!`,
            color: '#fde047',
            scale: 1.08,
            life: 0.95,
            maxLife: 0.95,
          });
        }

        for (let k = 0; k < 10; k++) {
          state.particles.push({
            x: item.x,
            y: item.y,
            z: 14,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 120,
            vz: 80 + Math.random() * 120,
            size: 4 + Math.random() * 3,
            color: item.kind === 'es_teh' ? '#4ade80' : '#facc15',
            alpha: 1,
            life: 0.45,
            maxLife: 0.45,
            gravity: 340,
          });
        }
        collected = true;
        break;
      }
    }
    if (collected) {
      state.pickups.splice(i, 1);
    }
  }
}
