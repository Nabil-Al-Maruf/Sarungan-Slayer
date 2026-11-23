import './style.css';
import { ProceduralAudio } from './audio/sfx';
import { FIXED_DT, PLAYER_PALETTES, ULT_DEFS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './core/constants';
import { HERO_DEFS, getHeroDef } from './core/heroes';
import { InputManager } from './core/input';
import type { BuffId, GameState, HeroId, PlayerInput, UltType } from './core/types';
import { createBrawlState, stepBrawl, type BrawlRosterMember } from './modes/brawl';
import { createSandboxState, stepSandbox } from './modes/sandbox';
import {
  createStoryState,
  loadStoryProgress,
  saveStageCleared,
  stepStory,
} from './modes/story';
import { getStoryDialogue, type StoryBeat, type StoryLine } from './modes/storyScript';
import {
  BUFF_DEFS,
  applyPlayerBuff,
  buyShopItem,
  canOpenWarung,
  createSurvivalState,
  getBarricadeActionInfo,
  loadBestWave,
  saveBestWave,
  skipIntermission,
  stepSurvival,
  getCoreUpgradeCost,
  TOWER_TIER_NAME,
  TOWER_UPGRADE_COST,
  type ShopItemId,
} from './modes/survival';
import { LocalPeerManager } from './net/localPeer';
import {
  packGameSnapshot,
  type CompactGameSnapshot,
  type LobbyPlayerInfo,
  type MabarGameMode,
  type StickPersonalSnapshot,
} from './net/protocol';
import { renderGame } from './render/renderer';
import {
  isAutoFullscreenEnabled,
  isFullscreen,
  setAutoFullscreenEnabled,
  toggleFullscreen,
  triggerAutoFullscreenIfEnabled,
} from './ui/fullscreen';
import { HudController } from './ui/hud';
import { buildInviteUrl, renderQrCodeToCanvas } from './ui/qrHelper';
import { bindTouchControls, type TouchDisplayMode } from './ui/touchControls';
import { haptic } from './ui/haptics';

const NAME_STORAGE_KEY = 'arek_slayer_player_name_v1';
const SKIN_STORAGE_KEY = 'arek_slayer_player_skin_v1';
const HERO_STORAGE_KEY = 'arek_slayer_hero_v1';
const GFX_STORAGE_KEY = 'arek_slayer_gfx_v1';
const HAPTIC_STORAGE_KEY = 'arek_slayer_haptic_v1';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const stageWrap = document.getElementById('stage-wrap') as HTMLDivElement;
const ctx = (canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d'))!;

const audio = new ProceduralAudio();
const input = new InputManager(() => audio.unlock());
const hud = new HudController();

let selectedPalette = Number(localStorage.getItem(SKIN_STORAGE_KEY) || '0') % PLAYER_PALETTES.length;
let playerName = (localStorage.getItem(NAME_STORAGE_KEY) || 'Cak Bima').slice(0, 14);
let selectedHeroId: HeroId = (localStorage.getItem(HERO_STORAGE_KEY) as HeroId) || 'bima';
if (!HERO_DEFS[selectedHeroId]) selectedHeroId = 'bima';
let selectedGameMode: 'survival' | 'brawl' = 'survival';

let state: GameState = createStoryState(1, selectedPalette, playerName);
let menuOpen = true;
let lobbyOpen = false;
let shopOpen = false;
let buffModalOpen = false;
let ultModalOpen = false;
let lastSkillPickTime = 0;

let pauseOpen = false;
let storyDialogueOpen = false;
let storyQueue: StoryLine[] = [];
let storyIndex = 0;
let storyBossShown = false;
let storyOutroDone = false;
let resultShown = false;
let lastBuffSig = '';

// Overlay DOM references
const menuOverlay = document.getElementById('menu-overlay') as HTMLDivElement;
const menuHomeView = document.getElementById('menu-home-view') as HTMLDivElement;
const menuPlayView = document.getElementById('menu-play-view') as HTMLDivElement;
const menuSettingsView = document.getElementById('menu-settings-view') as HTMLDivElement;
const menuStoryView = document.getElementById('menu-story-view') as HTMLDivElement;
const menuCreditsView = document.getElementById('menu-credits-view') as HTMLDivElement;
const menuChangelogView = document.getElementById('menu-changelog-view') as HTMLDivElement;

const lobbyOverlay = document.getElementById('lobby-overlay') as HTMLDivElement;
const shopOverlay = document.getElementById('shop-overlay') as HTMLDivElement;
const buffOverlay = document.getElementById('buff-overlay') as HTMLDivElement;
const buffChoicesGrid = document.getElementById('buff-choices-grid') as HTMLDivElement;
const ultOverlay = document.getElementById('ult-overlay') as HTMLDivElement;
const sandboxSkillsBar = document.getElementById('sandbox-skills-bar') as HTMLDivElement | null;
const pauseOverlay = document.getElementById('pause-overlay') as HTMLDivElement;
const pauseEyebrow = document.getElementById('pause-eyebrow') as HTMLDivElement;
const pauseSub = document.getElementById('pause-sub') as HTMLParagraphElement;
const btnPauseResume = document.getElementById('btn-pause-resume') as HTMLButtonElement;
const btnPauseToggleTouch = document.getElementById('btn-pause-toggle-touch') as HTMLButtonElement | null;
const pauseTouchStateText = document.getElementById('pause-touch-state-text') as HTMLSpanElement | null;
const btnPauseRestart = document.getElementById('btn-pause-restart') as HTMLButtonElement;
const btnPauseQuit = document.getElementById('btn-pause-quit') as HTMLButtonElement;

const storyDialogueOverlay = document.getElementById('story-dialogue-overlay') as HTMLDivElement;
const storyDialogueBox = document.getElementById('story-dialogue-box') as HTMLDivElement;
const storyMissionBanner = document.getElementById('story-mission-banner') as HTMLDivElement;
const storyAvatar = document.getElementById('story-avatar') as HTMLDivElement;
const storySpeaker = document.getElementById('story-speaker') as HTMLElement;
const storyRole = document.getElementById('story-role') as HTMLSpanElement;
const storyProgress = document.getElementById('story-progress') as HTMLSpanElement;
const storyText = document.getElementById('story-text') as HTMLParagraphElement;
const btnStorySkip = document.getElementById('btn-story-skip') as HTMLButtonElement;
const btnStoryNext = document.getElementById('btn-story-next') as HTMLButtonElement;

const resultOverlay = document.getElementById('result-overlay') as HTMLDivElement;
const resultEyebrow = document.getElementById('result-eyebrow') as HTMLDivElement;
const resultTitle = document.getElementById('result-title') as HTMLHeadingElement;
const resultDesc = document.getElementById('result-desc') as HTMLParagraphElement;
const btnNextStage = document.getElementById('btn-next-stage') as HTMLButtonElement;
const btnRetryStage = document.getElementById('btn-retry-stage') as HTMLButtonElement;
const btnBackMenu = document.getElementById('btn-back-menu') as HTMLButtonElement;
const menuBestWaveEl = document.getElementById('menu-best-wave') as HTMLSpanElement;

// Profile & Settings DOM references
const inputPlayerName = document.getElementById('input-player-name') as HTMLInputElement | null;
const inputSettingsName = document.getElementById('input-settings-name') as HTMLInputElement | null;
const setSfxBtn = document.getElementById('set-sfx-btn') as HTMLButtonElement;
const setBgmBtn = document.getElementById('set-bgm-btn') as HTMLButtonElement;
const setHapticBtn = document.getElementById('set-haptic-btn') as HTMLButtonElement;
const setAutoFsBtn = document.getElementById('set-autofs-btn') as HTMLButtonElement | null;
const btnFullscreenToggle = document.getElementById('btn-fullscreen-toggle') as HTMLButtonElement | null;

// Lobby DOM references
const inputLobbyName = document.getElementById('input-lobby-name') as HTMLInputElement;
const localStyleNormalBtn = document.getElementById('local-style-normal') as HTMLButtonElement;
const localStyleMonitorBtn = document.getElementById('local-style-monitor') as HTMLButtonElement;
const hotspotGuideTitle = document.getElementById('hotspot-guide-title') as HTMLElement;
const hotspotGuideStep1 = document.getElementById('hotspot-guide-step1') as HTMLElement;
const hotspotGuideStep2 = document.getElementById('hotspot-guide-step2') as HTMLElement;
const hotspotGuideStep3 = document.getElementById('hotspot-guide-step3') as HTMLElement;
const labelHostModeEl = document.getElementById('label-host-mode') as HTMLElement;
const btnCreateRoom = document.getElementById('btn-create-room') as HTMLButtonElement;
const hostCodeWrap = document.getElementById('host-code-wrap') as HTMLElement;
const lobbyRoomCodeEl = document.getElementById('lobby-room-code') as HTMLElement;
const qrCodeCanvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
const btnEnlargeQr = document.getElementById('btn-enlarge-qr') as HTMLElement;
const btnCopyLink = document.getElementById('btn-copy-link') as HTMLButtonElement;
const btnStartMabar = document.getElementById('btn-start-mabar') as HTMLButtonElement;
const btnRoleCoop = document.getElementById('btn-role-coop') as HTMLButtonElement;
const btnRoleStick = document.getElementById('btn-role-stick') as HTMLButtonElement;
const inputRoomCode = document.getElementById('input-room-code') as HTMLInputElement;
const btnJoinRoom = document.getElementById('btn-join-room') as HTMLButtonElement;
const lobbyRosterEl = document.getElementById('lobby-roster') as HTMLElement;
const lobbyPlayerCountEl = document.getElementById('lobby-player-count') as HTMLElement;
const lobbyStatusEl = document.getElementById('lobby-status') as HTMLElement;
const btnCloseLobby = document.getElementById('btn-close-lobby') as HTMLButtonElement;
const btnLobbyFullscreen = document.getElementById('btn-lobby-fullscreen') as HTMLButtonElement;

// QR Modal DOM references
const qrModalOverlay = document.getElementById('qr-modal-overlay') as HTMLDivElement;
const qrModalTitle = document.getElementById('qr-modal-title') as HTMLElement;
const qrModalCanvas = document.getElementById('qr-modal-canvas') as HTMLCanvasElement;
const qrModalCodeVal = document.getElementById('qr-modal-code-val') as HTMLElement;
const btnCloseQrModal = document.getElementById('btn-close-qr-modal') as HTMLButtonElement;

// Stick Controller HUD references
const stickHudBar = document.getElementById('stick-hud-bar') as HTMLDivElement;
const stickPlayerBadge = document.getElementById('stick-player-badge') as HTMLElement;
const stickPlayerName = document.getElementById('stick-player-name') as HTMLElement;
const stickWavePill = document.getElementById('stick-wave-pill') as HTMLElement;
const stickHpFill = document.getElementById('stick-hp-fill') as HTMLElement;
const stickHpText = document.getElementById('stick-hp-text') as HTMLElement;
const stickUltText = document.getElementById('stick-ult-text') as HTMLElement;
const stickCoinsText = document.getElementById('stick-coins-text') as HTMLElement;
const stickPingPill = document.getElementById('stick-ping-pill') as HTMLElement;
const vbtnStickShop = document.getElementById('vbtn-stick-shop') as HTMLButtonElement;
const btnStickExit = document.getElementById('btn-stick-exit') as HTMLButtonElement;

// Shop DOM references
const shopCoinsEl = document.getElementById('shop-coins') as HTMLElement;
const shopTicketsEl = document.getElementById('shop-tickets') as HTMLElement;
const shopFeedbackEl = document.getElementById('shop-feedback') as HTMLDivElement;
const btnSkipIntermission = document.getElementById('btn-skip-intermission') as HTMLButtonElement;

// HUD Quick Buttons
const btnWarungHud = document.getElementById('btn-warung-hud') as HTMLButtonElement;
const btnMenu = document.getElementById('btn-menu') as HTMLButtonElement;
const btnPalette = document.getElementById('btn-palette') as HTMLButtonElement | null;
const btnTouch = document.getElementById('btn-touch-toggle') as HTMLButtonElement | null;
const btnSfx = document.getElementById('btn-sfx') as HTMLButtonElement | null;
const btnBgm = document.getElementById('btn-bgm') as HTMLButtonElement | null;
const btnForceLandscape = document.getElementById('btn-force-landscape') as HTMLButtonElement | null;

// Tawuran Smash Brawl & Hero Picker DOM references
const btnPlayBrawl = document.getElementById('btn-play-brawl') as HTMLButtonElement | null;
const gametypeSurvivalBtn = document.getElementById('gametype-survival-btn') as HTMLButtonElement | null;
const gametypeBrawlBtn = document.getElementById('gametype-brawl-btn') as HTMLButtonElement | null;
const selectedHeroArchetypeEl = document.getElementById('selected-hero-archetype') as HTMLElement | null;
const heroSpecWeaponEl = document.getElementById('hero-spec-weapon') as HTMLElement | null;
const heroSpecProjEl = document.getElementById('hero-spec-proj') as HTMLElement | null;
const heroSpecUltEl = document.getElementById('hero-spec-ult') as HTMLElement | null;
const hostBotControls = document.getElementById('host-bot-controls') as HTMLElement | null;
const btnAddBot = document.getElementById('btn-add-bot') as HTMLButtonElement | null;
const btnRemBot = document.getElementById('btn-rem-bot') as HTMLButtonElement | null;

// Brawl Victory Modal DOM references
const brawlVictoryOverlay = document.getElementById('brawl-victory-overlay') as HTMLDivElement | null;
const brawlWinnerTitle = document.getElementById('brawl-winner-title') as HTMLElement | null;
const brawlWinnerAvatar = document.getElementById('brawl-winner-avatar') as HTMLElement | null;
const brawlWinnerName = document.getElementById('brawl-winner-name') as HTMLElement | null;
const brawlWinnerAlias = document.getElementById('brawl-winner-alias') as HTMLElement | null;
const brawlWinnerTagline = document.getElementById('brawl-winner-tagline') as HTMLElement | null;
const brawlPodiumRoster = document.getElementById('brawl-podium-roster') as HTMLElement | null;
const btnBrawlRematch = document.getElementById('btn-brawl-rematch') as HTMLButtonElement | null;
const btnBrawlLobby = document.getElementById('btn-brawl-lobby') as HTMLButtonElement | null;
const btnBrawlQuit = document.getElementById('btn-brawl-quit') as HTMLButtonElement | null;

let selectedHostRole: 'coop' | 'monitor' = 'coop';
let selectedJoinRole: 'coop' | 'stick' = 'coop';

if (inputPlayerName) inputPlayerName.value = playerName;
if (inputSettingsName) inputSettingsName.value = playerName;
if (inputLobbyName) inputLobbyName.value = playerName;

function getLocalPlayer() {
  if (localPeer.connected && !localPeer.isHost) {
    return state.players.find((p) => p.id === localPeer.localPlayerId) ?? state.players[0];
  }
  return state.players[0];
}

function syncPlayerName(newName: string): void {
  const cleaned = newName.trim().slice(0, 14) || 'Cak SBY';
  playerName = cleaned;
  try {
    localStorage.setItem(NAME_STORAGE_KEY, cleaned);
  } catch {}
  if (inputPlayerName && inputPlayerName.value !== newName) inputPlayerName.value = newName;
  if (inputSettingsName && inputSettingsName.value !== newName) inputSettingsName.value = newName;
  if (inputLobbyName && inputLobbyName.value !== newName) inputLobbyName.value = newName;

  const p = getLocalPlayer();
  if (p) p.name = cleaned;
}

function syncSelectedSkin(skinIdx: number): void {
  selectedPalette = Math.abs(Math.floor(skinIdx)) % PLAYER_PALETTES.length;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, String(selectedPalette));
  } catch {}
  const pal = PLAYER_PALETTES[selectedPalette];
  if (btnPalette) btnPalette.textContent = pal.label;

  document.querySelectorAll<HTMLButtonElement>('#settings-skin-picker .skin-swatch, #lobby-skin-picker .skin-swatch').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.skin) === selectedPalette);
  });

  const p = getLocalPlayer();
  if (p) {
    p.paletteIndex = selectedPalette;
  }
}

inputPlayerName?.addEventListener('input', () => syncPlayerName(inputPlayerName.value));
inputSettingsName?.addEventListener('input', () => syncPlayerName(inputSettingsName.value));
inputLobbyName?.addEventListener('input', () => syncPlayerName(inputLobbyName.value));

let wakeLockSentinel: {
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
} | null = null;

async function requestScreenWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: 'screen') => Promise<{
          release: () => Promise<void>;
          addEventListener?: (type: string, listener: () => void) => void;
        }>;
      };
    };
    if (nav.wakeLock && !wakeLockSentinel) {
      wakeLockSentinel = await nav.wakeLock.request('screen');
      wakeLockSentinel.addEventListener?.('release', () => {
        wakeLockSentinel = null;
      });
    }
  } catch {}
}

function releaseScreenWakeLock(): void {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (!menuOpen || localPeer.connected)) {
    void requestScreenWakeLock();
  }
});

window.setInterval(() => {
  if (document.visibilityState === 'visible' && (!menuOpen || localPeer.connected)) {
    void requestScreenWakeLock();
  }
}, 20000);

function setStickMode(active: boolean): void {
  const appShell = document.querySelector('.app-shell');
  appShell?.classList.toggle('stick-controller-mode', active);
  stickHudBar?.classList.toggle('hidden', !active);
  if (active) {
    void requestScreenWakeLock();
  }
}

function updateStickHud(): void {
  if (localPeer.localRole !== 'stick') return;
  const p = getLocalPlayer();
  const surv = state.survival;
  if (p) {
    const pal = PLAYER_PALETTES[p.paletteIndex % PLAYER_PALETTES.length];
    if (stickPlayerBadge) {
      stickPlayerBadge.textContent = p.id.toUpperCase();
      stickPlayerBadge.style.background = pal.accent;
    }
    if (stickPlayerName) stickPlayerName.textContent = p.name.toUpperCase();
    const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
    if (stickHpFill) stickHpFill.style.width = `${hpPct}%`;
    if (stickHpText) {
      stickHpText.textContent =
        state.mode === 'brawl'
          ? `${Math.ceil(p.hp)}% • ❤️x${p.brawlStocks ?? 3}`
          : `${Math.ceil(p.hp)}/${p.maxHp}`;
    }
    if (stickUltText) stickUltText.textContent = `ULT ${Math.floor(p.ult)}%`;
    if (stickCoinsText) {
      stickCoinsText.textContent = state.mode === 'brawl' ? getHeroDef(p.heroId).avatar : `🪙 ${p.coins}`;
    }
    if (vbtnStickShop) vbtnStickShop.classList.toggle('shop-ready', state.mode === 'survival' && canOpenWarung(state, p));
  }
  if (stickWavePill) {
    if (state.mode === 'brawl') {
      stickWavePill.textContent = `⚔️ ${p?.brawlKos ?? 0} KO`;
    } else if (surv) {
      stickWavePill.textContent =
        surv.phase === 'intermission'
          ? `W${surv.wave} ⏱${Math.ceil(surv.intermissionTimer)}s`
          : `W${surv.wave}`;
    }
  }
  if (stickPingPill) {
    stickPingPill.textContent = localPeer.pingMs > 0 ? `⚡ ${localPeer.pingMs}ms` : '⚡ LAN';
  }
}

// ===== LOCAL WEBRTC P2P MANAGER =====
const localPeer = new LocalPeerManager({
  onStatus(msg, isError) {
    if (lobbyStatusEl) {
      lobbyStatusEl.textContent = msg;
      lobbyStatusEl.style.color = isError ? '#f87171' : '#94a3b8';
    }
  },
  onLobbyUpdate(roomCode, players, localId, isHost, mode) {
    if (mode) {
      selectedGameMode = mode;
      gametypeSurvivalBtn?.classList.toggle('active', mode === 'survival');
      gametypeBrawlBtn?.classList.toggle('active', mode === 'brawl');
    }
    renderLobbyRoster(roomCode, players, localId, isHost, mode);
  },
  onGameStart() {
    audio.unlock();
    const currentMode = localPeer.gameMode || 'survival';
    if (state && state.mode === currentMode && state.status === 'playing' && !lobbyOpen && !menuOpen) {
      return;
    }

    if (localPeer.isHost) {
      if (localPeer.gameMode === 'brawl') {
        const roster: BrawlRosterMember[] = localPeer.lobbyPlayers
          .filter((p) => p.role !== 'monitor')
          .map((p) => ({
            id: p.id,
            paletteIndex: p.paletteIndex,
            name: p.name,
            heroId: p.heroId || 'bima',
            isBot: p.isBot,
          }));
        state = createBrawlState(roster);
      } else {
        const roster = localPeer.lobbyPlayers
          .filter((p) => p.role !== 'monitor')
          .map((p) => ({
            id: p.id,
            paletteIndex: p.paletteIndex,
            name: p.name,
          }));
        state = createSurvivalState(selectedPalette, roster, playerName);
      }
    }

    menuOpen = false;
    lobbyOpen = false;
    shopOpen = false;
    buffModalOpen = false;
    ultModalOpen = false;
    pauseOpen = false;
    storyDialogueOpen = false;
    lastBuffSig = '';
    resultShown = false;

    menuOverlay.classList.add('hidden');
    lobbyOverlay.classList.add('hidden');
    shopOverlay.classList.add('hidden');
    buffOverlay.classList.add('hidden');
    ultOverlay.classList.add('hidden');
    sandboxSkillsBar?.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    storyDialogueOverlay.classList.add('hidden');
    resultOverlay.classList.add('hidden');
    brawlVictoryOverlay?.classList.add('hidden');

    setStickMode(localPeer.localRole === 'stick');
    updateStickHud();
    void requestScreenWakeLock();
  },
  onSnapshot(snap: CompactGameSnapshot) {
    if (localPeer.localRole === 'stick') return;
    // Replicate snapshot into local render state
    state.status = snap.status;
    state.koCount = snap.koCount;
    state.shakeIntensity = snap.shakeIntensity;

    if (snap.gameMode === 'brawl') {
      state.mode = 'brawl';
      state.stageTitle = 'TAWURAN SMASH BRAWL';
      if (!state.brawl) {
        state.brawl = {
          platforms: [
            { x: 170, y: 390, w: 620, h: 32 },
            { x: 210, y: 280, w: 160, h: 14, dropThrough: true },
            { x: 590, y: 280, w: 160, h: 14, dropThrough: true },
            { x: 390, y: 190, w: 180, h: 14, dropThrough: true },
          ],
          initialStocks: 3,
          matchDuration: 180,
          ringOutBound: { minX: -50, maxX: 1010, minY: -100, maxY: 580 },
          itemSpawnTimer: 15,
          remainingTime: snap.brawlRemainingTime || 180,
          winnerId: snap.brawlWinnerId,
        };
      } else {
        if (snap.brawlRemainingTime !== undefined) state.brawl.remainingTime = snap.brawlRemainingTime;
        state.brawl.winnerId = snap.brawlWinnerId;
      }
    } else if (state.survival) {
      state.survival.wave = snap.wave;
      state.survival.phase = snap.phase;
      state.survival.intermissionTimer = snap.intermissionTimer;
      state.survival.core.hp = snap.core.hp;
      state.survival.core.maxHp = snap.core.maxHp;
      state.survival.core.shieldActive = snap.core.shieldActive;
      state.survival.core.shieldHp = snap.core.shieldHp;
      state.survival.core.towerLevel = snap.core.towerLevel as 0 | 1 | 2 | 3 | 4;

      for (const sb of snap.barricades) {
        const lb = state.survival.barricades.find((b) => b.id === sb.id);
        if (lb) {
          lb.hp = sb.hp;
          lb.maxHp = sb.maxHp;
        }
      }
    }

    // Sync players
    for (const sp of snap.players) {
      let lp = state.players.find((p) => p.id === sp.id);
      if (!lp) {
        lp = {
          id: sp.id,
          name: sp.name,
          paletteIndex: sp.pal,
          heroId: sp.heroId || 'bima',
          brawlStocks: sp.brawlStocks,
          brawlKos: sp.brawlKos,
          x: sp.x,
          y: sp.y,
          z: sp.z,
          vx: sp.vx,
          vy: sp.vy,
          vz: 0,
          radius: 18,
          dirX: sp.dirX,
          dirY: 0,
          jumpsRemaining: 2,
          hp: sp.hp,
          maxHp: sp.maxHp,
          ult: sp.ult,
          maxUlt: sp.maxUlt,
          coins: sp.coins,
          reviveTickets: 1,
          knockedDown: sp.knockedDown,
          invulnTimer: sp.invulnTimer,
          hitFlashTimer: 0,
          dmgMult: 1,
          cdMult: 1,
          speedMult: 1,
          ultGainMult: 1,
          coinMult: 1,
          pendingBuffChoices: [],
          buffCount: sp.buffCount,
          dashTimer: 0,
          dashCooldown: 0,
          dashDirX: sp.dirX,
          dashDirY: 0,
          meleeTimer: 0,
          meleeCooldown: 0,
          meleeSwingId: 0,
          meleeComboStep: 0,
          meleeAngle: 0,
          projCooldown: 0,
          ultType: sp.ultType,
          ultActiveTimer: 0,
          ultTickTimer: 0,
          scaleX: 1,
          scaleY: 1,
          animTime: sp.animTime,
          afterimages: [],
        };
        state.players.push(lp);
      } else {
        if (sp.id !== localPeer.localPlayerId) {
          lp.x = sp.x;
          lp.y = sp.y;
          lp.z = sp.z;
          lp.vx = sp.vx;
          lp.vy = sp.vy;
          lp.dirX = sp.dirX;
          lp.animTime = sp.animTime;
        }
        lp.hp = sp.hp;
        lp.maxHp = sp.maxHp;
        lp.ult = sp.ult;
        lp.coins = sp.coins;
        lp.knockedDown = sp.knockedDown;
        lp.ultType = sp.ultType;
        if (sp.heroId) lp.heroId = sp.heroId;
        if (sp.brawlStocks !== undefined) lp.brawlStocks = sp.brawlStocks;
        if (sp.brawlKos !== undefined) lp.brawlKos = sp.brawlKos;
      }
    }

    // Sound queue
    if (snap.sounds.length > 0) {
      audio.playQueue(snap.sounds);
    }

    if (shopOpen) {
      refreshShopUI();
    }
    showResultIfNeeded();
  },
  onStickSnapshot(snap: StickPersonalSnapshot) {
    if (localPeer.localRole !== 'stick') return;
    const p = getLocalPlayer();
    if (p) {
      p.hp = snap.hp;
      p.maxHp = snap.maxHp;
      p.ult = snap.ult;
      p.coins = snap.coins;
      if (snap.stocks !== undefined) p.brawlStocks = snap.stocks;
      if (snap.kos !== undefined) p.brawlKos = snap.kos;
    }
    if (snap.gameMode === 'brawl') {
      state.mode = 'brawl';
    }
    if (state.survival) {
      state.survival.wave = snap.wave;
      state.survival.phase = snap.phase;
      state.survival.intermissionTimer = snap.intermissionTimer;
    }
    if (snap.soundCue === 'player_hurt') {
      haptic.damage();
    }
    updateStickHud();
  },
  onSkillPrompt(kind: 'buff' | 'ult', choices: string[]) {
    if (kind === 'buff') {
      const p = getLocalPlayer();
      if (p) p.pendingBuffChoices = choices as BuffId[];
      checkPendingBuffModal();
    } else {
      const p = getLocalPlayer();
      if (p) p.pendingUltChoice = true;
      checkPendingUltModal();
    }
  },
  onDisconnect(reason: string) {
    setStickMode(false);
    releaseScreenWakeLock();
    state.shakeTimer = 0;
    state.shakeIntensity = 0;
    shopOpen = false;
    buffModalOpen = false;
    ultModalOpen = false;
    pauseOpen = false;
    resultShown = false;
    buffOverlay.classList.add('hidden');
    ultOverlay.classList.add('hidden');
    openLobby();
    if (lobbyStatusEl) {
      lobbyStatusEl.textContent = reason;
      lobbyStatusEl.style.color = '#f87171';
    }
  },
});

function renderLobbyRoster(
  roomCode: string,
  players: LobbyPlayerInfo[],
  localId: string,
  isHost: boolean,
  mode?: MabarGameMode
): void {
  const fighters = players.filter((p) => p.role !== 'monitor');
  const me = players.find((p) => p.id === localId);
  if (me && me.role !== 'monitor' && me.paletteIndex !== selectedPalette) {
    syncSelectedSkin(me.paletteIndex);
  }

  const takenByOthers = new Set(
    fighters.filter((p) => p.id !== localId).map((p) => p.paletteIndex)
  );
  document.querySelectorAll<HTMLButtonElement>('#lobby-skin-picker .skin-swatch').forEach((btn) => {
    const idx = Number(btn.dataset.skin);
    const taken = takenByOthers.has(idx);
    btn.disabled = taken;
    btn.classList.toggle('taken', taken);
  });

  const isBrawl = (mode || localPeer.gameMode) === 'brawl';

  if (roomCode && players.length > 0) {
    hostCodeWrap.classList.remove('hidden');
    lobbyRoomCodeEl.textContent = roomCode;
    qrModalCodeVal.textContent = roomCode;
    qrModalTitle.textContent = `ROOM ${roomCode}`;

    const inviteUrl = buildInviteUrl(roomCode, selectedHostRole === 'monitor' ? 'stick' : 'coop');
    if (qrCodeCanvas) {
      void renderQrCodeToCanvas(qrCodeCanvas, inviteUrl, { width: 96 });
    }
    if (qrModalCanvas) {
      void renderQrCodeToCanvas(qrModalCanvas, inviteUrl, { width: 240 });
    }

    const isMonitorHost = selectedHostRole === 'monitor';
    btnStartMabar.classList.toggle('hidden', !isHost);
    btnStartMabar.disabled = isMonitorHost && fighters.length === 0;
    btnStartMabar.textContent =
      isMonitorHost && fighters.length === 0
        ? 'MENUNGGU STICK HP GABUNG...'
        : isBrawl
          ? 'GAS TAWURAN BRAWL! ➔'
          : 'MULAI MABAR SURVIVAL ➔';

    if (hostBotControls) {
      hostBotControls.classList.toggle('hidden', !isHost || !isBrawl);
    }
    if (labelHostModeEl) {
      labelHostModeEl.textContent = isBrawl
        ? '👑 HOST TAWURAN SMASH BRAWL'
        : isMonitorHost
          ? '👑 HOST MONITOR (LAYAR UTAMA)'
          : '👑 HOST CO-OP (LAYAR DEWE)';
    }
  } else {
    hostCodeWrap.classList.add('hidden');
    btnStartMabar.classList.add('hidden');
    if (hostBotControls) hostBotControls.classList.add('hidden');
  }

  lobbyPlayerCountEl.textContent = `${fighters.length}/${isBrawl ? 6 : 5}`;
  if (players.length === 0) {
    lobbyRosterEl.innerHTML = '<div class="roster-empty">Belum ada room aktif.</div>';
    return;
  }

  lobbyRosterEl.innerHTML = players
    .map((p) => {
      const isMon = p.role === 'monitor';
      const isStk = p.role === 'stick';
      const dotColor = isMon
        ? '#38bdf8'
        : PLAYER_PALETTES[p.paletteIndex % PLAYER_PALETTES.length].accent;
      const you = p.id === localId ? ' (KAMU)' : '';
      const hDef = getHeroDef(p.heroId);
      const tag = p.isBot ? ' 🤖[BOT]' : isMon ? ' [MONITOR]' : isStk ? ' [STICK]' : ' [LAYAR]';
      return `<div class="roster-chip"><span class="roster-dot" style="background:${dotColor}"></span>${hDef.avatar} ${p.name}${tag}${you}</div>`;
    })
    .join('');
}

function setLocalPlayStyle(style: 'normal' | 'coop' | 'monitor'): void {
  selectedHostRole = style === 'monitor' ? 'monitor' : 'coop';
  const isNormal = style === 'normal' || style === 'coop';
  localStyleNormalBtn.classList.toggle('active', isNormal);
  localStyleMonitorBtn.classList.toggle('active', style === 'monitor');

  if (style === 'monitor') {
    hotspotGuideTitle.textContent = '📺 Cara Mabar 1 Monitor + HP Dadi Stik (0 Kuota):';
    hotspotGuideStep1.innerHTML =
      '1. Konekno TV/Laptop & kabeh HP nang <b>Wi-Fi / Hotspot HP seng podo</b>.';
    hotspotGuideStep2.innerHTML =
      '2. Layar Monitor (Laptop/Tablet/TV) pencet <b>BUAT ROOM MONITOR</b>.';
    hotspotGuideStep3.innerHTML =
      '3. HP konco lebokno <b>Kode Room</b> — layar HP konco otomatis dadi <b>Stick Gamepad</b>!';
    labelHostModeEl.textContent = '👑 HOST MONITOR (LAYAR UTAMA)';
    btnCreateRoom.textContent = 'BUAT ROOM MONITOR ➔';
    btnRoleStick.click();
  } else {
    hotspotGuideTitle.textContent = '📱 Cara Mabar Keroyokan Layar Dewe (Co-op Local):';
    hotspotGuideStep1.innerHTML =
      '1. Kabeh HP/Laptop konek nang <b>Wi-Fi utawa Hotspot HP seng podo</b>.';
    hotspotGuideStep2.innerHTML =
      '2. Siji arek klik <b>BUAT ROOM CO-OP</b>, duduhno kode room / QR nang konco.';
    hotspotGuideStep3.innerHTML =
      '3. Konco ketik kode room terus pencet <b>GABUNG ROOM</b>!';
    labelHostModeEl.textContent = '👑 HOST CO-OP (LAYAR DEWE)';
    btnCreateRoom.textContent = 'BUAT ROOM CO-OP ➔';
    btnRoleCoop.click();
  }
}

localStyleNormalBtn?.addEventListener('click', () => {
  audio.unlock();
  setLocalPlayStyle('normal');
});

localStyleMonitorBtn?.addEventListener('click', () => {
  audio.unlock();
  setLocalPlayStyle('monitor');
});

btnRoleCoop?.addEventListener('click', () => {
  selectedJoinRole = 'coop';
  btnRoleCoop.classList.add('active');
  btnRoleStick.classList.remove('active');
});

btnRoleStick?.addEventListener('click', () => {
  selectedJoinRole = 'stick';
  btnRoleStick.classList.add('active');
  btnRoleCoop.classList.remove('active');
});

btnCreateRoom?.addEventListener('click', () => {
  audio.unlock();
  triggerAutoFullscreenIfEnabled();
  localPeer.gameMode = selectedGameMode;
  localPeer.createRoom(selectedHostRole, playerName, selectedPalette, selectedHeroId);
});

btnJoinRoom?.addEventListener('click', () => {
  audio.unlock();
  triggerAutoFullscreenIfEnabled();
  localPeer.joinRoom(inputRoomCode.value, selectedJoinRole, playerName, selectedPalette, selectedHeroId);
});

inputRoomCode?.addEventListener('input', () => {
  inputRoomCode.value = inputRoomCode.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
});

inputRoomCode?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    audio.unlock();
    triggerAutoFullscreenIfEnabled();
    localPeer.joinRoom(inputRoomCode.value, selectedJoinRole, playerName, selectedPalette, selectedHeroId);
  }
});

function selectHero(heroId: HeroId): void {
  selectedHeroId = heroId;
  localStorage.setItem(HERO_STORAGE_KEY, heroId);

  document.querySelectorAll('#lobby-hero-picker .hero-card').forEach((card) => {
    card.classList.toggle('active', card.getAttribute('data-hero') === heroId);
  });

  const hDef = getHeroDef(heroId);
  if (selectedHeroArchetypeEl) selectedHeroArchetypeEl.textContent = hDef.archetype;
  if (heroSpecWeaponEl) heroSpecWeaponEl.textContent = hDef.weaponName;
  if (heroSpecProjEl) heroSpecProjEl.textContent = hDef.projName;
  if (heroSpecUltEl) heroSpecUltEl.textContent = hDef.ultName;

  if (localPeer.connected) {
    localPeer.sendPickHero(heroId);
  }
}

document.querySelectorAll<HTMLButtonElement>('#lobby-hero-picker .hero-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    const hero = btn.dataset.hero as HeroId;
    if (hero) selectHero(hero);
  });
});

function setMabarGameType(mode: 'survival' | 'brawl'): void {
  selectedGameMode = mode;
  gametypeSurvivalBtn?.classList.toggle('active', mode === 'survival');
  gametypeBrawlBtn?.classList.toggle('active', mode === 'brawl');

  if (localPeer.connected) {
    localPeer.sendSetGameMode(mode);
  } else {
    localPeer.gameMode = mode;
    renderLobbyRoster(localPeer.roomCode, localPeer.lobbyPlayers, localPeer.localPlayerId, localPeer.isHost, mode);
  }
}

gametypeSurvivalBtn?.addEventListener('click', () => {
  audio.unlock();
  setMabarGameType('survival');
});
gametypeBrawlBtn?.addEventListener('click', () => {
  audio.unlock();
  setMabarGameType('brawl');
});

btnAddBot?.addEventListener('click', () => {
  audio.unlock();
  localPeer.addBot();
});
btnRemBot?.addEventListener('click', () => {
  audio.unlock();
  localPeer.removeBot();
});

btnStartMabar?.addEventListener('click', () => {
  if (!localPeer.isHost) return;
  triggerAutoFullscreenIfEnabled();
  localPeer.sendStartGame();
});

btnCopyLink?.addEventListener('click', () => {
  if (!localPeer.roomCode) return;
  const url = buildInviteUrl(localPeer.roomCode, selectedHostRole === 'monitor' ? 'stick' : 'coop');
  navigator.clipboard?.writeText(url).catch(() => {});
  if (lobbyStatusEl) {
    lobbyStatusEl.textContent = `Link disalin: ${url}`;
    lobbyStatusEl.style.color = '#4ade80';
  }
});

btnEnlargeQr?.addEventListener('click', () => {
  audio.unlock();
  qrModalOverlay.classList.remove('hidden');
});

btnCloseQrModal?.addEventListener('click', () => {
  qrModalOverlay.classList.add('hidden');
});

qrModalOverlay?.addEventListener('click', (e) => {
  if (e.target === qrModalOverlay) {
    qrModalOverlay.classList.add('hidden');
  }
});

btnStickExit?.addEventListener('click', () => {
  audio.unlock();
  openPauseMenu();
});

function refreshMenuProgress(): void {
  const prog = loadStoryProgress();
  ([1, 2, 3] as const).forEach((num) => {
    const btn = document.getElementById(`btn-stage-${num}`) as HTMLButtonElement | null;
    const statusEl = document.getElementById(`status-stage-${num}`) as HTMLSpanElement | null;
    if (!btn || !statusEl) return;
    const unlocked = num <= prog.unlockedStage;
    const cleared = prog.clearedStages.includes(num);

    btn.disabled = !unlocked;
    statusEl.classList.toggle('cleared', cleared);
    statusEl.textContent = cleared ? 'SELESAI ✓' : unlocked ? 'TERBUKA' : 'TERKUNCI';
  });

  const bestWave = loadBestWave();
  if (menuBestWaveEl) {
    menuBestWaveEl.textContent = bestWave > 0 ? `(REKOR: W${bestWave})` : '';
  }
}

function refreshShopUI(): void {
  const surv = state.survival;
  const player = getLocalPlayer();
  if (!surv || !player) return;

  shopCoinsEl.textContent = `${player.coins} Receh`;
  shopTicketsEl.textContent = `${player.reviveTickets}`;
  btnSkipIntermission.classList.toggle('hidden', surv.phase !== 'intermission');

  const bottomBtn = document.getElementById('shop-bar-bottom') as HTMLButtonElement | null;
  const hasBottom = surv.barricades.some((b) => b.id === 'bottom');
  if (bottomBtn && !hasBottom) {
    bottomBtn.disabled = true;
    const descEl = document.getElementById('shop-bar-bottom-desc');
    const costEl = document.getElementById('shop-bar-bottom-cost');
    if (descEl) descEl.textContent = 'Jalur Selatan Terbuka di Wave 31+';
    if (costEl) costEl.textContent = 'WAVE 31';
  }

  for (const bar of surv.barricades) {
    const info = getBarricadeActionInfo(bar);
    const btn = document.getElementById(`shop-bar-${bar.id}`) as HTMLButtonElement | null;
    const descEl = document.getElementById(`shop-bar-${bar.id}-desc`);
    const costEl = document.getElementById(`shop-bar-${bar.id}-cost`);
    if (btn) btn.disabled = info.disabled;
    if (descEl) descEl.textContent = `HP ${Math.ceil(bar.hp)}/${bar.maxHp} • ${info.actionLabel}`;
    if (costEl) costEl.textContent = info.disabled ? 'MAX' : `${info.cost} Receh`;
  }

  const towerBtn = document.getElementById('shop-tower-pos') as HTMLButtonElement | null;
  const towerDesc = document.getElementById('shop-tower-pos-desc');
  const towerCost = document.getElementById('shop-tower-pos-cost');
  const curTowerLv = surv.core.towerLevel || 0;
  if (curTowerLv >= 4) {
    if (towerBtn) towerBtn.disabled = true;
    if (towerDesc) towerDesc.textContent = `TOWER MAKSIMAL (Lv.4 ${TOWER_TIER_NAME[4]})`;
    if (towerCost) towerCost.textContent = 'MAX ✓';
  } else {
    const nextLv = (curTowerLv + 1) as 1 | 2 | 3 | 4;
    const cost = TOWER_UPGRADE_COST[nextLv];
    if (towerBtn) towerBtn.disabled = false;
    if (towerDesc) {
      towerDesc.textContent =
        curTowerLv === 0
          ? `Beli Senjata Lv.1 (${TOWER_TIER_NAME[1]})`
          : `Upgrade Lv.${curTowerLv} ➔ Lv.${nextLv} (${TOWER_TIER_NAME[nextLv]})`;
    }
    if (towerCost) towerCost.textContent = `${cost} Receh`;
  }

  const coreHpBtn = document.getElementById('shop-upgrade-core') as HTMLButtonElement | null;
  const coreHpDesc = document.getElementById('shop-upgrade-core-desc');
  const coreHpCost = document.getElementById('shop-upgrade-core-cost');
  const upCost = getCoreUpgradeCost(surv.core.maxHp);
  if (coreHpBtn) coreHpBtn.disabled = false;
  if (coreHpDesc) {
    coreHpDesc.textContent = `HP Sekarang: ${Math.ceil(surv.core.hp)}/${surv.core.maxHp} • Tambah +200 Max HP`;
  }
  if (coreHpCost) coreHpCost.textContent = `${upCost} Receh`;

  const shieldBtn = document.getElementById('shop-shield-core') as HTMLButtonElement | null;
  const shieldDesc = document.getElementById('shop-shield-core-desc');
  const shieldCost = document.getElementById('shop-shield-core-cost');
  const shieldActive = surv.core.shieldActive && surv.core.shieldHp > 0;
  if (shieldBtn) shieldBtn.disabled = shieldActive;
  if (shieldDesc) {
    shieldDesc.textContent = shieldActive
      ? `Tameng Aktif (${Math.ceil(surv.core.shieldHp)}/${surv.core.shieldMaxHp}) • Sengat Zombie`
      : 'Perisai pelindung Pos Ronda (1 Wave) + Sengat Zombie';
  }
  if (shieldCost) shieldCost.textContent = shieldActive ? 'AKTIF ✓' : '150 Receh';

  const curUlt = player.ultType ?? 'gasing';
  const ultDef = ULT_DEFS[curUlt];
  const iconEl = document.getElementById('shop-ult-active-icon');
  const titleEl = document.getElementById('shop-ult-active-title');
  const descEl = document.getElementById('shop-ult-active-desc');
  if (iconEl && ultDef) iconEl.textContent = ultDef.icon;
  if (titleEl && ultDef) titleEl.textContent = ultDef.title;
  if (descEl && ultDef) descEl.textContent = ultDef.desc;
}

function checkPendingUltModal(): void {
  if (state.mode !== 'survival' || state.status !== 'playing' || menuOpen || lobbyOpen) {
    if (ultModalOpen) {
      ultModalOpen = false;
      ultOverlay.classList.add('hidden');
    }
    return;
  }

  const player = getLocalPlayer();
  if (!player || !player.pendingUltChoice) {
    if (ultModalOpen) {
      ultModalOpen = false;
      ultOverlay.classList.add('hidden');
    }
    return;
  }

  if (shopOpen) {
    shopOpen = false;
    shopOverlay.classList.add('hidden');
  }

  if (buffModalOpen) {
    buffModalOpen = false;
    buffOverlay.classList.add('hidden');
  }

  if (ultModalOpen) return;
  ultModalOpen = true;

  const ultCards = ultOverlay.querySelectorAll<HTMLButtonElement>('.ult-card-btn');
  for (const card of ultCards) {
    const uType = card.dataset.ult as UltType;
    card.classList.toggle('active-current', player.ultType === uType);
  }

  ultOverlay.classList.remove('hidden');
}

function pickUltChoice(ultType: UltType): void {
  const now = Date.now();
  if (now - lastSkillPickTime < 300) return;
  lastSkillPickTime = now;

  if (localPeer.connected && !localPeer.isHost) {
    localPeer.sendPickSkill('ult', ultType);
  } else {
    const player = getLocalPlayer();
    if (player) {
      player.ultType = ultType;
      player.ult = player.maxUlt;
      player.pendingUltChoice = false;
      const def = ULT_DEFS[ultType];
      state.soundQueue.push('pickup_kopi');
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 58,
        vy: -50,
        text: `JURUS: ${def.title.toUpperCase()}! ${def.icon}`,
        color: '#facc15',
        scale: 1.25,
        life: 1.5,
        maxLife: 1.5,
      });
    }
  }

  ultModalOpen = false;
  ultOverlay.classList.add('hidden');
  haptic.ultimate();

  setTimeout(() => {
    checkPendingBuffModal();
  }, 220);
}

function checkPendingBuffModal(): void {
  if (state.mode !== 'survival' || state.status !== 'playing' || menuOpen || lobbyOpen) {
    if (buffModalOpen) {
      buffModalOpen = false;
      buffOverlay.classList.add('hidden');
    }
    return;
  }

  const player = getLocalPlayer();
  if (ultModalOpen || player?.pendingUltChoice) {
    if (buffModalOpen) {
      buffModalOpen = false;
      buffOverlay.classList.add('hidden');
    }
    return;
  }

  const choices = player?.pendingBuffChoices ?? [];
  if (!player || choices.length === 0) {
    if (buffModalOpen) {
      buffModalOpen = false;
      lastBuffSig = '';
      buffOverlay.classList.add('hidden');
    }
    return;
  }

  if (shopOpen) {
    shopOpen = false;
    shopOverlay.classList.add('hidden');
  }

  const sig = choices.join(',');
  if (buffModalOpen && sig === lastBuffSig) return;

  lastBuffSig = sig;
  buffModalOpen = true;
  buffChoicesGrid.innerHTML = '';

  for (const buffId of choices) {
    const def = BUFF_DEFS[buffId];
    if (!def) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'buff-choice-btn';
    btn.innerHTML = `
      <span class="buff-icon">${def.icon}</span>
      <strong>${def.title}</strong>
      <small>${def.desc}</small>
      <span class="buff-pick-tag">PILIH BUFF INI</span>
    `;
    btn.addEventListener('click', () => {
      audio.unlock();
      pickBuffChoice(buffId);
    });
    buffChoicesGrid.appendChild(btn);
  }

  buffOverlay.classList.remove('hidden');
}

function pickBuffChoice(buffId: BuffId): void {
  const now = Date.now();
  if (now - lastSkillPickTime < 300) return;
  lastSkillPickTime = now;

  const player = getLocalPlayer();
  if (player) {
    player.pendingBuffChoices = [];
  }

  if (localPeer.connected && !localPeer.isHost) {
    localPeer.sendPickSkill('buff', buffId);
  } else {
    if (player) {
      applyPlayerBuff(state, player, buffId);
      audio.playQueue(state.soundQueue);
      state.soundQueue.length = 0;
    }
  }

  buffModalOpen = false;
  lastBuffSig = '';
  buffOverlay.classList.add('hidden');
  haptic.tap();
}

function toggleWarung(): void {
  if (
    state.mode !== 'survival' ||
    menuOpen ||
    lobbyOpen ||
    buffModalOpen ||
    ultModalOpen ||
    state.status !== 'playing'
  ) {
    return;
  }
  const player = getLocalPlayer();
  if (!player) return;

  if (shopOpen) {
    shopOpen = false;
    shopOverlay.classList.add('hidden');
    return;
  }

  if (!canOpenWarung(state, player)) {
    state.floatingTexts.push({
      x: player.x,
      y: player.y - player.z - 54,
      vy: -40,
      text: 'DEKATI POS WARKOP / TUNGGU JEDA!',
      color: '#fde047',
      scale: 0.92,
      life: 1.1,
      maxLife: 1.1,
    });
    return;
  }

  shopOpen = true;
  shopFeedbackEl.textContent = '';
  refreshShopUI();
  shopOverlay.classList.remove('hidden');
}

function showMenuView(view: 'home' | 'play' | 'settings' | 'story' | 'credits' | 'changelog'): void {
  menuHomeView.classList.toggle('hidden', view !== 'home');
  menuPlayView.classList.toggle('hidden', view !== 'play');
  menuSettingsView.classList.toggle('hidden', view !== 'settings');
  menuStoryView.classList.toggle('hidden', view !== 'story');
  menuCreditsView.classList.toggle('hidden', view !== 'credits');
  menuChangelogView.classList.toggle('hidden', view !== 'changelog');
}

let gfxQuality: 'low' | 'med' | 'high' =
  (localStorage.getItem(GFX_STORAGE_KEY) as 'low' | 'med' | 'high') || 'med';
let hapticEnabled = localStorage.getItem(HAPTIC_STORAGE_KEY) !== '0';

function refreshSettingsUI(): void {
  if (inputSettingsName) inputSettingsName.value = playerName;
  const sfxMuted = btnSfx ? btnSfx.classList.contains('muted') : audio.isSfxMuted();
  setSfxBtn.textContent = sfxMuted ? 'MATI' : 'NYALA';
  setSfxBtn.classList.toggle('active', !sfxMuted);
  const bgmOff = btnBgm ? btnBgm.classList.contains('muted') : !audio.isBgmEnabled();
  setBgmBtn.textContent = bgmOff ? 'MATI' : 'NYALA';
  setBgmBtn.classList.toggle('active', !bgmOff);
  setHapticBtn.textContent = hapticEnabled ? 'NYALA' : 'MATI';
  setHapticBtn.classList.toggle('active', hapticEnabled);
  if (setAutoFsBtn) {
    const autofs = isAutoFullscreenEnabled();
    setAutoFsBtn.textContent = autofs ? 'AKTIF (LEGA)' : 'NONAKTIF';
    setAutoFsBtn.classList.toggle('active', autofs);
  }
  document.querySelectorAll<HTMLButtonElement>('#set-gfx-group .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.gfx === gfxQuality);
  });
}

document.getElementById('btn-open-play')?.addEventListener('click', () => {
  audio.unlock();
  refreshMenuProgress();
  showMenuView('play');
});

document.getElementById('btn-open-mabar-home')?.addEventListener('click', () => {
  audio.unlock();
  openLobby();
});

document.getElementById('btn-open-lobby')?.addEventListener('click', () => {
  audio.unlock();
  openLobby();
});

document.getElementById('btn-home-sandbox')?.addEventListener('click', () => {
  audio.unlock();
  startSandbox();
});

document.getElementById('btn-open-settings')?.addEventListener('click', () => {
  audio.unlock();
  refreshSettingsUI();
  showMenuView('settings');
});

document.getElementById('btn-back-home-play')?.addEventListener('click', () => {
  audio.unlock();
  showMenuView('home');
});

document.getElementById('btn-back-home-settings')?.addEventListener('click', () => {
  audio.unlock();
  showMenuView('home');
});

document.querySelectorAll<HTMLButtonElement>('#settings-skin-picker .skin-swatch, #lobby-skin-picker .skin-swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    syncSelectedSkin(Number(btn.dataset.skin));
  });
});

setSfxBtn.addEventListener('click', () => {
  audio.unlock();
  const muted = audio.toggleSfx();
  btnSfx?.classList.toggle('muted', muted);
  refreshSettingsUI();
});

setBgmBtn.addEventListener('click', () => {
  const enabled = audio.toggleBgm();
  btnBgm?.classList.toggle('muted', !enabled);
  refreshSettingsUI();
});

setHapticBtn.addEventListener('click', () => {
  hapticEnabled = !hapticEnabled;
  haptic.setEnabled(hapticEnabled);
  try {
    localStorage.setItem(HAPTIC_STORAGE_KEY, hapticEnabled ? '1' : '0');
  } catch {}
  if (hapticEnabled) {
    haptic.tap();
  }
  refreshSettingsUI();
});

document.querySelectorAll<HTMLButtonElement>('#set-gfx-group .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const q = (btn.dataset.gfx as 'low' | 'med' | 'high') || 'med';
    gfxQuality = q;
    try {
      localStorage.setItem(GFX_STORAGE_KEY, q);
    } catch {
      // Ignore
    }
    resizeCanvas();
    refreshSettingsUI();
  });
});

setAutoFsBtn?.addEventListener('click', () => {
  audio.unlock();
  const next = !isAutoFullscreenEnabled();
  setAutoFullscreenEnabled(next);
  refreshSettingsUI();
  if (next && !isFullscreen()) {
    void toggleFullscreen();
  }
});

btnFullscreenToggle?.addEventListener('click', () => {
  audio.unlock();
  void toggleFullscreen();
});

btnLobbyFullscreen?.addEventListener('click', () => {
  audio.unlock();
  void toggleFullscreen();
});

document.addEventListener('fullscreenchange', () => {
  const fs = isFullscreen();
  if (btnFullscreenToggle) {
    btnFullscreenToggle.textContent = fs ? '🗗' : '⛶';
    btnFullscreenToggle.title = fs ? 'Keluar Layar Penuh [Esc]' : 'Layar Penuh / Fullscreen [F11]';
  }
  if (btnLobbyFullscreen) {
    btnLobbyFullscreen.textContent = fs ? '🗗 KELUAR FULLSCREEN' : '⛶ FULLSCREEN';
  }
  setTimeout(resizeCanvas, 80);
});

function openPauseMenu(): void {
  if (menuOpen || lobbyOpen || resultShown) return;
  pauseOpen = true;
  pauseEyebrow.textContent = localPeer.connected ? 'JEDA MABAR LOCAL' : 'PERMAINAN DIJEDA';
  pauseSub.textContent = localPeer.connected
    ? 'Room tetap aktif di jaringan Wi-Fi. Tekan Lanjutkan untuk bermain!'
    : 'Simulasi dijeda sementara. Ambil napas dulu rek!';
  btnPauseRestart.classList.toggle('hidden', localPeer.connected && !localPeer.isHost);
  pauseOverlay.classList.remove('hidden');
}

function closePauseMenu(): void {
  pauseOpen = false;
  pauseOverlay.classList.add('hidden');
}

btnPauseResume.addEventListener('click', () => {
  audio.unlock();
  closePauseMenu();
});

btnPauseRestart.addEventListener('click', () => {
  audio.unlock();
  closePauseMenu();
  if (state.mode === 'story') {
    startStoryStage(state.stageNumber);
  } else if (state.mode === 'survival') {
    if (localPeer.connected && localPeer.isHost) {
      localPeer.sendStartGame();
    } else {
      startSoloSurvival();
    }
  } else {
    startSandbox();
  }
});

btnPauseQuit.addEventListener('click', () => {
  audio.unlock();
  closePauseMenu();
  openMenu();
});

function openStoryCutscene(beat: StoryBeat): void {
  const lines = getStoryDialogue(state.stageNumber, beat, playerName);
  if (lines.length === 0) return;
  storyQueue = lines;
  storyIndex = 0;
  storyDialogueOpen = true;
  renderStoryLine();
  storyDialogueOverlay.classList.remove('hidden');
}

function renderStoryLine(): void {
  const line = storyQueue[storyIndex];
  if (!line) return;
  storyDialogueBox.classList.toggle('side-right', line.side === 'right');
  storyAvatar.textContent = line.avatar;
  storyAvatar.style.borderColor = line.accent;
  storySpeaker.textContent = line.speaker;
  storySpeaker.style.color = line.accent;
  storyRole.textContent = line.role;
  storyProgress.textContent = `${storyIndex + 1}/${storyQueue.length}`;
  storyText.textContent = line.text;
  if (line.mission) {
    storyMissionBanner.textContent = line.mission;
    storyMissionBanner.classList.remove('hidden');
  } else {
    storyMissionBanner.classList.add('hidden');
  }
  btnStoryNext.textContent =
    storyIndex + 1 >= storyQueue.length ? 'MULAI AKSI ➔' : 'LANJUT ➔';
}

function closeStoryCutscene(): void {
  storyDialogueOpen = false;
  storyDialogueOverlay.classList.add('hidden');
  if (state.mode === 'story' && state.status !== 'playing') {
    showResultIfNeeded();
  }
}

function advanceStoryCutscene(): void {
  if (!storyDialogueOpen) return;
  audio.unlock();
  if (storyIndex + 1 < storyQueue.length) {
    storyIndex++;
    renderStoryLine();
  } else {
    closeStoryCutscene();
  }
}

btnStoryNext.addEventListener('click', () => advanceStoryCutscene());
btnStorySkip.addEventListener('click', () => {
  audio.unlock();
  closeStoryCutscene();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && qrModalOverlay && !qrModalOverlay.classList.contains('hidden')) {
    e.preventDefault();
    qrModalOverlay.classList.add('hidden');
    return;
  }
  if (storyDialogueOpen) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'KeyZ') {
      e.preventDefault();
      advanceStoryCutscene();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeStoryCutscene();
      return;
    }
  }
  if (e.key === 'Escape' && !menuOpen && !lobbyOpen && !resultShown) {
    if (shopOpen) {
      shopOpen = false;
      shopOverlay.classList.add('hidden');
    } else if (!buffModalOpen && !ultModalOpen) {
      if (pauseOpen) closePauseMenu();
      else openPauseMenu();
    }
  }
  if (state.mode === 'sandbox' && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4')) {
    const ults: UltType[] = ['gasing', 'petir', 'mercon', 'naga'];
    const idx = parseInt(e.key, 10) - 1;
    const chosen = ults[idx];
    const player = getLocalPlayer();
    if (player && chosen) {
      player.ultType = chosen;
      player.ult = player.maxUlt;
      haptic.tap();
      const def = ULT_DEFS[chosen];
      sandboxSkillsBar?.querySelectorAll('.sandbox-skill-btn[data-ult]').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.ult === chosen);
      });
      state.soundQueue.push('pickup_kopi');
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 58,
        vy: -50,
        text: `JURUS: ${def.title.toUpperCase()}! ${def.icon}`,
        color: '#facc15',
        scale: 1.2,
        life: 1.3,
        maxLife: 1.3,
      });
    }
  }
});

function openMenu(): void {
  setStickMode(false);
  releaseScreenWakeLock();
  localPeer.disconnect();
  state.shakeTimer = 0;
  state.shakeIntensity = 0;
  state.hitstopTimer = 0;
  menuOpen = true;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  ultModalOpen = false;
  pauseOpen = false;
  storyDialogueOpen = false;
  resultShown = false;
  refreshMenuProgress();
  showMenuView('home');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  ultOverlay.classList.add('hidden');
  sandboxSkillsBar?.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  storyDialogueOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  menuOverlay.classList.remove('hidden');
}

function openLobby(): void {
  audio.unlock();
  menuOpen = false;
  lobbyOpen = true;
  shopOpen = false;
  buffModalOpen = false;
  ultModalOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  ultOverlay.classList.add('hidden');
  sandboxSkillsBar?.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  brawlVictoryOverlay?.classList.add('hidden');
  lobbyOverlay.classList.remove('hidden');
  selectHero(selectedHeroId);
  setMabarGameType(localPeer.connected ? localPeer.gameMode : selectedGameMode);
  setLocalPlayStyle(selectedHostRole);
  renderLobbyRoster(localPeer.roomCode, localPeer.lobbyPlayers, localPeer.localPlayerId, localPeer.isHost, localPeer.gameMode);
}

btnCloseLobby?.addEventListener('click', () => {
  openMenu();
});

function startStoryStage(stage: 1 | 2 | 3): void {
  audio.unlock();
  triggerAutoFullscreenIfEnabled();
  setStickMode(false);
  localPeer.disconnect();
  state = createStoryState(stage, selectedPalette, playerName);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  ultModalOpen = false;
  pauseOpen = false;
  storyBossShown = false;
  storyOutroDone = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  ultOverlay.classList.add('hidden');
  sandboxSkillsBar?.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  brawlVictoryOverlay?.classList.add('hidden');
  openStoryCutscene('intro');
  void requestScreenWakeLock();
}

function startSoloSurvival(): void {
  audio.unlock();
  triggerAutoFullscreenIfEnabled();
  setStickMode(false);
  localPeer.disconnect();
  state = createSurvivalState(selectedPalette, undefined, playerName);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  ultModalOpen = false;
  pauseOpen = false;
  storyDialogueOpen = false;
  lastBuffSig = '';
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  ultOverlay.classList.add('hidden');
  sandboxSkillsBar?.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  storyDialogueOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  brawlVictoryOverlay?.classList.add('hidden');
  void requestScreenWakeLock();
}

function startSoloBrawl(): void {
  audio.unlock();
  triggerAutoFullscreenIfEnabled();
  setStickMode(false);
  localPeer.disconnect();

  const heroKeys: HeroId[] = ['mat_clurit', 'bambang', 'gus_dimas', 'pak_rt', 'mbak_sri'];
  const otherHeroes = heroKeys.filter((h) => h !== selectedHeroId).slice(0, 3);
  if (otherHeroes.length < 3) otherHeroes.push('bima');

  const roster: BrawlRosterMember[] = [
    {
      id: 'p1',
      name: playerName || 'Cak Bima',
      paletteIndex: selectedPalette,
      heroId: selectedHeroId,
      isBot: false,
    },
    {
      id: 'p2',
      name: `BOT ${getHeroDef(otherHeroes[0]).name.replace('Cak ', '').replace('Bang ', '')}`,
      paletteIndex: (selectedPalette + 1) % 6,
      heroId: otherHeroes[0],
      isBot: true,
    },
    {
      id: 'p3',
      name: `BOT ${getHeroDef(otherHeroes[1]).name.replace('Cak ', '').replace('Bang ', '')}`,
      paletteIndex: (selectedPalette + 2) % 6,
      heroId: otherHeroes[1],
      isBot: true,
    },
    {
      id: 'p4',
      name: `BOT ${getHeroDef(otherHeroes[2]).name.replace('Cak ', '').replace('Bang ', '')}`,
      paletteIndex: (selectedPalette + 3) % 6,
      heroId: otherHeroes[2],
      isBot: true,
    },
  ];

  state = createBrawlState(roster);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  ultModalOpen = false;
  pauseOpen = false;
  storyDialogueOpen = false;
  lastBuffSig = '';
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  ultOverlay.classList.add('hidden');
  sandboxSkillsBar?.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  storyDialogueOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  brawlVictoryOverlay?.classList.add('hidden');
  void requestScreenWakeLock();
}

function startSandbox(): void {
  audio.unlock();
  triggerAutoFullscreenIfEnabled();
  setStickMode(false);
  localPeer.disconnect();
  state = createSandboxState(selectedPalette, playerName);
  const p0 = state.players[0];
  if (p0) {
    p0.ult = p0.maxUlt;
  }
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  ultModalOpen = false;
  pauseOpen = false;
  storyDialogueOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  ultOverlay.classList.add('hidden');
  sandboxSkillsBar?.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  storyDialogueOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  void requestScreenWakeLock();
}

// Menu Buttons
document.getElementById('btn-open-story')!.addEventListener('click', () => {
  audio.unlock();
  refreshMenuProgress();
  showMenuView('story');
});

document.getElementById('btn-open-credits')!.addEventListener('click', () => {
  audio.unlock();
  showMenuView('credits');
});

document.getElementById('btn-open-changelog')!.addEventListener('click', () => {
  audio.unlock();
  showMenuView('changelog');
});

document.getElementById('btn-back-home-story')!.addEventListener('click', () => showMenuView('home'));
document.getElementById('btn-back-home-credits')!.addEventListener('click', () => showMenuView('home'));
document.getElementById('btn-back-home-changelog')!.addEventListener('click', () => showMenuView('home'));

document.querySelectorAll<HTMLButtonElement>('.stage-btn[data-stage]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const stageNum = Number(btn.dataset.stage) as 1 | 2 | 3;
    startStoryStage(stageNum);
  });
});

document.getElementById('btn-quick-survival')?.addEventListener('click', () => {
  audio.unlock();
  startSoloSurvival();
});

document.getElementById('btn-play-survival')!.addEventListener('click', () => startSoloSurvival());
btnPlayBrawl?.addEventListener('click', () => startSoloBrawl());
document.getElementById('btn-play-sandbox')!.addEventListener('click', () => startSandbox());

document.getElementById('btn-unlock-all')!.addEventListener('click', () => {
  saveStageCleared(1);
  saveStageCleared(2);
  refreshMenuProgress();
});

// Shop & Ultimate Jurus Buttons
document.querySelectorAll<HTMLButtonElement>('.shop-item-btn[data-item], .shop-ult-btn[data-item]').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    const itemId = btn.dataset.item as ShopItemId;
    const player = getLocalPlayer();
    if (!player) return;
    const res = buyShopItem(state, player, itemId);
    shopFeedbackEl.textContent = res.message;
    shopFeedbackEl.style.color = res.ok ? '#4ade80' : '#f87171';
    audio.playQueue(state.soundQueue);
    state.soundQueue.length = 0;
    refreshShopUI();
  });
});

btnSkipIntermission.addEventListener('click', () => {
  audio.unlock();
  skipIntermission(state);
  shopOpen = false;
  shopOverlay.classList.add('hidden');
});

document.getElementById('btn-close-shop')!.addEventListener('click', () => {
  shopOpen = false;
  shopOverlay.classList.add('hidden');
});

// Result Buttons
btnNextStage.addEventListener('click', () => {
  if (state.stageNumber < 3) {
    startStoryStage((state.stageNumber + 1) as 1 | 2 | 3);
  } else {
    openMenu();
  }
});

btnRetryStage.addEventListener('click', () => {
  if (state.mode === 'story') {
    startStoryStage(state.stageNumber);
  } else if (state.mode === 'survival') {
    if (localPeer.connected && localPeer.isHost) {
      localPeer.sendStartGame();
    } else {
      startSoloSurvival();
    }
  } else if (state.mode === 'brawl') {
    if (localPeer.connected && localPeer.isHost) {
      localPeer.sendStartGame();
    } else {
      startSoloBrawl();
    }
  } else {
    startSandbox();
  }
});

btnBackMenu.addEventListener('click', () => openMenu());

btnBrawlRematch?.addEventListener('click', () => {
  brawlVictoryOverlay?.classList.add('hidden');
  if (localPeer.connected && localPeer.isHost) {
    localPeer.sendStartGame();
  } else {
    startSoloBrawl();
  }
});

btnBrawlLobby?.addEventListener('click', () => {
  brawlVictoryOverlay?.classList.add('hidden');
  openLobby();
});

btnBrawlQuit?.addEventListener('click', () => {
  brawlVictoryOverlay?.classList.add('hidden');
  openMenu();
});

const touchHandle = bindTouchControls(
  input,
  () => {
    if (state.mode === 'survival') {
      toggleWarung();
    } else {
      const player = getLocalPlayer();
      if (player) {
        state.floatingTexts.push({
          x: player.x,
          y: player.y - player.z - 54,
          vy: -40,
          text: 'WARUNG AKTIF DI MODE SURVIVAL!',
          color: '#fde047',
          scale: 0.92,
          life: 1.1,
          maxLife: 1.1,
        });
      }
    }
  },
  () => {
    void requestScreenWakeLock();
  }
);

// Settings & Pause Touch Mode Sync
const setTouchGroup = document.getElementById('set-touch-group');
function syncTouchModeUI(mode: TouchDisplayMode) {
  if (setTouchGroup) {
    setTouchGroup.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.touch === mode);
    });
  }
  if (pauseTouchStateText) {
    pauseTouchStateText.textContent =
      mode === 'auto' ? 'OTOMATIS' : mode === 'on' ? 'SELALU TAMPIL' : 'SEMBUNYIKAN';
  }
  if (btnTouch) {
    btnTouch.classList.toggle('muted', !touchHandle.isTouchActive());
  }
}

setTouchGroup?.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.touch as TouchDisplayMode;
    if (mode) {
      touchHandle.setTouchMode(mode);
      syncTouchModeUI(mode);
    }
  });
});

btnPauseToggleTouch?.addEventListener('click', () => {
  const current = touchHandle.getTouchMode();
  const next: TouchDisplayMode = current === 'auto' ? 'on' : current === 'on' ? 'off' : 'auto';
  touchHandle.setTouchMode(next);
  syncTouchModeUI(next);
});

// 10-Wave Jurus Ultimate Picker Modal Buttons
ultOverlay.querySelectorAll<HTMLButtonElement>('.ult-card-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    const uType = btn.dataset.ult as UltType;
    if (uType) {
      pickUltChoice(uType);
    }
  });
});

// Camp Latihan (Sandbox) Jurus Tester Dock
if (sandboxSkillsBar) {
  sandboxSkillsBar.querySelectorAll<HTMLButtonElement>('.sandbox-skill-btn[data-ult]').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.unlock();
      haptic.tap();
      const uType = btn.dataset.ult as UltType;
      const player = getLocalPlayer();
      if (player && uType) {
        player.ultType = uType;
        player.ult = player.maxUlt;
        sandboxSkillsBar.querySelectorAll('.sandbox-skill-btn[data-ult]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const def = ULT_DEFS[uType];
        state.soundQueue.push('pickup_kopi');
        state.floatingTexts.push({
          x: player.x,
          y: player.y - player.z - 58,
          vy: -50,
          text: `JURUS: ${def.title.toUpperCase()}! ${def.icon}`,
          color: '#facc15',
          scale: 1.2,
          life: 1.3,
          maxLife: 1.3,
        });
      }
    });
  });

  document.getElementById('btn-sandbox-refill')?.addEventListener('click', () => {
    audio.unlock();
    haptic.ultimate();
    const player = getLocalPlayer();
    if (player) {
      player.ult = player.maxUlt;
      state.soundQueue.push('pickup_kopi');
      state.floatingTexts.push({
        x: player.x,
        y: player.y - player.z - 54,
        vy: -40,
        text: '🔥 BAR ULTIMATE 100%!',
        color: '#fde047',
        scale: 1.1,
        life: 1.1,
        maxLife: 1.1,
      });
    }
  });
}

syncSelectedSkin(selectedPalette);

btnWarungHud.addEventListener('click', () => {
  audio.unlock();
  toggleWarung();
});

btnMenu.addEventListener('click', () => {
  audio.unlock();
  openPauseMenu();
});

btnPalette?.addEventListener('click', () => {
  audio.unlock();
  syncSelectedSkin((selectedPalette + 1) % PLAYER_PALETTES.length);
  const pal = PLAYER_PALETTES[selectedPalette];
  const player = getLocalPlayer();
  if (player) {
    state.floatingTexts.push({
      x: player.x,
      y: player.y - player.z - 54,
      vy: -45,
      text: pal.name.toUpperCase(),
      color: '#fde047',
      scale: 0.92,
      life: 1.0,
      maxLife: 1.0,
    });
  }
});

btnTouch?.addEventListener('click', () => {
  audio.unlock();
  const active = touchHandle.toggleTouchOverlay();
  btnTouch?.classList.toggle('muted', !active);
  syncTouchModeUI(touchHandle.getTouchMode());
});

syncTouchModeUI(touchHandle.getTouchMode());

btnSfx?.addEventListener('click', () => {
  audio.unlock();
  const muted = audio.toggleSfx();
  btnSfx?.classList.toggle('muted', muted);
});

if (btnBgm) {
  btnBgm.classList.add('muted');
  btnBgm.addEventListener('click', () => {
    const enabled = audio.toggleBgm();
    btnBgm?.classList.toggle('muted', !enabled);
  });
}

async function lockLandscapeOrientation(): Promise<void> {
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
    if (screen.orientation && 'lock' in screen.orientation) {
      await (screen.orientation as any).lock('landscape').catch(() => {});
    }
  } catch {}
}

btnForceLandscape?.addEventListener('click', () => {
  audio.unlock();
  void lockLandscapeOrientation();
});

function showResultIfNeeded(): void {
  if (resultShown || state.status === 'playing' || storyDialogueOpen) return;
  resultShown = true;
  state.shakeTimer = 0;
  state.shakeIntensity = 0;
  state.hitstopTimer = 0;
  shopOpen = false;
  buffModalOpen = false;
  ultModalOpen = false;
  pauseOpen = false;
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  ultOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');

  btnRetryStage.textContent = localPeer.connected && localPeer.isHost ? 'MAIN LAGI (HOST)' : 'MAIN LAGI';

  if (state.mode === 'brawl') {
    showBrawlVictoryModal();
    return;
  }

  if (state.mode === 'survival' && state.survival) {
    saveBestWave(state.survival.wave);
  }
  refreshMenuProgress();

  if (state.status === 'victory') {
    haptic.victory();
    resultEyebrow.textContent = `STAGE ${state.stageNumber} CLEAR!`;
    resultTitle.textContent =
      state.stageNumber === 3 ? 'JUARA SUROBOYO REK!' : 'MANTAP POLL CAK!';
    resultDesc.textContent =
      state.stageNumber === 3
        ? `Raja Sarung Baja Suramadu tumbang! Total KO: ${state.koCount}`
        : `Stage ${state.stageNumber} beres! Stage ${state.stageNumber + 1} sudah terbuka. Total KO: ${state.koCount}`;
    btnNextStage.classList.toggle('hidden', state.stageNumber >= 3);
  } else if (state.mode === 'survival' && state.survival) {
    resultEyebrow.textContent = 'SURVIVAL GAME OVER';
    resultTitle.textContent = `BERTAHAN SAMPAI WAVE ${state.survival.wave}!`;
    resultDesc.textContent =
      state.survival.core.hp <= 0
        ? `Pos Warkop Pusat jebol diserbu zombie! Total KO: ${state.koCount}`
        : `Arek Suroboyo tumbang di Wave ${state.survival.wave}! Total KO: ${state.koCount}`;
    btnNextStage.classList.add('hidden');
  } else {
    resultEyebrow.textContent = 'GAME OVER';
    resultTitle.textContent = 'TUMBANG CAK!';
    resultDesc.textContent = `Ojo nyerah rek! Coba maneh ning Stage ${state.stageNumber}. Total KO: ${state.koCount}`;
    btnNextStage.classList.add('hidden');
  }

  resultOverlay.classList.remove('hidden');
}

function showBrawlVictoryModal(): void {
  const br = state.brawl;
  if (!br) return;
  haptic.victory();

  const sorted = [...state.players].sort((a, b) => {
    const sA = a.brawlStocks ?? 0;
    const sB = b.brawlStocks ?? 0;
    if (sB !== sA) return sB - sA;
    return (b.brawlKos ?? 0) - (a.brawlKos ?? 0);
  });

  const winner = sorted[0];
  const hero = getHeroDef(winner?.heroId);

  if (brawlWinnerTitle) brawlWinnerTitle.textContent = `${winner?.name || 'AREK'} JUARA TAWURAN!`;
  if (brawlWinnerAvatar) brawlWinnerAvatar.textContent = hero.avatar;
  if (brawlWinnerName) brawlWinnerName.textContent = winner?.name || hero.name;
  if (brawlWinnerAlias) brawlWinnerAlias.textContent = hero.alias;
  if (brawlWinnerTagline) brawlWinnerTagline.textContent = `"${hero.tagline}"`;

  if (brawlPodiumRoster) {
    const medals = ['🥇 1ST', '🥈 2ND', '🥉 3RD', '4TH', '5TH', '6TH'];
    brawlPodiumRoster.innerHTML = sorted
      .map((p, idx) => {
        const h = getHeroDef(p.heroId);
        const pal = PLAYER_PALETTES[p.paletteIndex % PLAYER_PALETTES.length];
        const stocks = p.brawlStocks ?? 0;
        const kos = p.brawlKos ?? 0;
        const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
        return `<div class="brawl-podium-item ${rankClass}">
          <div class="brawl-podium-player">
            <span class="brawl-rank-badge">${medals[idx] || `${idx + 1}TH`}</span>
            <span class="roster-dot" style="background:${pal.accent}"></span>
            <span>${h.avatar} <b>${p.name}</b></span>
          </div>
          <div class="brawl-podium-stats">
            <span>❤️ x ${stocks}</span>
            <span>⚔️ ${kos} KO</span>
          </div>
        </div>`;
      })
      .join('');
  }

  brawlVictoryOverlay?.classList.remove('hidden');
}

// Adaptive 16:9 Canvas Fit
function resizeCanvas(): void {
  const rect = stageWrap.getBoundingClientRect();
  const aspect = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
  let displayW = rect.width;
  let displayH = displayW / aspect;

  if (displayH > rect.height) {
    displayH = rect.height;
    displayW = displayH * aspect;
  }

  canvas.style.width = `${Math.floor(displayW)}px`;
  canvas.style.height = `${Math.floor(displayH)}px`;

  const isTouchDevice =
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  const maxDpr = isTouchDevice
    ? (gfxQuality === 'low' ? 1.0 : gfxQuality === 'high' ? 1.25 : 1.1)
    : (gfxQuality === 'low' ? 1.0 : gfxQuality === 'high' ? 1.5 : 1.25);
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const targetW = Math.round(VIRTUAL_WIDTH * dpr);
  const targetH = Math.round(VIRTUAL_HEIGHT * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 80));
resizeCanvas();
refreshMenuProgress();

// Check URL query parameters for auto joining room
const urlParams = new URLSearchParams(window.location.search);
const inviteRoom = urlParams.get('room');
const inviteRole = urlParams.get('role');
const autoJoin = urlParams.get('autojoin') === '1';

if (inviteRoom && inviteRoom.trim().length === 4) {
  const code = inviteRoom.trim().toUpperCase();
  inputRoomCode.value = code;
  if (inviteRole === 'stick') {
    btnRoleStick.click();
  } else {
    btnRoleCoop.click();
  }
  openLobby();

  if (autoJoin) {
    if (lobbyStatusEl) {
      lobbyStatusEl.textContent = `⚡ Link terdeteksi! Menggabungkan ke Room ${code}...`;
      lobbyStatusEl.style.color = '#38bdf8';
    }
    setTimeout(() => {
      audio.unlock();
      triggerAutoFullscreenIfEnabled();
      localPeer.joinRoom(code, selectedJoinRole, playerName, selectedPalette);
    }, 400);
  }
}

// Fixed-timestep 60Hz Loop + Network Sync
let lastTime = performance.now();
let accumulator = 0;
let fpsFrames = 0;
let fpsLastSample = performance.now();
let currentFps = 60;
let snapSeq = 0;
let snapAccum = 0;

function frame(now: number): void {
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += delta;

  fpsFrames++;
  if (now - fpsLastSample >= 500) {
    currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastSample));
    fpsFrames = 0;
    fpsLastSample = now;
  }

  while (accumulator >= FIXED_DT) {
    const sampled = input.sample();
    if (
      sampled.shopPressed &&
      state.mode === 'survival' &&
      !menuOpen &&
      !lobbyOpen &&
      !buffModalOpen &&
      !ultModalOpen &&
      state.status === 'playing'
    ) {
      toggleWarung();
    }

    if (menuOpen || lobbyOpen) {
      state.time += FIXED_DT;
    }

    if (!menuOpen && !lobbyOpen && state.status === 'playing') {
      if (localPeer.connected && !localPeer.isHost) {
        // Client: Send input to Host via WebRTC UDP DataChannel
        localPeer.sendInput(sampled);
        if (localPeer.localRole === 'stick') {
          updateStickHud();
        }
      } else if (localPeer.connected && localPeer.isHost) {
        // Host: Simulate game with all player inputs
        const allInputs: Record<string, PlayerInput> = {};
        if (localPeer.localRole !== 'monitor') {
          allInputs[localPeer.localPlayerId] =
            shopOpen || buffModalOpen || ultModalOpen || pauseOpen || storyDialogueOpen
              ? {
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
                }
              : sampled;
        }

        for (const p of state.players) {
          if (p.id === localPeer.localPlayerId) continue;
          const rem = localPeer.clientInputs.get(p.id);
          if (rem) allInputs[p.id] = rem;
        }

        if (state.mode === 'brawl') {
          stepBrawl(state, allInputs, FIXED_DT);
        } else {
          stepSurvival(state, allInputs, FIXED_DT);

          // Check Milestone Buffs & Jurus for players
          for (const p of state.players) {
            if (p.id === localPeer.localPlayerId) {
              checkPendingBuffModal();
              checkPendingUltModal();
            } else {
              if (p.pendingBuffChoices.length > 0) {
                localPeer.promptClientSkill(p.id, 'buff', p.pendingBuffChoices);
                p.pendingBuffChoices = [];
              }
              if (p.pendingUltChoice) {
                localPeer.promptClientSkill(p.id, 'ult', ['gasing', 'petir', 'mercon', 'naga']);
                p.pendingUltChoice = false;
              }
            }
          }
        }

        if (state.soundQueue.includes('player_hurt')) {
          haptic.damage();
        }
        audio.playQueue(state.soundQueue);

        // Broadcast snapshot at 25Hz (0.04s) for ultra fluid 60 FPS replication
        snapAccum += FIXED_DT;
        if (snapAccum >= 0.04 || state.status !== 'playing') {
          snapAccum = 0;
          snapSeq++;
          const snap = packGameSnapshot(state, snapSeq);
          localPeer.broadcastSnapshot(snap);
          state.soundQueue.length = 0;
        }

        if (state.status !== 'playing') {
          state.shakeTimer = 0;
          state.shakeIntensity = 0;
          state.hitstopTimer = 0;
          showResultIfNeeded();
        }
      } else if (!shopOpen && !buffModalOpen && !ultModalOpen && !pauseOpen && !storyDialogueOpen) {
        // Offline Solo Mode
        if (state.mode === 'story') {
          stepStory(state, sampled, FIXED_DT);
          if (!storyBossShown && state.storyZones?.some((z) => z.isBossZone && z.triggered && !z.cleared)) {
            storyBossShown = true;
            openStoryCutscene('boss');
          }
          const storyStatus = (state as GameState).status;
          if (storyStatus === 'victory' && !storyOutroDone) {
            storyOutroDone = true;
            openStoryCutscene('outro');
          }
        } else if (state.mode === 'survival') {
          stepSurvival(state, sampled, FIXED_DT);
          checkPendingBuffModal();
          checkPendingUltModal();
        } else if (state.mode === 'brawl') {
          stepBrawl(state, { p1: sampled }, FIXED_DT);
        } else {
          stepSandbox(state, sampled, FIXED_DT);
        }

        if (state.soundQueue.includes('player_hurt')) {
          haptic.damage();
        }
        audio.playQueue(state.soundQueue);
        if (state.status !== 'playing') {
          state.shakeTimer = 0;
          state.shakeIntensity = 0;
          state.hitstopTimer = 0;
        }
        showResultIfNeeded();
      }
    }
    accumulator -= FIXED_DT;
  }

  if (localPeer.localRole !== 'stick') {
    renderGame(ctx, state, localPeer.localPlayerId, localPeer.localRole === 'monitor');
  }

  if (sandboxSkillsBar) {
    const isSandboxActive =
      state.mode === 'sandbox' &&
      state.status === 'playing' &&
      !menuOpen &&
      !lobbyOpen &&
      !pauseOpen &&
      !resultShown;
    sandboxSkillsBar.classList.toggle('hidden', !isSandboxActive);
    sandboxSkillsBar.style.display = isSandboxActive ? 'flex' : 'none';
  }

  const perfText = localPeer.connected
    ? `${currentFps} FPS • ${localPeer.pingMs}ms LAN`
    : `${currentFps} FPS`;
  hud.update(
    state,
    localPeer.localPlayerId,
    perfText,
    localPeer.connected && localPeer.localRole === 'monitor'
  );
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
