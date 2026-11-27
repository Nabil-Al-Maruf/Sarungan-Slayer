import { getHeroDef } from './heroes';
import type {
  ComboUltParticipant,
  ComboUltState,
  GameState,
  HeroId,
  PlayerState,
  SlashElement,
} from './types';

/** Window (seconds) within which players pressing Ult simultaneously trigger a Co-op Combo Ultimate */
export const ULT_SYNC_WINDOW = 0.65;

const ELEM_META: Record<SlashElement, { label: string; icon: string; color: string }> = {
  none: { label: 'SARUNG', icon: '🧣', color: '#94a3b8' },
  badai: { label: 'BADAI', icon: '🌀', color: '#38bdf8' },
  petir: { label: 'PETIR', icon: '⚡', color: '#facc15' },
  es: { label: 'ES', icon: '❄️', color: '#67e8f9' },
  suci: { label: 'SUCI', icon: '✨', color: '#fde047' },
  api: { label: 'API', icon: '🔥', color: '#f97316' },
  daun: { label: 'DAUN', icon: '🍃', color: '#4ade80' },
};

interface DuoComboDef {
  title: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor: string;
  visualPattern:
    | 'storm_lightning'
    | 'frost_shatter'
    | 'inferno_vortex'
    | 'sacred_dragon'
    | 'emerald_cyclone';
}

/**
 * All 15 unique 2-Hero combinations (sorted heroId pair key: "a+b")
 * Each pair gets its own elemental arena animation pattern!
 */
const DUO_COMBOS: Record<string, DuoComboDef> = {
  'bima+mat_clurit': {
    title: 'TOPAN HALILINTAR SURAMADU',
    subtitle: '🌀 BADAI × ⚡ PETIR • VORTEX ELEKTRIK',
    primaryColor: '#38bdf8',
    secondaryColor: '#facc15',
    visualPattern: 'storm_lightning',
  },
  'bambang+bima': {
    title: 'BADAI SALJU GLETSER',
    subtitle: '🌀 BADAI × ❄️ ES • TOPAN PEMBEKU',
    primaryColor: '#67e8f9',
    secondaryColor: '#38bdf8',
    visualPattern: 'frost_shatter',
  },
  'bima+gus_dimas': {
    title: 'PUSARAN KAROMAH AMPEL',
    subtitle: '🌀 BADAI × ✨ SUCI • TORNADO PENYEMBUH',
    primaryColor: '#38bdf8',
    secondaryColor: '#fde047',
    visualPattern: 'sacred_dragon',
  },
  'bima+pak_rt': {
    title: 'TORNADO API KARBIT',
    subtitle: '🌀 BADAI × 🔥 API • PILAR NERAKA',
    primaryColor: '#f97316',
    secondaryColor: '#38bdf8',
    visualPattern: 'inferno_vortex',
  },
  'bima+mbak_sri': {
    title: 'SIKLON RIMBA SUTRA',
    subtitle: '🌀 BADAI × 🍃 DAUN • BADAI SILET',
    primaryColor: '#4ade80',
    secondaryColor: '#38bdf8',
    visualPattern: 'emerald_cyclone',
  },
  'bambang+mat_clurit': {
    title: 'SUPERKONDUKTOR GLETSER',
    subtitle: '⚡ PETIR × ❄️ ES • PECAH ARMOR KILAT',
    primaryColor: '#facc15',
    secondaryColor: '#67e8f9',
    visualPattern: 'frost_shatter',
  },
  'gus_dimas+mat_clurit': {
    title: 'PETIR LANGIT WALI',
    subtitle: '⚡ PETIR × ✨ SUCI • HUJAN HALILINTAR',
    primaryColor: '#facc15',
    secondaryColor: '#fde047',
    visualPattern: 'storm_lightning',
  },
  'mat_clurit+pak_rt': {
    title: 'OVERLOAD KARBIT PETIR',
    subtitle: '⚡ PETIR × 🔥 API • LEDAKAN PLASMA',
    primaryColor: '#f97316',
    secondaryColor: '#facc15',
    visualPattern: 'inferno_vortex',
  },
  'mat_clurit+mbak_sri': {
    title: 'KILAT DAUN SAKERA',
    subtitle: '⚡ PETIR × 🍃 DAUN • TEBASAN CAHAYA',
    primaryColor: '#4ade80',
    secondaryColor: '#facc15',
    visualPattern: 'storm_lightning',
  },
  'bambang+gus_dimas': {
    title: 'KUBAH KRISTAL KAROMAH',
    subtitle: '❄️ ES × ✨ SUCI • BENTENG BEKU SUCI',
    primaryColor: '#67e8f9',
    secondaryColor: '#fde047',
    visualPattern: 'frost_shatter',
  },
  'bambang+pak_rt': {
    title: 'THERMAL SHOCK MERIAM ES',
    subtitle: '❄️ ES × 🔥 API • LEDAKAN UAP EKSTREM',
    primaryColor: '#67e8f9',
    secondaryColor: '#f97316',
    visualPattern: 'inferno_vortex',
  },
  'bambang+mbak_sri': {
    title: 'KRISTAL BUNGA SALJU',
    subtitle: '❄️ ES × 🍃 DAUN • HUJAN KELOPAK ES',
    primaryColor: '#67e8f9',
    secondaryColor: '#4ade80',
    visualPattern: 'frost_shatter',
  },
  'gus_dimas+pak_rt': {
    title: 'NAGA KARBIT NUSANTARA',
    subtitle: '✨ SUCI × 🔥 API • NAGA SURYA RAKSASA',
    primaryColor: '#fde047',
    secondaryColor: '#f97316',
    visualPattern: 'sacred_dragon',
  },
  'gus_dimas+mbak_sri': {
    title: 'TAMAN SURGA SUTRA',
    subtitle: '✨ SUCI × 🍃 DAUN • SIKLON BUNGA KAROMAH',
    primaryColor: '#fde047',
    secondaryColor: '#4ade80',
    visualPattern: 'sacred_dragon',
  },
  'mbak_sri+pak_rt': {
    title: 'BADAI BARA DAUN MEMBARA',
    subtitle: '🔥 API × 🍃 DAUN • PUSARAN INFERNO',
    primaryColor: '#f97316',
    secondaryColor: '#4ade80',
    visualPattern: 'inferno_vortex',
  },
};

export function resolveComboUltSpec(participants: ComboUltParticipant[]): Omit<
  ComboUltState,
  'elapsed' | 'cutinDuration' | 'totalDuration' | 'impactApplied' | 'centerX' | 'centerY'
> {
  const count = Math.max(2, Math.min(5, participants.length)) as 2 | 3 | 4 | 5;
  const sortedIds = participants.map((p) => p.heroId).sort();
  const comboKey = `${count}x:${sortedIds.join('+')}`;

  const uniqueElems = Array.from(new Set(participants.map((p) => p.element)));
  const primaryColor = ELEM_META[participants[0]?.element || 'badai'].color;
  const secondaryColor = ELEM_META[participants[1]?.element || 'petir'].color;
  const elemChain = uniqueElems
    .map((e) => `${ELEM_META[e].icon} ${ELEM_META[e].label}`)
    .join(' × ');

  if (count === 2) {
    const pairKey = `${sortedIds[0]}+${sortedIds[1]}`;
    const duo = DUO_COMBOS[pairKey];
    if (duo) {
      return {
        tier: 2,
        comboKey,
        title: duo.title,
        subtitle: duo.subtitle,
        tierLabel: '⚡ 2× DUO RESONANCE',
        primaryColor: duo.primaryColor,
        secondaryColor: duo.secondaryColor,
        visualPattern: duo.visualPattern,
        participants,
      };
    }
    const hName = getHeroDef(participants[0].heroId).name.toUpperCase();
    return {
      tier: 2,
      comboKey,
      title: `RESONANSI KEMBAR ${hName}`,
      subtitle: `${elemChain} • SERANGAN GANDA`,
      tierLabel: '⚡ 2× DUO RESONANCE',
      primaryColor,
      secondaryColor: '#ffffff',
      visualPattern: 'emerald_cyclone',
      participants,
    };
  }

  if (count === 3) {
    return {
      tier: 3,
      comboKey,
      title: `TRINITAS RESONANSI SUROBOYO`,
      subtitle: `${elemChain} • PRISMA 3 PILAR`,
      tierLabel: '🔥 3× TRIO TRINITY',
      primaryColor,
      secondaryColor,
      visualPattern: 'trinity_prism',
      participants,
    };
  }

  if (count === 4) {
    return {
      tier: 4,
      comboKey,
      title: `KUARTET BENCANA ELEMEN`,
      subtitle: `${elemChain} • SILANG 4 PENJURU`,
      tierLabel: '💥 4× QUARTET CATACLYSM',
      primaryColor,
      secondaryColor,
      visualPattern: 'quartet_cross',
      participants,
    };
  }

  return {
    tier: 5,
    comboKey,
    title: 'KEBANGKITAN 5 PENDEKAR SUROBOYO',
    subtitle: `${elemChain} • PENTA RESONANCE SEMPURNA`,
    tierLabel: '👑 5× PENTA ULTIMATE',
    primaryColor: '#facc15',
    secondaryColor: '#38bdf8',
    visualPattern: 'penta_shatter',
    participants: participants.slice(0, 5),
  };
}

/**
 * Registers a player's Ultimate activation for simultaneous Co-op Combo detection.
 * Only triggers when 2+ players in a Mabar match press Ultimate within ULT_SYNC_WINDOW.
 */
export function registerUltActivationForCombo(
  state: GameState,
  player: PlayerState
): ComboUltState | null {
  // Strictly Mabar Co-op Survival / 2+ players only (disabled in PvP Brawl!)
  if (state.mode === 'brawl' || state.players.length < 2) return null;

  const hDef = getHeroDef(player.heroId);
  const heroId: HeroId = player.heroId || hDef.id;
  const element: SlashElement =
    player.slashElement && player.slashElement !== 'none'
      ? player.slashElement
      : hDef.defaultElement;

  const entry: ComboUltParticipant & { pressedAt: number } = {
    playerId: player.id,
    name: player.name || hDef.name,
    heroId,
    paletteIndex: player.paletteIndex,
    element,
    pressedAt: state.time,
  };

  if (!state.ultSyncBuffer) state.ultSyncBuffer = [];

  // Prune expired entries outside the sync window
  state.ultSyncBuffer = state.ultSyncBuffer.filter(
    (e) => state.time - e.pressedAt <= ULT_SYNC_WINDOW && e.playerId !== player.id
  );
  state.ultSyncBuffer.push(entry);

  // If a Combo Ult is already in its cut-in phase and a 3rd/4th/5th player joins simultaneously, upgrade it live!
  if (state.comboUlt && !state.comboUlt.impactApplied && state.comboUlt.elapsed <= 0.7) {
    const alreadyIn = state.comboUlt.participants.some((p) => p.playerId === player.id);
    if (!alreadyIn && state.comboUlt.participants.length < 5) {
      const updatedParticipants: ComboUltParticipant[] = [
        ...state.comboUlt.participants,
        {
          playerId: entry.playerId,
          name: entry.name,
          heroId: entry.heroId,
          paletteIndex: entry.paletteIndex,
          element: entry.element,
        },
      ];
      const spec = resolveComboUltSpec(updatedParticipants);
      const cutinDur = 1.05 + (spec.tier - 2) * 0.1;
      state.comboUlt = {
        ...state.comboUlt,
        ...spec,
        elapsed: Math.min(state.comboUlt.elapsed, 0.25), // Brief dramatic extension for newly joined hero
        cutinDuration: cutinDur,
        totalDuration: cutinDur + 1.15,
      };
      player.invulnTimer = Math.max(player.invulnTimer, cutinDur + 1.4);
      state.soundQueue.push('smash_ball');
      return state.comboUlt;
    }
    return state.comboUlt;
  }

  // Trigger Combo Ultimate once 2+ distinct players pressed Ultimate together (max 5 in Co-op)!
  if (state.ultSyncBuffer.length >= 2) {
    const participants: ComboUltParticipant[] = state.ultSyncBuffer.slice(0, 5).map((e) => ({
      playerId: e.playerId,
      name: e.name,
      heroId: e.heroId,
      paletteIndex: e.paletteIndex,
      element: e.element,
    }));

    const spec = resolveComboUltSpec(participants);
    const cutinDuration = 1.05 + (spec.tier - 2) * 0.1;
    const totalDuration = cutinDuration + 1.15;

    // Compute center of participating players
    let cx = 0;
    let cy = 0;
    let validCount = 0;
    for (const part of participants) {
      const pl = state.players.find((p) => p.id === part.playerId);
      if (pl) {
        cx += pl.x;
        cy += pl.y;
        validCount++;
        pl.invulnTimer = Math.max(pl.invulnTimer, totalDuration + 0.4);
      }
    }
    const centerX = validCount > 0 ? cx / validCount : state.arenaWidth * 0.5;
    const centerY = validCount > 0 ? cy / validCount : state.arenaHeight * 0.5;

    state.comboUlt = {
      ...spec,
      elapsed: 0,
      cutinDuration,
      totalDuration,
      impactApplied: false,
      centerX,
      centerY,
    };

    state.soundQueue.push('smash_ball');
    state.soundQueue.push('ult_start');
    state.shakeTimer = Math.max(state.shakeTimer, 0.4);
    state.shakeIntensity = Math.max(state.shakeIntensity, 8 + spec.tier * 2);
    return state.comboUlt;
  }

  return null;
}

/**
 * Steps active Co-op Combo Ultimate.
 * Returns `true` if the Wuthering Waves cut-in freeze is currently active (caller should pause world physics).
 */
export function stepComboUlt(state: GameState, dt: number): boolean {
  const cu = state.comboUlt;
  if (!cu) return false;

  cu.elapsed += dt;

  // Phase 1: Wuthering Waves Cinematic Cut-In Freeze
  if (cu.elapsed < cu.cutinDuration) {
    return true;
  }

  // Phase 2: Impact Detonation right as Cut-In finishes!
  if (!cu.impactApplied) {
    cu.impactApplied = true;
    applyComboUltImpact(state, cu);
  }

  // Phase 3: Clean up after Arena Finisher animation ends
  if (cu.elapsed >= cu.totalDuration) {
    state.comboUlt = undefined;
    if (state.ultSyncBuffer) state.ultSyncBuffer.length = 0;
  }

  return false;
}

function applyComboUltImpact(state: GameState, cu: ComboUltState): void {
  const tier = cu.tier;
  const elements = new Set(cu.participants.map((p) => p.element));
  const participantIds = new Set(cu.participants.map((p) => p.playerId));

  // Heavy screen shake + dramatic audio impact
  state.shakeTimer = Math.max(state.shakeTimer, 0.65 + tier * 0.1);
  state.shakeIntensity = Math.max(state.shakeIntensity, 10 + tier * 2.5);
  state.soundQueue.push('ult_start');
  state.soundQueue.push('crate_break');

  if (elements.has('petir')) state.soundQueue.push('slash_petir');
  if (elements.has('es')) state.soundQueue.push('slash_es');
  if (elements.has('daun')) state.soundQueue.push('slash_daun');
  if (elements.has('api')) state.soundQueue.push('slash_api');

  // Scaled Arena-Wide Damage (2x=240, 3x=360, 4x=520, 5x=850)
  const tierDmgTable: Record<2 | 3 | 4 | 5, number> = {
    2: 240,
    3: 360,
    4: 520,
    5: 850,
  };
  const baseComboDmg = tierDmgTable[tier];

  // 1. Damage all Enemies (Survival / Story / Sandbox)
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dmg = e.isBoss ? Math.round(baseComboDmg * 0.85) : baseComboDmg;
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlashTimer = 0.4;

    // Combined elemental crowd-control effects from all participants!
    if (elements.has('es') || elements.has('petir') || tier >= 4) {
      e.stunTimer = Math.max(e.stunTimer, 1.8 + tier * 0.35);
    }
    if (elements.has('daun') || tier >= 5) {
      e.vz = Math.max(e.vz, 280 + tier * 35);
    }
    const ang = Math.atan2(e.y - cu.centerY, e.x - cu.centerX);
    if (elements.has('badai') && tier === 2) {
      // Pull inward then slam
      e.vx += -Math.cos(ang) * 240;
      e.vy += -Math.sin(ang) * 180;
    } else {
      e.vx += Math.cos(ang) * (280 + tier * 55);
      e.vy += Math.sin(ang) * (210 + tier * 40);
    }

    state.floatingTexts.push({
      x: e.x,
      y: e.y - e.z - 46,
      vy: -65,
      text: `⚡ -${dmg}!`,
      color: cu.primaryColor,
      scale: 1.25 + (tier - 2) * 0.08,
      life: 1.15,
      maxLife: 1.15,
    });

    if (e.hp <= 0) {
      state.soundQueue.push('ko');
      state.koCount++;
      if (state.mode === 'survival') {
        for (const pl of state.players) {
          if (participantIds.has(pl.id)) {
            pl.coins += Math.round(25 * (pl.coinMult ?? 1));
          }
        }
      }
    }
  }

  // 2. Brawl Mode: Launch non-participating opponents!
  if (state.mode === 'brawl') {
    for (const pl of state.players) {
      if (participantIds.has(pl.id) || (pl.brawlStocks ?? 0) <= 0 || pl.invulnTimer > 0) continue;
      const brawlDmg = 28 + tier * 10;
      pl.hp = Math.max(0, pl.hp - brawlDmg);
      pl.hitFlashTimer = 0.45;
      const dir = pl.x >= cu.centerX ? 1 : -1;
      pl.vx = dir * (420 + tier * 90);
      pl.vy = -(380 + tier * 75);
      pl.lastHitBy = cu.participants[0]?.playerId;
      pl.lastHitTime = state.time;
    }
  }

  // 3. Suci / 5x Penta Ultimate Team Heal Bonus!
  if (elements.has('suci') || tier === 5) {
    const healRatio = tier === 5 ? 1.0 : 0.35;
    for (const pl of state.players) {
      if (pl.hp <= 0 || pl.knockedDown) continue;
      const healAmt = Math.round(pl.maxHp * healRatio);
      pl.hp = Math.min(pl.maxHp, pl.hp + healAmt);
      state.floatingTexts.push({
        x: pl.x,
        y: pl.y - pl.z - 54,
        vy: -50,
        text: tier === 5 ? '👑 FULL HEAL PENTA!' : `✨ +${healAmt} HP RESONANSI!`,
        color: '#4ade80',
        scale: 1.15,
        life: 1.25,
        maxLife: 1.25,
      });
    }
  }

  // 4. Api Element: Spawn blazing fire craters around the impact center!
  if (elements.has('api') && state.mode !== 'brawl') {
    const craterCount = Math.min(4, tier);
    for (let i = 0; i < craterCount; i++) {
      const a = (Math.PI * 2 * i) / craterCount;
      state.hazards.push({
        id: state.nextEntityId++,
        kind: 'fire_crater',
        ownerId: cu.participants[0]?.playerId,
        x: cu.centerX + Math.cos(a) * 110,
        y: cu.centerY + Math.sin(a) * 75,
        radius: 78,
        delay: 0,
        maxDelay: 0,
        damage: 45 + tier * 10,
        detonated: true,
        flashTimer: 3.5,
      });
    }
  }

  // 5. Massive Elemental Particle Explosion across the arena
  const pCount = 24 + tier * 10;
  const paletteColors = cu.participants.map((p) => ELEM_META[p.element].color);
  for (let i = 0; i < pCount; i++) {
    const ang = (Math.PI * 2 * i) / pCount + Math.random() * 0.2;
    const spd = 160 + Math.random() * (240 + tier * 40);
    state.particles.push({
      x: cu.centerX,
      y: cu.centerY,
      z: 16,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.72,
      vz: 120 + Math.random() * 140,
      size: 5 + Math.random() * 5,
      color: paletteColors[i % paletteColors.length] || cu.primaryColor,
      alpha: 1,
      life: 0.6 + Math.random() * 0.35,
      maxLife: 0.95,
      gravity: 340,
    });
  }

  // Center Announcement Banner
  state.floatingTexts.push({
    x: cu.centerX,
    y: cu.centerY - 78,
    vy: -42,
    text: `${cu.tierLabel} • ${cu.title}!`,
    color: cu.primaryColor,
    scale: 1.45,
    life: 1.65,
    maxLife: 1.65,
  });
}
