import { createBrawlState, stepBrawl } from '../src/modes/brawl';
import type { GameState, PlayerInput } from '../src/core/types';

function createBlankInput(): PlayerInput {
  return {
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

let passed = 0;
let failed = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

console.log('=== TEST 1: Slash Effects & Melee Timer Lifecycle ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
    { id: 'p2', name: 'Player 2', paletteIndex: 1, heroId: 'mat_clurit' as const, isBot: false },
  ];
  const state = createBrawlState(roster);

  // Position player 1 & 2 close together on solid platform
  state.players[0].x = 400;
  state.players[0].y = 390;
  state.players[1].x = 430;
  state.players[1].y = 390;
  state.players[1].invulnTimer = 0;

  // Melee attack
  const inp1 = createBlankInput();
  inp1.meleePressed = true;
  stepBrawl(state, { p1: inp1, p2: createBlankInput() }, 0.0167);

  assert(state.slashes.length === 1, 'Melee attack successfully spawned 1 slash');
  const initialLife = state.slashes[0]?.life ?? 0;
  assert(initialLife > 0, `Slash initial life is positive (${initialLife.toFixed(3)})`);
  assert(state.players[0].meleeTimer > 0, `meleeTimer active on swing (${state.players[0].meleeTimer.toFixed(3)}s)`);

  // Step 20 frames (0.334s > 0.18s slash life & 0.22s meleeTimer)
  for (let f = 0; f < 20; f++) {
    stepBrawl(state, { p1: createBlankInput(), p2: createBlankInput() }, 0.0167);
  }

  assert(state.slashes.length === 0, 'Slash was cleanly decayed and removed from state.slashes (not stuck!)');
  assert(state.players[0].meleeTimer === 0, 'Player meleeTimer decayed cleanly to 0 (swing arm returned to neutral!)');
}

console.log('\n=== TEST 2: Combo Reset After Idle ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];

  // Perform Jab 1
  const inp = createBlankInput();
  inp.meleePressed = true;
  stepBrawl(state, { p1: inp }, 0.0167);
  assert(p1.meleeComboStep === 1, `First swing is combo step 1 (step = ${p1.meleeComboStep})`);

  // Wait until comboResetTimer (0.75s) expires (50 frames = 0.835s)
  for (let f = 0; f < 50; f++) {
    stepBrawl(state, { p1: createBlankInput() }, 0.0167);
  }
  assert(p1.meleeComboStep === 0, 'Combo step automatically reset to 0 after idle timeout');
}

console.log('\n=== TEST 3: Grounded Jab Stagger vs Finisher Launch ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
    { id: 'p2', name: 'Player 2', paletteIndex: 1, heroId: 'bambang' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  const p2 = state.players[1];
  p1.x = 400;
  p1.y = 390;
  p2.x = 435;
  p2.y = 390;
  p2.invulnTimer = 0;
  p2.isGrounded = true;

  // Hit with Jab Step 1
  const inpJab = createBlankInput();
  inpJab.meleePressed = true;
  stepBrawl(state, { p1: inpJab, p2: createBlankInput() }, 0.0167);

  assert(p2.isGrounded, 'Opponent remains grounded on jab hit (no sky bounce on tap 1!)');
  assert(p2.vy === 0, `Opponent vy is 0 on grounded jab (vy = ${p2.vy})`);
  assert(p2.vx > 0, `Opponent received horizontal stagger push (vx = ${p2.vx.toFixed(1)})`);

  // Step 3 frames to clear hitstop
  for (let f = 0; f < 3; f++) stepBrawl(state, { p1: createBlankInput(), p2: createBlankInput() }, 0.0167);

  // Fast forward cooldown to hit finisher (Combo Step 3)
  p1.meleeCooldown = 0;
  p1.meleeComboStep = 2; // Next attack will be Step 3 finisher!
  p1.comboResetTimer = 0.5; // Combo window still open
  p2.invulnTimer = 0;
  p2.isGrounded = true;

  const inpFinisher = createBlankInput();
  inpFinisher.meleePressed = true;
  stepBrawl(state, { p1: inpFinisher, p2: createBlankInput() }, 0.0167);

  assert(!p2.isGrounded, 'Opponent launched airborne on finisher combo step 3!');
  assert(p2.vy < -100, `Finisher upward launch trajectory applied (vy = ${p2.vy.toFixed(1)} < -100)`);
}

console.log('\n=== TEST 4: Screen Shake Decay & Intensity Reset ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
    { id: 'p2', name: 'Player 2', paletteIndex: 1, heroId: 'mat_clurit' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  assert(state.shakeTimer === 0 && state.shakeIntensity === 0, 'Initial shake is 0');

  // Trigger attack hit
  state.players[0].x = 400;
  state.players[0].y = 390;
  state.players[1].x = 430;
  state.players[1].y = 390;
  state.players[1].invulnTimer = 0;

  const inp1 = createBlankInput();
  inp1.meleePressed = true;
  stepBrawl(state, { p1: inp1, p2: createBlankInput() }, 0.0167);

  assert(state.shakeTimer > 0, `Shake timer activated on hit (${state.shakeTimer.toFixed(2)}s)`);
  assert(state.shakeIntensity > 0, `Shake intensity set on hit (${state.shakeIntensity})`);

  // Step frames until shake expires
  for (let f = 0; f < 30; f++) {
    stepBrawl(state, { p1: createBlankInput(), p2: createBlankInput() }, 0.0167);
  }

  assert(state.shakeTimer === 0, 'Shake timer decayed to 0');
  assert(state.shakeIntensity === 0, 'Shake intensity reset to 0 after timer expiration');
}

console.log('\n=== TEST 5: Solid Ground Drop-Through Prevention ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  p1.x = 400;
  p1.y = 390; // On solid ground
  p1.isGrounded = true;

  // Player holds DOWN and presses JUMP on SOLID ground
  const downJump = createBlankInput();
  downJump.down = true;
  downJump.jumpPressed = true;

  stepBrawl(state, { p1: downJump }, 0.0167);

  assert(p1.dropThroughTimer === 0, 'dropThroughTimer is NOT activated on solid ground');
  assert(p1.y <= 390, `Player did NOT drop through solid ground (y = ${p1.y})`);
}

console.log('\n=== TEST 6: Soft Platform Drop-Through & Landing Reset ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  // Left soft platform is at x: 210, y: 275, w: 160
  p1.x = 250;
  p1.y = 275;
  p1.isGrounded = true;

  // Player holds DOWN and presses JUMP on SOFT platform
  const downJump = createBlankInput();
  downJump.down = true;
  downJump.jumpPressed = true;

  stepBrawl(state, { p1: downJump }, 0.0167);

  assert((p1.dropThroughTimer ?? 0) > 0, 'dropThroughTimer activated on soft platform');
  assert(!p1.isGrounded, 'Player becomes airborne when dropping through soft platform');
  assert(p1.y > 275, `Player dropped below soft platform surface (y = ${p1.y.toFixed(2)} > 275)`);

  // Step until landing on solid ground below (y = 390)
  for (let f = 0; f < 40; f++) {
    stepBrawl(state, { p1: createBlankInput() }, 0.0167);
  }
  assert(p1.isGrounded && p1.y === 390, 'Player cleanly landed on solid ground below');
  assert(p1.dropThroughTimer === 0, 'dropThroughTimer reset to 0 after landing on underlying ground');
}

console.log('\n=== TEST 7: Walking Off Ledge ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  // Solid platform is x: 170 to 790, y: 390
  p1.x = 785;
  p1.y = 390;
  p1.isGrounded = true;
  p1.jumpsRemaining = 2;

  // Walk right off the ledge
  const moveRight = createBlankInput();
  moveRight.right = true;

  for (let f = 0; f < 10; f++) {
    stepBrawl(state, { p1: moveRight }, 0.0167);
  }

  assert(p1.x > 790, `Player walked past the platform right edge (x = ${p1.x.toFixed(1)})`);
  assert(!p1.isGrounded, 'Player is airborne after walking off ledge');
  assert(p1.jumpsRemaining === 1, `Air jump preserved after walking off ledge (jumpsRemaining = ${p1.jumpsRemaining})`);
}

console.log('\n=== TEST 8: Projectile Multi-Hit Prevention & Crate Hits ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'gus_dimas' as const, isBot: false },
    { id: 'p2', name: 'Player 2', paletteIndex: 1, heroId: 'mat_clurit' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  state.players[0].x = 350;
  state.players[0].y = 390;
  state.players[1].x = 420;
  state.players[1].y = 390;
  state.players[1].invulnTimer = 0;

  // Add crate in projectile path
  state.crates.push({
    id: 999,
    x: 480,
    y: 372,
    z: 0,
    vz: 0,
    radius: 18,
    hp: 30,
    maxHp: 30,
    hitFlashTimer: 0,
    lastHitSwingId: 0,
    style: 'wood',
  });

  // Fire projectile
  const fire = createBlankInput();
  fire.projPressed = true;
  stepBrawl(state, { p1: fire, p2: createBlankInput() }, 0.0167);

  assert(state.projectiles.length === 1, 'Gus Dimas pecut projectile spawned');
  const initialHp = state.players[1].hp;

  // Advance 2 frames where projectile passes through player 2
  stepBrawl(state, { p1: createBlankInput(), p2: createBlankInput() }, 0.0167);
  const hpAfterHit1 = state.players[1].hp;
  assert(hpAfterHit1 < initialHp, `Opponent took projectile damage (hp: ${hpAfterHit1})`);

  stepBrawl(state, { p1: createBlankInput(), p2: createBlankInput() }, 0.0167);
  const hpAfterHit2 = state.players[1].hp;
  assert(hpAfterHit2 === hpAfterHit1, `Opponent did NOT take duplicate damage on next frame (hp stayed ${hpAfterHit2})`);

  // Advance frames until projectile hits crate
  for (let f = 0; f < 10; f++) {
    stepBrawl(state, { p1: createBlankInput(), p2: createBlankInput() }, 0.0167);
  }
  assert(state.crates[0]?.hp < 30 || state.crates.length === 0, 'Projectile successfully hit and damaged the crate');
}

console.log('\n=== TEST 9: Hitstun Action Lockout ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  p1.x = 400;
  p1.y = 390;
  p1.hitFlashTimer = 0.2; // In hitstun!

  const attack = createBlankInput();
  attack.meleePressed = true;
  attack.dashPressed = true;

  stepBrawl(state, { p1: attack }, 0.0167);

  assert(state.slashes.length === 0, 'Cannot melee attack during hitstun');
  assert(p1.dashTimer === 0, 'Cannot dash during hitstun');
}

console.log('\n=== TEST 10: Jump from Main Platform to Side Platform ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  // Start on main stage under left soft platform (which is x: 210..370, y: 275)
  p1.x = 280;
  p1.y = 390;
  p1.isGrounded = true;

  // Jump upward
  const jumpInp = createBlankInput();
  jumpInp.jumpPressed = true;
  stepBrawl(state, { p1: jumpInp }, 0.0167);

  let reachedApexAbovePlat = false;
  // Step until landing
  for (let f = 0; f < 60; f++) {
    stepBrawl(state, { p1: createBlankInput() }, 0.0167);
    if (p1.y < 275) reachedApexAbovePlat = true;
    if (p1.isGrounded) break;
  }

  assert(reachedApexAbovePlat, 'Ground jump apex reaches above side platform (y < 275)');
  assert(p1.isGrounded && Math.abs(p1.y - 275) <= 1, `Player landed cleanly on top of side platform (y = ${p1.y})`);
}

console.log('\n=== TEST 11: Top Platform Triple Jump Does Not Self-KO ===');
{
  const roster = [
    { id: 'p1', name: 'Gus Dimas', paletteIndex: 0, heroId: 'gus_dimas' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  // Start on top center platform (y: 175)
  p1.x = 480;
  p1.y = 175;
  p1.isGrounded = true;

  // 1st Jump (Ground jump)
  const jump1 = createBlankInput();
  jump1.jumpPressed = true;
  stepBrawl(state, { p1: jump1 }, 0.0167);

  // Advance near apex (15 frames)
  for (let f = 0; f < 15; f++) stepBrawl(state, { p1: createBlankInput() }, 0.0167);

  // 2nd Jump (Double jump)
  const jump2 = createBlankInput();
  jump2.jumpPressed = true;
  stepBrawl(state, { p1: jump2 }, 0.0167);

  for (let f = 0; f < 12; f++) stepBrawl(state, { p1: createBlankInput() }, 0.0167);

  // 3rd Jump (Triple jump!)
  const jump3 = createBlankInput();
  jump3.jumpPressed = true;
  stepBrawl(state, { p1: jump3 }, 0.0167);

  for (let f = 0; f < 20; f++) stepBrawl(state, { p1: createBlankInput() }, 0.0167);

  assert(p1.brawlStocks === 3, `Gus Dimas did not ring out from triple jumping (stocks = ${p1.brawlStocks})`);
}

console.log('\n=== TEST 12: Respawn State Reset ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  p1.x = 500;
  p1.y = 600; // Trigger blast zone bottom fall
  p1.jumpsRemaining = 0;
  p1.hitFlashTimer = 0.5;
  p1.meleeTimer = 0.22;

  stepBrawl(state, { p1: createBlankInput() }, 0.0167);

  assert(p1.brawlStocks === 2, 'Player lost 1 stock from falling');
  assert(p1.jumpsRemaining === 2, `Respawn restored jumpsRemaining to max (jumps = ${p1.jumpsRemaining})`);
  assert(p1.hitFlashTimer === 0, 'Respawn cleared hitFlashTimer');
  assert(p1.meleeTimer === 0, 'Respawn cleared meleeTimer');
}

console.log('\n=== TEST 13: Void Falling for Off-Stage Crates & Pickups ===');
{
  const roster = [
    { id: 'p1', name: 'Player 1', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);

  // Spawn crate and pickup off-stage in void (x = 80, stage is x = 170..790)
  state.crates.push({
    id: 888,
    x: 80,
    y: 350,
    z: 0,
    vz: 0,
    radius: 18,
    hp: 30,
    maxHp: 30,
    hitFlashTimer: 0,
    lastHitSwingId: 0,
    style: 'wood',
  });

  // Step 25 frames
  for (let f = 0; f < 25; f++) {
    stepBrawl(state, { p1: createBlankInput() }, 0.0167);
  }

  // Should have fallen past y = 390 into void
  assert(
    state.crates.length === 0 || state.crates[0].y > 390,
    `Off-stage crate does NOT hover at y=390 (crate y = ${state.crates[0]?.y?.toFixed(1) ?? 'despawned'})`
  );
}

console.log('\n=== TEST 14: Kendi Emas (Smash Ball) Hover & Super Ultimate Reward ===');
{
  const roster = [
    { id: 'p1', name: 'Cak Bima', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  p1.ult = 0; // Starts with 0 ultimate charge

  // Spawn Kendi Emas (Smash Ball)
  state.crates.push({
    id: 999,
    x: 480,
    y: 150,
    z: 0,
    vz: 0,
    radius: 22,
    hp: 35,
    maxHp: 35,
    hitFlashTimer: 0,
    lastHitSwingId: 0,
    style: 'gold_kendi',
    bobPhase: 0,
  });

  // Step 15 frames: verify it hovers and does not drop to ground (y < 300)
  for (let f = 0; f < 15; f++) {
    stepBrawl(state, { p1: createBlankInput() }, 0.0167);
  }
  const kendi = state.crates.find((c) => c.style === 'gold_kendi');
  assert(!!kendi, 'Kendi Emas remains active in arena');
  assert((kendi?.bobPhase ?? 0) > 0, `Kendi bobPhase modulated (${kendi?.bobPhase?.toFixed(3)})`);
  assert((kendi?.y ?? 0) < 250, `Kendi maintains mid-air hovering altitude (y = ${kendi?.y?.toFixed(1)})`);

  // Position player to attack Kendi Emas
  p1.x = (kendi?.x ?? 480) - 20;
  p1.y = (kendi?.y ?? 150) + 15;
  const attackInp = createBlankInput();
  attackInp.meleePressed = true;
  stepBrawl(state, { p1: attackInp }, 0.0167);

  assert(kendi?.lastHitBy === 'p1', 'Kendi Emas recorded player attack hit (lastHitBy = p1)');
  assert((kendi?.hp ?? 0) < 35, `Kendi took damage from melee strike (hp = ${kendi?.hp})`);

  // Now deplete remaining HP to break Kendi Emas
  if (kendi) kendi.hp = 0;
  stepBrawl(state, { p1: createBlankInput() }, 0.0167);

  assert(p1.ult === p1.maxUlt, `Breaking Kendi awarded instant 100% Super Ultimate! (ult = ${p1.ult})`);
  assert(p1.invulnTimer > 0, 'Breaking Kendi granted invulnerability aura');
  assert(state.soundQueue.includes('smash_ball'), 'smash_ball procedural audio fanfare enqueued');
  assert(
    state.floatingTexts.some((ft) => ft.text.includes('KENDI EMAS')),
    'Broadcast banner announced Super Ultimate acquisition'
  );
  assert(!state.crates.some((c) => c.style === 'gold_kendi'), 'Kendi Emas cleanly despawned upon breaking');
}

console.log('\n=== TEST 15: Thematic Stage Architectures (Alun-Alun, Atap Warga, Jembatan Kali) ===');
{
  const roster = [
    { id: 'p1', name: 'Cak Bima', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
  ];

  // 1. Alun-Alun
  const sAlun = createBrawlState(roster, 3, 'alun_alun');
  assert(sAlun.brawl?.stageTheme === 'alun_alun', 'Stage theme is alun_alun');
  assert(sAlun.brawl?.platforms.length === 4, 'Alun-Alun has 4 platforms (1 solid, 3 soft)');

  // 2. Atap Warga
  const sAtap = createBrawlState(roster, 3, 'atap_warga');
  assert(sAtap.brawl?.stageTheme === 'atap_warga', 'Stage theme is atap_warga');
  const solidAtap = sAtap.brawl?.platforms.filter((p) => !p.dropThrough) ?? [];
  assert(solidAtap.length === 2, `Atap Warga has dual rooftop solids with central gap (count = ${solidAtap.length})`);
  assert(solidAtap[0].x < 200 && solidAtap[1].x > 500, 'Dual rooftops have wide abyss gap between them');

  // 3. Jembatan Kali
  const sJembatan = createBrawlState(roster, 3, 'jembatan_kali');
  assert(sJembatan.brawl?.stageTheme === 'jembatan_kali', 'Stage theme is jembatan_kali');
  const mainBridge = sJembatan.brawl?.platforms.find((p) => !p.dropThrough);
  assert((mainBridge?.w ?? 0) >= 700, `Jembatan Kali has grand continuous bridge deck (w = ${mainBridge?.w})`);
}

console.log('\n=== TEST 16: Hero & Elemental Procedural Audio Cues ===');
{
  const testHeroAudio = (
    heroId: 'bima' | 'mat_clurit' | 'bambang' | 'gus_dimas' | 'pak_rt' | 'mbak_sri',
    element: 'none' | 'petir' | 'api' | 'badai' | 'suci',
    expectedSound: string
  ) => {
    const roster = [{ id: 'p1', name: 'Tester', paletteIndex: 0, heroId, isBot: false }];
    const state = createBrawlState(roster);
    state.players[0].slashElement = element;
    state.soundQueue.length = 0; // Clear queue

    const inp = createBlankInput();
    inp.meleePressed = true;
    stepBrawl(state, { p1: inp }, 0.0167);

    assert(
      state.soundQueue.includes(expectedSound as any),
      `${heroId} with ${element} element enqueued procedural SFX: ${expectedSound}`
    );
  };

  testHeroAudio('mat_clurit', 'petir', 'slash_petir');
  testHeroAudio('bambang', 'api', 'slash_api');
  testHeroAudio('mbak_sri', 'badai', 'slash_badai');
  testHeroAudio('gus_dimas', 'suci', 'slash_suci');
  testHeroAudio('mat_clurit', 'none', 'slash_clurit');
  testHeroAudio('bambang', 'none', 'slash_tinju');
  testHeroAudio('bima', 'none', 'kibas');
}

console.log(`\n=============================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
if (failed > 0) process.exit(1);
