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
  ULT_MAX,
} from '../core/constants';
import { getHeroDef } from '../core/heroes';
import { stepTopDownPhysics } from '../core/physics';
import type { GameState, HeroId, PlayerInput, PlayerState } from '../core/types';

export function createPlayer(
  id: string,
  x: number,
  y: number,
  paletteIndex = 0,
  customName?: string,
  heroId?: HeroId
): PlayerState {
  const pal = PLAYER_PALETTES[paletteIndex % PLAYER_PALETTES.length];
  const resolvedHeroId: HeroId = heroId || pal.heroId || 'bima';
  const hDef = getHeroDef(resolvedHeroId);
  const resolvedPalette = heroId ? hDef.paletteIndex : paletteIndex % PLAYER_PALETTES.length;
  const defaultName = pal.name.split(' (')[0];
  return {
    id,
    name: (customName && customName.trim().slice(0, 14)) || (heroId ? hDef.name : defaultName),
    paletteIndex: resolvedPalette,
    heroId: resolvedHeroId,
    slashStyle: (heroId ? hDef.slashStyle : pal.slashStyle) || hDef.slashStyle || 'sarung_whip',
    sarungStyle: (heroId ? hDef.sarungStyle : pal.sarungStyle) || hDef.sarungStyle || 'gulung_tempur',
    slashElement: 'none',
    slashElementLevel: 1,
    unlockedElements: {},
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: PLAYER_RADIUS,
    dirX: 1,
    dirY: 0,
    jumpsRemaining: hDef.maxJumps ?? 2,

    hp: hDef.maxHp ?? 100,
    maxHp: hDef.maxHp ?? 100,
    ult: 0,
    maxUlt: ULT_MAX,
    ultType: hDef.ultType ?? 'gasing',
    coins: 60,
    reviveTickets: 0,
    knockedDown: false,
    invulnTimer: 0,
    hitFlashTimer: 0,

    dmgMult: hDef.dmgMult ?? 1,
    cdMult: hDef.cdMult ?? 1,
    speedMult: 1,
    ultGainMult: 1,
    coinMult: 1,
    pendingBuffChoices: [],
    buffCount: 0,

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

  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  if (player.hitFlashTimer > 0) player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (player.meleeTimer > 0) player.meleeTimer = Math.max(0, player.meleeTimer - dt);
  if (player.meleeCooldown > 0) player.meleeCooldown = Math.max(0, player.meleeCooldown - dt);
  if (player.projCooldown > 0) player.projCooldown = Math.max(0, player.projCooldown - dt);

  if (player.z === 0) {
    player.jumpsRemaining = 2;
  }

  // Support both 360° analog thumbstick vector and 8-way digital keys
  let ix =
    typeof input.moveX === 'number' && Math.abs(input.moveX) > 0.05
      ? input.moveX
      : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let iy =
    typeof input.moveY === 'number' && Math.abs(input.moveY) > 0.05
      ? input.moveY
      : (input.down ? 1 : 0) - (input.up ? 1 : 0);

  const len = Math.hypot(ix, iy);
  if (len > 0) {
    const clampedLen = Math.min(1, len);
    ix = (ix / len) * clampedLen;
    iy = (iy / len) * clampedLen;
    if (player.dashTimer <= 0) {
      player.dirX = ix / clampedLen;
      player.dirY = iy / clampedLen;
    }
  }

  // Ultimate Activation (Gasing, Petir, Mercon, or Naga)
  if (input.ultPressed && player.ult >= player.maxUlt && player.ultActiveTimer <= 0) {
    player.ult = 0;
    const uType = player.ultType ?? 'gasing';

    if (uType === 'petir') {
      player.ultActiveTimer = 0.55;
      player.invulnTimer = Math.max(player.invulnTimer, 1.4);
      player.scaleX = 1.35;
      player.scaleY = 0.7;
      player.vz = 95;
      state.soundQueue.push('ult_start');
      state.shakeTimer = Math.max(state.shakeTimer, 0.7);
      state.shakeIntensity = Math.max(state.shakeIntensity, 14);
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 65,
        vy: -55,
        text: '⚡ PETIR HALILINTAR KENJERAN! ⚡',
        color: '#38bdf8',
        scale: 1.4,
        life: 1.5,
        maxLife: 1.5,
      });

      // Strike all visible enemies with balanced high-voltage lightning & electric stun
      const activeEnemies = state.enemies.filter((e) => e.hp > 0);
      for (const e of activeEnemies) {
        const dmg = Math.round((e.isBoss ? 225 : 175) * player.dmgMult);
        e.hp = Math.max(0, e.hp - dmg);
        e.hitFlashTimer = 0.3;
        e.stunTimer = Math.max(e.stunTimer, 1.8); // Balanced 1.8s Electric Stun
        e.vz = 150;

        state.floatingTexts.push({
          x: e.x,
          y: e.y - e.z - 45,
          vy: -60,
          text: `⚡ -${dmg} (STUN!)`,
          color: '#38bdf8',
          scale: 1.15,
          life: 1.1,
          maxLife: 1.1,
        });

        // Vertical lightning strike particles falling from sky
        for (let k = 0; k < 10; k++) {
          state.particles.push({
            x: e.x + (Math.random() - 0.5) * 24,
            y: e.y + (Math.random() - 0.5) * 18,
            z: k * 35,
            vx: (Math.random() - 0.5) * 45,
            vy: (Math.random() - 0.5) * 45,
            vz: -30,
            size: 4 + Math.random() * 3,
            color: k % 2 === 0 ? '#38bdf8' : '#fef08a',
            alpha: 1,
            life: 0.4,
            maxLife: 0.4,
            gravity: 0,
          });
        }

        // Chain Lightning: Jump to nearest second enemy within 140px!
        const chainTarget = activeEnemies.find(
          (other) => other !== e && other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) <= 140
        );
        if (chainTarget) {
          const chainDmg = Math.round(85 * player.dmgMult);
          chainTarget.hp = Math.max(0, chainTarget.hp - chainDmg);
          chainTarget.hitFlashTimer = 0.25;
          chainTarget.stunTimer = Math.max(chainTarget.stunTimer, 1.6);
          // Sparks connecting the two enemies
          for (let s = 0; s < 5; s++) {
            const ratio = s / 5;
            state.particles.push({
              x: e.x + (chainTarget.x - e.x) * ratio,
              y: e.y + (chainTarget.y - e.y) * ratio,
              z: 18,
              vx: (Math.random() - 0.5) * 30,
              vy: (Math.random() - 0.5) * 30,
              vz: 10,
              size: 4,
              color: '#38bdf8',
              alpha: 1,
              life: 0.3,
              maxLife: 0.3,
              gravity: 0,
            });
          }
        }

        if (e.hp <= 0) {
          state.soundQueue.push('ko');
          if (state.mode === 'survival') {
            const reward = Math.round(35 * (player.coinMult ?? 1));
            player.coins += reward;
            state.floatingTexts.push({
              x: player.x,
              y: player.y - 70,
              vy: -40,
              text: `+${reward} Receh ⚡`,
              color: '#facc15',
              scale: 1,
              life: 0.9,
              maxLife: 0.9,
            });
          }
        }
      }
    } else if (uType === 'mercon') {
      player.ultActiveTimer = 0.5;
      player.invulnTimer = Math.max(player.invulnTimer, 0.8);
      player.scaleX = 1.38;
      player.scaleY = 0.68;
      // Cannon recoil knockback on player!
      player.vx -= player.dirX * 150;
      player.vy -= player.dirY * 150;
      state.soundQueue.push('tower_shoot');
      state.shakeTimer = Math.max(state.shakeTimer, 0.55);
      state.shakeIntensity = Math.max(state.shakeIntensity, 11);
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 65,
        vy: -55,
        text: '💥 MERIAM BAMBU KARBIT BAZOOKA! 💥',
        color: '#f97316',
        scale: 1.35,
        life: 1.4,
        maxLife: 1.4,
      });

      const baseAngle = Math.atan2(player.dirY, player.dirX);
      const angles = [baseAngle - 0.22, baseAngle, baseAngle + 0.22];
      for (const ang of angles) {
        state.projectiles.push({
          id: state.nextEntityId++,
          ownerId: player.id,
          kind: 'mercon',
          x: player.x + Math.cos(ang) * 26,
          y: player.y + Math.sin(ang) * 20,
          vx: Math.cos(ang) * (PROJ_SPEED * 1.35),
          vy: Math.sin(ang) * (PROJ_SPEED * 1.35),
          angle: ang,
          radius: 24,
          damage: Math.round(180 * player.dmgMult),
          pierceLeft: 1, // Explodes on hit or end of life
          hitIds: [],
          life: 0.65,
          maxLife: 0.65,
          color: '#f97316',
        });
      }
    } else if (uType === 'naga') {
      player.ultActiveTimer = 1.6;
      player.invulnTimer = Math.max(player.invulnTimer, 1.8);
      player.scaleX = 1.35;
      player.scaleY = 0.72;
      state.soundQueue.push('ult_start');
      state.shakeTimer = Math.max(state.shakeTimer, 0.5);
      state.shakeIntensity = Math.max(state.shakeIntensity, 10);
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 65,
        vy: -55,
        text: '🐉 NAGA BARONG API SUROBOYO! 🐉',
        color: '#ef4444',
        scale: 1.4,
        life: 1.5,
        maxLife: 1.5,
      });

      // Gus Dimas Karomah Healing Bonus (+25% Max HP)
      const healAmt = Math.round(player.maxHp * 0.25);
      player.hp = Math.min(player.maxHp, player.hp + healAmt);

      const nagaAngle = Math.atan2(player.dirY, player.dirX);
      state.projectiles.push({
        id: state.nextEntityId++,
        ownerId: player.id,
        kind: 'naga',
        x: player.x + Math.cos(nagaAngle) * 36,
        y: player.y + Math.sin(nagaAngle) * 26,
        vx: Math.cos(nagaAngle) * (PROJ_SPEED * 1.05),
        vy: Math.sin(nagaAngle) * (PROJ_SPEED * 1.05),
        angle: nagaAngle,
        radius: 52,
        damage: Math.round(190 * player.dmgMult),
        pierceLeft: 999,
        hitIds: [],
        life: 1.2,
        maxLife: 1.2,
        color: '#10b981',
      });

      // Ground Sacred Flame path
      for (let s = 1; s <= 3; s++) {
        state.hazards.push({
          id: state.nextEntityId++,
          kind: 'naga_flame',
          ownerId: player.id,
          x: player.x + Math.cos(nagaAngle) * (s * 80),
          y: player.y + Math.sin(nagaAngle) * (s * 55),
          radius: 48,
          delay: 0,
          maxDelay: 0,
          damage: Math.round(45 * player.dmgMult),
          detonated: true,
          flashTimer: 2.8,
        });
      }
    } else if (uType === 'gempa') {
      // Bang Bambang: Gempa Hantam Tunjungan (Seismic Slam Ring + Heavy Stun & Knockback)
      player.ultActiveTimer = 0.65;
      player.invulnTimer = Math.max(player.invulnTimer, 1.3);
      player.vz = 240;
      player.scaleX = 1.45;
      player.scaleY = 0.65;
      state.soundQueue.push('ult_start');
      state.shakeTimer = Math.max(state.shakeTimer, 0.55);
      state.shakeIntensity = Math.max(state.shakeIntensity, 12);
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 65,
        vy: -55,
        text: '🌋 GEMPA HANTAM TUNJUNGAN! 🌋',
        color: '#f59e0b',
        scale: 1.35,
        life: 1.4,
        maxLife: 1.4,
      });

      const quakeRadius = 215;
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist <= quakeRadius) {
          const dmg = Math.round((e.isBoss ? 235 : 185) * player.dmgMult);
          e.hp = Math.max(0, e.hp - dmg);
          e.hitFlashTimer = 0.32;
          e.stunTimer = Math.max(e.stunTimer, 1.6);
          const ang = Math.atan2(e.y - player.y, e.x - player.x);
          e.vx += Math.cos(ang) * 440;
          e.vy += Math.sin(ang) * 320;
          e.vz = 210;
          state.floatingTexts.push({
            x: e.x,
            y: e.y - e.z - 42,
            vy: -55,
            text: `🌋 -${dmg}`,
            color: '#fbbf24',
            scale: 1.1,
            life: 1.0,
            maxLife: 1.0,
          });
        }
      }
      for (let i = 0; i < 24; i++) {
        const ang = (Math.PI * 2 * i) / 24;
        state.particles.push({
          x: player.x + Math.cos(ang) * 20,
          y: player.y + Math.sin(ang) * 14,
          z: 8,
          vx: Math.cos(ang) * 290,
          vy: Math.sin(ang) * 190,
          vz: 110 + Math.random() * 80,
          size: 7 + Math.random() * 5,
          alpha: 1,
          gravity: 420,
          life: 0.55,
          maxLife: 0.55,
          color: i % 2 === 0 ? '#f59e0b' : '#ef4444',
        });
      }
    } else if (uType === 'selendang') {
      // Mbak Sri: Badai Selendang Sutra (High-Speed 360° Silk Cyclone)
      player.ultActiveTimer = 2.4;
      player.ultTickTimer = 0;
      player.invulnTimer = Math.max(player.invulnTimer, 2.5);
      player.scaleX = 1.32;
      player.scaleY = 0.78;
      state.soundQueue.push('ult_start');
      state.shakeTimer = Math.max(state.shakeTimer, 0.25);
      state.shakeIntensity = Math.max(state.shakeIntensity, 6);
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 60,
        vy: -48,
        text: '💃 BADAI SELENDANG SUTRA! 💃',
        color: '#f472b6',
        scale: 1.3,
        life: 1.3,
        maxLife: 1.3,
      });
      for (let i = 0; i < 18; i++) {
        const ang = (Math.PI * 2 * i) / 18;
        state.particles.push({
          x: player.x,
          y: player.y,
          z: 14,
          vx: Math.cos(ang) * 240,
          vy: Math.sin(ang) * 170,
          vz: 90,
          size: 6,
          alpha: 1,
          gravity: 0,
          life: 0.5,
          maxLife: 0.5,
          color: i % 2 === 0 ? '#ec4899' : '#fbcfe8',
        });
      }
    } else {
      // Default / Gasing (Cak Bima): Badai Gasing Sarung
      const gasingDur = 2.6;
      player.ultActiveTimer = gasingDur;
      player.ultTickTimer = 0;
      player.invulnTimer = Math.max(player.invulnTimer, gasingDur + 0.15);
      player.scaleX = 1.28;
      player.scaleY = 0.78;
      state.soundQueue.push('ult_start');
      state.shakeTimer = Math.max(state.shakeTimer, 0.28);
      state.shakeIntensity = Math.max(state.shakeIntensity, 7);
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 56,
        vy: -45,
        text: 'BADAI SARUNG GASING! 🌀',
        color: '#fde047',
        scale: 1.25,
        life: 1.2,
        maxLife: 1.2,
      });
    }
  }

  // 8-Way / 360° Dash Activation
  if (input.dashPressed && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    player.dashDirX = len > 0 ? player.dirX : player.dirX;
    player.dashDirY = len > 0 ? player.dirY : player.dirY;
    player.dashTimer = DASH_DURATION;
    player.dashCooldown = DASH_COOLDOWN * player.cdMult;
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
    const effSpeed = MOVE_SPEED * player.speedMult * ultSpeedMult;
    const targetVx = ix * effSpeed;
    const targetVy = iy * effSpeed;

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

  // Melee — Kibas Sarung
  if (input.meleePressed && player.meleeCooldown <= 0 && player.ultActiveTimer <= 0) {
    player.meleeTimer = MELEE_DURATION;
    player.meleeCooldown = MELEE_COOLDOWN * player.cdMult;
    player.meleeSwingId++;
    player.meleeComboStep = (player.meleeComboStep + 1) % 2;
    player.meleeAngle = Math.atan2(player.dirY, player.dirX);
    player.scaleX = 1.22;
    player.scaleY = 0.84;

    const hDef = getHeroDef(player.heroId);
    const slashStyle = player.slashStyle || hDef.slashStyle || 'sarung_whip';
    const slashElem = player.slashElement || 'none';
    const slashElemLv = player.slashElementLevel || 1;

    // Trigger hero & elemental procedural sound
    if (slashElem === 'petir') {
      state.soundQueue.push('slash_petir');
    } else if (slashElem === 'api') {
      state.soundQueue.push('slash_api');
    } else if (slashElem === 'badai') {
      state.soundQueue.push('slash_badai');
    } else if (slashElem === 'suci') {
      state.soundQueue.push('slash_suci');
    } else if (player.heroId === 'mat_clurit') {
      state.soundQueue.push('slash_clurit');
    } else if (player.heroId === 'bambang') {
      state.soundQueue.push('slash_tinju');
    } else {
      state.soundQueue.push('kibas');
    }

    state.slashes.push({
      x: player.x + player.dirX * 28,
      y: player.y - player.z - 18 + player.dirY * 22,
      angle: player.meleeAngle,
      color: hDef.slashColor || palette.sarung,
      stripeColor: palette.sarungStripe,
      life: 0.18,
      maxLife: 0.18,
      comboStep: player.meleeComboStep,
      heroId: player.heroId,
      slashStyle,
      element: slashElem,
      elementLevel: slashElemLv,
      ownerId: player.id,
    });

    // Spawn elemental attack particles
    if (slashElem === 'petir') {
      for (let p = 0; p < 4 * slashElemLv; p++) {
        state.particles.push({
          x: player.x + player.dirX * 30 + (Math.random() - 0.5) * 20,
          y: player.y - player.z - 18 + (Math.random() - 0.5) * 20,
          z: 14,
          vx: player.dirX * 180 + (Math.random() - 0.5) * 160,
          vy: player.dirY * 180 + (Math.random() - 0.5) * 160,
          vz: (Math.random() - 0.5) * 80,
          size: 2.5 + Math.random() * 2,
          color: Math.random() < 0.6 ? '#38bdf8' : '#facc15',
          alpha: 1,
          life: 0.14 + Math.random() * 0.1,
          maxLife: 0.24,
          gravity: 0,
        });
      }
    } else if (slashElem === 'api') {
      for (let p = 0; p < 5 * slashElemLv; p++) {
        state.particles.push({
          x: player.x + player.dirX * 28 + (Math.random() - 0.5) * 18,
          y: player.y - player.z - 18 + (Math.random() - 0.5) * 18,
          z: 12,
          vx: player.dirX * 120 + (Math.random() - 0.5) * 100,
          vy: player.dirY * 120 + (Math.random() - 0.5) * 100,
          vz: 60 + Math.random() * 80,
          size: 3 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#f97316' : '#ef4444',
          alpha: 1,
          life: 0.2 + Math.random() * 0.15,
          maxLife: 0.35,
          gravity: -60,
        });
      }
    } else if (slashElem === 'badai') {
      for (let p = 0; p < 4 * slashElemLv; p++) {
        state.particles.push({
          x: player.x + player.dirX * 34 + (Math.random() - 0.5) * 20,
          y: player.y - player.z - 18 + (Math.random() - 0.5) * 20,
          z: 10,
          vx: player.dirX * 200 + (Math.random() - 0.5) * 140,
          vy: player.dirY * 200 + (Math.random() - 0.5) * 140,
          vz: (Math.random() - 0.5) * 60,
          size: 2 + Math.random() * 2.5,
          color: '#e0f2fe',
          alpha: 0.8,
          life: 0.18 + Math.random() * 0.1,
          maxLife: 0.28,
          gravity: 0,
        });
      }
    } else if (slashElem === 'suci') {
      for (let p = 0; p < 4 * slashElemLv; p++) {
        state.particles.push({
          x: player.x + player.dirX * 26 + (Math.random() - 0.5) * 16,
          y: player.y - player.z - 18 + (Math.random() - 0.5) * 16,
          z: 12,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60 - 40,
          vz: 40 + Math.random() * 60,
          size: 2.5 + Math.random() * 2,
          color: Math.random() < 0.5 ? '#fde047' : '#ffffff',
          alpha: 1,
          life: 0.22 + Math.random() * 0.15,
          maxLife: 0.37,
          gravity: -40,
        });
      }
    }
  }

  // Secondary — Sabetan Angin Pecut (Projectile)
  if (input.projPressed && player.projCooldown <= 0 && player.ultActiveTimer <= 0) {
    player.projCooldown = PROJ_COOLDOWN * player.cdMult;
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
      damage: Math.round(PROJ_DAMAGE * player.dmgMult),
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
