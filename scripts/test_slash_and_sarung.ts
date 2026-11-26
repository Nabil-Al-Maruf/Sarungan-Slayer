import { HERO_DEFS, HERO_LIST, getHeroDef } from '../src/core/heroes';
import { PLAYER_PALETTES } from '../src/core/constants';
import type { GameState, HeroId, PlayerInput, SlashElement } from '../src/core/types';
import { createBrawlState, stepBrawl } from '../src/modes/brawl';
import { createSandboxState, cyclePlayerSlashElement, upgradePlayerSlashLevel } from '../src/modes/sandbox';
import { createStoryState } from '../src/modes/story';
import { buyShopItem, createSurvivalState } from '../src/modes/survival';
import { resolveCombat, hitEnemy } from '../src/entities/combat';
import { createPlayer, updatePlayer } from '../src/entities/player';
import { spawnEnemy, updateEnemies } from '../src/entities/enemyFactory';
import {
  ZOMBIE_MATCHUPS,
  getHeroZombieMatchups,
  getZombieDealtDmgMatchup,
  getZombieTakenDmgMatchup,
} from '../src/core/zombieMatchups';
import { packGameSnapshot } from '../src/net/protocol';
import * as fs from 'fs';
import * as path from 'path';

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

console.log('=== TEST 1: Unique Hero Slash Styles & Sarung Silhouettes Definition ===');
{
  const expectedStyles: Record<HeroId, { slash: string; sarung: string; elem: string }> = {
    bima: { slash: 'sarung_whip', sarung: 'gulung_tempur', elem: 'badai' },
    mat_clurit: { slash: 'clurit_crescent', sarung: 'sarung_celana', elem: 'petir' },
    bambang: { slash: 'tinju_shockwave', sarung: 'lipit_jawara', elem: 'es' },
    gus_dimas: { slash: 'bambu_radiant', sarung: 'jubah_wali', elem: 'suci' },
    pak_rt: { slash: 'mercon_burst', sarung: 'lipit_dinas', elem: 'api' },
    mbak_sri: { slash: 'selendang_cyclone', sarung: 'lilit_kebaya', elem: 'daun' },
  };

  for (const [id, exp] of Object.entries(expectedStyles) as [HeroId, { slash: string; sarung: string; elem: string }][]) {
    const def = getHeroDef(id);
    assert(def.slashStyle === exp.slash, `${id} has unique slash style: ${def.slashStyle}`);
    assert(def.sarungStyle === exp.sarung, `${id} has distinct sarung silhouette: ${def.sarungStyle}`);
    assert(def.defaultElement === exp.elem, `${id} has default elemental affinity: ${def.defaultElement}`);
    assert(typeof def.slashStyleName === 'string' && def.slashStyleName.length > 0, `${id} has descriptive slashStyleName`);
    assert(typeof def.sarungSilhouetteName === 'string' && def.sarungSilhouetteName.length > 0, `${id} has descriptive sarungSilhouetteName`);
  }
}

console.log('\n=== TEST 2: Player Palettes Distinct Sarung & Slash Assignments ===');
{
  assert(PLAYER_PALETTES.length >= 6, `At least 6 player palettes configured (${PLAYER_PALETTES.length})`);
  for (const pal of PLAYER_PALETTES) {
    assert(typeof pal.sarungStyle === 'string', `${pal.name} specifies sarungStyle: ${pal.sarungStyle}`);
    assert(typeof pal.slashStyle === 'string', `${pal.name} specifies slashStyle: ${pal.slashStyle}`);
  }
}

console.log('\n=== TEST 3: Hero Slash Spawning in Sandbox Dojo ===');
{
  const heroes: HeroId[] = ['bima', 'mat_clurit', 'bambang', 'gus_dimas', 'pak_rt', 'mbak_sri'];
  for (const heroId of heroes) {
    const state = createSandboxState(0, 'Tester', heroId);
    const p = state.players[0];
    assert(p.heroId === heroId, `Dojo player heroId matches ${heroId}`);
    assert(p.slashStyle === HERO_DEFS[heroId].slashStyle, `Dojo player slashStyle matches hero ${heroId}`);
    assert(p.sarungStyle === HERO_DEFS[heroId].sarungStyle, `Dojo player sarungStyle matches hero ${heroId}`);

    // Trigger melee swing
    const inp = createBlankInput();
    inp.meleePressed = true;
    updatePlayer(state, p, inp, 0.0167);

    assert(state.slashes.length === 1, `Melee spawn created 1 slash for ${heroId}`);
    const slash = state.slashes[0];
    assert(slash.slashStyle === HERO_DEFS[heroId].slashStyle, `Slash effect contains hero slashStyle: ${slash.slashStyle}`);
    assert(slash.heroId === heroId, `Slash effect links to heroId: ${slash.heroId}`);

    // Cleanup slashes for next iteration
    state.slashes.length = 0;
  }
}

console.log('\n=== TEST 4: Element Cycling in Sandbox Mode ===');
{
  const state = createSandboxState(0, 'Tester', 'bima');
  const p = state.players[0];
  assert(p.slashElement === 'none', 'Player starts with none in sandbox');

  const step1 = cyclePlayerSlashElement(p);
  assert(step1.element === 'petir', `Cycle 1 gives petir (got ${step1.element})`);
  const step2 = cyclePlayerSlashElement(p);
  assert(step2.element === 'api', `Cycle 2 gives api (got ${step2.element})`);
  const step3 = cyclePlayerSlashElement(p);
  assert(step3.element === 'badai', `Cycle 3 gives badai (got ${step3.element})`);
  const step4 = cyclePlayerSlashElement(p);
  assert(step4.element === 'suci', `Cycle 4 gives suci (got ${step4.element})`);
  const step5 = cyclePlayerSlashElement(p);
  assert(step5.element === 'es', `Cycle 5 gives es (got ${step5.element})`);
  const step6 = cyclePlayerSlashElement(p);
  assert(step6.element === 'daun', `Cycle 6 gives daun (got ${step6.element})`);
  const step7 = cyclePlayerSlashElement(p);
  assert(step7.element === 'none', `Cycle 7 wraps back to none (got ${step7.element})`);
}

console.log('\n=== TEST 5: Survival Warung Elemental Upgrade Purchases (Locked to Hero Element) ===');
{
  // Cak Bima's signature element is 'badai'
  const state = createSurvivalState(0, undefined, 'Survivor', 'bima');
  const p = state.players[0];
  p.coins = 500;

  // Reject buying another hero's element
  const wrongElem = buyShopItem(state, p, 'elem_petir');
  assert(!wrongElem.ok, `Rejected elem_petir for Cak Bima (locked to badai): ${wrongElem.message}`);

  // Buy Badai Lv.1
  const buy1 = buyShopItem(state, p, 'elem_badai');
  assert(buy1.ok, `Buy elem_badai Lv.1 succeeded: ${buy1.message}`);
  assert(p.slashElement === 'badai', `Player active element is badai`);
  assert(p.slashElementLevel === 1, `Player active element level is 1`);
  assert(p.coins === 500 - 75, `Coins deducted correctly for Lv.1 (coins = ${p.coins})`);

  // Upgrade Badai to Lv.2
  const buy2 = buyShopItem(state, p, 'elem_badai');
  assert(buy2.ok, `Upgrade elem_badai Lv.2 succeeded: ${buy2.message}`);
  assert(p.slashElementLevel === 2, `Player active element level is now 2`);
  assert(p.coins === 500 - 75 - 150, `Coins deducted correctly for Lv.2 (coins = ${p.coins})`);

  // Upgrade Badai to Lv.3 (Max)
  const buy3 = buyShopItem(state, p, 'elem_badai');
  assert(buy3.ok, `Upgrade elem_badai Lv.3 succeeded: ${buy3.message}`);
  assert(p.slashElementLevel === 3, `Player active element level is now 3`);

  // Cannot upgrade beyond Lv.3
  const buy4 = buyShopItem(state, p, 'elem_badai');
  assert(!buy4.ok, `Cannot upgrade past Lv.3 (correctly rejected)`);

  // Cannot switch to Api when playing Bima
  p.coins = 200;
  const buyApi = buyShopItem(state, p, 'elem_api');
  assert(!buyApi.ok, `Cannot switch to elem_api when hero is Bima (correctly rejected)`);
  assert(p.slashElement === 'badai', `Active element remains badai`);
}

console.log('\n=== TEST 6: Elemental Combat Effects in Combat Engine ===');
{
  // 6A: Badai Reach Extension
  const state = createSandboxState(0, 'Tester', 'bima');
  const p = state.players[0];
  p.x = 200;
  p.y = 300;
  p.dirX = 1;
  p.dirY = 0;
  p.meleeAngle = 0;

  // Place enemy outside normal MELEE_REACH (74) but within Badai Reach (74 + 36 = 110)
  // Distance = 295 - 200 = 95 > 74 + 16 (target radius) = 90
  const enemy = spawnEnemy(state, 'dummy', 298, 300);
  enemy.hp = 100;
  enemy.lastHitSwingId = -1;

  // Without element: normal attack misses
  p.slashElement = 'none';
  p.meleeTimer = 0.15;
  p.meleeSwingId = 1;
  resolveCombat(state, 0.0167);
  assert(enemy.hp === 100, `Normal reach does not hit target at distance 98px (hp stayed 100)`);

  // With Badai Lv.2: extra reach (18 * 2 = 36px) connects!
  p.slashElement = 'badai';
  p.slashElementLevel = 2;
  p.meleeTimer = 0.15;
  p.meleeSwingId = 2;
  resolveCombat(state, 0.0167);
  assert(enemy.hp < 100, `Badai Lv.2 successfully hit target with extended range! (hp: ${enemy.hp})`);

  // 6B: Petir Stun & Bonus Damage
  const enemy2 = spawnEnemy(state, 'dummy', 240, 300);
  enemy2.hp = 100;
  enemy2.stunTimer = 0;
  p.slashElement = 'petir';
  p.slashElementLevel = 2;
  p.meleeTimer = 0.15;
  p.meleeSwingId = 3;
  resolveCombat(state, 0.0167);
  assert(enemy2.stunTimer > 0, `Petir applied electric stun (${enemy2.stunTimer.toFixed(2)}s)`);

  // 6C: Suci HP Leech & Extra Ult Gain
  p.hp = 50;
  p.ult = 0;
  p.slashElement = 'suci';
  p.slashElementLevel = 2;
  p.meleeTimer = 0.15;
  p.meleeSwingId = 4;
  enemy2.lastHitSwingId = -1;
  resolveCombat(state, 0.0167);
  assert(p.hp > 50, `Suci restored player HP on hit (hp = ${p.hp})`);
  assert(p.ult > 12, `Suci generated bonus ultimate charge (ult = ${p.ult})`);

  // 6D: Es Freeze Stun & Bonus Damage
  const enemy3 = spawnEnemy(state, 'dummy', 240, 300);
  enemy3.hp = 100;
  enemy3.stunTimer = 0;
  p.slashElement = 'es';
  p.slashElementLevel = 2;
  p.meleeTimer = 0.15;
  p.meleeSwingId = 5;
  resolveCombat(state, 0.0167);
  assert(enemy3.stunTimer > 0, `Es applied frost freeze stun (${enemy3.stunTimer.toFixed(2)}s)`);

  // 6E: Daun Upward Juggle Lift & Bonus Damage
  const enemy4 = spawnEnemy(state, 'dummy', 240, 300);
  enemy4.hp = 100;
  enemy4.vz = 0;
  p.slashElement = 'daun';
  p.slashElementLevel = 2;
  p.meleeTimer = 0.15;
  p.meleeSwingId = 6;
  resolveCombat(state, 0.0167);
  assert(enemy4.vz >= 150, `Daun lifted enemy upward (vz = ${enemy4.vz})`);
}

console.log('\n=== TEST 7: Brawl Mode Hero Slash & Default Elements ===');
{
  // Verify all 6 heroes have 6 completely unique elements
  const uniqueElems = new Set(Object.values(HERO_DEFS).map((h) => h.defaultElement));
  assert(uniqueElems.size === 6, `All 6 heroes have 6 unique default elements (got ${uniqueElems.size})`);

  const roster = [
    { id: 'p1', name: 'Sakera', paletteIndex: 1, heroId: 'mat_clurit' as const, isBot: false },
    { id: 'p2', name: 'Preman', paletteIndex: 2, heroId: 'bambang' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  const p2 = state.players[1];

  assert(p1.slashStyle === 'clurit_crescent', 'P1 has clurit_crescent slash style');
  assert(p1.sarungStyle === 'sarung_celana', 'P1 has sarung_celana silhouette');
  assert(p1.slashElement === 'petir', 'Mat Clurit defaults to Petir element in brawl');

  assert(p2.slashStyle === 'tinju_shockwave', 'P2 has tinju_shockwave slash style');
  assert(p2.sarungStyle === 'lipit_jawara', 'P2 has lipit_jawara silhouette');
  assert(p2.slashElement === 'es', 'Bang Bambang defaults to Es element in brawl');

  // Melee attack in brawl
  p1.x = 400; p1.y = 390;
  p2.x = 440; p2.y = 390;
  p2.invulnTimer = 0;
  const inp1 = createBlankInput();
  inp1.meleePressed = true;
  stepBrawl(state, { p1: inp1, p2: createBlankInput() }, 0.0167);

  assert(state.slashes.length === 1, 'Brawl melee spawned slash');
  const brawlSlash = state.slashes[0];
  assert(brawlSlash.slashStyle === 'clurit_crescent', `Brawl slash has hero style: ${brawlSlash.slashStyle}`);
  assert(brawlSlash.element === 'petir', `Brawl slash has elemental aura: ${brawlSlash.element}`);
}

console.log('\n=== TEST 8: HTML DOM Elements for Slash & Sarung Features ===');
{
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  assert(html.includes('id="hud-element-pill"'), 'HUD element pill exists in HTML');
  assert(html.includes('id="hud-element-icon"'), 'HUD element icon exists in HTML');
  assert(html.includes('id="hud-element-name"'), 'HUD element name exists in HTML');

  assert(html.includes('data-item="elem_petir"'), 'Warung shop has Petir element upgrade button');
  assert(html.includes('data-item="elem_api"'), 'Warung shop has Api element upgrade button');
  assert(html.includes('data-item="elem_badai"'), 'Warung shop has Badai element upgrade button');
  assert(html.includes('data-item="elem_suci"'), 'Warung shop has Suci element upgrade button');

  assert(html.includes('id="hero-spec-slash"'), 'Hero Spec preview displays Gaya Slash');
  assert(html.includes('id="hero-spec-sarung"'), 'Hero Spec preview displays Bentuk Sarung');
  assert(html.includes('data-elem="petir"'), 'Sandbox skills bar has Petir button');
  assert(html.includes('id="btn-sandbox-elem-lvl"'), 'Sandbox skills bar has element level button');
  assert(html.includes('data-sandbox-hero="mat_clurit"'), 'Sandbox skills bar has hero switcher button');
  assert(html.includes('id="settings-hero-picker"'), 'Settings view has Hero picker');
}

console.log('\n=== TEST 9: Palette Fallback to Distinct Hero & Sarung Style ===');
{
  // When heroId is omitted, each skin palette must fall back to its unique hero archetype and distinct sarung
  const p0 = createPlayer('p0', 0, 0, 0);
  assert(p0.heroId === 'bima', 'Palette 0 resolves to hero bima');
  assert(p0.sarungStyle === 'gulung_tempur', 'Palette 0 resolves to gulung_tempur');
  assert(p0.slashStyle === 'sarung_whip', 'Palette 0 resolves to sarung_whip');

  const p1 = createPlayer('p1', 0, 0, 1);
  assert(p1.heroId === 'mat_clurit', 'Palette 1 resolves to hero mat_clurit');
  assert(p1.sarungStyle === 'sarung_celana', 'Palette 1 resolves to sarung_celana');
  assert(p1.slashStyle === 'clurit_crescent', 'Palette 1 resolves to clurit_crescent');

  const p2 = createPlayer('p2', 0, 0, 2);
  assert(p2.heroId === 'bambang', 'Palette 2 resolves to hero bambang');
  assert(p2.sarungStyle === 'lipit_jawara', 'Palette 2 resolves to lipit_jawara');
  assert(p2.slashStyle === 'tinju_shockwave', 'Palette 2 resolves to tinju_shockwave');

  const p3 = createPlayer('p3', 0, 0, 3);
  assert(p3.heroId === 'gus_dimas', 'Palette 3 resolves to hero gus_dimas');
  assert(p3.sarungStyle === 'jubah_wali', 'Palette 3 resolves to jubah_wali');
  assert(p3.slashStyle === 'bambu_radiant', 'Palette 3 resolves to bambu_radiant');
  assert(p3.ultType === 'naga', 'Gus Dimas has unique ultType naga');

  const p4 = createPlayer('p4', 0, 0, 4);
  assert(p4.heroId === 'pak_rt', 'Palette 4 resolves to hero pak_rt');
  assert(p4.sarungStyle === 'lipit_dinas', 'Palette 4 resolves to lipit_dinas');
  assert(p4.slashStyle === 'mercon_burst', 'Palette 4 resolves to mercon_burst');
  assert(p4.ultType === 'mercon', 'Pak RT has unique ultType mercon');

  const p5 = createPlayer('p5', 0, 0, 5);
  assert(p5.heroId === 'mbak_sri', 'Palette 5 resolves to hero mbak_sri');
  assert(p5.sarungStyle === 'lilit_kebaya', 'Palette 5 resolves to lilit_kebaya');
  assert(p5.slashStyle === 'selendang_cyclone', 'Palette 5 resolves to selendang_cyclone');
  assert(p5.ultType === 'selendang', 'Mbak Sri has unique ultType selendang');

  assert(p0.ultType === 'gasing', 'Cak Bima has unique ultType gasing');
  assert(p1.ultType === 'petir', 'Mat Clurit has unique ultType petir');
  assert(p2.ultType === 'gempa', 'Bang Bambang has unique ultType gempa');
}

console.log('\n=== TEST 10: Upgrade Player Slash Level in Dojo ===');
{
  const state = createSandboxState(0, 'Tester', 'bima');
  const p = state.players[0];
  p.slashElement = 'petir';
  p.slashElementLevel = 1;

  const lv2 = upgradePlayerSlashLevel(p);
  assert(lv2 === 2, 'Upgrade from Lv.1 gives Lv.2');
  assert(p.slashElementLevel === 2, 'Player slashElementLevel is 2');

  const lv3 = upgradePlayerSlashLevel(p);
  assert(lv3 === 3, 'Upgrade from Lv.2 gives Lv.3');
  assert(p.slashElementLevel === 3, 'Player slashElementLevel is 3');

  const lv1Again = upgradePlayerSlashLevel(p);
  assert(lv1Again === 1, 'Upgrade from Lv.3 wraps back to Lv.1');
  assert(p.slashElementLevel === 1, 'Player slashElementLevel is 1');
}

console.log('\n=== TEST 11: Brawl Elemental Swing & Hit Particles + Badai Knockback ===');
{
  const roster = [
    { id: 'p1', name: 'Bima', paletteIndex: 0, heroId: 'bima' as const, isBot: false },
    { id: 'p2', name: 'Opponent', paletteIndex: 1, heroId: 'mat_clurit' as const, isBot: false },
  ];
  const state = createBrawlState(roster);
  const p1 = state.players[0];
  const p2 = state.players[1];
  p1.x = 400; p1.y = 390;
  p2.x = 440; p2.y = 390;
  p2.invulnTimer = 0;
  p1.slashElement = 'badai';
  p1.slashElementLevel = 2;

  const inp1 = createBlankInput();
  inp1.meleePressed = true;
  stepBrawl(state, { p1: inp1, p2: createBlankInput() }, 0.0167);

  // Particles must be emitted on elemental melee in Brawl mode
  assert(state.particles.length > 0, `Brawl melee spawned particles (${state.particles.length} particles)`);
  // Badai knockback multiplier applied
  assert(p2.vx > 130, `Badai Lv.2 amplified knockback push (vx = ${p2.vx} > 130)`);
}

console.log('\n=== TEST 12: Network Snapshot Protocol Serializes Elements ===');
{
  const state = createSandboxState(0, 'Tester', 'mat_clurit');
  const p = state.players[0];
  p.slashElement = 'petir';
  p.slashElementLevel = 2;

  const snap = packGameSnapshot(state, 1);
  assert(snap.players.length === 1, 'Snapshot packed 1 player');
  const sp = snap.players[0];
  assert(sp.elem === 'petir', `Snapshot packed elem: ${sp.elem}`);
  assert(sp.elemLv === 2, `Snapshot packed elemLv: ${sp.elemLv}`);
}

console.log('\n=== TEST 13: Play View Hero Selector Strip in HTML ===');
{
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  assert(html.includes('id="play-hero-picker"'), 'Play mode view contains #play-hero-picker');
  assert(html.includes('id="play-hero-active-badge"'), 'Play mode view contains #play-hero-active-badge');
  assert(html.includes('data-hero="bima"'), 'Hero picker contains Cak Bima');
  assert(html.includes('data-hero="mat_clurit"'), 'Hero picker contains Mat Clurit');
  assert(html.includes('data-hero="bambang"'), 'Hero picker contains Bang Bambang');
  assert(html.includes('data-hero="gus_dimas"'), 'Hero picker contains Gus Dimas');
  assert(html.includes('data-hero="pak_rt"'), 'Hero picker contains Pak RT');
  assert(html.includes('data-hero="mbak_sri"'), 'Hero picker contains Mbak Sri');
  assert(html.includes('id="dex-strong-zombies"'), 'Info Hero contains #dex-strong-zombies');
  assert(html.includes('id="dex-weak-zombies"'), 'Info Hero contains #dex-weak-zombies');
}

console.log('\n=== TEST 14: Zombie vs 6-Hero Strengths & Weaknesses ===');
{
  const entries = Object.values(ZOMBIE_MATCHUPS).filter(Boolean);
  assert(entries.length === 9, `All 9 zombie types have matchups defined (got ${entries.length})`);

  for (const m of entries) {
    assert(m!.weakAgainst !== m!.strongAgainst, `${m!.zombieKind} has distinct weak & strong hero`);
  }

  // Every single one of the 6 heroes has at least 1 zombie it counters AND 1 zombie that counters it
  for (const heroId of HERO_LIST.map((h) => h.id)) {
    const hm = getHeroZombieMatchups(heroId);
    assert(hm.strongVsZombies.length >= 1, `${heroId} counters at least 1 zombie (${hm.strongVsZombies.length})`);
    assert(hm.weakVsZombies.length >= 1, `${heroId} is countered by at least 1 zombie (${hm.weakVsZombies.length})`);
  }

  // Real combat test: Gus Dimas vs Zombie Pocong (weak -> 1.55x) vs Pak RT vs Zombie Pocong (strong -> 0.65x)
  const st = createSurvivalState(0, undefined, 'Tester', 'gus_dimas');
  const gus = st.players[0];
  const pocong1 = spawnEnemy(st, 'zombie_pocong', 300, 300);
  pocong1.hp = 200;
  hitEnemy(st, pocong1, gus, 20, 0, 0, 0, false);
  const gusDmg = 200 - pocong1.hp;
  assert(gusDmg === 31, `Gus Dimas deals 1.55x weakness dmg to Zombie Pocong (expected 31, got ${gusDmg})`);
  assert(
    st.floatingTexts.some((ft) => ft.text.includes('LEMAH')),
    'Weakness hit spawns LEMAH floating text'
  );

  const st2 = createSurvivalState(0, undefined, 'Tester', 'pak_rt');
  const pakRt = st2.players[0];
  const pocong2 = spawnEnemy(st2, 'zombie_pocong', 300, 300);
  pocong2.hp = 200;
  hitEnemy(st2, pocong2, pakRt, 20, 0, 0, 0, false);
  const pakRtDmg = 200 - pocong2.hp;
  assert(pakRtDmg === 13, `Pak RT deals 0.65x resisted dmg to Zombie Pocong (expected 13, got ${pakRtDmg})`);
  assert(
    st2.floatingTexts.some((ft) => ft.text.includes('KEBAL')),
    'Resisted hit spawns KEBAL floating text'
  );

  // Zombie contact counter damage: Pocong hits Pak RT (1.35x -> 14) vs Pocong hits Gus Dimas (0.8x -> 8)
  assert(getZombieTakenDmgMatchup('zombie_buto_ijo', 'bambang').mult === 1.55, 'Buto Ijo weak to Bang Bambang');
  assert(getZombieDealtDmgMatchup('zombie_pocong', 'pak_rt').mult === 1.35, 'Pocong deals 1.35x to Pak RT');

  pakRt.x = 300; pakRt.y = 300; pakRt.z = 0; pakRt.invulnTimer = 0; pakRt.hp = 100;
  pocong2.x = 305; pocong2.y = 300; pocong2.z = 0; pocong2.attackCooldown = 0; pocong2.stunTimer = 0;
  updateEnemies(st2, 0.0167);
  assert(pakRt.hp === 86, `Zombie Pocong dealt 1.35x counter damage (14) to Pak RT (hp = ${pakRt.hp})`);
}

console.log('\n=============================================');
console.log(`SLASH & SARUNG VARIATION TESTS: ${passed} PASSED, ${failed} FAILED`);
if (failed > 0) {
  process.exit(1);
}
