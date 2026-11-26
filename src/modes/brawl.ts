import {
  FIXED_DT,
  PLAYER_PALETTES,
  PLAYER_RADIUS,
  PROJ_COOLDOWN,
} from '../core/constants';
import { getHeroDef } from '../core/heroes';
import type {
  BrawlPlatform,
  BrawlStageTheme,
  BrawlState,
  GameState,
  HeroId,
  PlayerInput,
  PlayerState,
  ProjectileState,
  SlashEffect,
} from '../core/types';

export interface BrawlRosterMember {
  id: string;
  name: string;
  paletteIndex: number;
  heroId: HeroId;
  isBot?: boolean;
}

// 2D Platform Fighter Physics Constants (Super Smash Bros style)
const BRAWL_GRAVITY = 980; // px/s² downward acceleration
const BRAWL_MAX_FALL = 680; // terminal fall velocity
const BRAWL_FAST_FALL = 840; // holding down while falling
const BRAWL_JUMP_IMPULSE = -495; // ground jump launch velocity (clears side platforms cleanly)
const BRAWL_DOUBLE_JUMP_IMPULSE = -450; // air jump launch velocity

export function createBrawlState(
  roster: BrawlRosterMember[],
  initialStocks = 3,
  stageTheme: BrawlStageTheme = 'alun_alun'
): GameState {
  let platforms: BrawlPlatform[];
  let spawnPoints: Array<{ x: number; y: number }>;

  if (stageTheme === 'atap_warga') {
    // Dual rooftops with a dangerous central void gap and high clotheslines
    platforms = [
      { x: 130, y: 390, w: 300, h: 34, dropThrough: false },
      { x: 530, y: 390, w: 300, h: 34, dropThrough: false },
      { x: 370, y: 290, w: 220, h: 14, dropThrough: true },
      { x: 180, y: 225, w: 150, h: 14, dropThrough: true },
      { x: 630, y: 225, w: 150, h: 14, dropThrough: true },
    ];
    spawnPoints = [
      { x: 260, y: 390 },
      { x: 700, y: 390 },
      { x: 480, y: 290 },
      { x: 250, y: 225 },
      { x: 710, y: 225 },
      { x: 340, y: 390 },
    ];
  } else if (stageTheme === 'jembatan_kali') {
    // Wide bridge over water with 3 pagoda/tower platforms
    platforms = [
      { x: 110, y: 390, w: 740, h: 34, dropThrough: false },
      { x: 160, y: 265, w: 140, h: 14, dropThrough: true },
      { x: 660, y: 265, w: 140, h: 14, dropThrough: true },
      { x: 390, y: 195, w: 180, h: 14, dropThrough: true },
    ];
    spawnPoints = [
      { x: 230, y: 390 },
      { x: 730, y: 390 },
      { x: 230, y: 265 },
      { x: 730, y: 265 },
      { x: 480, y: 195 },
      { x: 480, y: 390 },
    ];
  } else {
    // 'alun_alun' (Classic Battlefield style)
    platforms = [
      { x: 170, y: 390, w: 620, h: 32, dropThrough: false },
      { x: 210, y: 275, w: 160, h: 14, dropThrough: true },
      { x: 590, y: 275, w: 160, h: 14, dropThrough: true },
      { x: 390, y: 175, w: 180, h: 14, dropThrough: true },
    ];
    spawnPoints = [
      { x: 280, y: 390 },
      { x: 680, y: 390 },
      { x: 290, y: 275 },
      { x: 670, y: 275 },
      { x: 480, y: 175 },
      { x: 480, y: 390 },
    ];
  }

  const players: PlayerState[] = roster.map((m, idx) => {
    const pt = spawnPoints[idx % spawnPoints.length];
    const pal = PLAYER_PALETTES[m.paletteIndex % PLAYER_PALETTES.length];
    const hDef = getHeroDef(m.heroId);

    return {
      id: m.id,
      name: m.name || pal.name.split(' (')[0],
      paletteIndex: m.paletteIndex % PLAYER_PALETTES.length,
      heroId: m.heroId,
      slashStyle: hDef.slashStyle,
      sarungStyle: hDef.sarungStyle,
      slashElement: hDef.defaultElement || 'none',
      slashElementLevel: 1,
      brawlStocks: initialStocks,
      brawlKos: 0,
      isBot: !!m.isBot,
      x: pt.x,
      y: pt.y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: PLAYER_RADIUS,
      dirX: idx % 2 === 0 ? 1 : -1,
      dirY: 0,
      jumpsRemaining: hDef.maxJumps,
      isGrounded: true,
      dropThroughTimer: 0,
      botJumpTimer: 0,

      hp: hDef.maxHp,
      maxHp: hDef.maxHp,
      ult: 0,
      maxUlt: 100,
      ultType: hDef.ultType,
      coins: 0,
      reviveTickets: 0,
      knockedDown: false,
      invulnTimer: 2.5, // Initial spawn protection
      hitFlashTimer: 0,

      dmgMult: hDef.dmgMult,
      cdMult: hDef.cdMult,
      speedMult: 1,
      ultGainMult: 1,
      coinMult: 1,
      pendingBuffChoices: [],
      buffCount: 0,

      dashTimer: 0,
      dashCooldown: 0,
      dashDirX: idx % 2 === 0 ? 1 : -1,
      dashDirY: 0,

      meleeTimer: 0,
      meleeCooldown: 0,
      meleeSwingId: 0,
      meleeComboStep: 0,
      meleeAngle: 0,
      comboResetTimer: 0,

      projCooldown: 0,

      ultActiveTimer: 0,
      ultTickTimer: 0,

      scaleX: 1,
      scaleY: 1,
      animTime: 0,
      afterimages: [],
    };
  });

  const brawl: BrawlState = {
    initialStocks,
    matchDuration: 180,
    remainingTime: 180,
    stageTheme,
    platforms,
    itemSpawnTimer: 8,
    ringOutBound: {
      minX: -80,
      maxX: 1040,
      minY: -260,
      maxY: 580,
    },
  };

  return {
    mode: 'brawl',
    theme: 'arena_smash',
    stageNumber: 1,
    stageTitle: 'TAWURAN SMASH SUROBOYO',
    status: 'playing',

    time: 0,
    arenaWidth: 960,
    arenaHeight: 540,
    cameraX: 0,
    activeMinX: -80,
    activeMaxX: 1040,
    goPromptTimer: 0,

    storyZones: [],
    brawl,
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
    nextEntityId: 100,
    crateSpawnTimer: 0,
    enemyRespawnTimer: 0,
  };
}

/**
 * Intelligent Bot AI for Solo / Fill-in Smash Brawl
 * Supports:
 * - Edge-recovery jumping back to stage when airborne outside stage bounds
 * - Platform vertical tracking (jumping up or dropping through soft platforms)
 * - Melee combos, projectile kiting, and ultimate triggers
 */
function computeBotInput(bot: PlayerState, state: GameState, dt: number): PlayerInput {
  const inp: PlayerInput = {
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

  if ((bot.botJumpTimer ?? 0) > 0) {
    bot.botJumpTimer = Math.max(0, (bot.botJumpTimer ?? 0) - dt);
  }

  // 1. RECOVERY PRIORITY: When outside stage bounds, save life first!
  const stageLeft = 190;
  const stageRight = 770;
  const isOffStage = bot.x < stageLeft || bot.x > stageRight;

  if (isOffStage || bot.y > 400) {
    // Steer horizontally toward stage center (480)
    if (bot.x < 480) {
      inp.right = true;
    } else {
      inp.left = true;
    }

    // Jump if falling or below stage level
    if (bot.vy > 20 && bot.jumpsRemaining > 0 && (bot.botJumpTimer ?? 0) <= 0) {
      inp.jumpPressed = true;
      bot.botJumpTimer = 0.38; // Cooldown between jumps
    }

    // Emergency dash towards stage
    if (bot.dashCooldown <= 0 && Math.abs(bot.x - 480) > 120 && Math.random() < 0.08) {
      inp.dashPressed = true;
    }

    return inp;
  }

  // 2. COMBAT TARGETING: Find closest living opponent
  let closest: PlayerState | null = null;
  let minDist = Infinity;

  for (const p of state.players) {
    if (p.id === bot.id || (p.brawlStocks ?? 0) <= 0) continue;
    const d = Math.hypot(p.x - bot.x, p.y - bot.y);
    if (d < minDist) {
      minDist = d;
      closest = p;
    }
  }

  if (!closest) return inp;

  const dx = closest.x - bot.x;
  const dy = closest.y - bot.y;
  const absDx = Math.abs(dx);

  // Horizontal tracking
  if (dx > 36) inp.right = true;
  else if (dx < -36) inp.left = true;

  // Vertical tracking: Jump to reach opponent on higher platform
  if (dy < -45 && (bot.botJumpTimer ?? 0) <= 0 && (bot.isGrounded || bot.jumpsRemaining > 0)) {
    if (Math.random() < 0.15) {
      inp.jumpPressed = true;
      bot.botJumpTimer = 0.42;
    }
  }

  // Drop down from soft platform if opponent is well below
  const botOnSoftPlat = state.brawl?.platforms.some(
    (plat) =>
      plat.dropThrough &&
      bot.x + bot.radius * 0.7 > plat.x &&
      bot.x - bot.radius * 0.7 < plat.x + plat.w &&
      Math.abs(bot.y - plat.y) <= 5
  );

  if (dy > 65 && bot.isGrounded && botOnSoftPlat && Math.random() < 0.1) {
    inp.down = true;
    inp.jumpPressed = true;
  }

  // Attack decisions
  if (bot.ult >= bot.maxUlt && minDist < 190) {
    inp.ultPressed = true;
  } else if (minDist < 68 && Math.abs(dy) < 35) {
    inp.meleePressed = true;
  } else if (absDx > 90 && absDx < 340 && Math.abs(dy) < 45 && bot.projCooldown <= 0) {
    if (Math.random() < 0.25) {
      inp.projPressed = true;
    }
  } else if (absDx > 180 && bot.dashCooldown <= 0 && Math.random() < 0.05) {
    inp.dashPressed = true;
  }

  return inp;
}

export function stepBrawl(
  state: GameState,
  inputs: Record<string, PlayerInput>,
  dt = FIXED_DT
): void {
  const br = state.brawl;
  if (!br) return;

  // Clear frame sound queue at start of step
  state.soundQueue.length = 0;

  if (state.status !== 'playing') {
    state.slashes.length = 0;
    state.shakeTimer = 0;
    state.shakeIntensity = 0;
    state.hitstopTimer = 0;
    return;
  }

  // Screen shake decay (subtle & smoothly fades out)
  if (state.shakeTimer > 0) {
    state.shakeTimer = Math.max(0, state.shakeTimer - dt);
    if (state.shakeTimer === 0) {
      state.shakeIntensity = 0;
    }
  }

  // Hitstop pause (impact freeze frame)
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  state.time += dt;

  // Match timer
  br.remainingTime -= dt;
  if (br.remainingTime <= 0) {
    br.remainingTime = 0;
    determineBrawlWinner(state);
    return;
  }

  // Check living fighters count
  const activeFighters = state.players.filter((p) => (p.brawlStocks ?? 0) > 0);
  if (state.players.length > 1 && activeFighters.length <= 1) {
    determineBrawlWinner(state);
    return;
  }

  // Periodically spawn Smash Item Crates / Pickups
  br.itemSpawnTimer -= dt;
  if (br.itemSpawnTimer <= 0) {
    br.itemSpawnTimer = 12 + Math.random() * 8;
    spawnBrawlItem(state);
  }

  // Step each player
  for (const player of state.players) {
    if ((player.brawlStocks ?? 0) <= 0) continue; // Eliminated

    const hDef = getHeroDef(player.heroId);
    let inp = inputs[player.id];
    if (player.isBot) {
      inp = computeBotInput(player, state, dt);
    }
    if (!inp) {
      inp = {
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
    }

    // Cooldown & timers
    if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    if (player.hitFlashTimer > 0) player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.meleeCooldown > 0) player.meleeCooldown = Math.max(0, player.meleeCooldown - dt);
    if (player.meleeTimer > 0) player.meleeTimer = Math.max(0, player.meleeTimer - dt);
    if (player.projCooldown > 0) player.projCooldown = Math.max(0, player.projCooldown - dt);
    if ((player.dropThroughTimer ?? 0) > 0) player.dropThroughTimer = Math.max(0, (player.dropThroughTimer ?? 0) - dt);

    // Combo window countdown (resets combo chain if no follow-up attack within window)
    if ((player.comboResetTimer ?? 0) > 0) {
      player.comboResetTimer = Math.max(0, (player.comboResetTimer ?? 0) - dt);
      if (player.comboResetTimer === 0) {
        player.meleeComboStep = 0;
      }
    }

    const inHitstun = (player.hitFlashTimer ?? 0) > 0;

    // Active Ultimate timer
    if (player.ultActiveTimer > 0) {
      player.ultActiveTimer -= dt;
      player.ultTickTimer -= dt;
      if (player.ultTickTimer <= 0) {
        player.ultTickTimer = 0.18;
        executeHeroUltTick(state, player, hDef);
      }
      if (player.ultActiveTimer <= 0) {
        player.ult = 0;
      }
    }

    // Movement Intent
    let mx = 0;
    if (inp.moveX !== undefined && Math.abs(inp.moveX) > 0.08) {
      mx = inp.moveX;
    } else {
      if (inp.left) mx -= 1;
      if (inp.right) mx += 1;
    }

    if (!inHitstun) {
      if (mx > 0.1) player.dirX = 1;
      else if (mx < -0.1) player.dirX = -1;
    }

    const isHoldingDown = inp.down || (inp.moveY !== undefined && inp.moveY > 0.45);

    // Dash Action
    if (inp.dashPressed && player.dashCooldown <= 0 && !inHitstun) {
      player.dashTimer = 0.22;
      player.dashCooldown = 0.75 * hDef.cdMult;
      player.dashDirX = player.dirX;
      player.vx = player.dirX * hDef.dashSpeed;
      player.vy = 0; // Pause vertical fall during dash
      player.invulnTimer = Math.max(player.invulnTimer, 0.12);
      state.soundQueue.push('dash');
    }

    // Jump / Drop Through Action
    if (inp.jumpPressed && !inHitstun) {
      const onSoftPlatform = br.platforms.some(
        (plat) =>
          plat.dropThrough &&
          player.x + player.radius * 0.7 > plat.x &&
          player.x - player.radius * 0.7 < plat.x + plat.w &&
          Math.abs(player.y - plat.y) <= 5
      );

      if (player.isGrounded && isHoldingDown && onSoftPlatform) {
        // Drop through current soft platform!
        player.dropThroughTimer = 0.28;
        player.isGrounded = false;
        player.y += 6;
        player.vy = 80;
      } else if (player.isGrounded) {
        // Ground Jump
        player.isGrounded = false;
        player.vy = BRAWL_JUMP_IMPULSE;
        player.jumpsRemaining = hDef.maxJumps - 1;
        player.scaleX = 0.85;
        player.scaleY = 1.25;
        state.soundQueue.push('jump');
      } else if (player.jumpsRemaining > 0) {
        // Air Double / Triple Jump
        player.vy = BRAWL_DOUBLE_JUMP_IMPULSE;
        player.jumpsRemaining--;
        player.scaleX = 0.88;
        player.scaleY = 1.22;
        state.soundQueue.push('double_jump');

        // Air jump particle ring
        for (let j = 0; j < 6; j++) {
          const ang = (Math.PI * 2 * j) / 6;
          state.particles.push({
            x: player.x + Math.cos(ang) * 12,
            y: player.y + 4,
            z: 0,
            vx: Math.cos(ang) * 60,
            vy: 20 + Math.random() * 30,
            vz: 0,
            size: 3,
            color: '#f8fafc',
            alpha: 0.8,
            life: 0.25,
            maxLife: 0.25,
            gravity: 100,
          });
        }
      }
    }

    // Physics Step
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashDirX * hDef.dashSpeed;
      player.vy = 0;
      if (state.time % 0.05 < dt) {
        player.afterimages.push({
          x: player.x,
          y: player.y,
          z: 0,
          alpha: 0.6,
          color: hDef.accentColor,
        });
      }
    } else {
      const targetVx = mx * hDef.moveSpeed;
      if (inHitstun) {
        // DI steering during knockback
        player.vx += mx * 180 * dt;
        player.vx *= Math.pow(0.95, dt * 60);
      } else if (player.isGrounded) {
        // Grounded movement & landing slide friction
        if (Math.abs(player.vx) > hDef.moveSpeed * 1.2) {
          player.vx *= Math.pow(0.82, dt * 60);
        } else {
          player.vx += (targetVx - player.vx) * Math.min(1, dt * 20);
        }
      } else {
        // Airborne movement & knockback trajectory
        if (Math.abs(player.vx) > hDef.moveSpeed) {
          player.vx *= Math.pow(0.94, dt * 60);
          player.vx += mx * 220 * dt;
        } else {
          player.vx += (targetVx - player.vx) * Math.min(1, dt * 9);
        }
      }

      // Gravity
      if (!player.isGrounded) {
        const fallLimit = isHoldingDown && player.vy > 0 ? BRAWL_FAST_FALL : BRAWL_MAX_FALL;
        const grav = isHoldingDown && player.vy > 0 ? BRAWL_GRAVITY * 1.5 : BRAWL_GRAVITY;
        player.vy = Math.min(fallLimit, player.vy + grav * dt);
      }
    }

    // Squash & Stretch visual recovery
    player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 15);
    player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 15);

    // Animation Clock
    const speed = Math.hypot(player.vx, player.vy);
    if (player.ultActiveTimer > 0) {
      player.animTime += dt * 24;
    } else if (speed > 20 && player.isGrounded) {
      player.animTime += dt * 14;
    } else {
      player.animTime += dt * 3.5;
    }

    // Integrate Position
    const prevX = player.x;
    const prevY = player.y;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.z = 0; // Brawl is 2D side-scrolling, z kept at 0

    // Platform Collision Resolution
    handle2DPlatforms(player, prevX, prevY, br.platforms, isHoldingDown, dt);

    // Melee attack trigger
    if (inp.meleePressed && player.meleeCooldown <= 0 && player.dashTimer <= 0 && !inHitstun) {
      executeHeroMelee(state, player, hDef);
    }

    // Projectile skill trigger
    if (inp.projPressed && player.projCooldown <= 0 && player.dashTimer <= 0 && !inHitstun) {
      executeHeroProjectile(state, player, hDef);
    }

    // Ultimate trigger
    if (inp.ultPressed && player.ult >= player.maxUlt && player.ultActiveTimer <= 0 && !inHitstun) {
      player.ultActiveTimer = 3.2;
      player.ultTickTimer = 0.1;
      player.invulnTimer = 3.2;
      state.soundQueue.push('ult_start');
      state.shakeTimer = 0.16;
      state.shakeIntensity = 2.6;
      state.floatingTexts.push({
        x: player.x,
        y: player.y - 65,
        vy: -55,
        text: `⚡ JURUS: ${hDef.ultName.toUpperCase()}!`,
        color: hDef.accentColor,
        scale: 1.45,
        life: 1.8,
        maxLife: 1.8,
      });
    }

    // Clean afterimages
    for (let ai = player.afterimages.length - 1; ai >= 0; ai--) {
      player.afterimages[ai].alpha -= dt * 3.5;
      if (player.afterimages[ai].alpha <= 0) {
        player.afterimages.splice(ai, 1);
      }
    }

    // Check Ring Out / Blast Zones
    checkBrawlRingOut(state, player, br);
  }

  // Gentle horizontal separation push between living grounded players (prevents sprite stacking)
  for (let i = 0; i < state.players.length; i++) {
    const p1 = state.players[i];
    if ((p1.brawlStocks ?? 0) <= 0) continue;
    for (let j = i + 1; j < state.players.length; j++) {
      const p2 = state.players[j];
      if ((p2.brawlStocks ?? 0) <= 0) continue;
      if (Math.abs(p1.y - p2.y) < 20) {
        const minSep = p1.radius * 1.35; // ~24px
        const dx = p2.x - p1.x;
        const dist = Math.abs(dx);
        if (dist < minSep) {
          const overlap = (minSep - dist) * 0.5;
          const pushDir = dx >= 0 ? 1 : -1;
          p1.x -= pushDir * overlap * 0.45;
          p2.x += pushDir * overlap * 0.45;
        }
      }
    }
  }

  // Update projectiles & crates
  updateBrawlProjectiles(state, dt);
  updateBrawlCratesAndPickups(state, dt);

  // Update visual slashes (fixes bug where slashes stayed stuck on screen!)
  for (let i = state.slashes.length - 1; i >= 0; i--) {
    state.slashes[i].life -= dt;
    if (state.slashes[i].life <= 0) {
      state.slashes.splice(i, 1);
    }
  }

  // Update particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.vy += (p.gravity ?? 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha = Math.max(0, p.life / p.maxLife);
  }

  // Update floating texts
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

/**
 * 2D Platform Collision Engine
 * Supports:
 * - Solid ground with top landing, ceiling bonk, and side-push
 * - Soft platforms with drop-through and smooth top landing
 * - Edge detection (walking off edges enters airborne state with preserved air jump)
 */
function handle2DPlatforms(
  player: PlayerState,
  prevX: number,
  prevY: number,
  platforms: BrawlPlatform[],
  isHoldingDown: boolean,
  dt: number
): void {
  const wasGrounded = player.isGrounded;
  player.isGrounded = false;
  const hDef = getHeroDef(player.heroId);

  for (const plat of platforms) {
    const footSpan = player.radius * 0.7;
    const inX = player.x + footSpan > plat.x && player.x - footSpan < plat.x + plat.w;

    if (!plat.dropThrough) {
      // Solid Main Platform (plat.y: 390, plat.w: 620, plat.h: 32)
      const platTop = plat.y;
      const platBottom = plat.y + plat.h;

      // 1. Top Landing
      const maxFallStep = Math.max(18, player.vy * dt + 10);
      if (
        inX &&
        prevY <= platTop + 4 &&
        player.y >= platTop - 2 &&
        player.y <= platTop + maxFallStep &&
        player.vy >= 0
      ) {
        player.y = platTop;
        player.vy = 0;
        player.isGrounded = true;
        player.jumpsRemaining = hDef.maxJumps;
        player.dropThroughTimer = 0;
        if (!wasGrounded) {
          player.scaleX = 1.18;
          player.scaleY = 0.85;
        }
        continue;
      }

      // 2. Ceiling bonk
      const headPrevY = prevY - 44;
      const headY = player.y - 44;
      if (inX && headPrevY >= platBottom - 6 && headY <= platBottom + 2 && player.vy < 0) {
        player.y = platBottom + 44;
        player.vy = 0;
        player.scaleX = 1.15;
        player.scaleY = 0.88;
      }

      // 3. Side walls
      const bodyTop = player.y - 36;
      const bodyBottom = player.y;
      if (bodyTop < platBottom && bodyBottom > platTop + 4) {
        // Left ledge push
        if (prevX + player.radius <= plat.x + 6 && player.x + player.radius >= plat.x) {
          player.x = plat.x - player.radius;
          if (player.vx > 0) player.vx = 0;
        }
        // Right ledge push
        else if (prevX - player.radius >= plat.x + plat.w - 6 && player.x - player.radius <= plat.x + plat.w) {
          player.x = plat.x + plat.w + player.radius;
          if (player.vx < 0) player.vx = 0;
        }
      }
    } else {
      // Soft Floating Energy Platform
      if ((player.dropThroughTimer ?? 0) > 0) {
        continue; // Dropping through
      }

      // Land on top edge if falling downward and not holding down
      const maxFallStep = Math.max(18, player.vy * dt + 10);
      if (
        inX &&
        prevY <= plat.y + 4 &&
        player.y >= plat.y - 2 &&
        player.y <= plat.y + maxFallStep &&
        player.vy >= 0
      ) {
        if (!isHoldingDown) {
          player.y = plat.y;
          player.vy = 0;
          player.isGrounded = true;
          player.jumpsRemaining = hDef.maxJumps;
          player.dropThroughTimer = 0;
          if (!wasGrounded) {
            player.scaleX = 1.15;
            player.scaleY = 0.88;
          }
        }
      }
    }
  }

  // 4. Ground maintenance: If walking along platform and didn't jump or drop-through, stay grounded
  if (wasGrounded && !player.isGrounded && player.vy >= 0 && (player.dropThroughTimer ?? 0) <= 0) {
    for (const plat of platforms) {
      if (plat.dropThrough && (player.dropThroughTimer ?? 0) > 0) continue;
      const footSpan = player.radius * 0.7;
      const inX = player.x + footSpan > plat.x && player.x - footSpan < plat.x + plat.w;
      if (inX && Math.abs(player.y - plat.y) <= 5) {
        player.y = plat.y;
        player.vy = 0;
        player.isGrounded = true;
        break;
      }
    }
    // If walked off platform ledge, transition cleanly to air
    if (!player.isGrounded) {
      player.jumpsRemaining = Math.min(player.jumpsRemaining, hDef.maxJumps - 1);
    }
  }
}

function checkBrawlRingOut(
  state: GameState,
  player: PlayerState,
  br: BrawlState
): void {
  const b = br.ringOutBound;
  // Ceiling blast zone only KOs if fighter was launched in hitstun/knockback, preventing self-jump suicides
  const hitCeilingBlast = player.y < b.minY && (player.hitFlashTimer > 0 || player.vy < -250);
  const isOut =
    player.x < b.minX || player.x > b.maxX || hitCeilingBlast || player.y > b.maxY;

  if (isOut) {
    // Blast Zone Hit!
    player.brawlStocks = Math.max(0, (player.brawlStocks ?? 1) - 1);

    // Credit attacker
    if (player.lastHitBy && player.lastHitTime && state.time - player.lastHitTime < 8) {
      const killer = state.players.find((p) => p.id === player.lastHitBy);
      if (killer && killer.id !== player.id) {
        killer.brawlKos = (killer.brawlKos ?? 0) + 1;
        killer.ult = Math.min(killer.maxUlt, killer.ult + 35);
        state.floatingTexts.push({
          x: 480,
          y: 120,
          vy: -60,
          text: `💥 ${killer.name.toUpperCase()} KO'D ${player.name.toUpperCase()}!`,
          color: '#facc15',
          scale: 1.45,
          life: 2.2,
          maxLife: 2.2,
        });
      }
    }

    state.soundQueue.push('ko');
    state.shakeTimer = 0.18;
    state.shakeIntensity = 2.8;

    // Spawn blast particles
    const blastX = Math.max(30, Math.min(930, player.x));
    const blastY = Math.max(30, Math.min(510, player.y));
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24;
      const spd = 140 + Math.random() * 260;
      state.particles.push({
        x: blastX,
        y: blastY,
        z: 0,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: 0,
        size: 5 + Math.random() * 5,
        color: i % 2 === 0 ? '#ef4444' : '#fde047',
        alpha: 1,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        gravity: 0,
      });
    }

    if (player.brawlStocks > 0) {
      const hDef = getHeroDef(player.heroId);
      // Respawn at revival hover point with 2.5s invulnerability
      player.x = 480;
      player.y = 150;
      player.z = 0;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.isGrounded = false;
      player.jumpsRemaining = hDef.maxJumps;
      player.hitFlashTimer = 0;
      player.dropThroughTimer = 0;
      player.meleeTimer = 0;
      player.meleeCooldown = 0;
      player.dashTimer = 0;
      player.dashCooldown = 0;
      player.afterimages = [];
      player.comboResetTimer = 0;
      player.scaleX = 1;
      player.scaleY = 1;
      player.hp = player.maxHp;
      player.invulnTimer = 2.5;
      player.lastHitBy = undefined;
      player.lastHitTime = undefined;
    } else {
      // Eliminated
      player.x = -9999;
      player.y = -9999;
      player.vx = 0;
      player.vy = 0;
      state.floatingTexts.push({
        x: 480,
        y: 260,
        vy: -30,
        text: `💀 ${player.name.toUpperCase()} TERELIMINASI!`,
        color: '#f87171',
        scale: 1.5,
        life: 2.5,
        maxLife: 2.5,
      });
    }
  }
}

function executeHeroMelee(
  state: GameState,
  player: PlayerState,
  hDef: ReturnType<typeof getHeroDef>
): void {
  player.meleeComboStep = (player.meleeComboStep % 3) + 1;
  player.meleeTimer = 0.22;
  player.meleeCooldown = 0.35 * hDef.cdMult;
  player.comboResetTimer = 0.75 * hDef.cdMult; // Combo window remains open
  player.meleeSwingId++;
  player.meleeAngle = player.dirX > 0 ? 0 : Math.PI;

  // Spawn visual slash & elemental audio
  const elem = player.slashElement || hDef.defaultElement || 'none';
  const elemLevel = player.slashElementLevel || 1;

  if (elem === 'petir') {
    state.soundQueue.push('slash_petir');
  } else if (elem === 'api') {
    state.soundQueue.push('slash_api');
  } else if (elem === 'badai') {
    state.soundQueue.push('slash_badai');
  } else if (elem === 'suci') {
    state.soundQueue.push('slash_suci');
  } else if (elem === 'es') {
    state.soundQueue.push('slash_es');
  } else if (elem === 'daun') {
    state.soundQueue.push('slash_daun');
  } else if (player.heroId === 'mat_clurit') {
    state.soundQueue.push('slash_clurit');
  } else if (player.heroId === 'bambang') {
    state.soundQueue.push('slash_tinju');
  } else {
    state.soundQueue.push('kibas');
  }

  const slash: SlashEffect = {
    x: player.x + player.dirX * 36,
    y: player.y - 18,
    angle: player.meleeAngle,
    color: hDef.slashColor,
    stripeColor: '#ffffff',
    life: 0.18,
    maxLife: 0.18,
    comboStep: player.meleeComboStep,
    heroId: player.heroId,
    slashStyle: player.slashStyle || hDef.slashStyle,
    element: elem,
    elementLevel: elemLevel,
    ownerId: player.id,
  };
  state.slashes.push(slash);

  // Spawn elemental attack swing particles
  if (elem === 'petir') {
    for (let p = 0; p < 4 * elemLevel; p++) {
      state.particles.push({
        x: player.x + player.dirX * 32 + (Math.random() - 0.5) * 20,
        y: player.y - 18 + (Math.random() - 0.5) * 20,
        z: 0,
        vx: player.dirX * 180 + (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        vz: 0,
        size: 2.5 + Math.random() * 2,
        color: Math.random() < 0.6 ? '#38bdf8' : '#facc15',
        alpha: 1,
        life: 0.14 + Math.random() * 0.1,
        maxLife: 0.24,
        gravity: 0,
      });
    }
  } else if (elem === 'api') {
    for (let p = 0; p < 5 * elemLevel; p++) {
      state.particles.push({
        x: player.x + player.dirX * 30 + (Math.random() - 0.5) * 18,
        y: player.y - 18 + (Math.random() - 0.5) * 18,
        z: 0,
        vx: player.dirX * 120 + (Math.random() - 0.5) * 100,
        vy: -40 - Math.random() * 80,
        vz: 0,
        size: 3 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#f97316' : '#ef4444',
        alpha: 1,
        life: 0.2 + Math.random() * 0.15,
        maxLife: 0.35,
        gravity: -60,
      });
    }
  } else if (elem === 'badai') {
    for (let p = 0; p < 4 * elemLevel; p++) {
      state.particles.push({
        x: player.x + player.dirX * 36 + (Math.random() - 0.5) * 20,
        y: player.y - 18 + (Math.random() - 0.5) * 20,
        z: 0,
        vx: player.dirX * 220 + (Math.random() - 0.5) * 140,
        vy: (Math.random() - 0.5) * 140,
        vz: 0,
        size: 2 + Math.random() * 2.5,
        color: '#e0f2fe',
        alpha: 0.8,
        life: 0.18 + Math.random() * 0.1,
        maxLife: 0.28,
        gravity: 0,
      });
    }
  } else if (elem === 'suci') {
    for (let p = 0; p < 4 * elemLevel; p++) {
      state.particles.push({
        x: player.x + player.dirX * 28 + (Math.random() - 0.5) * 16,
        y: player.y - 18 + (Math.random() - 0.5) * 16,
        z: 0,
        vx: (Math.random() - 0.5) * 60,
        vy: -40 - Math.random() * 60,
        vz: 0,
        size: 2.5 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#fde047' : '#ffffff',
        alpha: 1,
        life: 0.22 + Math.random() * 0.15,
        maxLife: 0.37,
        gravity: -40,
      });
    }
  } else if (elem === 'es') {
    for (let p = 0; p < 5 * elemLevel; p++) {
      state.particles.push({
        x: player.x + player.dirX * 30 + (Math.random() - 0.5) * 20,
        y: player.y - 18 + (Math.random() - 0.5) * 20,
        z: 0,
        vx: player.dirX * 150 + (Math.random() - 0.5) * 130,
        vy: -30 - Math.random() * 60,
        vz: 0,
        size: 3 + Math.random() * 2.5,
        color: Math.random() < 0.6 ? '#67e8f9' : '#e0f2fe',
        alpha: 0.95,
        life: 0.2 + Math.random() * 0.14,
        maxLife: 0.34,
        gravity: 110,
      });
    }
  } else if (elem === 'daun') {
    for (let p = 0; p < 5 * elemLevel; p++) {
      state.particles.push({
        x: player.x + player.dirX * 32 + (Math.random() - 0.5) * 20,
        y: player.y - 18 + (Math.random() - 0.5) * 20,
        z: 0,
        vx: player.dirX * 180 + (Math.random() - 0.5) * 140,
        vy: -50 - Math.random() * 70,
        vz: 0,
        size: 3 + Math.random() * 2,
        color: Math.random() < 0.65 ? '#4ade80' : '#f472b6',
        alpha: 0.95,
        life: 0.24 + Math.random() * 0.14,
        maxLife: 0.38,
        gravity: -25,
      });
    }
  }

  // Hitbox detection
  const reach = 56 + (elem === 'badai' ? 18 * elemLevel : 0);
  const hx = player.x + player.dirX * 34;
  const hy = player.y - 16;

  for (const other of state.players) {
    if (other.id === player.id || (other.brawlStocks ?? 0) <= 0 || other.invulnTimer > 0) {
      continue;
    }

    const dist = Math.hypot(other.x - hx, other.y - hy);
    if (dist < reach + other.radius) {
      // HIT!
      const isFinisher = player.meleeComboStep === 3;
      let baseDmg = (isFinisher ? 28 : 14) * hDef.dmgMult;
      if (elem === 'petir') baseDmg += 4 * elemLevel;
      if (elem === 'api') baseDmg += 6 * elemLevel;
      if (elem === 'es') baseDmg += 4 * elemLevel;
      if (elem === 'daun') baseDmg += 5 * elemLevel;
      if (elem === 'suci') {
        baseDmg += 3 * elemLevel;
        player.hp = Math.min(player.maxHp, player.hp + 2 * elemLevel);
        player.ult = Math.min(player.maxUlt, player.ult + 4 * elemLevel);
      }

      other.hp = Math.max(0, other.hp - baseDmg);
      other.hitFlashTimer = isFinisher ? 0.22 : 0.14;
      if (elem === 'petir') other.hitFlashTimer = Math.max(other.hitFlashTimer, 0.24 * elemLevel);
      if (elem === 'es') other.hitFlashTimer = Math.max(other.hitFlashTimer, 0.26 * elemLevel);
      if (elem === 'daun') other.vy = Math.min(other.vy, -190 * elemLevel);
      other.lastHitBy = player.id;
      other.lastHitTime = state.time;

      player.ult = Math.min(player.maxUlt, player.ult + (isFinisher ? 14 : 7));

      // Elemental hit particles
      if (elem === 'petir') {
        for (let k = 0; k < 5 * elemLevel; k++) {
          state.particles.push({
            x: other.x + (Math.random() - 0.5) * 16,
            y: other.y - 14 + (Math.random() - 0.5) * 16,
            z: 0,
            vx: (Math.random() - 0.5) * 190,
            vy: (Math.random() - 0.5) * 190,
            vz: 0,
            size: 2.5 + Math.random() * 2,
            color: Math.random() < 0.6 ? '#38bdf8' : '#facc15',
            alpha: 1,
            life: 0.16 + Math.random() * 0.1,
            maxLife: 0.26,
            gravity: 0,
          });
        }
      } else if (elem === 'api') {
        for (let k = 0; k < 6 * elemLevel; k++) {
          state.particles.push({
            x: other.x + (Math.random() - 0.5) * 16,
            y: other.y - 14 + (Math.random() - 0.5) * 16,
            z: 0,
            vx: (Math.random() - 0.5) * 140,
            vy: -60 - Math.random() * 90,
            vz: 0,
            size: 3 + Math.random() * 2.5,
            color: Math.random() < 0.5 ? '#f97316' : '#ef4444',
            alpha: 1,
            life: 0.22 + Math.random() * 0.12,
            maxLife: 0.34,
            gravity: -50,
          });
        }
      } else if (elem === 'badai') {
        for (let k = 0; k < 5 * elemLevel; k++) {
          state.particles.push({
            x: other.x + (Math.random() - 0.5) * 16,
            y: other.y - 14 + (Math.random() - 0.5) * 16,
            z: 0,
            vx: player.dirX * 200 + (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            vz: 0,
            size: 2.5 + Math.random() * 2,
            color: '#e0f2fe',
            alpha: 0.85,
            life: 0.18 + Math.random() * 0.1,
            maxLife: 0.28,
            gravity: 0,
          });
        }
      } else if (elem === 'suci') {
        for (let k = 0; k < 5 * elemLevel; k++) {
          state.particles.push({
            x: other.x + (Math.random() - 0.5) * 16,
            y: other.y - 14 + (Math.random() - 0.5) * 16,
            z: 0,
            vx: (Math.random() - 0.5) * 80,
            vy: -40 - Math.random() * 70,
            vz: 0,
            size: 2.5 + Math.random() * 2,
            color: '#facc15',
            alpha: 1,
            life: 0.22 + Math.random() * 0.1,
            maxLife: 0.32,
            gravity: -30,
          });
        }
      } else if (elem === 'es') {
        for (let k = 0; k < 6 * elemLevel; k++) {
          state.particles.push({
            x: other.x + (Math.random() - 0.5) * 16,
            y: other.y - 14 + (Math.random() - 0.5) * 16,
            z: 0,
            vx: (Math.random() - 0.5) * 160,
            vy: -40 - Math.random() * 90,
            vz: 0,
            size: 3 + Math.random() * 2.5,
            color: Math.random() < 0.6 ? '#67e8f9' : '#e0f2fe',
            alpha: 1,
            life: 0.22 + Math.random() * 0.12,
            maxLife: 0.34,
            gravity: 140,
          });
        }
      } else if (elem === 'daun') {
        for (let k = 0; k < 6 * elemLevel; k++) {
          state.particles.push({
            x: other.x + (Math.random() - 0.5) * 16,
            y: other.y - 14 + (Math.random() - 0.5) * 16,
            z: 0,
            vx: (Math.random() - 0.5) * 150,
            vy: -70 - Math.random() * 80,
            vz: 0,
            size: 3 + Math.random() * 2,
            color: Math.random() < 0.65 ? '#4ade80' : '#f472b6',
            alpha: 0.95,
            life: 0.24 + Math.random() * 0.12,
            maxLife: 0.36,
            gravity: -25,
          });
        }
      }

      // Smash Knockback scaling: lower remaining HP = MASSIVE launch!
      const damagePercent = Math.max(1, (other.maxHp - other.hp) / 14);
      const badaiKnockbackMult = elem === 'badai' ? 1 + 0.25 * elemLevel : 1;

      if (isFinisher) {
        // SMASH LAUNCH FINISHER: 45-degree upward launch trajectory!
        other.isGrounded = false;
        const launchPower = (360 + hDef.knockbackMult * 90) * damagePercent * badaiKnockbackMult;
        other.vx = player.dirX * (launchPower * 0.82);
        other.vy = -launchPower * 0.68;
        state.shakeTimer = 0.12;
        state.shakeIntensity = 2.2;
        state.hitstopTimer = 0.05;
      } else {
        // Light stagger jab (keeps grounded opponent grounded for combo connection)
        if (other.isGrounded) {
          const jabPower = (110 + 20 * player.meleeComboStep) * hDef.knockbackMult * Math.min(1.6, damagePercent) * badaiKnockbackMult;
          other.vx = player.dirX * jabPower;
          other.vy = 0;
        } else {
          // Light juggle pop in air
          other.vx = player.dirX * (120 * hDef.knockbackMult * badaiKnockbackMult);
          other.vy = -90;
        }
        state.shakeTimer = 0.04;
        state.shakeIntensity = 0.8;
        state.hitstopTimer = 0.02;
      }

      state.soundQueue.push('hit');

      // Hit particles
      for (let p = 0; p < 8; p++) {
        state.particles.push({
          x: other.x,
          y: other.y - 16,
          z: 0,
          vx: (Math.random() - 0.5) * 220,
          vy: -80 - Math.random() * 160,
          vz: 0,
          size: 3 + Math.random() * 4,
          color: hDef.slashColor,
          alpha: 1,
          life: 0.35,
          maxLife: 0.35,
          gravity: 500,
        });
      }
    }
  }

  // Damage nearby crates
  for (const crate of state.crates) {
    const cd = Math.hypot(crate.x - hx, crate.y - hy);
    if (cd < reach + crate.radius) {
      let crateDmg = 25;
      if (elem === 'api') crateDmg += 8 * elemLevel;
      if (elem === 'petir') crateDmg += 6 * elemLevel;
      crate.hp -= crateDmg;
      crate.hitFlashTimer = 0.15;
      crate.lastHitBy = player.id;
      state.soundQueue.push('crate_hit');
    }
  }
}

function executeHeroProjectile(
  state: GameState,
  player: PlayerState,
  hDef: ReturnType<typeof getHeroDef>
): void {
  player.projCooldown = PROJ_COOLDOWN * hDef.cdMult;
  state.soundQueue.push('pecut');

  const pSpeed = 460;
  const proj: ProjectileState = {
    id: state.nextEntityId++,
    ownerId: player.id,
    kind: 'slash',
    x: player.x + player.dirX * 30,
    y: player.y - 18,
    vx: player.dirX * pSpeed,
    vy: 0,
    angle: player.dirX > 0 ? 0 : Math.PI,
    radius: 14,
    damage: 24 * hDef.dmgMult,
    pierceLeft: hDef.id === 'gus_dimas' ? 3 : 1,
    hitIds: [],
    life: 0.95,
    maxLife: 0.95,
    color: hDef.slashColor,
  };

  state.projectiles.push(proj);
}

function executeHeroUltTick(
  state: GameState,
  player: PlayerState,
  hDef: ReturnType<typeof getHeroDef>
): void {
  const uType = player.ultType ?? hDef.ultType ?? 'gasing';
  const ultRadius = uType === 'naga' ? 210 : uType === 'selendang' ? 175 : uType === 'gempa' ? 185 : 150;
  state.soundQueue.push('ult_tick');

  // Gus Dimas Karomah Healing tick in Brawl (+4% HP per tick)
  if (uType === 'naga') {
    player.hp = Math.min(player.maxHp, player.hp + 4);
  }

  for (const other of state.players) {
    if (other.id === player.id || (other.brawlStocks ?? 0) <= 0 || other.invulnTimer > 0) {
      continue;
    }

    const d = Math.hypot(other.x - player.x, other.y - player.y);
    if (d < ultRadius) {
      const isExecute = uType === 'petir' && other.hp < other.maxHp * 0.5;
      const tickDmg = (isExecute ? 22 : 16) * hDef.dmgMult;
      other.hp = Math.max(0, other.hp - tickDmg);
      other.hitFlashTimer = uType === 'petir' ? 0.42 : uType === 'gempa' ? 0.34 : 0.18;
      other.lastHitBy = player.id;
      other.lastHitTime = state.time;
      other.isGrounded = false;

      const damageFactor = Math.max(1, (other.maxHp - other.hp) / 16);
      const angOut = Math.atan2(other.y - player.y, other.x - player.x);

      if (uType === 'gasing') {
        // Cak Bima: Pull inward, then blast outward on final tick
        if (player.ultActiveTimer <= 0.25) {
          other.vx = Math.cos(angOut) * (420 * damageFactor);
          other.vy = -260 * damageFactor;
        } else {
          const angIn = Math.atan2(player.y - other.y, player.x - other.x);
          other.vx = Math.cos(angIn) * 260;
          other.vy = -140;
        }
      } else if (uType === 'selendang') {
        // Mbak Sri: Continuous upward silk juggle toward top blast zone
        other.vx = Math.cos(angOut) * 180;
        other.vy = -310 * Math.min(1.8, damageFactor);
      } else if (uType === 'gempa') {
        // Bang Bambang: Massive horizontal seismic smash (1.4x knockback)
        other.vx = Math.cos(angOut) * (460 * damageFactor);
        other.vy = -220 * damageFactor;
      } else if (uType === 'mercon') {
        // Pak RT: Explosive skyward mortar blast
        other.vx = Math.cos(angOut) * (300 * damageFactor);
        other.vy = -440 * damageFactor;
      } else if (uType === 'naga') {
        // Gus Dimas: Long-range directional spirit pushback
        const pushDir = player.dirX >= 0 ? 1 : -1;
        other.vx = pushDir * (380 * damageFactor);
        other.vy = -180;
      } else {
        // Mat Clurit (petir): Stun-lock & lightning execute burst
        other.vx = Math.cos(angOut) * (340 * damageFactor);
        other.vy = -240 * damageFactor;
      }
    }
  }
}

function updateBrawlProjectiles(state: GameState, dt: number): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const pr = state.projectiles[i];
    pr.life -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (pr.life <= 0) {
      state.projectiles.splice(i, 1);
      continue;
    }

    // Check hit against other players
    for (const other of state.players) {
      if (
        other.id === pr.ownerId ||
        (other.brawlStocks ?? 0) <= 0 ||
        other.invulnTimer > 0 ||
        pr.hitIds.includes(other.id)
      ) {
        continue;
      }

      const d = Math.hypot(other.x - pr.x, other.y - 18 - pr.y);
      if (d < pr.radius + other.radius) {
        // Projectile hit player!
        pr.hitIds.push(other.id);
        other.hp = Math.max(0, other.hp - pr.damage);
        other.hitFlashTimer = 0.16;
        other.lastHitBy = pr.ownerId;
        other.lastHitTime = state.time;
        other.isGrounded = false;

        const damageFactor = Math.max(1, (other.maxHp - other.hp) / 18);
        const kbDir = pr.vx > 0 ? 1 : -1;
        other.vx = kbDir * (260 * damageFactor);
        other.vy = -170 * damageFactor;

        state.soundQueue.push('hit');

        pr.pierceLeft--;
        if (pr.pierceLeft <= 0) {
          state.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // Check hit against crates
    for (const crate of state.crates) {
      if (pr.life <= 0 || pr.pierceLeft <= 0) break;
      const cd = Math.hypot(crate.x - pr.x, crate.y - pr.y);
      if (cd < pr.radius + crate.radius) {
        crate.hp -= pr.damage;
        crate.hitFlashTimer = 0.15;
        crate.lastHitBy = pr.ownerId;
        state.soundQueue.push('crate_hit');
        pr.pierceLeft--;
        if (pr.pierceLeft <= 0) {
          state.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }
}

function spawnBrawlItem(state: GameState): void {
  const br = state.brawl;
  const platforms = br?.platforms ?? [];

  // 1. Chance to spawn rare floating "Pusaka Sakti / Kendi Emas" (Super Smash Ball)
  const hasKendi = state.crates.some((c) => c.style === 'gold_kendi');
  if (!hasKendi && Math.random() < 0.38) {
    state.crates.push({
      id: state.nextEntityId++,
      x: 480 + (Math.random() - 0.5) * 180,
      y: 150,
      z: 0,
      vz: 0,
      radius: 22,
      hp: 35,
      maxHp: 35,
      hitFlashTimer: 0,
      lastHitSwingId: 0,
      style: 'gold_kendi',
      bobPhase: Math.random() * Math.PI * 2,
    });
    state.floatingTexts.push({
      x: 480,
      y: 95,
      vy: -35,
      text: '✨ PUSAKA KENDI EMAS MUNCUL! REBUT SEKARANG! 🏺',
      color: '#facc15',
      scale: 1.35,
      life: 2.2,
      maxLife: 2.2,
    });
    return;
  }

  const targetPlat = platforms.length > 0 ? platforms[Math.floor(Math.random() * platforms.length)] : null;
  const x = targetPlat
    ? targetPlat.x + 20 + Math.random() * Math.max(10, targetPlat.w - 40)
    : 240 + Math.random() * 480;
  const isCrate = Math.random() < 0.5;

  if (isCrate) {
    state.crates.push({
      id: state.nextEntityId++,
      x,
      y: 120,
      z: 0,
      vz: 0,
      radius: 18,
      hp: 30,
      maxHp: 30,
      hitFlashTimer: 0,
      lastHitSwingId: 0,
      style: 'wood',
    });
  } else {
    state.pickups.push({
      id: state.nextEntityId++,
      kind: Math.random() < 0.6 ? 'es_teh' : 'kopi_giras',
      x,
      y: 120,
      z: 0,
      vx: (Math.random() - 0.5) * 60,
      vy: 0,
      vz: 0,
      radius: 15,
      life: 25,
      bobPhase: Math.random() * Math.PI,
    });
  }
}

function updateBrawlCratesAndPickups(state: GameState, dt: number): void {
  const br = state.brawl;
  const platforms = br?.platforms ?? [];

  // Update Crates & Kendi Emas
  for (let i = state.crates.length - 1; i >= 0; i--) {
    const crate = state.crates[i];

    if (crate.style === 'gold_kendi') {
      // Floating Pusaka Sakti: undulating hover trajectory across the arena
      crate.bobPhase = (crate.bobPhase ?? 0) + dt;
      crate.x = 480 + Math.sin(crate.bobPhase * 0.9) * 230;
      crate.y = 155 + Math.sin(crate.bobPhase * 2.2) * 45;

      // Golden ambient sparkles
      if (Math.random() < 0.35) {
        state.particles.push({
          x: crate.x + (Math.random() - 0.5) * 22,
          y: crate.y + (Math.random() - 0.5) * 22,
          z: 0,
          vx: (Math.random() - 0.5) * 35,
          vy: -25 - Math.random() * 25,
          vz: 0,
          size: 2.5 + Math.random() * 2,
          color: Math.random() < 0.6 ? '#facc15' : '#fef08a',
          alpha: 0.9,
          life: 0.32,
          maxLife: 0.32,
          gravity: -15,
        });
      }

      // Check break
      if (crate.hp <= 0) {
        state.soundQueue.push('smash_ball');
        const killer = state.players.find((p) => p.id === crate.lastHitBy) || state.players[0];

        if (killer) {
          killer.ult = killer.maxUlt; // Instant 100% Super Ultimate!
          killer.invulnTimer = Math.max(killer.invulnTimer, 0.7);

          state.shakeTimer = 0.22;
          state.shakeIntensity = 2.5;

          state.floatingTexts.push({
            x: killer.x,
            y: killer.y - 65,
            vy: -55,
            text: `🌟 ${killer.name.toUpperCase()} REBUT KENDI EMAS! JURUS SAKTI SIAP! ⚡`,
            color: '#facc15',
            scale: 1.4,
            life: 2.2,
            maxLife: 2.2,
          });

          // Celestial golden nova explosion
          for (let p = 0; p < 28; p++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 70 + Math.random() * 220;
            state.particles.push({
              x: crate.x,
              y: crate.y,
              z: 0,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              vz: 0,
              size: 3.5 + Math.random() * 3,
              color: p % 2 === 0 ? '#facc15' : '#38bdf8',
              alpha: 1,
              life: 0.55,
              maxLife: 0.55,
              gravity: 60,
            });
          }
        }

        state.crates.splice(i, 1);
        continue;
      }
    } else {
      // Normal Crates: gravity towards platforms
      let groundY: number | null = null;
      for (const plat of platforms) {
        if (crate.x >= plat.x && crate.x <= plat.x + plat.w && plat.y >= crate.y - 4) {
          if (groundY === null || plat.y < groundY) groundY = plat.y;
        }
      }
      if (groundY !== null) {
        if (crate.y < groundY) {
          crate.y = Math.min(groundY, crate.y + 180 * dt);
        }
      } else {
        // Over void: fall down into abyss
        crate.y += 180 * dt;
        if (crate.y > 600) {
          state.crates.splice(i, 1);
          continue;
        }
      }

      if (crate.hp <= 0) {
        state.soundQueue.push('crate_break');
        state.pickups.push({
          id: state.nextEntityId++,
          kind: Math.random() < 0.6 ? 'es_teh' : 'kopi_giras',
          x: crate.x,
          y: crate.y,
          z: 0,
          vx: (Math.random() - 0.5) * 80,
          vy: -100,
          vz: 0,
          radius: 15,
          life: 25,
          bobPhase: 0,
        });
        state.crates.splice(i, 1);
      }
    }
  }

  // Update Pickups
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pic = state.pickups[i];
    pic.life -= dt;
    if (pic.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    let groundY: number | null = null;
    for (const plat of platforms) {
      if (pic.x >= plat.x && pic.x <= plat.x + plat.w && plat.y >= pic.y - 4) {
        if (groundY === null || plat.y < groundY) groundY = plat.y;
      }
    }
    if (groundY !== null) {
      if (pic.y < groundY) {
        pic.y = Math.min(groundY, pic.y + 160 * dt);
      }
    } else {
      // Over void: fall down into abyss
      pic.y += 160 * dt;
      if (pic.y > 600) {
        state.pickups.splice(i, 1);
        continue;
      }
    }

    // Check player collection
    for (const p of state.players) {
      if ((p.brawlStocks ?? 0) <= 0) continue;
      const dist = Math.hypot(p.x - pic.x, p.y - 18 - pic.y);
      if (dist < p.radius + pic.radius) {
        if (pic.kind === 'es_teh') {
          p.hp = Math.min(p.maxHp, p.hp + 35);
          state.soundQueue.push('pickup_heal');
        } else {
          p.ult = Math.min(p.maxUlt, p.ult + 45);
          state.soundQueue.push('pickup_kopi');
        }
        state.pickups.splice(i, 1);
        break;
      }
    }
  }
}

function determineBrawlWinner(state: GameState): void {
  const br = state.brawl;
  if (!br) return;

  // Rank players by stocks remaining first, then KOs
  const sorted = [...state.players].sort((a, b) => {
    const sA = a.brawlStocks ?? 0;
    const sB = b.brawlStocks ?? 0;
    if (sB !== sA) return sB - sA;
    return (b.brawlKos ?? 0) - (a.brawlKos ?? 0);
  });

  const winner = sorted[0];
  if (winner) {
    br.winnerId = winner.id;
    br.winnerName = winner.name;
    state.status = 'victory';
    state.soundQueue.push('ult_start');
    state.slashes.length = 0;
  }
}
