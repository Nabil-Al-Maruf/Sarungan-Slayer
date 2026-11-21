import './style.css';
import { ProceduralAudio } from './audio/sfx';
import { FIXED_DT, PLAYER_PALETTES, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './core/constants';
import { InputManager } from './core/input';
import type { GameState, PlayerInput } from './core/types';
import { createSandboxState, stepSandbox } from './modes/sandbox';
import {
  createStoryState,
  loadStoryProgress,
  saveStageCleared,
  stepStory,
} from './modes/story';
import {
  buyShopItem,
  canOpenWarung,
  createSurvivalState,
  getBarricadeActionInfo,
  loadBestWave,
  saveBestWave,
  skipIntermission,
  stepSurvival,
  type ShopItemId,
} from './modes/survival';
import { PeerManager, type LobbyPlayer } from './net/peerManager';
import { renderGame } from './render/renderer';
import { HudController } from './ui/hud';
import { bindTouchControls } from './ui/touchControls';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const stageWrap = document.getElementById('stage-wrap') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;

const audio = new ProceduralAudio();
const input = new InputManager(() => audio.unlock());
const hud = new HudController();

let selectedPalette = 0;
let state: GameState = createStoryState(1, selectedPalette);
let menuOpen = true;
let lobbyOpen = false;
let shopOpen = false;
let resultShown = false;
let snapshotAccum = 0;
let clientInputAccum = 0;

// Overlay DOM references
const menuOverlay = document.getElementById('menu-overlay') as HTMLDivElement;
const menuHomeView = document.getElementById('menu-home-view') as HTMLDivElement;
const menuStoryView = document.getElementById('menu-story-view') as HTMLDivElement;
const menuCreditsView = document.getElementById('menu-credits-view') as HTMLDivElement;
const menuChangelogView = document.getElementById('menu-changelog-view') as HTMLDivElement;
const lobbyOverlay = document.getElementById('lobby-overlay') as HTMLDivElement;
const shopOverlay = document.getElementById('shop-overlay') as HTMLDivElement;
const resultOverlay = document.getElementById('result-overlay') as HTMLDivElement;
const resultEyebrow = document.getElementById('result-eyebrow') as HTMLDivElement;
const resultTitle = document.getElementById('result-title') as HTMLHeadingElement;
const resultDesc = document.getElementById('result-desc') as HTMLParagraphElement;
const btnNextStage = document.getElementById('btn-next-stage') as HTMLButtonElement;
const btnRetryStage = document.getElementById('btn-retry-stage') as HTMLButtonElement;
const btnBackMenu = document.getElementById('btn-back-menu') as HTMLButtonElement;
const menuBestWaveEl = document.getElementById('menu-best-wave') as HTMLSpanElement;

// Lobby DOM references
const lobbyStatusEl = document.getElementById('lobby-status') as HTMLParagraphElement;
const hostCodeWrap = document.getElementById('host-code-wrap') as HTMLDivElement;
const lobbyRoomCodeEl = document.getElementById('lobby-room-code') as HTMLDivElement;
const inputRoomCode = document.getElementById('input-room-code') as HTMLInputElement;
const lobbyRosterEl = document.getElementById('lobby-roster') as HTMLDivElement;
const lobbyPlayerCountEl = document.getElementById('lobby-player-count') as HTMLSpanElement;
const btnStartMabar = document.getElementById('btn-start-mabar') as HTMLButtonElement;

// Shop DOM references
const shopCoinsEl = document.getElementById('shop-coins') as HTMLElement;
const shopTicketsEl = document.getElementById('shop-tickets') as HTMLElement;
const shopFeedbackEl = document.getElementById('shop-feedback') as HTMLDivElement;
const btnSkipIntermission = document.getElementById('btn-skip-intermission') as HTMLButtonElement;

// ===== PEERJS MULTIPLAYER MANAGER =====
const peerMgr = new PeerManager({
  onStatus(text, isError) {
    lobbyStatusEl.textContent = text;
    lobbyStatusEl.style.color = isError ? '#f87171' : '#94a3b8';
  },
  onLobbyUpdate(roomCode, players, localId) {
    renderLobbyRoster(roomCode, players, localId);
  },
  onGameStart() {
    audio.unlock();
    menuOpen = false;
    lobbyOpen = false;
    shopOpen = false;
    resultShown = false;
    menuOverlay.classList.add('hidden');
    lobbyOverlay.classList.add('hidden');
    shopOverlay.classList.add('hidden');
    resultOverlay.classList.add('hidden');
  },
  onSnapshot(remoteState) {
    if (remoteState.status !== 'playing') {
      remoteState.shakeTimer = 0;
      remoteState.shakeIntensity = 0;
      remoteState.hitstopTimer = 0;
    }
    state = remoteState;
    if (state.soundQueue.length > 0) {
      audio.playQueue(state.soundQueue);
    }
    if (shopOpen) {
      refreshShopUI();
    }
    showResultIfNeeded();
  },
  onClientBuy(playerId, itemId) {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p) return { ok: false, message: 'Pemain tidak ditemukan' };
    return buyShopItem(state, p, itemId);
  },
  onClientSkipIntermission() {
    skipIntermission(state);
  },
  onShopResult(ok, message) {
    shopFeedbackEl.textContent = message;
    shopFeedbackEl.style.color = ok ? '#4ade80' : '#f87171';
    refreshShopUI();
  },
  onHostDisconnect() {
    state.shakeTimer = 0;
    state.shakeIntensity = 0;
    state.hitstopTimer = 0;
    shopOpen = false;
    resultShown = false;
    openLobby();
    lobbyStatusEl.textContent = 'Host keluar dari room — permainan berakhir.';
    lobbyStatusEl.style.color = '#f87171';
  },
});

function getLocalPlayer() {
  return state.players.find((p) => p.id === peerMgr.localPlayerId) ?? state.players[0];
}

function renderLobbyRoster(roomCode: string, players: LobbyPlayer[], localId: string): void {
  if (peerMgr.role === 'host' && roomCode) {
    hostCodeWrap.classList.remove('hidden');
    lobbyRoomCodeEl.textContent = roomCode;
    btnStartMabar.classList.remove('hidden');
  } else {
    hostCodeWrap.classList.add('hidden');
    btnStartMabar.classList.add('hidden');
  }

  lobbyPlayerCountEl.textContent = `${players.length}/5`;
  if (players.length === 0) {
    lobbyRosterEl.innerHTML = '<div class="roster-empty">Belum ada room aktif.</div>';
    return;
  }

  lobbyRosterEl.innerHTML = players
    .map((p) => {
      const pal = PLAYER_PALETTES[p.paletteIndex % PLAYER_PALETTES.length];
      const you = p.id === localId ? ' (KAMU)' : '';
      return `<div class="roster-chip"><span class="roster-dot" style="background:${pal.accent}"></span>${p.name}${you}</div>`;
    })
    .join('');
}

function refreshMenuProgress(): void {
  const prog = loadStoryProgress();
  ([1, 2, 3] as const).forEach((num) => {
    const btn = document.getElementById(`btn-stage-${num}`) as HTMLButtonElement;
    const statusEl = document.getElementById(`status-stage-${num}`) as HTMLSpanElement;
    const unlocked = num <= prog.unlockedStage;
    const cleared = prog.clearedStages.includes(num);

    btn.disabled = !unlocked;
    statusEl.classList.toggle('cleared', cleared);
    statusEl.textContent = cleared ? 'SELESAI ✓' : unlocked ? 'TERBUKA' : 'TERKUNCI';
  });

  const bestWave = loadBestWave();
  menuBestWaveEl.textContent = bestWave > 0 ? `(REKOR: W${bestWave})` : '';
}

function refreshShopUI(): void {
  const surv = state.survival;
  const player = getLocalPlayer();
  if (!surv || !player) return;

  shopCoinsEl.textContent = `${player.coins} Receh`;
  shopTicketsEl.textContent = `${player.reviveTickets}`;
  btnSkipIntermission.classList.toggle('hidden', surv.phase !== 'intermission');

  for (const bar of surv.barricades) {
    const info = getBarricadeActionInfo(bar);
    const btn = document.getElementById(`shop-bar-${bar.id}`) as HTMLButtonElement | null;
    const descEl = document.getElementById(`shop-bar-${bar.id}-desc`);
    const costEl = document.getElementById(`shop-bar-${bar.id}-cost`);
    if (btn) btn.disabled = info.disabled;
    if (descEl) {
      descEl.textContent = `HP ${Math.ceil(bar.hp)}/${bar.maxHp} • ${info.actionLabel}`;
    }
    if (costEl) {
      costEl.textContent = info.disabled ? 'MAX' : `${info.cost} Receh`;
    }
  }
}

function toggleWarung(): void {
  if (state.mode !== 'survival' || menuOpen || lobbyOpen || state.status !== 'playing') return;
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

function showMenuView(view: 'home' | 'story' | 'credits' | 'changelog'): void {
  menuHomeView.classList.toggle('hidden', view !== 'home');
  menuStoryView.classList.toggle('hidden', view !== 'story');
  menuCreditsView.classList.toggle('hidden', view !== 'credits');
  menuChangelogView.classList.toggle('hidden', view !== 'changelog');
}

function openMenu(): void {
  peerMgr.disconnect();
  menuOpen = true;
  lobbyOpen = false;
  shopOpen = false;
  resultShown = false;
  refreshMenuProgress();
  showMenuView('home');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  menuOverlay.classList.remove('hidden');
}

function openLobby(): void {
  audio.unlock();
  menuOpen = false;
  lobbyOpen = true;
  shopOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  lobbyOverlay.classList.remove('hidden');
  renderLobbyRoster(peerMgr.roomCode, peerMgr.lobbyPlayers, peerMgr.localPlayerId);
}

function startStoryStage(stage: 1 | 2 | 3): void {
  audio.unlock();
  peerMgr.disconnect();
  state = createStoryState(stage, selectedPalette);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
}

function startSurvival(mabarRoster?: LobbyPlayer[]): void {
  audio.unlock();
  if (!mabarRoster) {
    peerMgr.disconnect();
  }
  state = createSurvivalState(
    selectedPalette,
    mabarRoster?.map((p) => ({ id: p.id, paletteIndex: p.paletteIndex }))
  );
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
}

function startSandbox(): void {
  audio.unlock();
  peerMgr.disconnect();
  state = createSandboxState(selectedPalette);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
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

document.getElementById('btn-play-survival')!.addEventListener('click', () => startSurvival());
document.getElementById('btn-open-lobby')!.addEventListener('click', () => openLobby());
document.getElementById('btn-play-sandbox')!.addEventListener('click', () => startSandbox());

document.getElementById('btn-unlock-all')!.addEventListener('click', () => {
  saveStageCleared(1);
  saveStageCleared(2);
  refreshMenuProgress();
});

// Lobby Buttons
document.getElementById('btn-create-room')!.addEventListener('click', () => {
  audio.unlock();
  peerMgr.createRoom(selectedPalette);
});

document.getElementById('btn-copy-link')!.addEventListener('click', () => {
  if (!peerMgr.roomCode) return;
  const url = `${window.location.origin}${window.location.pathname}?room=${peerMgr.roomCode}`;
  navigator.clipboard?.writeText(url).catch(() => {});
  lobbyStatusEl.textContent = `Link undangan disalin: ${url}`;
  lobbyStatusEl.style.color = '#4ade80';
});

document.getElementById('btn-join-room')!.addEventListener('click', () => {
  audio.unlock();
  peerMgr.joinRoom(inputRoomCode.value);
});

inputRoomCode.addEventListener('input', () => {
  inputRoomCode.value = inputRoomCode.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
});

inputRoomCode.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    audio.unlock();
    peerMgr.joinRoom(inputRoomCode.value);
  }
});

btnStartMabar.addEventListener('click', () => {
  if (peerMgr.role !== 'host') return;
  startSurvival(peerMgr.lobbyPlayers);
  peerMgr.broadcastStartGame();
  peerMgr.broadcastSnapshot(state);
});

document.getElementById('btn-close-lobby')!.addEventListener('click', () => openMenu());

// Shop Buttons
document.querySelectorAll<HTMLButtonElement>('.shop-item-btn[data-item]').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    const itemId = btn.dataset.item as ShopItemId;

    if (peerMgr.role === 'client') {
      peerMgr.sendClientBuy(itemId);
      return;
    }

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
  if (peerMgr.role === 'client') {
    peerMgr.sendClientSkipIntermission();
  } else {
    skipIntermission(state);
  }
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
    if (peerMgr.role === 'host') {
      startSurvival(peerMgr.lobbyPlayers);
      peerMgr.broadcastStartGame();
      peerMgr.broadcastSnapshot(state);
    } else if (peerMgr.role === 'client') {
      peerMgr.disconnect();
      openLobby();
    } else {
      startSurvival();
    }
  } else {
    startSandbox();
  }
});

btnBackMenu.addEventListener('click', () => openMenu());

const { toggleTouchOverlay } = bindTouchControls(input, () => {
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
});

// HUD Quick Buttons
const btnWarungHud = document.getElementById('btn-warung-hud') as HTMLButtonElement;
const btnMenu = document.getElementById('btn-menu') as HTMLButtonElement;
const btnPalette = document.getElementById('btn-palette') as HTMLButtonElement;
const btnTouch = document.getElementById('btn-touch-toggle') as HTMLButtonElement;
const btnSfx = document.getElementById('btn-sfx') as HTMLButtonElement;
const btnBgm = document.getElementById('btn-bgm') as HTMLButtonElement;

btnWarungHud.addEventListener('click', () => {
  audio.unlock();
  toggleWarung();
});

btnMenu.addEventListener('click', () => {
  audio.unlock();
  openMenu();
});

btnPalette.addEventListener('click', () => {
  audio.unlock();
  selectedPalette = (selectedPalette + 1) % PLAYER_PALETTES.length;
  const pal = PLAYER_PALETTES[selectedPalette];
  btnPalette.textContent = pal.label;
  const player = getLocalPlayer();
  if (player && peerMgr.role !== 'client') {
    player.paletteIndex = selectedPalette;
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

btnTouch.addEventListener('click', () => {
  audio.unlock();
  const active = toggleTouchOverlay();
  btnTouch.classList.toggle('muted', !active);
});

btnSfx.addEventListener('click', () => {
  audio.unlock();
  const muted = audio.toggleSfx();
  btnSfx.classList.toggle('muted', muted);
});

btnBgm.classList.add('muted');
btnBgm.addEventListener('click', () => {
  const enabled = audio.toggleBgm();
  btnBgm.classList.toggle('muted', !enabled);
});

function showResultIfNeeded(): void {
  if (resultShown || state.status === 'playing') return;
  resultShown = true;
  state.shakeTimer = 0;
  state.shakeIntensity = 0;
  state.hitstopTimer = 0;
  shopOpen = false;
  shopOverlay.classList.add('hidden');
  btnRetryStage.textContent = peerMgr.role === 'client' ? 'KELUAR KE LOBI' : 'MAIN LAGI';

  if (state.mode === 'survival' && state.survival) {
    saveBestWave(state.survival.wave);
  }
  refreshMenuProgress();

  if (state.status === 'victory') {
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
        : `Tim Arek Suroboyo tumbang di Wave ${state.survival.wave}! Total KO: ${state.koCount}`;
    btnNextStage.classList.add('hidden');
  } else {
    resultEyebrow.textContent = 'GAME OVER';
    resultTitle.textContent = 'TUMBANG CAK!';
    resultDesc.textContent = `Ojo nyerah rek! Coba maneh ning Stage ${state.stageNumber}. Total KO: ${state.koCount}`;
    btnNextStage.classList.add('hidden');
  }

  resultOverlay.classList.remove('hidden');
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

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

// Auto-open Mabar Lobby if user opened an invite link (?room=XXXX)
const urlParams = new URLSearchParams(window.location.search);
const inviteRoom = urlParams.get('room');
if (inviteRoom && inviteRoom.trim().length === 4) {
  inputRoomCode.value = inviteRoom.trim().toUpperCase();
  openLobby();
  lobbyStatusEl.textContent = `Kode undangan ${inputRoomCode.value} terdeteksi! Klik GABUNG untuk masuk.`;
  lobbyStatusEl.style.color = '#4ade80';
}

// Fixed-timestep 60Hz Loop
let lastTime = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= FIXED_DT) {
    const sampled = input.sample();
    if (
      sampled.shopPressed &&
      state.mode === 'survival' &&
      !menuOpen &&
      !lobbyOpen &&
      state.status === 'playing'
    ) {
      toggleWarung();
    }

    if (menuOpen || lobbyOpen) {
      state.time += FIXED_DT;
    }

    if (!menuOpen && !lobbyOpen && state.status === 'playing') {
      if (peerMgr.role === 'client') {
        // Client sends input packets at ~30Hz to Host
        clientInputAccum += FIXED_DT;
        if (
          clientInputAccum >= 1 / 30 ||
          sampled.meleePressed ||
          sampled.projPressed ||
          sampled.jumpPressed ||
          sampled.dashPressed ||
          sampled.ultPressed
        ) {
          clientInputAccum = 0;
          peerMgr.sendClientInput(sampled);
        }
      } else {
        // Solo or Host authoritative simulation
        const isMultiplayerHost = peerMgr.role === 'host';
        if (!shopOpen || isMultiplayerHost) {
          if (state.mode === 'story') {
            stepStory(state, sampled, FIXED_DT);
          } else if (state.mode === 'survival') {
            if (isMultiplayerHost) {
              const allInputs: Record<string, PlayerInput> = {
                [peerMgr.localPlayerId]: shopOpen
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
                  : sampled,
              };
              for (const p of state.players) {
                if (p.id === peerMgr.localPlayerId) continue;
                const rem = peerMgr.getRemoteInput(p.id);
                if (rem) allInputs[p.id] = rem;
              }
              stepSurvival(state, allInputs, FIXED_DT);
            } else {
              stepSurvival(state, sampled, FIXED_DT);
            }
          } else {
            stepSandbox(state, sampled, FIXED_DT);
          }
          audio.playQueue(state.soundQueue);
          const endedNow = state.status !== 'playing';
          if (endedNow) {
            state.shakeTimer = 0;
            state.shakeIntensity = 0;
            state.hitstopTimer = 0;
          }
          showResultIfNeeded();
        }

        // Host broadcasts snapshot to Clients at 25Hz (or immediately on game end!)
        if (isMultiplayerHost) {
          snapshotAccum += FIXED_DT;
          if (snapshotAccum >= 0.04 || state.status !== 'playing') {
            snapshotAccum = 0;
            peerMgr.broadcastSnapshot(state);
          }
        }
      }
    }
    accumulator -= FIXED_DT;
  }

  renderGame(ctx, state);
  hud.update(state, peerMgr.localPlayerId);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
