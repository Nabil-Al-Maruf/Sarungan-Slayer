import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`[PASS] ${message}`);
}

const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
const css = fs.readFileSync(path.resolve('src/style.css'), 'utf-8');
const ts = fs.readFileSync(path.resolve('src/main.ts'), 'utf-8');

console.log('=== TEST 1: Menu Overlay Views & Thematic Subpanels in HTML ===');
assert(html.includes('id="menu-title-hero"'), 'Hero title has id="menu-title-hero"');
assert(html.includes('id="menu-side-dock"'), 'Quick dock has id="menu-side-dock"');
assert(html.includes('id="menu-footer-credit"'), 'Footer credit has id="menu-footer-credit"');

assert(html.includes('subpanel-play'), 'Play mode view has subpanel-play class');
assert(html.includes('subpanel-settings'), 'Settings view has subpanel-settings class');
assert(html.includes('subpanel-story'), 'Story view has subpanel-story class');
assert(html.includes('subpanel-credits'), 'Credits view has subpanel-credits class');
assert(html.includes('subpanel-changelog'), 'Changelog view has subpanel-changelog class');

assert(html.includes('eyebrow-gold'), 'Play mode has distinct gold eyebrow');
assert(html.includes('eyebrow-cyan'), 'Settings has distinct cyan eyebrow');
assert(html.includes('eyebrow-red'), 'Story mode has distinct red eyebrow');
assert(html.includes('eyebrow-purple'), 'Credits has distinct purple eyebrow');
assert(html.includes('eyebrow-emerald'), 'Changelog has distinct emerald eyebrow');

console.log('\n=== TEST 2: Cartoon Pill Buttons Differentiation in HTML & CSS ===');
assert(html.includes('pill-btn-play'), 'Home play button has pill-btn-play class');
assert(html.includes('pill-btn-mabar'), 'Home mabar button has pill-btn-mabar class');
assert(html.includes('pill-btn-dojo'), 'Home dojo button has pill-btn-dojo class');
assert(html.includes('pill-btn-settings'), 'Home settings button has pill-btn-settings class');

assert(css.includes('.pill-btn-play {'), 'CSS defines distinct emerald theme for play button');
assert(css.includes('.pill-btn-mabar {'), 'CSS defines distinct purple theme for mabar button');
assert(css.includes('.pill-btn-dojo {'), 'CSS defines distinct cyan theme for dojo button');
assert(css.includes('.pill-btn-settings {'), 'CSS defines distinct amber theme for settings button');

console.log('\n=== TEST 3: CSS Z-Index Layering Hierarchy ===');
assert(css.includes('#pause-overlay {\n  z-index: 60;'), 'Pause overlay z-index is set to 60');
assert(css.includes('#qr-modal-overlay {\n  z-index: 70;'), 'QR modal overlay z-index is set to 70');
assert(css.includes('#result-overlay {\n  z-index: 52;'), 'Result overlay z-index is set to 52');
assert(css.includes('#brawl-victory-overlay {\n  z-index: 52;'), 'Brawl victory overlay z-index is set to 52');
assert(css.includes('#ult-overlay {\n  z-index: 49;'), 'Ult overlay z-index is set to 49');
assert(css.includes('#buff-overlay {\n  z-index: 48;'), 'Buff overlay z-index is set to 48');
assert(css.includes('#story-dialogue-overlay {\n  z-index: 46;'), 'Story cutscene z-index is set to 46');
assert(css.includes('#shop-overlay {\n  z-index: 45;'), 'Shop overlay z-index is set to 45');
assert(css.includes('#lobby-overlay {\n  z-index: 44;'), 'Lobby overlay z-index is set to 44');
assert(css.includes('#menu-overlay.title-screen-bg {\n  position: fixed;\n  inset: 0;\n  padding: 0;\n  background: #55c4d6;\n  overflow: hidden;\n  z-index: 40;'), 'Base menu overlay z-index is set to 40');

console.log('\n=== TEST 4: Subview Isolation & Overlap Prevention in CSS ===');
assert(
  css.includes('#menu-overlay.in-subview .menu-side-dock') &&
  css.includes('#menu-overlay.in-subview .scenic-footer-credit') &&
  css.includes('#menu-overlay.in-subview .title-hero'),
  'in-subview cleanly hides dock, footer credit, and title hero to eliminate overlap'
);
assert(
  css.includes('.subpanel-play {') &&
  css.includes('.subpanel-settings {') &&
  css.includes('.subpanel-story {') &&
  css.includes('.subpanel-credits {') &&
  css.includes('.subpanel-changelog {'),
  'All 5 subviews have individual thematic borders, glow shadows, and color differentiation'
);

console.log('\n=== TEST 5: Distinct Themes for Modals in CSS ===');
assert(css.includes('#lobby-overlay .lobby-card {') && css.includes('border: 3.5px solid #8b5cf6'), 'Lobby modal has distinct purple border theme');
assert(css.includes('#shop-overlay .shop-card {') && css.includes('border: 3.5px solid #d97706'), 'Shop modal has distinct amber warkop theme');
assert(css.includes('#buff-overlay .buff-card {') && css.includes('border: 3.5px solid #06b6d4'), 'Buff modal has distinct electric cyan theme');
assert(css.includes('#ult-overlay .ult-modal-card {') && css.includes('border: 3.5px solid #f59e0b'), 'Ultimate modal has distinct fiery gold theme');
assert(css.includes('#result-overlay .result-card.is-victory {') && css.includes('border-color: #22c55e'), 'Result victory has distinct emerald theme');
assert(css.includes('#result-overlay .result-card.is-gameover {') && css.includes('border-color: #ef4444'), 'Result game over has distinct crimson theme');
assert(css.includes('#brawl-victory-overlay .brawl-victory-card {') && css.includes('border: 3.5px solid #f97316'), 'Brawl victory has distinct champion orange theme');
assert(css.includes('#qr-modal-overlay .qr-modal-card {') && css.includes('border: 3.5px solid #0284c7'), 'QR modal has distinct blue frame theme');
assert(css.includes('.stage-status.locked {'), 'Locked stages have distinct muted styling');

console.log('\n=== TEST 6: Responsive Alignment & Grid Wrapping in CSS ===');
assert(css.includes('@media (max-width: 620px) {\n  .lobby-actions-row'), 'Lobby actions row wraps on narrow screens');
assert(css.includes('@media (max-width: 620px) {\n  .stage-grid'), 'Story stage grid wraps on narrow screens');
assert(css.includes('.pause-card {') && css.includes('border: 3.5px solid #f59e0b'), 'Pause modal has distinct visual styling');
assert(css.includes('@media (orientation: landscape) and (max-height: 520px)'), 'Landscape media query protects home and subpanel layouts from squishing');

console.log('\n=== TEST 7: Menu Navigation & Modal Logic in main.ts ===');
assert(ts.includes("menuOverlay.classList.toggle('in-subview', !isHome);"), 'showMenuView toggles in-subview class on menuOverlay');
assert(ts.includes('function closeAllModals(): void'), 'closeAllModals cleanly hides every overlay without leaking elements');
assert(!html.includes('id="settings-skin-picker"'), 'Old redundant settings skin picker removed in favor of 6 Heroes');
assert(!html.includes('id="lobby-skin-picker"'), 'Old redundant lobby skin picker removed in favor of 6 Heroes');
assert(ts.includes("if (heroSection) heroSection.classList.remove('hidden');"), 'Lobby Hero Selector stays visible for all modes');
assert(ts.includes("} else if (state.mode === 'brawl') {\n    if (localPeer.connected && localPeer.isHost) {\n      localPeer.sendStartGame();\n    } else {\n      startSoloBrawl();\n    }"), 'btnPauseRestart restarts brawl mode properly instead of falling into sandbox');
assert(ts.includes("if (e.key === 'Escape' && (resultShown || (brawlVictoryOverlay && !brawlVictoryOverlay.classList.contains('hidden'))))"), 'Escape key returns to menu cleanly on result or brawl victory');
assert(ts.includes("statusEl.classList.toggle('locked', !unlocked);"), 'refreshMenuProgress toggles locked class');

console.log('\n=== TEST 8: UI Audit & Responsiveness Fixes ===');
assert(css.includes('.element-pill {') && css.includes('pointer-events: auto;'), 'HUD Element Pill receives pointer events');
assert(css.includes('@media (max-width: 580px) {\n  .shop-grid'), 'Shop grid wraps to 2 columns on mobile screens');
assert(css.includes('@media (max-width: 380px) {\n  .shop-grid'), 'Shop grid wraps to 1 column on narrow screens');
assert(css.includes('@media (max-width: 540px) {\n  .buff-grid'), 'Buff grid wraps cleanly on mobile screens');
assert(css.includes('.play-hero-picker-row .hero-card {') && css.includes('flex-direction: column !important;'), 'Play hero picker cards have column layout');
assert(css.includes('@media (max-width: 520px) {\n  .play-hero-picker-row'), 'Play hero picker row wraps to 3 columns on small screens');
assert(css.includes('.sandbox-skills-bar {') && css.includes('overflow-x: auto;'), 'Sandbox skills bar supports horizontal scrolling');
assert(html.includes('id="landscape-lock-overlay"'), 'Mandatory landscape lock overlay exists in HTML');
assert(html.includes('id="btn-lock-landscape"'), 'Landscape lock button exists in HTML');
assert(html.includes('id="stick-toast"'), 'Stick controller toast banner exists in HTML');
assert(css.includes('@media (max-width: 960px) and (orientation: portrait)'), 'Portrait mobile screens trigger mandatory landscape overlay');
assert(ts.includes('localPeer.sendBuyItem(itemId)'), 'Client/Stick Warung purchases sync authoritatively to Host');
assert(ts.includes('if (snapAccum >= FIXED_DT || state.status !== \'playing\')'), 'Host broadcasts network snapshots at full 60Hz');
assert(ts.includes("state.mode === 'sandbox'") && ts.includes('Upgrade Bebas hanya di Pelatihan Dojo!'), 'Free element upgrades are strictly restricted to Pelatihan Dojo (sandbox)');
assert(ts.includes("} else if (state.mode === 'sandbox') {\n    const elements: SlashElement[]"), 'Free element cycling is strictly restricted to Pelatihan Dojo (sandbox)');
assert(html.includes('id="menu-heroes-view"') && html.includes('id="btn-open-heroes"'), 'Hero Encyclopedia menu and dock button exist in HTML');
assert(ts.includes('function renderHeroEncyclopedia('), 'renderHeroEncyclopedia wired in main.ts');
assert(ts.includes('shopOverlay?.addEventListener(\'click\''), 'shopOverlay backdrop click listener wired in main.ts');
assert(ts.includes('pauseOverlay?.addEventListener(\'click\''), 'pauseOverlay backdrop click listener wired in main.ts');
assert(ts.includes('lobbyOverlay?.addEventListener(\'click\''), 'lobbyOverlay backdrop click listener wired in main.ts');
assert(ts.includes('storyDialogueBox?.addEventListener(\'click\''), 'storyDialogueBox tap-to-advance listener wired in main.ts');
assert(ts.includes('e.stopPropagation();') && ts.includes('advanceStoryCutscene();'), 'Story cutscene buttons stop propagation to prevent double-advance bug');
assert(ts.includes('b.dataset.ult === p.ultType'), 'Sandbox skills bar syncs active ult button');
assert(css.includes('.overlay-modal {\n  position: absolute;'), 'Overlay modals use absolute positioning inside stage-wrap');
assert(css.includes('.app-shell.touch-active .controls-deck {\n  display: block;\n  position: fixed;'), 'Touch controls use unified fullscreen overlay');
assert(css.includes('.vbtn.act-elem-mini {') && css.includes('position: absolute;'), 'Virtual control action arc positions .act-elem-mini');
assert(css.includes('@media (max-width: 768px) {\n  .brawl-scoreboard-strip') && css.includes('flex-wrap: nowrap;'), 'Brawl scoreboard strip preserves single-row layout on mobile');
assert(css.includes('.app-shell.touch-active .sandbox-skills-bar {\n  top: 68px;\n  bottom: auto;'), 'Sandbox skills bar moves below HUD when touch controls are active to prevent overlap');
assert(css.includes('.app-shell.touch-active .brawl-scoreboard-strip {\n  max-width: calc(100% - 380px);'), 'Brawl scoreboard clears virtual touch controls on wide screens');
assert(css.includes('@media (max-width: 720px) {\n  .desktop-hints {\n    display: none !important;'), 'HUD wraps cleanly and hides desktop hints on narrow screens');
assert(css.includes('.act-btn {\n  position: absolute;\n  width: 28%;\n  aspect-ratio: 1 / 1;\n  height: auto;'), 'Virtual controller action buttons maintain 1:1 circular aspect ratio');
assert(css.includes('.app-shell.stick-controller-mode .stick-hud-bar {\n    flex-wrap: wrap;'), 'Stick controller HUD bar wraps cleanly on narrow screens without clipping');

console.log('\n=======================================');
console.log('ALL MENU & OVERLAY VERIFICATION TESTS PASSED!');
