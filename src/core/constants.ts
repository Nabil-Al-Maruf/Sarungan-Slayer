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
  },
  {
    id: 1,
    label: 'P2',
    name: 'Cak Bagus (Biru Kenjeran)',
    shirt: '#2563eb',
    shirtShadow: '#1d4ed8',
    sarung: '#f97316',
    sarungStripe: '#fef08a',
    peci: '#0f172a',
    accent: '#3b82f6',
  },
  {
    id: 2,
    label: 'P3',
    name: 'Cak Dimas (Kuning Tunjungan)',
    shirt: '#eab308',
    shirtShadow: '#a16207',
    sarung: '#7c3aed',
    sarungStripe: '#f472b6',
    peci: '#1e293b',
    accent: '#eab308',
  },
  {
    id: 3,
    label: 'P4',
    name: 'Cak Raka (Hijau Persebaya)',
    shirt: '#10b981',
    shirtShadow: '#047857',
    sarung: '#dc2626',
    sarungStripe: '#f8fafc',
    peci: '#0f172a',
    accent: '#10b981',
  },
  {
    id: 4,
    label: 'P5',
    name: 'Cak Yudi (Ungu Suramadu)',
    shirt: '#9333ea',
    shirtShadow: '#6b21a8',
    sarung: '#06b6d4',
    sarungStripe: '#fef08a',
    peci: '#1e293b',
    accent: '#a855f7',
  },
];
