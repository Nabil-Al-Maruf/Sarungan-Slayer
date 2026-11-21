import {
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SPEED,
  DOUBLE_JUMP_VZ,
  JUMP_VZ,
  MELEE_COOLDOWN,
  MELEE_DURATION,
  MOVE_ACCEL,
  MOVE_SPEED,
  PLAYER_PALETTES,
  PLAYER_RADIUS,
  PROJ_COOLDOWN,
  PROJ_DAMAGE,
  PROJ_LIFETIME,
  PROJ_MAX_PIERCE,
  PROJ_RADIUS,
  PROJ_SPEED,
  ULT_DURATION,
  ULT_MAX,
} from '../core/constants';
import { stepTopDownPhysics } from '../core/physics';
import type { GameState, PlayerInput, PlayerState } from '../core/types';

export function createPlayer(id: string, x: number, y: number, paletteIndex = 0): PlayerState {
  return {
    id,
    paletteIndex: paletteIndex % PLAYER_PALETTES.length,
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: PLAYER_RADIUS,
    dirX: 1,
    dirY: 0,
    jumpsRemaining: 2,

    hp: 100,
    maxHp: 100,
    ult: 0,
    maxUlt: ULT_MAX,
    coins: 60,
    reviveTickets: 0,
    knockedDown: false,
    invulnTimer: 0,
    hitFlashTimer: 0,

    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 1,
    dashDirY: 0,

    meleeTimer: 0,
    meleeCooldown: 0,
    meleeSwingId: 0,
    meleeComboStep: 0,
    meleeAngle: 0,

    projCooldown: 0,

    ultActiveTimer: 0,
    ultTickTimer: 0,

    scaleX: 1,
    scaleY: 1,
    animTime: 0,
    afterimages: [],
  };
}

export function updatePlayer(
  state: GameState,
  player: PlayerState,
  input: PlayerInput,
  dt: number
): void {
  const palette = PLAYER_PALETTES[player.paletteIndex % PLAYER_PALETTES.length];

  // Timers
  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  if (player.hitFlashTimer > 0) player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (player.meleeTimer > 0) player.meleeTimer = Math.max(0, player.meleeTimer - dt);
  if (player.meleeCooldown > 0) player.meleeCooldown = Math.max(0, player.meleeCooldown - dt);
  if (player.projCooldown > 0) player.projCooldown = Math.max(0, player.projCooldown - dt);

  if (player.z === 0) {
    player.jumpsRemaining = 2;
  }

  // 8-way movement vector
  let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(ix, iy);
  if (len > 0) {
    ix /= len;
    iy /= len;
    if (player.dashTimer <= 0) {
      player.dirX = ix;
      player.dirY = iy;
    }
  }

  // Ultimate Activation (Badai Sarung Suroboyo)
  if (input.ultPressed && player.ult >= player.maxUlt && player.ultActiveTimer <= 0) {
    player.ult = 0;
    player.ultActiveTimer = ULT_DURATION;
    player.ultTickTimer = 0;
    player.invulnTimer = Math.max(player.invulnTimer, ULT_DURATION + 0.15);
    player.scaleX = 1.28;
    player.scaleY = 0.78;
    state.soundQueue.push('ult_start');
    state.shakeTimer = Math.max(state.shakeTimer, 0.28);
    state.shakeIntensity = Math.max(state.shakeIntensity, 7);
    state.floatingTexts.push({
      x: player.x,
      y: player.y - player.z - 56,
      vy: -45,
      text: 'BADAI SARUNG SUROBOYO!',
      color: '#fde047',
      scale: 1.25,
      life: 1.2,
      maxLife: 1.2,
    });
  }

  // 8-Way Dash Activation
  if (input.dashPressed && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    player.dashDirX = len > 0 ? ix : player.dirX;
    player.dashDirY = len > 0 ? iy : player.dirY;
    player.dirX = player.dashDirX;
    player.dirY = player.dashDirY;
    player.dashTimer = DASH_DURATION;
    player.dashCooldown = DASH_COOLDOWN;
    player.invulnTimer = Math.max(player.invulnTimer, DASH_DURATION + 0.08);
    player.scaleX = 1.3;
    player.scaleY = 0.76;
    state.soundQueue.push('dash');
  }

  // Ground X/Y velocity
  if (player.dashTimer > 0) {
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    player.vx = player.dashDirX * DASH_SPEED;
    player.vy = player.dashDirY * DASH_SPEED;

    if (Math.floor(state.time * 60) % 2 === 0) {
      player.afterimages.push({
        x: player.x,
        y: player.y,
        z: player.z,
        alpha: 0.55,
        color: palette.sarung,
      });
    }
  } else {
    const ultSpeedMult = player.ultActiveTimer > 0 ? 1.15 : 1;
    const targetVx = ix * MOVE_SPEED * ultSpeedMult;
    const targetVy = iy * MOVE_SPEED * ultSpeedMult;

    const dvx = targetVx - player.vx;
    const dvy = targetVy - player.vy;
    const step = MOVE_ACCEL * dt;
    const dist = Math.hypot(dvx, dvy);
    if (dist <= step) {
      player.vx = targetVx;
      player.vy = targetVy;
    } else {
      player.vx += (dvx / dist) * step;
      player.vy += (dvy / dist) * step;
    }
  }

  // Z-Axis Hop & Double Jump
  if (input.jumpPressed && player.jumpsRemaining > 0) {
    const isFirst = player.z === 0;
    player.vz = isFirst ? JUMP_VZ : DOUBLE_JUMP_VZ;
    player.jumpsRemaining = isFirst ? 1 : player.jumpsRemaining - 1;
    player.scaleX = 0.78;
    player.scaleY = 1.26;
    state.soundQueue.push(isFirst ? 'jump' : 'double_jump');
    spawnDust(state, player.x, player.y, 6);
  }

  // Melee — 8-Way Kibas Sarung
  if (input.meleePressed && player.meleeCooldown <= 0 && player.ultActiveTimer <= 0) {
    player.meleeTimer = MELEE_DURATION;
    player.meleeCooldown = MELEE_COOLDOWN;
    player.meleeSwingId++;
    player.meleeComboStep = (player.meleeComboStep + 1) % 2;
    player.meleeAngle = Math.atan2(player.dirY, player.dirX);
    player.scaleX = 1.22;
    player.scaleY = 0.84;
    state.soundQueue.push('kibas');

    state.slashes.push({
      x: player.x + player.dirX * 26,
      y: player.y - player.z - 18 + player.dirY * 22,
      angle: player.meleeAngle,
      color: palette.sarung,
      stripeColor: palette.sarungStripe,
      life: 0.16,
      maxLife: 0.16,
      comboStep: player.meleeComboStep,
    });
  }

  // Secondary — 8-Way Sabetan Angin Pecut (Projectile)
  if (input.projPressed && player.projCooldown <= 0 && player.ultActiveTimer <= 0) {
    player.projCooldown = PROJ_COOLDOWN;
    player.scaleX = 1.24;
    player.scaleY = 0.82;
    state.soundQueue.push('pecut');

    const angle = Math.atan2(player.dirY, player.dirX);
    state.projectiles.push({
      id: state.nextEntityId++,
      ownerId: player.id,
      x: player.x + player.dirX * 22,
      y: player.y + player.dirY * 18,
      vx: player.dirX * PROJ_SPEED,
      vy: player.dirY * PROJ_SPEED,
      angle,
      radius: PROJ_RADIUS,
      damage: PROJ_DAMAGE,
      pierceLeft: PROJ_MAX_PIERCE,
      hitIds: [],
      life: PROJ_LIFETIME,
      maxLife: PROJ_LIFETIME,
      color: palette.sarungStripe,
    });

    for (let i = 0; i < 7; i++) {
      state.particles.push({
        x: player.x + player.dirX * 18,
        y: player.y + player.dirY * 14,
        z: 18 + (Math.random() - 0.5) * 10,
        vx: player.dirX * (120 + Math.random() * 140) + (Math.random() - 0.5) * 60,
        vy: player.dirY * (120 + Math.random() * 140) + (Math.random() - 0.5) * 60,
        vz: (Math.random() - 0.5) * 40,
        size: 4 + Math.random() * 3,
        color: '#e0f2fe',
        alpha: 0.9,
        life: 0.24,
        maxLife: 0.24,
        gravity: 0,
      });
    }
  }

  // Physics step
  const phys = stepTopDownPhysics(player, dt, state.obstacles, state.activeMinX, state.activeMaxX);
  if (phys.landed && phys.impactVz > 160) {
    player.scaleX = 1.24;
    player.scaleY = 0.78;
    spawnDust(state, player.x, player.y, 5);
  }

  // Smooth squash & stretch recovery
  player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 15);
  player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 15);

  const speed = Math.hypot(player.vx, player.vy);
  if (player.ultActiveTimer > 0) {
    player.animTime += dt * 24;
  } else if (speed > 20 && player.z === 0) {
    player.animTime += dt * 13;
  } else {
    player.animTime += dt * 3;
  }

  // Fade afterimages
  for (let i = player.afterimages.length - 1; i >= 0; i--) {
    player.afterimages[i].alpha -= dt * 3.4;
    if (player.afterimages[i].alpha <= 0) {
      player.afterimages.splice(i, 1);
    }
  }
}

export function damagePlayer(
  state: GameState,
  player: PlayerState,
  amount: number,
  kbX: number,
  kbY: number
): void {
  if (player.invulnTimer > 0 || player.ultActiveTimer > 0) return;

  player.hp = Math.max(0, player.hp - amount);
  player.invulnTimer = 0.85;
  player.hitFlashTimer = 0.16;
  player.vx = kbX * 240;
  player.vy = kbY * 240;
  player.vz = 170;
  player.scaleX = 1.25;
  player.scaleY = 0.75;

  state.soundQueue.push('player_hurt');
  state.shakeTimer = Math.max(state.shakeTimer, 0.14);
  state.shakeIntensity = Math.max(state.shakeIntensity, 5);

  state.floatingTexts.push({
    x: player.x,
    y: player.y - player.z - 46,
    vy: -55,
    text: `-${amount} ADUH!`,
    color: '#f87171',
    scale: 1,
    life: 0.75,
    maxLife: 0.75,
  });

  if (player.hp <= 0) {
    if (state.mode === 'sandbox') {
      player.hp = player.maxHp;
      state.floatingTexts.push({
        x: player.x,
        y: player.y - 66,
        vy: -45,
        text: 'TANGI MANEH REK!',
        color: '#38bdf8',
        scale: 1.1,
        life: 1.1,
        maxLife: 1.1,
      });
    } else if (state.mode === 'survival' && player.reviveTickets > 0) {
      player.reviveTickets--;
      player.hp = player.maxHp;
      player.invulnTimer = 2.0;
      state.soundQueue.push('pickup_kopi');
      state.floatingTexts.push({
        x: player.x,
        y: player.y - 66,
        vy: -45,
        text: 'TIKET REVIVE AKTIF!',
        color: '#4ade80',
        scale: 1.15,
        life: 1.3,
        maxLife: 1.3,
      });
    } else if (state.mode === 'survival') {
      player.knockedDown = true;
      const anyAlive = state.players.some((p) => !p.knockedDown);
      if (!anyAlive) {
        state.status = 'gameover';
        state.shakeTimer = 0;
        state.shakeIntensity = 0;
        state.hitstopTimer = 0;
        state.soundQueue.push('ko');
      }
    } else {
      state.status = 'gameover';
      state.shakeTimer = 0;
      state.shakeIntensity = 0;
      state.hitstopTimer = 0;
      state.soundQueue.push('ko');
    }
  }
}

function spawnDust(state: GameState, x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 8,
      z: 2,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 50,
      vz: 25 + Math.random() * 55,
      size: 3 + Math.random() * 3.5,
      color: '#e2e8f0',
      alpha: 0.75,
      life: 0.28 + Math.random() * 0.12,
      maxLife: 0.4,
      gravity: 160,
    });
  }
}
