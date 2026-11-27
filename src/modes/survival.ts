import { getHeroDef } from '../core/heroes';
import { registerUltActivationForCombo, stepComboUlt } from '../core/comboUlt';
import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  PROJ_SPEED,
  ULT_DEFS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from '../core/constants';
import type {
  BarricadeSlot,
  BarricadeState,
  BuffId,
  EnemyKind,
  GameState,
  HeroId,
  MapTheme,
  PlayerInput,
  PlayerState,
  SlashElement,
  SurvivalWaveEvent,
  UltType,
} from '../core/types';
import { resolveCombat } from '../entities/combat';
import { spawnCrate, updateCratesAndPickups } from '../entities/crate';
import { spawnEnemy, updateEnemies } from '../entities/enemyFactory';
import { createPlayer, updatePlayer } from '../entities/player';

const BEST_WAVE_KEY = 'arek_slayer_survival_best_v1';

export const MAX_SURVIVAL_WAVE = 100;

export const WAVE_EVENT_INFO: Record<
  SurvivalWaveEvent,
  { label: string; shortLabel: string; color: string; desc: string }
> = {
  normal: {
    label: 'GELOMBANG STANDAR',
    shortLabel: 'STANDAR',
    color: '#94a3b8',
    desc: 'Pertahankan Pos Warkop & Barikade dari serbuan zombie.',
  },
  rush_hour: {
    label: '💨 SERBUAN KILAT (TUYUL & BOCIL)',
    shortLabel: '💨 SERBUAN KILAT',
    color: '#38bdf8',
    desc: 'Musuh lincah menyerbu lebih cepat dengan 75% HP & +35% cas Ulti!',
  },
  kuntilanak_night: {
    label: '👻 MALAM JUMAT MISTIS',
    shortLabel: '👻 MALAM MISTIS',
    color: '#c084fc',
    desc: 'Pocong, Kuntilanak & Dukun mendominasi! Bonus +35% Uang Receh.',
  },
  golden_kendi_rain: {
    label: '🪙 HUJAN KENDI & PETI EMAS',
    shortLabel: '🪙 HUJAN KENDI EMAS',
    color: '#facc15',
    desc: 'Peti/Kendi berjatuhan lebih sering & drop Uang Receh +50%!',
  },
  petir_badai: {
    label: '⚡ BADAI PETIR SUROBOYO',
    shortLabel: '⚡ BADAI PETIR',
    color: '#60a5fa',
    desc: 'Kilat menyambar arena tiap 3.2 detik! Hantam zombie & hati-hati!',
  },
  hyper_ult: {
    label: '🔥 OVERDRIVE ULTI 2×',
    shortLabel: '🔥 OVERDRIVE ULTI 2×',
    color: '#fb923c',
    desc: 'Bar Ultimate terisi 2× lebih cepat! Pesta Jurus & Resonansi Mabar!',
  },
  boss_invasion: {
    label: '🚨 BOSS INVASION',
    shortLabel: '🚨 BOSS INVASION',
    color: '#f87171',
    desc: 'Pimpinan Zombie turun ke lapangan bersama pasukan pengawal!',
  },
  final_boss: {
    label: '👑 FINAL WAVE 100/100 • RAJA SARUNG BAJA',
    shortLabel: '👑 FINAL BOSS 100',
    color: '#fde047',
    desc: 'Pertempuran terakhir menyelamatkan Kota Suroboyo! Tumbangkan untuk Menang!',
  },
};

export function pickWaveEventForWave(wave: number): SurvivalWaveEvent {
  if (wave >= MAX_SURVIVAL_WAVE) return 'final_boss';
  if (wave % 5 === 0) return 'boss_invasion';
  if (wave <= 2) return 'normal';
  if (wave >= 9 && wave % 9 === 0) return 'petir_badai';
  if (wave % 8 === 0) return 'golden_kendi_rain';
  if (wave % 7 === 0) return 'kuntilanak_night';
  if (wave % 6 === 0) return 'hyper_ult';
  if (wave % 4 === 0) return 'rush_hour';
  // Add extra mid/late-game spice on odd waves >= 11 so higher waves stay fresh
  if (wave >= 11 && wave % 10 === 3) return 'petir_badai';
  if (wave >= 17 && wave % 10 === 7) return 'kuntilanak_night';
  return 'normal';
}

export type ShopItemId =
  | 'barricade_left'
  | 'barricade_top'
  | 'barricade_right'
  | 'barricade_bottom'
  | 'ult_gasing'
  | 'ult_petir'
  | 'ult_mercon'
  | 'ult_naga'
  | 'elem_petir'
  | 'elem_api'
  | 'elem_badai'
  | 'elem_suci'
  | 'elem_es'
  | 'elem_daun'
  | 'tower_pos'
  | 'upgrade_core'
  | 'shield_core'
  | 'tiket_revive'
  | 'es_teh_jumbo'
  | 'kopi_pekat';

export interface BuffDef {
  id: BuffId;
  icon: string;
  title: string;
  desc: string;
}

export const BUFF_DEFS: Record<BuffId, BuffDef> = {
  max_hp: {
    id: 'max_hp',
    icon: '❤️',
    title: 'Raga Baja Suroboyo',
    desc: 'Max HP +25 (misal 100 → 125) & langsung pulih +25 HP',
  },
  dmg_up: {
    id: 'dmg_up',
    icon: '⚔️',
    title: 'Sarung Sutra Tajam',
    desc: 'Damage Kibas Sarung, Pecut & Badai +20% lebih sakit',
  },
  cd_fast: {
    id: 'cd_fast',
    icon: '⚡',
    title: 'Tangan Kilat Pecut',
    desc: 'Reload Pecut, Kibas & Dash 18% lebih cepat',
  },
  move_speed: {
    id: 'move_speed',
    icon: '👟',
    title: 'Sandal Balap Kenjeran',
    desc: 'Kecepatan lari karakter +15% lebih gesit',
  },
  ult_charge: {
    id: 'ult_charge',
    icon: '🔥',
    title: 'Semangat Bonek',
    desc: 'Bar Ultimate terisi +25% lebih cepat tiap serang',
  },
  coin_boost: {
    id: 'coin_boost',
    icon: '💰',
    title: 'Dompet Juragan',
    desc: 'Uang Receh dari zombie +25% lebih banyak',
  },
};

const ALL_BUFF_IDS: BuffId[] = [
  'max_hp',
  'dmg_up',
  'cd_fast',
  'move_speed',
  'ult_charge',
  'coin_boost',
];

export function rollRandomBuffChoices(count = 3): BuffId[] {
  const pool = [...ALL_BUFF_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}

export function applyPlayerBuff(
  state: GameState,
  player: PlayerState,
  buffId: BuffId
): { ok: boolean; message: string } {
  if (
    player.pendingBuffChoices.length > 0 &&
    !player.pendingBuffChoices.includes(buffId)
  ) {
    return { ok: false, message: 'Buff tidak ada di pilihan!' };
  }

  const def = BUFF_DEFS[buffId];
  if (!def) return { ok: false, message: 'Buff tidak valid' };

  switch (buffId) {
    case 'max_hp':
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case 'dmg_up':
      player.dmgMult = Math.round((player.dmgMult + 0.2) * 100) / 100;
      break;
    case 'cd_fast':
      player.cdMult = Math.max(0.35, Math.round(player.cdMult * 0.82 * 100) / 100);
      break;
    case 'move_speed':
      player.speedMult = Math.round((player.speedMult + 0.15) * 100) / 100;
      break;
    case 'ult_charge':
      player.ultGainMult = Math.round((player.ultGainMult + 0.25) * 100) / 100;
      break;
    case 'coin_boost':
      player.coinMult = Math.round((player.coinMult + 0.25) * 100) / 100;
      break;
  }

  player.pendingBuffChoices = [];
  player.buffCount++;
  state.soundQueue.push('buff_pick');
  state.floatingTexts.push({
    x: player.x,
    y: player.y - player.z - 58,
    vy: -50,
    text: `BUFF: ${def.title.toUpperCase()}!`,
    color: '#4ade80',
    scale: 1.08,
    life: 1.25,
    maxLife: 1.25,
  });

  return { ok: true, message: `${def.title} aktif!` };
}

export const BARRICADE_MAX_HP: Record<1 | 2 | 3 | 4, number> = {
  1: 150,
  2: 280,
  3: 450,
  4: 700,
};

export const BARRICADE_TIER_NAME: Record<1 | 2 | 3 | 4, string> = {
  1: 'Tumpukan Kardus & Kayu',
  2: 'Pagar Bambu Runcing',
  3: 'Gerobak Besi Karatan',
  4: 'Tembok Kawat Duri Baja',
};

export const TOWER_TIER_NAME: Record<1 | 2 | 3 | 4, string> = {
  1: 'Ketapel Krikil Otomatis',
  2: 'Pecut Mercon Bumbung',
  3: 'Meriam Bambu Karbit',
  4: 'Gatling Kembang Api Suramadu',
};

export const TOWER_UPGRADE_COST: Record<1 | 2 | 3 | 4, number> = {
  1: 180, // Beli Senjata Lv.1 (Ketapel Krikil)
  2: 320, // Upgrade ke Lv.2 (Pecut Mercon Bumbung)
  3: 550, // Upgrade ke Lv.3 (Meriam Bambu Karbit)
  4: 900, // Upgrade ke Lv.4 (Gatling Kembang Api Suramadu)
};

export function getCoreUpgradeCost(maxHp: number): number {
  const tiers = Math.max(0, Math.round((maxHp - 500) / 200));
  return 180 + tiers * 90; // 180 -> 270 -> 360 -> 450 -> 540...
}

export function loadBestWave(): number {
  try {
    const raw = localStorage.getItem(BEST_WAVE_KEY);
    return raw ? Math.max(0, Number(raw) || 0) : 0;
  } catch {
    return 0;
  }
}

export function saveBestWave(wave: number): void {
  try {
    const capped = Math.min(MAX_SURVIVAL_WAVE, Math.max(0, wave));
    const prev = loadBestWave();
    if (capped > prev) {
      localStorage.setItem(BEST_WAVE_KEY, String(capped));
    }
  } catch {
    // Ignore storage errors
  }
}

export function getThemeForWave(wave: number): { theme: MapTheme; locationName: string } {
  const block = Math.floor((Math.max(1, wave) - 1) / 10) % 4;
  if (block === 0) return { theme: 'tambak', locationName: 'KAMPUNG TAMBAK' };
  if (block === 1) return { theme: 'tunjungan', locationName: 'ALUN-ALUN TUNJUNGAN' };
  if (block === 2) return { theme: 'suramadu', locationName: 'TANJUNG PERAK • SURAMADU' };
  return { theme: 'perempatan', locationName: 'SIMPANG EMPAT MAUT • JOYOBOYO' };
}

export function createSurvivalState(
  paletteIndex = 0,
  roster?: Array<{ id: string; paletteIndex: number; name?: string; heroId?: HeroId }>,
  customName?: string,
  heroId?: HeroId
): GameState {
  const { theme, locationName } = getThemeForWave(1);

  const core = {
    x: 432,
    y: 288,
    w: 96,
    h: 50,
    hp: 500,
    maxHp: 500,
    hitFlashTimer: 0,
    towerLevel: 0,
    towerActive: false,
    towerCooldown: 0,
    towerAimAngle: 0,
    shieldActive: false,
    shieldHp: 0,
    shieldMaxHp: 250,
  };

  const barricades: BarricadeState[] = [
    {
      id: 'left',
      label: 'BARRICADE KIRI',
      x: 230,
      y: 286,
      w: 28,
      h: 82,
      level: 1,
      hp: BARRICADE_MAX_HP[1],
      maxHp: BARRICADE_MAX_HP[1],
      hitFlashTimer: 0,
    },
    {
      id: 'top',
      label: 'BARRICADE ATAS',
      x: 434,
      y: 180,
      w: 92,
      h: 26,
      level: 1,
      hp: BARRICADE_MAX_HP[1],
      maxHp: BARRICADE_MAX_HP[1],
      hitFlashTimer: 0,
    },
    {
      id: 'right',
      label: 'BARRICADE KANAN',
      x: 702,
      y: 286,
      w: 28,
      h: 82,
      level: 1,
      hp: BARRICADE_MAX_HP[1],
      maxHp: BARRICADE_MAX_HP[1],
      hitFlashTimer: 0,
    },
  ];

  const spawnPoints = [
    { x: 370, y: 345 },
    { x: 590, y: 345 },
    { x: 480, y: 405 },
    { x: 370, y: 255 },
    { x: 590, y: 255 },
  ];

  const players =
    roster && roster.length > 0
      ? roster.map((r, idx) => {
          const pt = spawnPoints[idx % spawnPoints.length];
          return createPlayer(r.id, pt.x, pt.y, r.paletteIndex, r.name, r.heroId);
        })
      : [createPlayer('p1', 370, 345, paletteIndex, customName, heroId)];

  const state: GameState = {
    mode: 'survival',
    theme,
    stageNumber: 1,
    stageTitle: `WAVE 1/${MAX_SURVIVAL_WAVE} • ${locationName}`,
    status: 'playing',
    time: 0,
    arenaWidth: VIRTUAL_WIDTH,
    arenaHeight: VIRTUAL_HEIGHT,
    cameraX: 0,
    activeMinX: ARENA_MIN_X,
    activeMaxX: ARENA_MAX_X,
    goPromptTimer: 0,
    storyZones: [],
    survival: {
      wave: 1,
      maxWave: MAX_SURVIVAL_WAVE,
      waveEvent: 'normal',
      waveEventTimer: 0,
      phase: 'wave',
      intermissionTimer: 0,
      zombiesRemainingToSpawn: 5 + players.length * 2,
      spawnTimer: 1.0,
      core,
      barricades,
      mapBannerTimer: 2.6,
      mapBannerText: `WAVE 1/${MAX_SURVIVAL_WAVE} • ${locationName}`,
    },
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
    nextEntityId: 1,
    crateSpawnTimer: 10,
    enemyRespawnTimer: 0,
  };

  spawnCrate(state, 330, 425);
  return state;
}

export function canOpenWarung(state: GameState, player: PlayerState): boolean {
  const surv = state.survival;
  if (!surv) return false;
  if (surv.phase === 'intermission') return true;
  const cx = surv.core.x + surv.core.w * 0.5;
  const cy = surv.core.y + surv.core.h * 0.5;
  return Math.hypot(player.x - cx, player.y - cy) <= 155;
}

export function getBarricadeActionInfo(bar: BarricadeState): {
  actionLabel: string;
  cost: number;
  disabled: boolean;
} {
  if (bar.hp <= 0) {
    return {
      actionLabel: `Bangun Ulang (Lv.1 ${BARRICADE_TIER_NAME[1]})`,
      cost: 95,
      disabled: false,
    };
  }
  if (bar.hp < bar.maxHp) {
    const baseRepairs: Record<1 | 2 | 3 | 4, number> = { 1: 50, 2: 85, 3: 130, 4: 190 };
    const repairCost = baseRepairs[bar.level] ?? 60;
    return { actionLabel: `Perbaiki Penuh (Lv.${bar.level})`, cost: repairCost, disabled: false };
  }
  if (bar.level < 4) {
    const nextLv = (bar.level + 1) as 2 | 3 | 4;
    const upgradeCosts: Record<2 | 3 | 4, number> = { 2: 160, 3: 320, 4: 580 };
    const cost = upgradeCosts[nextLv];
    return {
      actionLabel: `Upgrade → Lv.${nextLv} ${BARRICADE_TIER_NAME[nextLv]}`,
      cost,
      disabled: false,
    };
  }
  return { actionLabel: 'MAKSIMAL (Lv.4 Berduri)', cost: 0, disabled: true };
}

export function buyShopItem(
  state: GameState,
  player: PlayerState,
  itemId: ShopItemId
): { ok: boolean; message: string } {
  const surv = state.survival;
  if (!surv) return { ok: false, message: 'Bukan mode Survival' };

  if (itemId.startsWith('barricade_')) {
    const slot = itemId.replace('barricade_', '') as BarricadeSlot;
    const bar = surv.barricades.find((b) => b.id === slot);
    if (!bar) return { ok: false, message: 'Barricade tidak ditemukan' };

    const info = getBarricadeActionInfo(bar);
    if (info.disabled) return { ok: false, message: 'Barricade sudah maksimal!' };
    if (player.coins < info.cost) return { ok: false, message: 'Uang Receh kurang rek!' };

    player.coins -= info.cost;
    if (bar.hp <= 0) {
      bar.level = 1;
      bar.maxHp = BARRICADE_MAX_HP[1];
      bar.hp = bar.maxHp;
    } else if (bar.hp < bar.maxHp) {
      bar.hp = bar.maxHp;
    } else if (bar.level < 4) {
      bar.level = (bar.level + 1) as 2 | 3 | 4;
      bar.maxHp = BARRICADE_MAX_HP[bar.level];
      bar.hp = bar.maxHp;
    }
    state.soundQueue.push('pickup_heal');
    state.floatingTexts.push({
      x: bar.x + bar.w * 0.5,
      y: bar.y - 12,
      vy: -40,
      text: `${bar.label} LV.${bar.level}!`,
      color: '#4ade80',
      scale: 1.05,
      life: 1.1,
      maxLife: 1.1,
    });
    return { ok: true, message: `${bar.label} diperkuat!` };
  }

  if (itemId.startsWith('ult_')) {
    const newUlt = itemId.replace('ult_', '') as UltType;
    player.ultType = newUlt;
    player.ult = player.maxUlt; // Always refill to 100% as milestone reward!
    player.pendingUltChoice = false; // Critical: clear pending milestone choice!
    state.soundQueue.push('pickup_kopi');
    const def = ULT_DEFS[newUlt];
    state.floatingTexts.push({
      x: player.x,
      y: player.y - 54,
      vy: -45,
      text: `JURUS: ${def.title.toUpperCase()}! ${def.icon}`,
      color: '#facc15',
      scale: 1.15,
      life: 1.4,
      maxLife: 1.4,
    });
    return { ok: true, message: `Jurus aktif: ${def.title}!` };
  }

  if (itemId.startsWith('elem_')) {
    const elem = itemId.replace('elem_', '') as SlashElement;
    const heroDef = getHeroDef(player.heroId);
    const allowedElem = heroDef.defaultElement;
    if (allowedElem && allowedElem !== 'none' && elem !== allowedElem) {
      return {
        ok: false,
        message: `${heroDef.name} hanya bisa upgrade elemen ${allowedElem.toUpperCase()}!`,
      };
    }
    const isSame = player.slashElement === elem;
    const curLv = isSame ? (player.slashElementLevel || 1) : 0;
    if (curLv >= 3) {
      return { ok: false, message: `Elemen ${elem.toUpperCase()} sudah Level Maksimal (Lv.3)!` };
    }
    const nextLv = curLv + 1;
    const cost = nextLv === 1 ? 75 : nextLv === 2 ? 150 : 225;
    if (player.coins < cost) {
      return { ok: false, message: `Uang Receh kurang rek! Butuh ${cost} Receh.` };
    }
    player.coins -= cost;
    player.slashElement = elem;
    player.slashElementLevel = nextLv;
    player.unlockedElements = player.unlockedElements || {};
    player.unlockedElements[elem] = nextLv;
    state.soundQueue.push('pickup_kopi');

    const elemNames: Record<SlashElement, string> = {
      none: 'STANDAR',
      petir: '⚡ PETIR HALILINTAR',
      api: '🔥 API KOBARAN',
      badai: '🌀 BADAI TOPAN',
      suci: '✨ CAHAYA SUCI',
      es: '❄️ ES GLETSER',
      daun: '🍃 DAUN RIMBA',
    };
    const elemColors: Record<SlashElement, string> = {
      none: '#ffffff',
      petir: '#38bdf8',
      api: '#f97316',
      badai: '#34d399',
      suci: '#facc15',
      es: '#67e8f9',
      daun: '#4ade80',
    };

    state.floatingTexts.push({
      x: player.x,
      y: player.y - 54,
      vy: -45,
      text: `UPGRADE: ${elemNames[elem]} LV.${nextLv}!`,
      color: elemColors[elem],
      scale: 1.15,
      life: 1.4,
      maxLife: 1.4,
    });
    return { ok: true, message: `Elemen ${elemNames[elem]} Lv.${nextLv} aktif!` };
  }

  if (itemId === 'tower_pos') {
    const curLv = surv.core.towerLevel || 0;
    if (curLv >= 4) {
      return { ok: false, message: 'Senjata Tower sudah Level Maksimal (Gatling Suramadu)!' };
    }
    const nextLv = (curLv + 1) as 1 | 2 | 3 | 4;
    const cost = TOWER_UPGRADE_COST[nextLv];
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };

    player.coins -= cost;
    surv.core.towerLevel = nextLv;
    surv.core.towerActive = true;
    surv.core.towerCooldown = 0.2;
    state.soundQueue.push('pickup_kopi');
    state.floatingTexts.push({
      x: surv.core.x + surv.core.w * 0.5,
      y: surv.core.y - 72,
      vy: -45,
      text: `TOWER UPGRADE LV.${nextLv} (${TOWER_TIER_NAME[nextLv].toUpperCase()})!`,
      color: '#fb923c',
      scale: 1.15,
      life: 1.4,
      maxLife: 1.4,
    });
    return { ok: true, message: `Tower diupgrade ke Lv.${nextLv} (${TOWER_TIER_NAME[nextLv]})!` };
  }

  if (itemId === 'upgrade_core') {
    const cost = getCoreUpgradeCost(surv.core.maxHp);
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };
    player.coins -= cost;
    surv.core.maxHp += 200;
    surv.core.hp = Math.min(surv.core.maxHp, surv.core.hp + 200);
    state.soundQueue.push('pickup_heal');
    state.floatingTexts.push({
      x: surv.core.x + surv.core.w * 0.5,
      y: surv.core.y - 72,
      vy: -45,
      text: `POS WARKOP +200 MAX HP! (${Math.ceil(surv.core.hp)}/${surv.core.maxHp})`,
      color: '#38bdf8',
      scale: 1.15,
      life: 1.4,
      maxLife: 1.4,
    });
    return { ok: true, message: `Nyawa Pos Warkop bertambah! Max HP: ${surv.core.maxHp}` };
  }

  if (itemId === 'shield_core') {
    const cost = 150;
    if (surv.core.shieldActive && surv.core.shieldHp > 0) {
      return { ok: false, message: 'Tameng Gaib sudah aktif untuk wave ini!' };
    }
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };
    player.coins -= cost;
    surv.core.shieldActive = true;
    surv.core.shieldMaxHp = 250;
    surv.core.shieldHp = 250;
    state.soundQueue.push('pickup_kopi');
    state.floatingTexts.push({
      x: surv.core.x + surv.core.w * 0.5,
      y: surv.core.y - 72,
      vy: -45,
      text: 'TAMENG GAIB WARKOP AKTIF (1 WAVE)!',
      color: '#38bdf8',
      scale: 1.15,
      life: 1.4,
      maxLife: 1.4,
    });
    return { ok: true, message: 'Tameng Gaib aktif menjaga Pos Ronda selama 1 Wave!' };
  }

  if (itemId === 'tiket_revive') {
    const cost = 200;
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };

    const downed = state.players.find((p) => p.knockedDown);
    player.coins -= cost;
    if (downed) {
      downed.knockedDown = false;
      downed.hp = downed.maxHp;
      downed.invulnTimer = 2.0;
      state.soundQueue.push('pickup_kopi');
      return { ok: true, message: 'Rekan tim berhasil dihidupkan!' };
    }
    player.reviveTickets++;
    state.soundQueue.push('pickup_kopi');
    return { ok: true, message: `Tiket Revive dibeli (Total: ${player.reviveTickets})` };
  }

  if (itemId === 'es_teh_jumbo') {
    const cost = 110;
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };
    player.coins -= cost;
    player.hp = player.maxHp;
    surv.core.hp = Math.min(surv.core.maxHp, surv.core.hp + 150);
    state.soundQueue.push('pickup_heal');
    state.floatingTexts.push({
      x: player.x,
      y: player.y - 54,
      vy: -45,
      text: 'ES TEH JUMBO! FULL HP + POS!',
      color: '#4ade80',
      scale: 1.05,
      life: 1.1,
      maxLife: 1.1,
    });
    return { ok: true, message: 'HP Penuh + Pos Ronda +150 HP!' };
  }

  if (itemId === 'kopi_pekat') {
    const cost = 160;
    if (player.coins < cost) return { ok: false, message: 'Uang Receh kurang rek!' };
    player.coins -= cost;
    player.ult = player.maxUlt;
    state.soundQueue.push('pickup_kopi');
    state.floatingTexts.push({
      x: player.x,
      y: player.y - 54,
      vy: -45,
      text: 'KOPI PEKAT! ULTIMATE 100%!',
      color: '#fde047',
      scale: 1.08,
      life: 1.1,
      maxLife: 1.1,
    });
    return { ok: true, message: 'Bar Ultimate langsung 100%!' };
  }

  return { ok: false, message: 'Item tidak dikenal' };
}

export function skipIntermission(state: GameState): void {
  const surv = state.survival;
  if (!surv || surv.phase !== 'intermission') return;
  surv.intermissionTimer = 0.05;
}

function pickZombieKindForWave(wave: number, waveEvent: SurvivalWaveEvent = 'normal'): EnemyKind {
  if (waveEvent === 'rush_hour') {
    const rushPool: EnemyKind[] = ['zombie_bocil', 'zombie_bocil', 'zombie_warga'];
    if (wave >= 8) rushPool.push('zombie_petasan');
    if (wave >= 12) rushPool.push('zombie_tuyul', 'zombie_tuyul');
    return rushPool[Math.floor(Math.random() * rushPool.length)];
  }
  if (waveEvent === 'kuntilanak_night') {
    const nightPool: EnemyKind[] = ['zombie_pocong', 'zombie_pocong', 'zombie_kuntilanak', 'zombie_kuntilanak'];
    if (wave >= 12) nightPool.push('zombie_dukun');
    return nightPool[Math.floor(Math.random() * nightPool.length)];
  }

  const pool: EnemyKind[] = ['zombie_warga', 'zombie_bocil'];
  if (wave >= 4) pool.push('zombie_pocong');
  if (wave >= 6) pool.push('zombie_kuntilanak');
  if (wave >= 8) pool.push('zombie_petasan');
  if (wave >= 11) pool.push('zombie_gendruwo');
  if (wave >= 13) pool.push('zombie_buto_ijo');
  if (wave >= 15) pool.push('zombie_dukun');
  if (wave >= 18) pool.push('zombie_tuyul');

  return pool[Math.floor(Math.random() * pool.length)];
}

function spawnSurvivalZombie(
  state: GameState,
  wave: number,
  waveEvent: SurvivalWaveEvent = 'normal'
): void {
  const kind = pickZombieKindForWave(wave, waveEvent);
  const laneCount = wave >= 31 ? 4 : 3;
  const lane = Math.floor(Math.random() * laneCount);
  let sx = 46;
  let sy = 325;
  if (lane === 0) {
    // Jalur Barat (Kiri)
    sx = 42;
    sy = 250 + Math.random() * 170;
  } else if (lane === 1) {
    // Jalur Utara (Atas)
    sx = 415 + Math.random() * 130;
    sy = 142;
  } else if (lane === 2) {
    // Jalur Timur (Kanan)
    sx = VIRTUAL_WIDTH - 42;
    sy = 250 + Math.random() * 170;
  } else {
    // Jalur Selatan (Bawah) - Khusus Wave 31+
    sx = 415 + Math.random() * 130;
    sy = VIRTUAL_HEIGHT - 36;
  }

  const z = spawnEnemy(state, kind, sx, sy);
  let hpMult = 1 + (wave - 1) * 0.1;
  if (waveEvent === 'rush_hour') hpMult *= 0.75;
  z.hp = Math.max(20, Math.round(z.hp * hpMult));
  z.maxHp = z.hp;
}

const IDLE_INPUT: PlayerInput = {
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

export function stepSurvival(
  state: GameState,
  inputs: PlayerInput | Record<string, PlayerInput>,
  dt: number
): void {
  state.soundQueue.length = 0;
  const surv = state.survival;
  if (!surv || state.status !== 'playing') return;

  if (state.shakeTimer > 0) {
    state.shakeTimer = Math.max(0, state.shakeTimer - dt);
    if (state.shakeTimer === 0) state.shakeIntensity = 0;
  }
  if (surv.core.hitFlashTimer > 0) surv.core.hitFlashTimer = Math.max(0, surv.core.hitFlashTimer - dt);
  if (surv.mapBannerTimer > 0) surv.mapBannerTimer = Math.max(0, surv.mapBannerTimer - dt);
  for (const bar of surv.barricades) {
    if (bar.hitFlashTimer > 0) bar.hitFlashTimer = Math.max(0, bar.hitFlashTimer - dt);
  }

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  // Co-op Synchronized Combo Ultimate (Wuthering Waves Cut-In Freeze + Live Upgrade for 3-6 players!)
  const isSingleInput = 'up' in inputs;
  if (state.comboUlt) {
    if (!state.comboUlt.impactApplied) {
      for (const player of state.players) {
        if (player.knockedDown) continue;
        const pInput = isSingleInput
          ? (inputs as PlayerInput)
          : (inputs as Record<string, PlayerInput>)[player.id] ?? IDLE_INPUT;
        if (pInput.ultPressed && player.ult >= player.maxUlt) {
          player.ult = 0;
          registerUltActivationForCombo(state, player);
        }
      }
    }
    if (stepComboUlt(state, dt)) {
      return;
    }
  }

  state.time += dt;

  // 1. Update All Players
  for (const player of state.players) {
    if (player.knockedDown) continue;
    const pInput = isSingleInput
      ? (inputs as PlayerInput)
      : (inputs as Record<string, PlayerInput>)[player.id] ?? IDLE_INPUT;
    updatePlayer(state, player, pInput, dt);
  }

  // 2. Central Pos Warkop Defense Tower Weapon (Permanent across waves, Upgradable Lv 1-4)
  const towerLv = surv.core.towerLevel || (surv.core.towerActive ? 1 : 0);
  if (towerLv > 0 && surv.phase === 'wave') {
    surv.core.towerCooldown = Math.max(0, surv.core.towerCooldown - dt);
    if (surv.core.towerCooldown <= 0 && state.enemies.length > 0) {
      const cx = surv.core.x + surv.core.w * 0.5;
      const cy = surv.core.y - 24;
      let nearest = state.enemies[0];
      let bestDist = Infinity;
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - cx, e.y - cy);
        if (d < bestDist) {
          bestDist = d;
          nearest = e;
        }
      }
      const maxRange = 330 + towerLv * 25;
      if (nearest && bestDist <= maxRange) {
        // Stats based on Tower Level
        let cd = 0.90;
        let dmg = 20;
        let pierce = 1;
        let spd = PROJ_SPEED * 0.95;
        let col = '#fb923c';
        let rad = 11;

        if (towerLv === 2) {
          cd = 0.70;
          dmg = 32;
          pierce = 2;
          spd = PROJ_SPEED * 1.05;
          col = '#f97316';
        } else if (towerLv === 3) {
          cd = 0.50;
          dmg = 46;
          pierce = 3;
          spd = PROJ_SPEED * 1.15;
          col = '#ef4444';
          rad = 13;
        } else if (towerLv >= 4) {
          cd = 0.28;
          dmg = 58;
          pierce = 5;
          spd = PROJ_SPEED * 1.30;
          col = '#facc15';
          rad = 14;
        }

        surv.core.towerCooldown = cd;
        const angle = Math.atan2(nearest.y - cy, nearest.x - cx);
        surv.core.towerAimAngle = angle;
        state.soundQueue.push('tower_shoot');
        state.projectiles.push({
          id: state.nextEntityId++,
          ownerId: 'tower',
          x: cx + Math.cos(angle) * 18,
          y: cy + Math.sin(angle) * 14,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          angle,
          radius: rad,
          damage: dmg,
          pierceLeft: pierce,
          hitIds: [],
          life: 0.95,
          maxLife: 0.95,
          color: col,
        });

        // Twin Gatling stream for Lv 4!
        if (towerLv >= 4) {
          const spreadAngle = angle + (Math.random() - 0.5) * 0.16;
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerId: 'tower',
            x: cx + Math.cos(spreadAngle) * 18,
            y: cy + Math.sin(spreadAngle) * 14,
            vx: Math.cos(spreadAngle) * spd,
            vy: Math.sin(spreadAngle) * spd,
            angle: spreadAngle,
            radius: 11,
            damage: Math.round(dmg * 0.75),
            pierceLeft: 3,
            hitIds: [],
            life: 0.9,
            maxLife: 0.9,
            color: '#fbbf24',
          });
        }
      }
    }
  }

  // 3. Wave / Intermission State Machine
  if (surv.phase === 'wave') {
    const waveEvent = surv.waveEvent || 'normal';

    // Dynamic anti-boredom wave event effects
    if (waveEvent === 'petir_badai' && state.enemies.length > 0) {
      surv.waveEventTimer = (surv.waveEventTimer ?? 2.2) - dt;
      if (surv.waveEventTimer <= 0) {
        surv.waveEventTimer = 3.2;
        const target = state.enemies[Math.floor(Math.random() * state.enemies.length)];
        if (target && target.hp > 0) {
          state.hazards.push({
            id: state.nextEntityId++,
            kind: 'mercon',
            ownerId: 'storm_event',
            x: target.x + (Math.random() - 0.5) * 32,
            y: target.y + (Math.random() - 0.5) * 24,
            radius: 68,
            delay: 0.75,
            maxDelay: 0.75,
            damage: 75 + Math.floor(surv.wave * 3.5),
            detonated: false,
            flashTimer: 0,
          });
        }
      }
    }

    if (surv.zombiesRemainingToSpawn > 0) {
      surv.spawnTimer -= dt;
      if (surv.spawnTimer <= 0) {
        spawnSurvivalZombie(state, surv.wave, waveEvent);
        surv.zombiesRemainingToSpawn--;
        const baseInterval = Math.max(0.45, 1.55 - surv.wave * 0.055);
        const eventMult = waveEvent === 'rush_hour' ? 0.65 : 1.0;
        surv.spawnTimer = baseInterval * eventMult * (0.75 + Math.random() * 0.5);
      }
    } else if (state.enemies.length === 0) {
      // Wave cleared!
      const clearedWave = Math.min(MAX_SURVIVAL_WAVE, surv.wave);
      saveBestWave(clearedWave);

      // Wave 100 Victory!
      if (clearedWave >= MAX_SURVIVAL_WAVE) {
        state.status = 'victory';
        surv.mapBannerText = `👑 VICTORY! 100/100 WAVE SUROBOYO SELAMAT! 👑`;
        surv.mapBannerTimer = 6.0;
        state.stageTitle = `WAVE ${MAX_SURVIVAL_WAVE}/${MAX_SURVIVAL_WAVE} • JUARA MUTLAK!`;
        state.soundQueue.push('ult_start');
        state.soundQueue.push('pickup_kopi');
        return;
      }

      surv.phase = 'intermission';
      surv.intermissionTimer = 20.0;
      state.soundQueue.push('pickup_kopi');

      // Keep Tower permanent!
      if (surv.core.towerLevel > 0) {
        surv.core.towerActive = true;
      }

      // Expire 1-Wave Energy Shield when wave finishes (must be rebought next wave)
      if (surv.core.shieldActive) {
        surv.core.shieldActive = false;
        state.floatingTexts.push({
          x: surv.core.x + surv.core.w * 0.5,
          y: surv.core.y - 72,
          vy: -35,
          text: 'TAMENG GAIB SELESAI UNTUK WAVE INI',
          color: '#38bdf8',
          scale: 0.95,
          life: 1.4,
          maxLife: 1.4,
        });
      }

      // Every 10 Waves (Wave 10, 20, ..., 90), refill 100% Hero Ultimate + Bonus +150 Receh + +150 Core HP!
      if (surv.wave % 10 === 0) {
        for (const p of state.players) {
          p.ult = p.maxUlt;
          p.coins += 150;
          p.pendingUltChoice = false;
        }
        surv.core.hp = Math.min(surv.core.maxHp, surv.core.hp + 150);
      }

      // Every 2 Waves (Wave 2, 4, 6, 8, ...), grant 3 random Buff choices (Player picks 1!)
      if (surv.wave % 2 === 0) {
        for (const p of state.players) {
          p.pendingBuffChoices = rollRandomBuffChoices(3);
        }
      }

      if (surv.wave === MAX_SURVIVAL_WAVE - 1) {
        surv.mapBannerText = `👑 SIAP-SIAP! WAVE 100/100 FINAL BOSS SUROBOYO! 👑`;
        surv.mapBannerTimer = 5.0;
        state.soundQueue.push('ult_start');
      } else if (surv.wave % 10 === 0) {
        surv.mapBannerText = `🔥 WAVE ${surv.wave}/100 TEMBUS! +150 RECEH & ULTI PENUH! 🔥`;
        surv.mapBannerTimer = 4.5;
        state.soundQueue.push('ult_start');
      } else if ((surv.wave + 1) % 5 === 0) {
        surv.mapBannerText = `⚠️ SIAP-SIAP! WAVE ${surv.wave + 1}/100 BOSS INVASION! ⚠️`;
        surv.mapBannerTimer = 4.5;
        state.soundQueue.push('ult_start');
      } else if (surv.wave % 2 === 0) {
        surv.mapBannerText = `WAVE ${surv.wave}/100 BERES! PILIH 1 BUFF ATRIBUT!`;
        surv.mapBannerTimer = 3.0;
      } else {
        surv.mapBannerText = `WAVE ${surv.wave}/100 BERES! JEDA WARUNG 20 DETIK`;
        surv.mapBannerTimer = 3.0;
      }
    }
  } else {
    surv.intermissionTimer -= dt;
    if (surv.intermissionTimer <= 0) {
      // Auto-pick first buff if any player didn't pick before intermission ended
      for (const p of state.players) {
        if (p.pendingBuffChoices.length > 0) {
          applyPlayerBuff(state, p, p.pendingBuffChoices[0]);
        }
        if (p.pendingUltChoice) {
          p.pendingUltChoice = false;
        }
      }

      surv.wave = Math.min(MAX_SURVIVAL_WAVE, surv.wave + 1);
      surv.phase = 'wave';
      const nextEvent = pickWaveEventForWave(surv.wave);
      surv.waveEvent = nextEvent;
      surv.waveEventTimer = 2.0;
      const isBossWave = surv.wave % 5 === 0;

      // Wave 31+ 4-Way Crossroad: Activate 4th Barricade (Bawah / Selatan)
      if (surv.wave >= 31 && !surv.barricades.some((b) => b.id === 'bottom')) {
        surv.barricades.push({
          id: 'bottom',
          label: 'BARRICADE BAWAH',
          x: 434,
          y: 395,
          w: 92,
          h: 26,
          level: 1,
          hp: BARRICADE_MAX_HP[1],
          maxHp: BARRICADE_MAX_HP[1],
          hitFlashTimer: 0,
        });
        state.soundQueue.push('pickup_heal');
      }

      const { theme, locationName } = getThemeForWave(surv.wave);
      const changedMap = theme !== state.theme;
      state.theme = theme;

      if (isBossWave) {
        let bossKind: EnemyKind = 'boss_koordinator';
        if (surv.wave % 15 === 0 || surv.wave === MAX_SURVIVAL_WAVE) {
          bossKind = 'boss_suramadu';
        } else if (surv.wave % 10 === 0) {
          bossKind = 'boss_tunjungan';
        }

        const boss = spawnEnemy(state, bossKind, 480, 155);
        const finalMult = surv.wave === MAX_SURVIVAL_WAVE ? 2.2 : 1.0;
        const hpMult = (1 + (surv.wave - 1) * 0.14) * finalMult;
        boss.maxHp = Math.round(boss.hp * hpMult);
        boss.hp = boss.maxHp;

        surv.zombiesRemainingToSpawn =
          (surv.wave === MAX_SURVIVAL_WAVE ? 16 : 6 + Math.min(10, Math.floor(surv.wave * 0.35))) +
          (state.players.length - 1) * 2;
        surv.spawnTimer = 1.2;

        state.soundQueue.push('ult_start');
        state.shakeTimer = 0.9;
        state.shakeIntensity = 10;
        surv.mapBannerText =
          surv.wave === MAX_SURVIVAL_WAVE
            ? `👑 FINAL WAVE 100/100 • ${boss.name}! 👑`
            : `🚨 WAVE ${surv.wave}/${MAX_SURVIVAL_WAVE} • BOSS: ${boss.name}! 🚨`;
        surv.mapBannerTimer = 4.5;
        state.stageTitle =
          surv.wave === MAX_SURVIVAL_WAVE
            ? `WAVE 100/100 • 👑 FINAL BOSS 👑`
            : `WAVE ${surv.wave}/${MAX_SURVIVAL_WAVE} • 🚨 BOSS INVASION 🚨`;
      } else {
        const rushExtra = nextEvent === 'rush_hour' ? 6 : 0;
        surv.zombiesRemainingToSpawn = 5 + surv.wave * 2 + rushExtra + (state.players.length - 1) * 2;
        surv.spawnTimer = 0.8;
        state.stageTitle = `WAVE ${surv.wave}/${MAX_SURVIVAL_WAVE} • ${locationName}`;

        const evInfo = WAVE_EVENT_INFO[nextEvent];
        if (changedMap) {
          state.soundQueue.push('ult_start');
          surv.mapBannerText = `PINDAH LOKASI: ${locationName}!`;
          surv.mapBannerTimer = 3.5;
          surv.core.hp = Math.min(surv.core.maxHp, surv.core.hp + 100);
        } else if (nextEvent !== 'normal') {
          state.soundQueue.push('pickup_kopi');
          surv.mapBannerText = `WAVE ${surv.wave}/${MAX_SURVIVAL_WAVE} • ${evInfo.label}`;
          surv.mapBannerTimer = 3.6;
        } else {
          surv.mapBannerText = `WAVE ${surv.wave}/${MAX_SURVIVAL_WAVE} DIMULAI!`;
          surv.mapBannerTimer = 2.0;
        }
      }
    }
  }

  // 4. Resolve Combat, Enemies & Crates
  resolveCombat(state, dt);
  updateEnemies(state, dt);
  updateCratesAndPickups(state, dt);

  const maxCrates = surv.waveEvent === 'golden_kendi_rain' ? 4 : 2;
  const crateInterval = surv.waveEvent === 'golden_kendi_rain' ? 5.0 : 11.5;
  if (state.crates.length < maxCrates) {
    state.crateSpawnTimer -= dt;
    if (state.crateSpawnTimer <= 0) {
      state.crateSpawnTimer = crateInterval;
      const spots = [
        { x: 330, y: 425 },
        { x: 630, y: 425 },
        { x: 340, y: 240 },
        { x: 620, y: 240 },
      ];
      const s = spots[Math.floor(Math.random() * spots.length)];
      spawnCrate(state, s.x, s.y, 120);
    }
  }

  for (let i = state.slashes.length - 1; i >= 0; i--) {
    state.slashes[i].life -= dt;
    if (state.slashes[i].life <= 0) state.slashes.splice(i, 1);
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.vz -= p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z = Math.max(0, p.z + p.vz * dt);
    p.alpha = Math.max(0, p.life / p.maxLife);
  }

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
