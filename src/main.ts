import './style.css';
import { ProceduralAudio } from './audio/sfx';
import { FIXED_DT, PLAYER_PALETTES, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './core/constants';
import { InputManager } from './core/input';
import type { BuffId, GameState, PlayerInput } from './core/types';
import { createSandboxState, stepSandbox } from './modes/sandbox';
import {
  createStoryState,
  loadStoryProgress,
  saveStageCleared,
  stepStory,
} from './modes/story';
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
  type ShopItemId,
} from './modes/survival';
import {
  WsManager,
  type ConnectionMode,
  type LobbyPlayer,
  type LocalPlayStyle,
} from './net/wsManager';
import { renderGame } from './render/renderer';
import { HudController } from './ui/hud';
import { bindTouchControls } from './ui/touchControls';

const NAME_STORAGE_KEY = 'arek_slayer_player_name_v1';
const SKIN_STORAGE_KEY = 'arek_slayer_player_skin_v1';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const stageWrap = document.getElementById('stage-wrap') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;

const audio = new ProceduralAudio();
const input = new InputManager(() => audio.unlock());
const hud = new HudController();

let selectedPalette = Number(localStorage.getItem(SKIN_STORAGE_KEY) || '0') % PLAYER_PALETTES.length;
let playerName = (localStorage.getItem(NAME_STORAGE_KEY) || 'Cak Bima').slice(0, 14);

let state: GameState = createStoryState(1, selectedPalette, playerName);
let menuOpen = true;
let lobbyOpen = false;
let shopOpen = false;
let buffModalOpen = false;
let pauseOpen = false;
let resultShown = false;
let lastBuffSig = '';
let snapshotAccum = 0;

// Overlay DOM references
const menuOverlay = document.getElementById('menu-overlay') as HTMLDivElement;
const menuHomeView = document.getElementById('menu-home-view') as HTMLDivElement;
const menuStoryView = document.getElementById('menu-story-view') as HTMLDivElement;
const menuCreditsView = document.getElementById('menu-credits-view') as HTMLDivElement;
const menuChangelogView = document.getElementById('menu-changelog-view') as HTMLDivElement;
const lobbyOverlay = document.getElementById('lobby-overlay') as HTMLDivElement;
const shopOverlay = document.getElementById('shop-overlay') as HTMLDivElement;
const buffOverlay = document.getElementById('buff-overlay') as HTMLDivElement;
const buffChoicesGrid = document.getElementById('buff-choices-grid') as HTMLDivElement;
const pauseOverlay = document.getElementById('pause-overlay') as HTMLDivElement;
const pauseEyebrow = document.getElementById('pause-eyebrow') as HTMLDivElement;
const pauseSub = document.getElementById('pause-sub') as HTMLParagraphElement;
const btnPauseResume = document.getElementById('btn-pause-resume') as HTMLButtonElement;
const btnPauseRestart = document.getElementById('btn-pause-restart') as HTMLButtonElement;
const btnPauseQuit = document.getElementById('btn-pause-quit') as HTMLButtonElement;
const resultOverlay = document.getElementById('result-overlay') as HTMLDivElement;
const resultEyebrow = document.getElementById('result-eyebrow') as HTMLDivElement;
const resultTitle = document.getElementById('result-title') as HTMLHeadingElement;
const resultDesc = document.getElementById('result-desc') as HTMLParagraphElement;
const btnNextStage = document.getElementById('btn-next-stage') as HTMLButtonElement;
const btnRetryStage = document.getElementById('btn-retry-stage') as HTMLButtonElement;
const btnBackMenu = document.getElementById('btn-back-menu') as HTMLButtonElement;
const menuBestWaveEl = document.getElementById('menu-best-wave') as HTMLSpanElement;

// Profile & Lobby DOM references
const inputPlayerName = document.getElementById('input-player-name') as HTMLInputElement;
const inputLobbyName = document.getElementById('input-lobby-name') as HTMLInputElement;
const tabConnOnline = document.getElementById('tab-conn-online') as HTMLButtonElement;
const tabConnHotspot = document.getElementById('tab-conn-hotspot') as HTMLButtonElement;
const hotspotGuideEl = document.getElementById('hotspot-guide') as HTMLDivElement;
const inputHotspotIp = document.getElementById('input-hotspot-ip') as HTMLInputElement;
const labelHostModeEl = document.getElementById('label-host-mode') as HTMLSpanElement;
const btnCreateRoom = document.getElementById('btn-create-room') as HTMLButtonElement;
const lobbyStatusEl = document.getElementById('lobby-status') as HTMLParagraphElement;
const hostCodeWrap = document.getElementById('host-code-wrap') as HTMLDivElement;
const lobbyRoomCodeEl = document.getElementById('lobby-room-code') as HTMLDivElement;
const inputRoomCode = document.getElementById('input-room-code') as HTMLInputElement;
const lobbyRosterEl = document.getElementById('lobby-roster') as HTMLDivElement;
const lobbyPlayerCountEl = document.getElementById('lobby-player-count') as HTMLSpanElement;
const btnStartMabar = document.getElementById('btn-start-mabar') as HTMLButtonElement;
const appShellEl = document.querySelector('.app-shell') as HTMLDivElement;
const localStyleNormalBtn = document.getElementById('local-style-normal') as HTMLButtonElement;
const localStyleMonitorBtn = document.getElementById('local-style-monitor') as HTMLButtonElement;
const hotspotGuideTitle = document.getElementById('hotspot-guide-title') as HTMLElement;
const hotspotGuideStep1 = document.getElementById('hotspot-guide-step1') as HTMLElement;
const hotspotGuideStep2 = document.getElementById('hotspot-guide-step2') as HTMLElement;
const hotspotGuideStep3 = document.getElementById('hotspot-guide-step3') as HTMLElement;

// Stick HP Controller HUD references
const stickHudBar = document.getElementById('stick-hud-bar') as HTMLDivElement;
const stickPlayerBadge = document.getElementById('stick-player-badge') as HTMLSpanElement;
const stickPlayerName = document.getElementById('stick-player-name') as HTMLElement;
const stickWavePill = document.getElementById('stick-wave-pill') as HTMLSpanElement;
const stickHpFill = document.getElementById('stick-hp-fill') as HTMLDivElement;
const stickHpText = document.getElementById('stick-hp-text') as HTMLSpanElement;
const stickUltText = document.getElementById('stick-ult-text') as HTMLSpanElement;
const stickCoinsText = document.getElementById('stick-coins-text') as HTMLSpanElement;
const stickPingPill = document.getElementById('stick-ping-pill') as HTMLSpanElement;
const vbtnStickShop = document.getElementById('vbtn-stick-shop') as HTMLButtonElement;
const stickToastEl = document.getElementById('stick-toast') as HTMLDivElement;
const btnStickExit = document.getElementById('btn-stick-exit') as HTMLButtonElement;
let stickToastTimer: number | null = null;

function showStickToast(msg: string): void {
  stickToastEl.textContent = msg;
  stickToastEl.classList.remove('hidden');
  if (stickToastTimer !== null) window.clearTimeout(stickToastTimer);
  stickToastTimer = window.setTimeout(() => {
    stickToastEl.classList.add('hidden');
    stickToastTimer = null;
  }, 2200);
}

// Shop DOM references
const shopCoinsEl = document.getElementById('shop-coins') as HTMLElement;
const shopTicketsEl = document.getElementById('shop-tickets') as HTMLElement;
const shopFeedbackEl = document.getElementById('shop-feedback') as HTMLDivElement;
const btnSkipIntermission = document.getElementById('btn-skip-intermission') as HTMLButtonElement;

inputPlayerName.value = playerName;
inputLobbyName.value = playerName;

function syncPlayerName(newName: string): void {
  const cleaned = newName.trim().slice(0, 14) || 'Arek SBY';
  playerName = cleaned;
  try {
    localStorage.setItem(NAME_STORAGE_KEY, cleaned);
  } catch {
    // Ignore storage error
  }
  if (inputPlayerName.value !== newName) inputPlayerName.value = newName;
  if (inputLobbyName.value !== newName) inputLobbyName.value = newName;

  const p = getLocalPlayer();
  if (p) p.name = cleaned;

  if (wsMgr.connected) {
    wsMgr.sendSetProfile(cleaned, selectedPalette);
  }
}

function syncSelectedSkin(skinIdx: number, sendProfile = true): void {
  const nextIdx = Math.abs(Math.floor(skinIdx)) % PLAYER_PALETTES.length;
  if (
    wsMgr.connected &&
    wsMgr.lobbyPlayers.some(
      (pl) => pl.id !== wsMgr.localPlayerId && pl.role !== 'monitor' && pl.paletteIndex === nextIdx
    )
  ) {
    lobbyStatusEl.textContent = 'Skin itu sudah dipakai pemain lain! Pilih skin yang berbeda.';
    lobbyStatusEl.style.color = '#f87171';
    return;
  }

  selectedPalette = nextIdx;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, String(selectedPalette));
  } catch {
    // Ignore storage error
  }
  const pal = PLAYER_PALETTES[selectedPalette];
  btnPalette.textContent = pal.label;

  document.querySelectorAll<HTMLButtonElement>('#lobby-skin-picker .skin-swatch').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.skin) === selectedPalette);
  });

  const p = getLocalPlayer();
  if (p) {
    p.paletteIndex = selectedPalette;
  }

  if (sendProfile && wsMgr.connected) {
    wsMgr.sendSetProfile(playerName, selectedPalette);
  }
}

inputPlayerName.addEventListener('input', () => syncPlayerName(inputPlayerName.value));
inputLobbyName.addEventListener('input', () => syncPlayerName(inputLobbyName.value));

document.querySelectorAll<HTMLButtonElement>('#lobby-skin-picker .skin-swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    syncSelectedSkin(Number(btn.dataset.skin));
  });
});

function setStickMode(active: boolean): void {
  appShellEl.classList.toggle('stick-controller-mode', active);
  stickHudBar.classList.toggle('hidden', !active);
}

function updateStickHud(): void {
  if (!wsMgr.isStickClient) return;
  const p = getLocalPlayer();
  const surv = state.survival;
  if (p) {
    const pal = PLAYER_PALETTES[p.paletteIndex % PLAYER_PALETTES.length];
    stickPlayerBadge.textContent = p.id.toUpperCase();
    stickPlayerBadge.style.background = pal.accent;
    stickPlayerName.textContent = p.name.toUpperCase();
    const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
    stickHpFill.style.width = `${hpPct}%`;
    stickHpText.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    stickUltText.textContent = `ULT ${Math.floor(p.ult)}%`;
    stickCoinsText.textContent = `🪙 ${p.coins}`;
    vbtnStickShop.classList.toggle('shop-ready', canOpenWarung(state, p));
  }
  if (surv) {
    stickWavePill.textContent = surv.phase === 'intermission' ? `W${surv.wave} ⏱${Math.ceil(surv.intermissionTimer)}s` : `W${surv.wave}`;
  }
  stickPingPill.textContent = wsMgr.pingMs > 0 ? `${wsMgr.pingMs}ms ${wsMgr.transportMode}` : wsMgr.transportMode;
}

// ===== HYBRID WEBRTC UDP P2P + CLOUDFLARE WSS FALLBACK MANAGER =====
const wsMgr = new WsManager({
  onStatus(text, isError) {
    lobbyStatusEl.textContent = text;
    lobbyStatusEl.style.color = isError ? '#f87171' : '#94a3b8';
  },
  onLobbyUpdate(roomCode, players, localId, isHost) {
    renderLobbyRoster(roomCode, players, localId, isHost);
  },
  onGameStart() {
    audio.unlock();
    const usedPalettes = new Set<number>();
    const roster = wsMgr.lobbyPlayers
      .filter((p) => p.role !== 'monitor')
      .map((p) => {
        let pal = Math.abs(Math.floor(p.paletteIndex)) % PLAYER_PALETTES.length;
        if (usedPalettes.has(pal)) {
          for (let i = 0; i < PLAYER_PALETTES.length; i++) {
            if (!usedPalettes.has(i)) {
              pal = i;
              break;
            }
          }
        }
        usedPalettes.add(pal);
        return {
          id: p.id,
          paletteIndex: pal,
          name: p.customName,
        };
      });
    state = createSurvivalState(selectedPalette, roster, playerName);
    snapshotAccum = 0;
    menuOpen = false;
    lobbyOpen = false;
    shopOpen = false;
    buffModalOpen = false;
    pauseOpen = false;
    lastBuffSig = '';
    resultShown = false;
    menuOverlay.classList.add('hidden');
    lobbyOverlay.classList.add('hidden');
    shopOverlay.classList.add('hidden');
    buffOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    resultOverlay.classList.add('hidden');

    setStickMode(wsMgr.isStickClient);
    updateStickHud();

    if (wsMgr.isHost) {
      wsMgr.broadcastCompactSnapshot(state, []);
    }
  },
  onCompactSnapshot(snap) {
    wsMgr.mergeSnapshot(state, snap);
    if (snap.snd.length > 0 && !wsMgr.isStickClient) {
      audio.playQueue(snap.snd);
    }
    if (wsMgr.isStickClient) {
      updateStickHud();
    }
    if (shopOpen) {
      refreshShopUI();
    }
    checkPendingBuffModal();
    showResultIfNeeded();
  },
  onRemoteBuy(playerId, itemId) {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p) return { ok: false, message: 'Pemain tidak ditemukan' };
    const res = buyShopItem(state, p, itemId);
    wsMgr.broadcastCompactSnapshot(state, state.soundQueue);
    state.soundQueue.length = 0;
    return res;
  },
  onRemoteBuff(playerId, buffId) {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p) return;
    applyPlayerBuff(state, p, buffId);
    wsMgr.broadcastCompactSnapshot(state, state.soundQueue);
    state.soundQueue.length = 0;
  },
  onRemoteSkip() {
    skipIntermission(state);
    wsMgr.broadcastCompactSnapshot(state, []);
  },
  onShopResult(ok, message) {
    shopFeedbackEl.textContent = message;
    shopFeedbackEl.style.color = ok ? '#4ade80' : '#f87171';
    refreshShopUI();
  },
  onDisconnect(reason) {
    setStickMode(false);
    state.shakeTimer = 0;
    state.shakeIntensity = 0;
    state.hitstopTimer = 0;
    shopOpen = false;
    buffModalOpen = false;
    pauseOpen = false;
    resultShown = false;
    buffOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    openLobby();
    lobbyStatusEl.textContent = reason;
    lobbyStatusEl.style.color = '#f87171';
  },
});

function setLocalPlayStyle(style: LocalPlayStyle): void {
  if (wsMgr.connected) {
    wsMgr.disconnect(true);
    renderLobbyRoster('', [], 'p1', false);
  }
  wsMgr.localPlayStyle = style;
  localStyleNormalBtn.classList.toggle('active', style === 'normal');
  localStyleMonitorBtn.classList.toggle('active', style === 'monitor');

  if (style === 'monitor') {
    hotspotGuideTitle.textContent = 'Cara Mabar Mode Monitor + Stick HP (Satu Jaringan):';
    hotspotGuideStep1.innerHTML =
      '1. Pastikan Monitor &amp; semua HP berada di <b>satu jaringan yang sama</b> (Wi-Fi / Hotspot HP siapa saja / Bluetooth).';
    hotspotGuideStep2.innerHTML =
      '2. Perangkat <b>Monitor</b> (Laptop/Tablet/HP utama) klik <b>Buat Room Monitor</b> (tidak harus pemilik Hotspot).';
    hotspotGuideStep3.innerHTML =
      '3. HP teman masukkan <b>Kode Room (H---)</b> — HP teman otomatis jadi <b>Stick Gamepad</b>!';
    if (wsMgr.connectionMode === 'hotspot') {
      labelHostModeEl.textContent = 'HOST MONITOR (LAYAR UTAMA)';
      btnCreateRoom.textContent = 'BUAT ROOM MONITOR';
    }
  } else {
    hotspotGuideTitle.textContent = 'Cara Mabar Local (Satu Jaringan Wi-Fi / Hotspot / Bluetooth):';
    hotspotGuideStep1.innerHTML =
      '1. Pastikan semua perangkat berada di <b>satu jaringan yang sama</b> (Wi-Fi, Hotspot HP siapa saja, atau Bluetooth Tethering).';
    hotspotGuideStep2.innerHTML =
      '2. <b>Siapa saja</b> boleh jadi Host (tidak harus perangkat yang menyalakan Hotspot).';
    hotspotGuideStep3.innerHTML =
      '3. Host klik <b>Buat Room Local</b> (Kode <code>H---</code>), lalu teman masukkan kode itu!';
    if (wsMgr.connectionMode === 'hotspot') {
      labelHostModeEl.textContent = 'HOST LOCAL (SATU JARINGAN)';
      btnCreateRoom.textContent = 'BUAT ROOM LOCAL';
    }
  }
}

localStyleNormalBtn.addEventListener('click', () => {
  audio.unlock();
  setLocalPlayStyle('normal');
});

localStyleMonitorBtn.addEventListener('click', () => {
  audio.unlock();
  setLocalPlayStyle('monitor');
});

btnStickExit.addEventListener('click', () => {
  audio.unlock();
  openPauseMenu();
});

function setConnectionMode(mode: ConnectionMode): void {
  if (wsMgr.connected) {
    wsMgr.disconnect(true);
    renderLobbyRoster('', [], 'p1', false);
  }
  wsMgr.connectionMode = mode;
  tabConnOnline.classList.toggle('active', mode === 'online');
  tabConnHotspot.classList.toggle('active', mode === 'hotspot');
  hotspotGuideEl.classList.toggle('hidden', mode !== 'hotspot');

  if (mode === 'hotspot') {
    setLocalPlayStyle(wsMgr.localPlayStyle);
    inputRoomCode.placeholder = 'H---';
    lobbyStatusEl.textContent =
      'Pastikan semua di 1 jaringan (Wi-Fi / Hotspot siapa saja / Bluetooth). Siapa saja boleh Buat/Gabung Room!';
  } else {
    labelHostModeEl.textContent = 'JADI HOST ONLINE';
    btnCreateRoom.textContent = 'BUAT ROOM BARU';
    inputRoomCode.placeholder = 'KODE';
    lobbyStatusEl.textContent =
      'Buat Room baru atau masukkan Kode Room 4 karakter dari temanmu.';
  }
  lobbyStatusEl.style.color = '#94a3b8';
}

tabConnOnline.addEventListener('click', () => {
  audio.unlock();
  setConnectionMode('online');
});

tabConnHotspot.addEventListener('click', () => {
  audio.unlock();
  setConnectionMode('hotspot');
});

inputHotspotIp.addEventListener('input', () => {
  wsMgr.customHotspotHost = inputHotspotIp.value.trim();
});

function getLocalPlayer() {
  return state.players.find((p) => p.id === wsMgr.localPlayerId) ?? state.players[0];
}

function renderLobbyRoster(
  roomCode: string,
  players: LobbyPlayer[],
  localId: string,
  isHost: boolean
): void {
  const fighters = players.filter((p) => p.role !== 'monitor');
  const me = players.find((p) => p.id === localId);
  if (me && me.role !== 'monitor' && me.paletteIndex !== selectedPalette) {
    syncSelectedSkin(me.paletteIndex, false);
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

  if (roomCode && players.length > 0) {
    hostCodeWrap.classList.remove('hidden');
    lobbyRoomCodeEl.textContent = roomCode;
    const isMonitorHost = me?.role === 'monitor';
    btnStartMabar.classList.toggle('hidden', !isHost);
    btnStartMabar.disabled = isMonitorHost && fighters.length === 0;
    btnStartMabar.textContent =
      isMonitorHost && fighters.length === 0
        ? 'MENUNGGU STICK HP GABUNG...'
        : 'MULAI MABAR SURVIVAL ➔';
  } else {
    hostCodeWrap.classList.add('hidden');
    btnStartMabar.classList.add('hidden');
    btnStartMabar.disabled = false;
  }

  lobbyPlayerCountEl.textContent = `${fighters.length}/5`;
  if (players.length === 0) {
    lobbyRosterEl.innerHTML = '<div class="roster-empty">Belum ada room aktif.</div>';
    return;
  }

  lobbyRosterEl.innerHTML = players
    .map((p) => {
      const isMon = p.role === 'monitor';
      const dotColor = isMon
        ? '#38bdf8'
        : PLAYER_PALETTES[p.paletteIndex % PLAYER_PALETTES.length].accent;
      const you = p.id === localId ? ' (KAMU)' : '';
      return `<div class="roster-chip"><span class="roster-dot" style="background:${dotColor}"></span>${p.name}${you}</div>`;
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

  // Center Pos Warkop 1-Wave Tower status
  const towerBtn = document.getElementById('shop-tower-pos') as HTMLButtonElement | null;
  const towerDesc = document.getElementById('shop-tower-pos-desc');
  const towerCost = document.getElementById('shop-tower-pos-cost');
  if (towerBtn) towerBtn.disabled = surv.core.towerActive;
  if (towerDesc) {
    towerDesc.textContent = surv.core.towerActive
      ? 'Menara aktif menjaga Pos Warkop di wave ini!'
      : 'Menara mercon otomatis (hanya 1 Wave, wave depan sewa lagi)';
  }
  if (towerCost) {
    towerCost.textContent = surv.core.towerActive ? 'AKTIF ✓' : '85 Receh';
  }
}

/**
 * Checks if the local player has a pending every-2-wave Buff choice
 * and displays the 3 random Buff cards modal (Player picks 1!).
 */
function checkPendingBuffModal(): void {
  if (
    state.mode !== 'survival' ||
    state.status !== 'playing' ||
    menuOpen ||
    lobbyOpen ||
    wsMgr.isMonitor
  ) {
    if (buffModalOpen) {
      buffModalOpen = false;
      buffOverlay.classList.add('hidden');
    }
    return;
  }

  const player = getLocalPlayer();
  const choices = player?.pendingBuffChoices ?? [];
  if (!player || choices.length === 0) {
    if (buffModalOpen) {
      buffModalOpen = false;
      lastBuffSig = '';
      buffOverlay.classList.add('hidden');
    }
    return;
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
  const player = getLocalPlayer();
  if (!player) return;

  if (wsMgr.connected && !wsMgr.isHost) {
    wsMgr.sendPickBuff(buffId);
    player.pendingBuffChoices = [];
  } else {
    applyPlayerBuff(state, player, buffId);
    audio.playQueue(state.soundQueue);
    state.soundQueue.length = 0;
  }

  buffModalOpen = false;
  lastBuffSig = '';
  buffOverlay.classList.add('hidden');
}

function toggleWarung(): void {
  if (
    state.mode !== 'survival' ||
    menuOpen ||
    lobbyOpen ||
    buffModalOpen ||
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
    if (wsMgr.isStickClient) {
      showStickToast('DEKATI POS WARKOP / TUNGGU JEDA 20 DETIK!');
      return;
    }
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

function openPauseMenu(): void {
  if (menuOpen || lobbyOpen || resultShown) return;
  pauseOpen = true;
  if (wsMgr.connected) {
    pauseEyebrow.textContent = 'MENU JEDA MABAR';
    pauseSub.textContent =
      'Room tetap aktif. Pilih Lanjutkan agar tidak keluar dari permainan!';
    btnPauseRestart.classList.toggle('hidden', !wsMgr.isHost);
  } else {
    pauseEyebrow.textContent = 'PERMAINAN DIJEDA';
    pauseSub.textContent = 'Simulasi dijeda sementara. Ambil napas dulu rek!';
    btnPauseRestart.classList.remove('hidden');
  }
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
    if (wsMgr.connected && wsMgr.isHost) {
      wsMgr.sendStartGame();
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

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menuOpen && !lobbyOpen && !resultShown) {
    if (shopOpen) {
      shopOpen = false;
      shopOverlay.classList.add('hidden');
    } else if (!buffModalOpen) {
      if (pauseOpen) closePauseMenu();
      else openPauseMenu();
    }
  }
});

function openMenu(): void {
  setStickMode(false);
  wsMgr.disconnect(true);
  state.shakeTimer = 0;
  state.shakeIntensity = 0;
  state.hitstopTimer = 0;
  menuOpen = true;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  pauseOpen = false;
  resultShown = false;
  refreshMenuProgress();
  showMenuView('home');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  menuOverlay.classList.remove('hidden');
}

function openLobby(): void {
  audio.unlock();
  menuOpen = false;
  lobbyOpen = true;
  shopOpen = false;
  buffModalOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  lobbyOverlay.classList.remove('hidden');
  renderLobbyRoster(wsMgr.roomCode, wsMgr.lobbyPlayers, wsMgr.localPlayerId, wsMgr.isHost);
}

function startStoryStage(stage: 1 | 2 | 3): void {
  audio.unlock();
  wsMgr.disconnect(true);
  state = createStoryState(stage, selectedPalette, playerName);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
}

function startSoloSurvival(): void {
  audio.unlock();
  wsMgr.disconnect(true);
  state = createSurvivalState(selectedPalette, undefined, playerName);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  lastBuffSig = '';
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
}

function startSandbox(): void {
  audio.unlock();
  wsMgr.disconnect(true);
  state = createSandboxState(selectedPalette, playerName);
  menuOpen = false;
  lobbyOpen = false;
  shopOpen = false;
  buffModalOpen = false;
  resultShown = false;
  menuOverlay.classList.add('hidden');
  lobbyOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
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

document.getElementById('btn-play-survival')!.addEventListener('click', () => startSoloSurvival());
document.getElementById('btn-open-lobby')!.addEventListener('click', () => openLobby());
document.getElementById('btn-play-sandbox')!.addEventListener('click', () => startSandbox());

document.getElementById('btn-unlock-all')!.addEventListener('click', () => {
  saveStageCleared(1);
  saveStageCleared(2);
  refreshMenuProgress();
});

// Lobby Buttons
btnCreateRoom.addEventListener('click', () => {
  audio.unlock();
  wsMgr.createRoom(selectedPalette, playerName);
});

document.getElementById('btn-copy-link')!.addEventListener('click', () => {
  if (!wsMgr.roomCode) return;
  const modeParam = wsMgr.connectionMode === 'hotspot' ? '&mode=hotspot' : '';
  const url = `${window.location.origin}${window.location.pathname}?room=${wsMgr.roomCode}${modeParam}`;
  navigator.clipboard?.writeText(url).catch(() => {});
  lobbyStatusEl.textContent = `Link undangan disalin: ${url}`;
  lobbyStatusEl.style.color = '#4ade80';
});

document.getElementById('btn-join-room')!.addEventListener('click', () => {
  audio.unlock();
  wsMgr.joinRoom(inputRoomCode.value, selectedPalette, playerName);
});

inputRoomCode.addEventListener('input', () => {
  inputRoomCode.value = inputRoomCode.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
});

inputRoomCode.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    audio.unlock();
    wsMgr.joinRoom(inputRoomCode.value, selectedPalette, playerName);
  }
});

btnStartMabar.addEventListener('click', () => {
  if (!wsMgr.isHost) return;
  wsMgr.sendStartGame();
});

document.getElementById('btn-close-lobby')!.addEventListener('click', () => openMenu());

// Shop Buttons
document.querySelectorAll<HTMLButtonElement>('.shop-item-btn[data-item]').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    const itemId = btn.dataset.item as ShopItemId;

    if (wsMgr.connected && !wsMgr.isHost) {
      wsMgr.sendBuy(itemId);
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
  if (wsMgr.connected && !wsMgr.isHost) {
    wsMgr.sendSkipIntermission();
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
    if (wsMgr.connected) {
      if (wsMgr.isHost) {
        wsMgr.sendStartGame();
      } else {
        setStickMode(false);
        wsMgr.disconnect(true);
        openLobby();
      }
    } else {
      startSoloSurvival();
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

syncSelectedSkin(selectedPalette);

btnWarungHud.addEventListener('click', () => {
  audio.unlock();
  toggleWarung();
});

btnMenu.addEventListener('click', () => {
  audio.unlock();
  openPauseMenu();
});

btnPalette.addEventListener('click', () => {
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
  buffModalOpen = false;
  pauseOpen = false;
  shopOverlay.classList.add('hidden');
  buffOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');

  if (wsMgr.connected) {
    btnRetryStage.textContent = wsMgr.isHost ? 'MAIN LAGI (HOST)' : 'KELUAR KE LOBI';
  } else {
    btnRetryStage.textContent = 'MAIN LAGI';
  }

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

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
const inviteMode = urlParams.get('mode');
if (inviteRoom && inviteRoom.trim().length === 4) {
  const code = inviteRoom.trim().toUpperCase();
  if (inviteMode === 'hotspot' || code.startsWith('H')) {
    setConnectionMode('hotspot');
  }
  inputRoomCode.value = code;
  openLobby();
  lobbyStatusEl.textContent = `Kode undangan ${code} terdeteksi! Klik GABUNG untuk masuk.`;
  lobbyStatusEl.style.color = '#4ade80';
}

// Fixed-timestep 60Hz Loop + Live FPS & Ping Meter
let lastTime = performance.now();
let accumulator = 0;
let fpsFrames = 0;
let fpsLastSample = performance.now();
let currentFps = 60;

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
      state.status === 'playing'
    ) {
      toggleWarung();
    }

    if (menuOpen || lobbyOpen) {
      state.time += FIXED_DT;
    }

    if (!menuOpen && !lobbyOpen && state.status === 'playing') {
      if (wsMgr.connected && !wsMgr.isHost) {
        // Client: 0ms Local Action & Movement Prediction + Delta Input + 60 FPS Lerp
        const netInput =
          shopOpen || buffModalOpen || pauseOpen
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
        wsMgr.sendDeltaInput(netInput);
        if (!wsMgr.isStickClient) {
          wsMgr.applyPredictionAndLerp(state, netInput, FIXED_DT, (ev) => audio.play(ev));
        } else {
          updateStickHud();
        }
      } else if (wsMgr.connected && wsMgr.isHost) {
        // Host: Authoritative 60Hz Simulation + 20Hz Compact Snapshot over UDP/WSS
        const allInputs: Record<string, PlayerInput> = {};
        if (!wsMgr.isMonitor) {
          allInputs[wsMgr.localPlayerId] =
            shopOpen || buffModalOpen || pauseOpen
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
          if (p.id === wsMgr.localPlayerId) continue;
          const rem = wsMgr.getRemoteInput(p.id);
          if (rem) allInputs[p.id] = rem;
        }
        stepSurvival(state, allInputs, FIXED_DT);
        audio.playQueue(state.soundQueue);
        checkPendingBuffModal();

        const endedNow = state.status !== 'playing';
        if (endedNow) {
          state.shakeTimer = 0;
          state.shakeIntensity = 0;
          state.hitstopTimer = 0;
          wsMgr.broadcastCompactSnapshot(state, state.soundQueue);
          showResultIfNeeded();
        } else {
          snapshotAccum += FIXED_DT;
          // Adaptive rate for 1 Mbps mobile smoothness: 10Hz for Monitor->Stick, 12-15Hz for full-screen clients
          const snapInterval = wsMgr.isMonitor
            ? 0.1
            : wsMgr.pingMs > 120
              ? 0.08
              : 0.066;
          if (snapshotAccum >= snapInterval) {
            snapshotAccum = 0;
            wsMgr.broadcastCompactSnapshot(state, state.soundQueue);
          }
        }
      } else if (!shopOpen && !buffModalOpen && !pauseOpen) {
        // Offline Solo Mode
        if (state.mode === 'story') {
          stepStory(state, sampled, FIXED_DT);
        } else if (state.mode === 'survival') {
          stepSurvival(state, sampled, FIXED_DT);
          checkPendingBuffModal();
        } else {
          stepSandbox(state, sampled, FIXED_DT);
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

  if (!wsMgr.isStickClient) {
    renderGame(ctx, state);
  }
  const perfText = wsMgr.connected
    ? `${currentFps} FPS • ${wsMgr.pingMs}ms ${wsMgr.transportMode}`
    : `${currentFps} FPS`;
  hud.update(state, wsMgr.localPlayerId, perfText, wsMgr.isMonitor);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
