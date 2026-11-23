import {
  FIXED_DT,
  PLAYER_PALETTES,
  PLAYER_RADIUS,
  PROJ_COOLDOWN,
} from '../core/constants';
import { getHeroDef } from '../core/heroes';
import type {
  BrawlPlatform,
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
const BRAWL_JUMP_IMPULSE = -470; // ground jump launch velocity
const BRAWL_DOUBLE_JUMP_IMPULSE = -430; // air jump launch velocity

export function createBrawlState(
  roster: BrawlRosterMember[],
  initialStocks = 3
): GameState {
  const platforms: BrawlPlatform[] = [
    // Main solid center ground (Battlefield style)
    { x: 170, y: 390, w: 620, h: 32, dropThrough: false },
    // Left soft floating platform
    { x: 210, y: 275, w: 160, h: 14, dropThrough: true },
    // Right soft floating platform
    { x: 590, y: 275, w: 160, h: 14, dropThrough: true },
    // Top center soft platform
    { x: 390, y: 175, w: 180, h: 14, dropThrough: true },
  ];

  const spawnPoints = [
    { x: 280, y: 390 },
    { x: 680, y: 390 },
    { x: 290, y: 275 },
    { x: 670, y: 275 },
    { x: 480, y: 175 },
    { x: 480, y: 390 },
  ];

  const players: PlayerState[] = roster.map((m, idx) => {
    const pt = spawnPoints[idx % spawnPoints.length];
    const pal = PLAYER_PALETTES[m.paletteIndex % PLAYER_PALETTES.length];
    const hDef = getHeroDef(m.heroId);

    return {
      id: m.id,
      name: m.name || pal.name.split(' (')[0],
      paletteIndex: m.paletteIndex % PLAYER_PALETTES.length,
      heroId: m.heroId,
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
    platforms,
    itemSpawnTimer: 8,
    ringOutBound: {
      minX: -60,
      maxX: 1020,
      minY: -90,
      maxY: 560,
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
    soundQueue: ['jump'],
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
 * - Platform vertical tracking (jumping up or dropping through)
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
  if (dy < -50 && (bot.botJumpTimer ?? 0) <= 0 && (bot.isGrounded || bot.jumpsRemaining > 0)) {
    if (Math.random() < 0.12) {
      inp.jumpPressed = true;
      bot.botJumpTimer = 0.42;
    }
  }

  // Drop down from soft platform if opponent is well below
  if (dy > 65 && bot.isGrounded && Math.random() < 0.1) {
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

  state.time += dt;
  if (state.status !== 'playing') return;

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
    if (player.projCooldown > 0) player.projCooldown = Math.max(0, player.projCooldown - dt);
    if ((player.dropThroughTimer ?? 0) > 0) player.dropThroughTimer = Math.max(0, (player.dropThroughTimer ?? 0) - dt);

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

    if (mx > 0.1) player.dirX = 1;
    else if (mx < -0.1) player.dirX = -1;

    const isHoldingDown = inp.down || (inp.moveY !== undefined && inp.moveY > 0.45);

    // Dash Action
    if (inp.dashPressed && player.dashCooldown <= 0) {
      player.dashTimer = 0.22;
      player.dashCooldown = 0.75 * hDef.cdMult;
      player.dashDirX = player.dirX;
      player.vx = player.dirX * hDef.dashSpeed;
      player.vy = 0; // Pause vertical fall during dash
      player.invulnTimer = Math.max(player.invulnTimer, 0.12);
      state.soundQueue.push('dash');
    }

    // Jump / Drop Through Action
    if (inp.jumpPressed) {
      if (player.isGrounded && isHoldingDown) {
        // Drop through current soft platform!
        player.dropThroughTimer = 0.26;
        player.isGrounded = false;
        player.y += 5;
        player.vy = 120;
      } else if (player.isGrounded) {
        // Ground Jump
        player.isGrounded = false;
        player.vy = BRAWL_JUMP_IMPULSE;
        player.jumpsRemaining = hDef.maxJumps - 1;
        state.soundQueue.push('jump');
      } else if (player.jumpsRemaining > 0) {
        // Air Double / Triple Jump
        player.vy = BRAWL_DOUBLE_JUMP_IMPULSE;
        player.jumpsRemaining--;
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
      // Horizontal acceleration / friction
      const targetVx = mx * hDef.moveSpeed;
      if (player.isGrounded) {
        player.vx += (targetVx - player.vx) * Math.min(1, dt * 18);
      } else {
        // Air drift
        player.vx += (targetVx - player.vx) * Math.min(1, dt * 8);
      }

      // Air resistance on knockback momentum
      player.vx *= Math.pow(0.92, dt * 60);

      // Gravity
      if (!player.isGrounded) {
        const fallLimit = isHoldingDown && player.vy > 0 ? BRAWL_FAST_FALL : BRAWL_MAX_FALL;
        const grav = isHoldingDown && player.vy > 0 ? BRAWL_GRAVITY * 1.5 : BRAWL_GRAVITY;
        player.vy = Math.min(fallLimit, player.vy + grav * dt);
      }
    }

    // Integrate Position
    const prevY = player.y;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.z = 0; // Brawl is 2D side-scrolling, z kept at 0

    // Platform Collision Resolution
    handle2DPlatforms(player, prevY, br.platforms, isHoldingDown);

    // Melee attack trigger
    if (inp.meleePressed && player.meleeCooldown <= 0 && player.dashTimer <= 0) {
      executeHeroMelee(state, player, hDef);
    }

    // Projectile skill trigger
    if (inp.projPressed && player.projCooldown <= 0 && player.dashTimer <= 0) {
      executeHeroProjectile(state, player, hDef);
    }

    // Ultimate trigger
    if (inp.ultPressed && player.ult >= player.maxUlt && player.ultActiveTimer <= 0) {
      player.ultActiveTimer = 3.2;
      player.ultTickTimer = 0.1;
      player.invulnTimer = 3.2;
      state.soundQueue.push('ult_start');
      state.shakeTimer = 0.45;
      state.shakeIntensity = 9;
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

  // Update projectiles & crates
  updateBrawlProjectiles(state, dt);
  updateBrawlCratesAndPickups(state, dt);
}

/**
 * 2D Platform Collision Engine
 * Supports:
 * - Solid ground with top landing, ceiling bonk, and side-push
 * - Soft platforms with drop-through and smooth top landing
 * - Edge detection (walking off edges enters airborne state)
 */
function handle2DPlatforms(
  player: PlayerState,
  prevY: number,
  platforms: BrawlPlatform[],
  isHoldingDown: boolean
): void {
  let wasGrounded = player.isGrounded;
  player.isGrounded = false;

  for (const plat of platforms) {
    const inX =
      player.x + player.radius * 0.7 > plat.x &&
      player.x - player.radius * 0.7 < plat.x + plat.w;

    if (!plat.dropThrough) {
      // Solid Main Platform (plat.y: 390, plat.w: 620, plat.h: 32)
      // 1. Top Landing
      if (inX && prevY <= plat.y + 6 && player.y >= plat.y - 2 && player.vy >= 0) {
        player.y = plat.y;
        player.vy = 0;
        player.isGrounded = true;
        player.jumpsRemaining = getHeroDef(player.heroId).maxJumps;
        continue;
      }

      // 2. Ceiling bonk
      if (inX && player.y - 42 < plat.y + plat.h && prevY - 42 >= plat.y + plat.h - 10 && player.vy < 0) {
        player.y = plat.y + plat.h + 42;
        player.vy = 0;
      }

      // 3. Side walls
      if (player.y > plat.y + 4 && player.y - 32 < plat.y + plat.h) {
        // Left ledge push
        if (player.x > plat.x - player.radius && player.x < plat.x + 12) {
          player.x = plat.x - player.radius;
          if (player.vx > 0) player.vx = 0;
        }
        // Right ledge push
        if (player.x < plat.x + plat.w + player.radius && player.x > plat.x + plat.w - 12) {
          player.x = plat.x + plat.w + player.radius;
          if (player.vx < 0) player.vx = 0;
        }
      }
    } else {
      // Soft Floating Energy Platform
      if ((player.dropThroughTimer ?? 0) > 0) {
        continue; // Dropping through
      }

      // Land on top edge if falling downward
      if (inX && prevY <= plat.y + 5 && player.y >= plat.y - 3 && player.vy >= 0) {
        if (!isHoldingDown) {
          player.y = plat.y;
          player.vy = 0;
          player.isGrounded = true;
          player.jumpsRemaining = getHeroDef(player.heroId).maxJumps;
        }
      }
    }
  }

  // If walking along platform, remain grounded
  if (wasGrounded && !player.isGrounded && Math.abs(player.vy) < 1) {
    for (const plat of platforms) {
      const inX =
        player.x + player.radius * 0.7 > plat.x &&
        player.x - player.radius * 0.7 < plat.x + plat.w;
      if (inX && Math.abs(player.y - plat.y) < 4) {
        player.y = plat.y;
        player.vy = 0;
        player.isGrounded = true;
        break;
      }
    }
  }
}

function checkBrawlRingOut(
  state: GameState,
  player: PlayerState,
  br: BrawlState
): void {
  const b = br.ringOutBound;
  const isOut =
    player.x < b.minX || player.x > b.maxX || player.y < b.minY || player.y > b.maxY;

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
    state.shakeTimer = 0.5;
    state.shakeIntensity = 12;

    // Spawn massive blast particles
    const blastX = Math.max(30, Math.min(930, player.x));
    const blastY = Math.max(30, Math.min(510, player.y));
    for (let i = 0; i < 32; i++) {
      const angle = (Math.PI * 2 * i) / 32;
      const spd = 140 + Math.random() * 280;
      state.particles.push({
        x: blastX,
        y: blastY,
        z: 0,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: 0,
        size: 5 + Math.random() * 6,
        color: i % 2 === 0 ? '#ef4444' : '#fde047',
        alpha: 1,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        gravity: 0,
      });
    }

    if (player.brawlStocks > 0) {
      // Respawn at revival hover point with 2.5s invulnerability
      player.x = 480;
      player.y = 150;
      player.z = 0;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.isGrounded = false;
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
  player.meleeSwingId++;
  player.meleeAngle = player.dirX > 0 ? 0 : Math.PI;

  state.soundQueue.push('kibas');

  // Spawn visual slash
  const slash: SlashEffect = {
    x: player.x + player.dirX * 36,
    y: player.y - 18,
    angle: player.meleeAngle,
    color: hDef.slashColor,
    stripeColor: '#ffffff',
    life: 0.18,
    maxLife: 0.18,
    comboStep: player.meleeComboStep,
  };
  state.slashes.push(slash);

  // Hitbox detection
  const reach = 56;
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
      const baseDmg = (isFinisher ? 28 : 14) * hDef.dmgMult;
      other.hp = Math.max(0, other.hp - baseDmg);
      other.hitFlashTimer = 0.18;
      other.lastHitBy = player.id;
      other.lastHitTime = state.time;

      player.ult = Math.min(player.maxUlt, player.ult + (isFinisher ? 14 : 7));

      // Smash Knockback scaling: lower remaining HP = MASSIVE launch!
      const damagePercent = Math.max(1, (other.maxHp - other.hp) / 14);

      other.isGrounded = false;
      if (isFinisher) {
        // SMASH LAUNCH FINISHER: 45-degree upward launch trajectory!
        const launchPower = (360 + hDef.knockbackMult * 90) * damagePercent;
        other.vx = player.dirX * (launchPower * 0.82);
        other.vy = -launchPower * 0.68;
        state.shakeTimer = 0.22;
        state.shakeIntensity = 7;
        state.hitstopTimer = 0.07;
      } else {
        // Light stagger jab
        const jabPower = 170 * hDef.knockbackMult * damagePercent;
        other.vx = player.dirX * jabPower;
        other.vy = -140;
        state.shakeTimer = 0.1;
        state.shakeIntensity = 3;
        state.hitstopTimer = 0.04;
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
      crate.hp -= 25;
      crate.hitFlashTimer = 0.15;
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
  const ultRadius = 150;
  state.soundQueue.push('ult_tick');

  for (const other of state.players) {
    if (other.id === player.id || (other.brawlStocks ?? 0) <= 0 || other.invulnTimer > 0) {
      continue;
    }

    const d = Math.hypot(other.x - player.x, other.y - player.y);
    if (d < ultRadius) {
      const tickDmg = 16 * hDef.dmgMult;
      other.hp = Math.max(0, other.hp - tickDmg);
      other.hitFlashTimer = 0.14;
      other.lastHitBy = player.id;
      other.lastHitTime = state.time;
      other.isGrounded = false;

      const damageFactor = Math.max(1, (other.maxHp - other.hp) / 16);

      // Vortex pull or blast launch depending on hero
      if (hDef.id === 'bima' || hDef.id === 'mbak_sri') {
        // Whirlwind vortex: pull inward and spin upward
        const ang = Math.atan2(player.y - other.y, player.x - other.x);
        other.vx = Math.cos(ang) * 260;
        other.vy = -180;
      } else {
        // Massive radial explosion launch
        const ang = Math.atan2(other.y - player.y, other.x - player.x);
        other.vx = Math.cos(ang) * (360 * damageFactor);
        other.vy = -Math.abs(Math.sin(ang)) * (340 * damageFactor) - 100;
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
      if (other.id === pr.ownerId || (other.brawlStocks ?? 0) <= 0 || other.invulnTimer > 0) {
        continue;
      }

      const d = Math.hypot(other.x - pr.x, other.y - pr.y);
      if (d < pr.radius + other.radius) {
        // Projectile hit player!
        other.hp = Math.max(0, other.hp - pr.damage);
        other.hitFlashTimer = 0.15;
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
  }
}

function spawnBrawlItem(state: GameState): void {
  const x = 240 + Math.random() * 480;
  const isCrate = Math.random() < 0.5;

  if (isCrate) {
    state.crates.push({
      id: state.nextEntityId++,
      x,
      y: 220,
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
      y: 220,
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
  // Update Crates
  for (let i = state.crates.length - 1; i >= 0; i--) {
    const crate = state.crates[i];
    // Drop down until landing on a platform
    if (crate.y < 380) {
      crate.y += 180 * dt;
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

  // Update Pickups
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pic = state.pickups[i];
    pic.life -= dt;
    if (pic.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    if (pic.y < 385) {
      pic.y += 160 * dt;
    }

    // Check player collection
    for (const p of state.players) {
      if ((p.brawlStocks ?? 0) <= 0) continue;
      const dist = Math.hypot(p.x - pic.x, p.y - pic.y);
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
  }
}
