import {
  FIXED_DT,
  PLAYER_PALETTES,
  PLAYER_RADIUS,
  PROJ_COOLDOWN,
} from '../core/constants';
import { getHeroDef } from '../core/heroes';
import { stepTopDownPhysics } from '../core/physics';
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

export function createBrawlState(
  roster: BrawlRosterMember[],
  initialStocks = 3
): GameState {
  const platforms: BrawlPlatform[] = [
    // Main solid center ground
    { x: 170, y: 390, w: 620, h: 32 },
    // Left soft floating platform
    { x: 210, y: 280, w: 160, h: 14, dropThrough: true },
    // Right soft floating platform
    { x: 590, y: 280, w: 160, h: 14, dropThrough: true },
    // Top center platform
    { x: 390, y: 190, w: 180, h: 14, dropThrough: true },
  ];

  const spawnPoints = [
    { x: 260, y: 370 },
    { x: 700, y: 370 },
    { x: 290, y: 260 },
    { x: 670, y: 260 },
    { x: 480, y: 170 },
    { x: 480, y: 370 },
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

      hp: hDef.maxHp,
      maxHp: hDef.maxHp,
      ult: 0,
      maxUlt: 100,
      ultType: hDef.ultType,
      coins: 0,
      reviveTickets: 0,
      knockedDown: false,
      invulnTimer: 2.0, // Initial spawn protection
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
      minX: -50,
      maxX: 1010,
      minY: -100,
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
    activeMinX: 0,
    activeMaxX: 960,
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
 */
function computeBotInput(bot: PlayerState, state: GameState): PlayerInput {
  // Find closest living enemy player
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

  if (!closest) return inp;

  const dx = closest.x - bot.x;
  const dy = closest.y - bot.y;
  const absDx = Math.abs(dx);

  // Horizontal tracking
  if (dx > 30) inp.right = true;
  else if (dx < -30) inp.left = true;

  // Vertical tracking & platform jumping
  if (dy < -45 && bot.jumpsRemaining > 0 && Math.random() < 0.25) {
    inp.jumpPressed = true;
  }

  // Drop down from soft platform if target is well below
  if (dy > 60 && Math.random() < 0.15) {
    inp.down = true;
    inp.jumpPressed = true;
  }

  // Combat decision
  if (bot.ult >= bot.maxUlt && minDist < 180) {
    inp.ultPressed = true;
  } else if (minDist < 68) {
    inp.meleePressed = true;
  } else if (minDist < 320 && bot.projCooldown <= 0 && Math.random() < 0.3) {
    inp.projPressed = true;
  } else if (absDx > 200 && bot.dashCooldown <= 0 && Math.random() < 0.1) {
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
    // Time's up! Find winner by highest lives or KOs
    determineBrawlWinner(state);
    return;
  }

  // Check living fighters count
  const activeFighters = state.players.filter((p) => (p.brawlStocks ?? 0) > 0);
  if (state.players.length > 1 && activeFighters.length <= 1) {
    determineBrawlWinner(state);
    return;
  }

  // Periodically spawn Smash Item Crates
  br.itemSpawnTimer -= dt;
  if (br.itemSpawnTimer <= 0) {
    br.itemSpawnTimer = 14 + Math.random() * 8;
    spawnBrawlItem(state);
  }

  // Step each player
  for (const player of state.players) {
    if ((player.brawlStocks ?? 0) <= 0) continue; // Eliminated

    const hDef = getHeroDef(player.heroId);
    let inp = inputs[player.id];
    if (player.isBot) {
      inp = computeBotInput(player, state);
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

    // Active Ultimate timer
    if (player.ultActiveTimer > 0) {
      player.ultActiveTimer -= dt;
      player.ultTickTimer -= dt;
      if (player.ultTickTimer <= 0) {
        player.ultTickTimer = 0.2;
        executeHeroUltTick(state, player, hDef);
      }
      if (player.ultActiveTimer <= 0) {
        player.ult = 0;
      }
    }

    // Dash
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashDirX * hDef.dashSpeed;
      player.vy = player.dashDirY * hDef.dashSpeed * 0.4;
      player.invulnTimer = Math.max(player.invulnTimer, 0.1);
      if (state.time % 0.05 < dt) {
        player.afterimages.push({
          x: player.x,
          y: player.y,
          z: player.z,
          alpha: 0.6,
          color: hDef.accentColor,
        });
      }
    } else {
      // Movement Input (Analog or D-Pad)
      let mx = 0;
      let my = 0;
      if (inp.moveX !== undefined && inp.moveY !== undefined && (Math.abs(inp.moveX) > 0.05 || Math.abs(inp.moveY) > 0.05)) {
        mx = inp.moveX;
        my = inp.moveY;
      } else {
        if (inp.left) mx -= 1;
        if (inp.right) mx += 1;
        if (inp.up) my -= 1;
        if (inp.down) my += 1;
        const len = Math.hypot(mx, my);
        if (len > 0) {
          mx /= len;
          my /= len;
        }
      }

      if (mx !== 0) {
        player.dirX = mx > 0 ? 1 : -1;
      }

      const targetVx = mx * hDef.moveSpeed;
      player.vx += (targetVx - player.vx) * Math.min(1, dt * 14);

      // Vertical movement on 2.5D plane
      const targetVy = my * (hDef.moveSpeed * 0.65);
      player.vy += (targetVy - player.vy) * Math.min(1, dt * 12);

      // Dash trigger
      if (inp.dashPressed && player.dashCooldown <= 0) {
        player.dashTimer = 0.22;
        player.dashCooldown = 0.75 * hDef.cdMult;
        player.dashDirX = mx !== 0 ? mx : player.dirX;
        player.dashDirY = my;
        state.soundQueue.push('dash');
      }

      // Jump
      if (inp.jumpPressed && player.jumpsRemaining > 0) {
        player.jumpsRemaining--;
        player.vz = player.jumpsRemaining === hDef.maxJumps - 1 ? 380 : 340;
        state.soundQueue.push(player.jumpsRemaining === hDef.maxJumps - 1 ? 'jump' : 'double_jump');
      }
    }

    // Step physics & jump gravity
    stepTopDownPhysics(player, dt, [], -200, 1200);

    // Platform landing & collision logic
    handleBrawlPlatforms(player, br.platforms, inp);

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
      state.shakeTimer = 0.4;
      state.shakeIntensity = 8;
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 65,
        vy: -50,
        text: `⚡ JURUS: ${hDef.ultName.toUpperCase()}!`,
        color: hDef.accentColor,
        scale: 1.4,
        life: 1.6,
        maxLife: 1.6,
      });
    }

    // Check Ring Out / Blast Zones (Super Smash Bros style!)
    checkBrawlRingOut(state, player, br);
  }

  // Update projectiles & hazard zones
  updateBrawlProjectiles(state, dt);
  updateBrawlCratesAndPickups(state, dt);
}

function handleBrawlPlatforms(
  player: PlayerState,
  platforms: BrawlPlatform[],
  inp: PlayerInput
): void {
  const feetY = player.y;

  for (const plat of platforms) {
    if (player.x + player.radius > plat.x && player.x - player.radius < plat.x + plat.w) {
      // Base solid platform
      if (!plat.dropThrough) {
        if (feetY >= plat.y && feetY <= plat.y + plat.h) {
          player.y = Math.min(player.y, plat.y + plat.h);
        }
      } else {
        // Drop-through platform: land on it if falling onto top edge and not holding down
        if (inp.down && inp.jumpPressed) {
          // Drop through!
          continue;
        }
        if (player.vy >= 0 && Math.abs(feetY - plat.y) < 14) {
          player.y = plat.y;
          player.vy = 0;
          player.jumpsRemaining = getHeroDef(player.heroId).maxJumps;
        }
      }
    }
  }

  // Natural arena boundaries (soft walls before ring-out)
  if (player.z <= 0) {
    player.jumpsRemaining = getHeroDef(player.heroId).maxJumps;
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
    // Blast Zone hit!
    player.brawlStocks = Math.max(0, (player.brawlStocks ?? 1) - 1);

    // Credit attacker
    if (player.lastHitBy && player.lastHitTime && state.time - player.lastHitTime < 7) {
      const killer = state.players.find((p) => p.id === player.lastHitBy);
      if (killer && killer.id !== player.id) {
        killer.brawlKos = (killer.brawlKos ?? 0) + 1;
        killer.ult = Math.min(killer.maxUlt, killer.ult + 35);
        state.floatingTexts.push({
          x: Math.max(100, Math.min(860, player.x)),
          y: Math.max(80, Math.min(460, player.y)),
          vy: -60,
          text: `💥 ${killer.name.toUpperCase()} KO'D ${player.name.toUpperCase()}!`,
          color: '#facc15',
          scale: 1.35,
          life: 2.0,
          maxLife: 2.0,
        });
      }
    }

    state.soundQueue.push('ko');
    state.shakeTimer = 0.5;
    state.shakeIntensity = 12;

    // Spawn massive blast particles
    const blastX = Math.max(40, Math.min(920, player.x));
    const blastY = Math.max(40, Math.min(500, player.y));
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28;
      const spd = 120 + Math.random() * 260;
      state.particles.push({
        x: blastX,
        y: blastY,
        z: 10,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: (Math.random() - 0.5) * 100,
        size: 5 + Math.random() * 6,
        color: i % 2 === 0 ? '#ef4444' : '#fde047',
        alpha: 1,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        gravity: 0,
      });
    }

    if (player.brawlStocks > 0) {
      // Respawn with invulnerability
      player.x = 480;
      player.y = 190;
      player.z = 0;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.hp = player.maxHp;
      player.invulnTimer = 2.5;
      player.lastHitBy = undefined;
      player.lastHitTime = undefined;
    } else {
      // Eliminated
      player.x = -9999;
      player.y = -9999;
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
    y: player.y - player.z - 12,
    angle: player.meleeAngle,
    color: hDef.slashColor,
    stripeColor: '#ffffff',
    life: 0.18,
    maxLife: 0.18,
    comboStep: player.meleeComboStep,
  };
  state.slashes.push(slash);

  // Hitbox detection on other players
  const reach = 54;
  const hx = player.x + player.dirX * 34;
  const hy = player.y;

  for (const other of state.players) {
    if (other.id === player.id || (other.brawlStocks ?? 0) <= 0 || other.invulnTimer > 0) {
      continue;
    }

    const dist = Math.hypot(other.x - hx, other.y - hy);
    if (dist < reach + other.radius) {
      // HIT!
      const comboBonus = player.meleeComboStep === 3 ? 1.5 : 1.0;
      const baseDmg = 18 * comboBonus * hDef.dmgMult;
      other.hp = Math.max(0, other.hp - baseDmg);
      other.hitFlashTimer = 0.16;
      other.lastHitBy = player.id;
      other.lastHitTime = state.time;

      player.ult = Math.min(player.maxUlt, player.ult + 8);

      // Smash Knockback scaling: lower HP = MASSIVE launch!
      const damagePercent = Math.max(1, (other.maxHp - other.hp) / 16);
      const knockback = (280 + player.meleeComboStep * 60) * hDef.knockbackMult * damagePercent;
      other.vx = player.dirX * knockback;
      other.vy = (other.y - player.y) * 2;
      other.vz = Math.max(other.vz, knockback * 0.55);

      state.soundQueue.push('hit');
      state.hitstopTimer = 0.05;
      state.shakeTimer = 0.15;
      state.shakeIntensity = 4 * comboBonus;

      // Spawn hit particles
      for (let p = 0; p < 8; p++) {
        state.particles.push({
          x: other.x,
          y: other.y,
          z: other.z + 15,
          vx: (Math.random() - 0.5) * 180,
          vy: (Math.random() - 0.5) * 180,
          vz: Math.random() * 200,
          size: 3 + Math.random() * 4,
          color: hDef.slashColor,
          alpha: 1,
          life: 0.35,
          maxLife: 0.35,
          gravity: 200,
        });
      }
    }
  }

  // Also damage nearby crates
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

  const pSpeed = 440;
  const proj: ProjectileState = {
    id: state.nextEntityId++,
    ownerId: player.id,
    kind: 'slash',
    x: player.x + player.dirX * 30,
    y: player.y - player.z - 16,
    vx: player.dirX * pSpeed,
    vy: player.dirY * 40,
    angle: player.dirX > 0 ? 0 : Math.PI,
    radius: 14,
    damage: 26 * hDef.dmgMult,
    pierceLeft: hDef.id === 'gus_dimas' ? 3 : 1,
    hitIds: [],
    life: 0.85,
    maxLife: 0.85,
    color: hDef.slashColor,
  };

  state.projectiles.push(proj);
}

function executeHeroUltTick(
  state: GameState,
  player: PlayerState,
  hDef: ReturnType<typeof getHeroDef>
): void {
  const ultRadius = 140;
  state.soundQueue.push('ult_tick');

  for (const other of state.players) {
    if (other.id === player.id || (other.brawlStocks ?? 0) <= 0 || other.invulnTimer > 0) {
      continue;
    }

    const d = Math.hypot(other.x - player.x, other.y - player.y);
    if (d < ultRadius) {
      const tickDmg = 15 * hDef.dmgMult;
      other.hp = Math.max(0, other.hp - tickDmg);
      other.hitFlashTimer = 0.14;
      other.lastHitBy = player.id;
      other.lastHitTime = state.time;

      // Vortex pull or push depending on hero
      if (hDef.id === 'bima' || hDef.id === 'mbak_sri') {
        // Pull inwards
        const ang = Math.atan2(player.y - other.y, player.x - other.x);
        other.vx = Math.cos(ang) * 220;
        other.vy = Math.sin(ang) * 220;
        other.vz = Math.max(other.vz, 160);
      } else {
        // Blast outwards
        const ang = Math.atan2(other.y - player.y, other.x - player.x);
        other.vx = Math.cos(ang) * 360;
        other.vy = Math.sin(ang) * 360;
        other.vz = Math.max(other.vz, 260);
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
        other.hitFlashTimer = 0.14;
        other.lastHitBy = pr.ownerId;
        other.lastHitTime = state.time;

        const damageFactor = Math.max(1, (other.maxHp - other.hp) / 22);
        const kbDir = pr.vx > 0 ? 1 : -1;
        other.vx = kbDir * (240 * damageFactor);
        other.vz = Math.max(other.vz, 180 * damageFactor);

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
      y: 200,
      z: 140,
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
      z: 100,
      vx: (Math.random() - 0.5) * 60,
      vy: 0,
      vz: 40,
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
    if (crate.z > 0) {
      crate.vz -= 650 * dt;
      crate.z += crate.vz * dt;
      if (crate.z <= 0) {
        crate.z = 0;
        crate.vz = 0;
      }
    }
    if (crate.hp <= 0) {
      // Break into pickup
      state.soundQueue.push('crate_break');
      state.pickups.push({
        id: state.nextEntityId++,
        kind: Math.random() < 0.6 ? 'es_teh' : 'kopi_giras',
        x: crate.x,
        y: crate.y,
        z: 10,
        vx: (Math.random() - 0.5) * 80,
        vy: 0,
        vz: 120,
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
    if (pic.z > 0) {
      pic.vz -= 550 * dt;
      pic.z += pic.vz * dt;
      if (pic.z <= 0) {
        pic.z = 0;
        pic.vz = 0;
      }
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
