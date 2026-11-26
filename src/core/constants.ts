import type { HeroId, SarungStyle, SlashStyle, UltType } from './types';

export const VIRTUAL_WIDTH = 960;
export const VIRTUAL_HEIGHT = 540;
export const FIXED_DT = 1 / 60;

// Top-Down Playable Walkable Bounds (leaves top strip for 3/4 Kampung buildings)
export const ARENA_MIN_X = 36;
export const ARENA_MAX_X = VIRTUAL_WIDTH - 36;
export const ARENA_MIN_Y = 128;
export const ARENA_MAX_Y = VIRTUAL_HEIGHT - 28;

// Player Physics (Top-Down 8-Way + Z-Axis Hop)
export const PLAYER_RADIUS = 16;
export const MOVE_SPEED = 245;
export const MOVE_ACCEL = 2200;
export const Z_GRAVITY = 1550;
export const JUMP_VZ = 430;
export const DOUBLE_JUMP_VZ = 370;

// Dash (8-Way)
export const DASH_SPEED = 600;
export const DASH_DURATION = 0.16;
export const DASH_COOLDOWN = 0.6;

// Combat — Kibas Sarung (Melee 8-Way Arc)
export const MELEE_DURATION = 0.22;
export const MELEE_COOLDOWN = 0.28;
export const MELEE_REACH = 74;
export const MELEE_ARC_COS = 0.15; // ~160 degree wide front cone
export const MELEE_DAMAGE = 24;
export const MELEE_KNOCKBACK = 320;
export const MELEE_ULT_GAIN = 12;

// Combat — Sabetan Angin Pecut (8-Way Piercing Projectile)
export const PROJ_COOLDOWN = 2.5;
export const PROJ_SPEED = 560;
export const PROJ_RADIUS = 20;
export const PROJ_DAMAGE = 30;
export const PROJ_MAX_PIERCE = 3;
export const PROJ_LIFETIME = 1.25;
export const PROJ_ULT_GAIN = 8;

// Combat — Badai Sarung Suroboyo (360° Ultimate)
export const ULT_MAX = 100;
export const ULT_DURATION = 3.0;
export const ULT_TICK_INTERVAL = 0.16;
export const ULT_RADIUS = 118;
export const ULT_DAMAGE_PER_TICK = 18;
export const ULT_KNOCKBACK = 260;

export interface UltDef {
  id: UltType;
  title: string;
  icon: string;
  desc: string;
}

export const ULT_DEFS: Record<UltType, UltDef> = {
  gasing: {
    id: 'gasing',
    title: 'Badai Gasing Suroboyo',
    icon: '🌀',
    desc: 'Pusaran angin tornado 2.6 detik menyedot musuh ke tengah lalu meledakkan gelombang kejut seimbang!',
  },
  petir: {
    id: 'petir',
    title: 'Tebasan Petir Halilintar',
    icon: '⚡',
    desc: 'Sambaran kilat berantai cepat menyambar musuh di arena + setrum lumpuh 1.8 detik!',
  },
  gempa: {
    id: 'gempa',
    title: 'Hantam Gletser Es',
    icon: '❄️',
    desc: 'Lompat & hantam tanah memicu pilar gletser es raksasa — BEKU 1.8 detik & pecah perisai!',
  },
  naga: {
    id: 'naga',
    title: 'Naga Barong & Bambu Suci',
    icon: '🐉',
    desc: 'Panggil arwah Naga Barong menerjang menembus musuh sambil memulihkan 25% HP pribadi!',
  },
  mercon: {
    id: 'mercon',
    title: 'Meriam Bazooka Karbit',
    icon: '💥',
    desc: 'Tembakkan 3 roket artileri karbit berdaya ledak luas + kawah api membara selama 3 detik!',
  },
  selendang: {
    id: 'selendang',
    title: 'Badai Daun Sutra',
    icon: '🍃',
    desc: 'Pusaran badai daun silet & pita sutra 360° yang mengiris lebar & melontarkan musuh ke udara!',
  },
};

// Crate & Items
export const CRATE_SIZE = 40;
export const CRATE_HP = 45;
export const PICKUP_HEAL_AMOUNT = 35;
export const PICKUP_KOPI_ULT = 50;

export interface PlayerPalette {
  id: number;
  label: string;
  name: string;
  shirt: string;
  shirtShadow: string;
  sarung: string;
  sarungStripe: string;
  peci: string;
  accent: string;
  headgear:
    | 'peci_garuda'
    | 'udeng_kenjeran'
    | 'blangkon_batik'
    | 'baret_bonek'
    | 'sorban_putih'
    | 'udeng_wali';
  accessoryDesc: string;
  heroId?: HeroId;
  sarungStyle?: SarungStyle;
  slashStyle?: SlashStyle;
}

export const PLAYER_PALETTES: PlayerPalette[] = [
  {
    id: 0,
    label: 'P1',
    name: 'Cak Bima (Merah Bonek)',
    shirt: '#ef4444',
    shirtShadow: '#b91c1c',
    sarung: '#16a34a',
    sarungStripe: '#fde047',
    peci: '#1e293b',
    accent: '#ef4444',
    headgear: 'peci_garuda',
    accessoryDesc: 'Peci Garuda Emas & Selempang Merah',
    heroId: 'bima',
    sarungStyle: 'gulung_tempur',
    slashStyle: 'sarung_whip',
  },
  {
    id: 1,
    label: 'P2',
    name: 'Mat Clurit (Biru Sakera)',
    shirt: '#2563eb',
    shirtShadow: '#1d4ed8',
    sarung: '#dc2626',
    sarungStripe: '#fef08a',
    peci: '#0f172a',
    accent: '#3b82f6',
    headgear: 'udeng_kenjeran',
    accessoryDesc: 'Udeng Sakera & Bebat Kaki Pendekar',
    heroId: 'mat_clurit',
    sarungStyle: 'sarung_celana',
    slashStyle: 'clurit_crescent',
  },
  {
    id: 2,
    label: 'P3',
    name: 'Bang Bambang (Emas Jawara)',
    shirt: '#eab308',
    shirtShadow: '#a16207',
    sarung: '#7c2d12',
    sarungStripe: '#fde047',
    peci: '#1e293b',
    accent: '#f59e0b',
    headgear: 'blangkon_batik',
    accessoryDesc: 'Blangkon Batik & Sabuk Jawara Emas',
    heroId: 'bambang',
    sarungStyle: 'lipit_jawara',
    slashStyle: 'tinju_shockwave',
  },
  {
    id: 3,
    label: 'P4',
    name: 'Gus Dimas (Hijau Ampel)',
    shirt: '#10b981',
    shirtShadow: '#047857',
    sarung: '#065f46',
    sarungStripe: '#fef08a',
    peci: '#0f172a',
    accent: '#10b981',
    headgear: 'sorban_putih',
    accessoryDesc: 'Sorban Putih Waliyullah & Kalung Tasbih',
    heroId: 'gus_dimas',
    sarungStyle: 'jubah_wali',
    slashStyle: 'bambu_radiant',
  },
  {
    id: 4,
    label: 'P5',
    name: 'Pak RT Karbit (Oranye Linmas)',
    shirt: '#ea580c',
    shirtShadow: '#c2410c',
    sarung: '#0284c7',
    sarungStripe: '#fef08a',
    peci: '#0f172a',
    accent: '#ea580c',
    headgear: 'baret_bonek',
    accessoryDesc: 'Topi Dinas RT & Sabuk Kopel Linmas',
    heroId: 'pak_rt',
    sarungStyle: 'lipit_dinas',
    slashStyle: 'mercon_burst',
  },
  {
    id: 5,
    label: 'P6',
    name: 'Mbak Sri (Magenta Srikandi)',
    shirt: '#ec4899',
    shirtShadow: '#be185d',
    sarung: '#7e22ce',
    sarungStripe: '#fbcfe8',
    peci: '#4a044e',
    accent: '#ec4899',
    headgear: 'udeng_wali',
    accessoryDesc: 'Kebaya Srikandi & Pita Selendang Sutra',
    heroId: 'mbak_sri',
    sarungStyle: 'lilit_kebaya',
    slashStyle: 'selendang_cyclone',
  },
];
