import type { HeroId, SarungStyle, SlashElement, SlashStyle, UltType } from './types';

export interface HeroDef {
  id: HeroId;
  name: string;
  alias: string;
  tagline: string;
  archetype: 'Balanced' | 'Assassin' | 'Juggernaut' | 'Zoner' | 'Trapper' | 'Acrobat';
  avatar: string; // Emoji
  paletteIndex: number;
  accentColor: string;
  badgeBg: string;

  // Combat Specs
  weaponName: string;
  weaponDesc: string;
  projName: string;
  projDesc: string;
  ultName: string;
  ultDesc: string;
  ultImpactDesc: string;
  ultType: UltType;

  // Visual & Elemental Styles
  slashStyle: SlashStyle;
  sarungStyle: SarungStyle;
  defaultElement: SlashElement;
  sarungSilhouetteName: string;
  slashStyleName: string;

  // Base Stats
  maxHp: number;
  moveSpeed: number;
  dmgMult: number;
  knockbackMult: number;
  cdMult: number;
  maxJumps: number;
  dashSpeed: number;

  // Sound cues / Projectile kind
  projKind: string;
  slashColor: string;
}

export const HERO_DEFS: Record<HeroId, HeroDef> = {
  bima: {
    id: 'bima',
    name: 'Cak Bima',
    alias: 'Pendekar Sarung Sakti',
    tagline: 'Kibasane nggepuk, pecute nyamber!',
    archetype: 'Balanced',
    avatar: '🧣',
    paletteIndex: 0,
    accentColor: '#ef4444',
    badgeBg: '#7f1d1d',
    weaponName: 'Kibasan Sarung',
    weaponDesc: '3x sabetan combo seimbang karo jangkauan apik',
    projName: 'Pecut Kilat',
    projDesc: 'Sabetan angin pecut lurus sing nyengat',
    ultName: 'Badai Gasing Suroboyo',
    ultDesc: 'Muter kaya gasing narik kabeh musuh ing badai',
    ultImpactDesc: 'Menyedot semua musuh ke pusat pusaran, lalu meledakkan mentalan besar (knockback 420) di akhir!',
    ultType: 'gasing',
    slashStyle: 'sarung_whip',
    sarungStyle: 'gulung_tempur',
    defaultElement: 'badai',
    sarungSilhouetteName: 'Gulung Tempur Di Atas Lutut',
    slashStyleName: 'Kibasan Cambuk Anyaman Sarung',
    maxHp: 110,
    moveSpeed: 210,
    dmgMult: 1.0,
    knockbackMult: 1.0,
    cdMult: 1.0,
    maxJumps: 2,
    dashSpeed: 520,
    projKind: 'slash',
    slashColor: '#38bdf8',
  },
  mat_clurit: {
    id: 'mat_clurit',
    name: 'Mat Clurit',
    alias: 'Pendekar Madura Sakera',
    tagline: 'Mlayu banter, clurite ngiris kilat!',
    archetype: 'Assassin',
    avatar: '🗡️',
    paletteIndex: 1,
    accentColor: '#3b82f6',
    badgeBg: '#1e3a8a',
    weaponName: 'Tebasan Clurit',
    weaponDesc: '4x sabetan super cepet karo damage kritis dhuwur',
    projName: 'Clurit Putar',
    projDesc: 'Lemparan clurit boomerang sing mbalik maneh',
    ultName: 'Tebasan Petir Halilintar',
    ultDesc: 'Sambaran kilat langit berantai menyambar musuh di arena',
    ultImpactDesc: 'Melumpuhkan musuh (Stun Listrik 1.8 detik) + Bonus Eksekusi +40% Damage ke musuh sekarat (<50% HP)!',
    ultType: 'petir',
    slashStyle: 'clurit_crescent',
    sarungStyle: 'sarung_celana',
    defaultElement: 'petir',
    sarungSilhouetteName: 'Sarung Celana Sakera & Bebat Kaki',
    slashStyleName: 'Tebasan Sabit Aret Silang Kembar',
    maxHp: 95,
    moveSpeed: 245,
    dmgMult: 1.2,
    knockbackMult: 1.15,
    cdMult: 0.85,
    maxJumps: 2,
    dashSpeed: 620,
    projKind: 'clurit',
    slashColor: '#60a5fa',
  },
  bambang: {
    id: 'bambang',
    name: 'Bang Bambang',
    alias: 'Preman Pasar Tunjungan',
    tagline: 'Awak wesi, tinjune nggilani!',
    archetype: 'Juggernaut',
    avatar: '🥊',
    paletteIndex: 2,
    accentColor: '#f59e0b',
    badgeBg: '#78350f',
    weaponName: 'Tinju Beton',
    weaponDesc: '2x pukulan abot sing mentalno musuh adoh pol',
    projName: 'Bakiak Kayu',
    projDesc: 'Lemparan sandal kayu abot sing nggulingno lawan',
    ultName: 'Gempa Hantam Tunjungan',
    ultDesc: 'Lompat dhuwur terus ngantem bumi gawe gelombang seismik & stun berat',
    ultImpactDesc: 'Pemecah Perisai (+50% Damage ke Boss & musuh berpelindung/tank) + lempar ke udara & Stun 1.6 detik!',
    ultType: 'gempa',
    slashStyle: 'tinju_shockwave',
    sarungStyle: 'lipit_jawara',
    defaultElement: 'api',
    sarungSilhouetteName: 'Lipit Tebal Gagah & Sabuk Jawara Emas',
    slashStyleName: 'Gelombang Kejut Tinju Pecah Bumi',
    maxHp: 140,
    moveSpeed: 185,
    dmgMult: 1.35,
    knockbackMult: 1.5,
    cdMult: 1.15,
    maxJumps: 2,
    dashSpeed: 460,
    projKind: 'bakiak',
    slashColor: '#fbbf24',
  },
  gus_dimas: {
    id: 'gus_dimas',
    name: 'Gus Dimas',
    alias: 'Santri Karomah Ampel',
    tagline: 'Bambu kuning sakti, ilmu linuwih!',
    archetype: 'Zoner',
    avatar: '🎋',
    paletteIndex: 3,
    accentColor: '#10b981',
    badgeBg: '#064e3b',
    weaponName: 'Bambu Kuning',
    weaponDesc: 'Tusukan tongkat dawa sing aman saka kadohan',
    projName: 'Angin Tasbih',
    projDesc: 'Gelombang suci tembus sing ndorong musuh mundur',
    ultName: 'Naga Barong & Bambu Suci',
    ultDesc: 'Arwah Naga Barong menerjang menembus musuh + pulihkan HP tim',
    ultImpactDesc: 'Menyapu mundur barisan musuh + meninggalkan jejak api suci + memulihkan +25% HP diri sendiri & kawan terdekat!',
    ultType: 'naga',
    slashStyle: 'bambu_radiant',
    sarungStyle: 'jubah_wali',
    defaultElement: 'suci',
    sarungSilhouetteName: 'Jubah Panjang Menjuntai & Sorban Waliyullah',
    slashStyleName: 'Kaligrafi Suci Karomah Ampel',
    maxHp: 100,
    moveSpeed: 215,
    dmgMult: 1.0,
    knockbackMult: 0.9,
    cdMult: 0.95,
    maxJumps: 3, // Triple Jump!
    dashSpeed: 520,
    projKind: 'tasbih',
    slashColor: '#34d399',
  },
  pak_rt: {
    id: 'pak_rt',
    name: 'Pak RT Karbit',
    alias: 'Sesepuh Mercon Kenjeran',
    tagline: 'Duwe mercon renteng, ojo cedak-cedak!',
    archetype: 'Trapper',
    avatar: '🧨',
    paletteIndex: 4,
    accentColor: '#ea580c',
    badgeBg: '#7c2d12',
    weaponName: 'Sapu Lidi Sakti',
    weaponDesc: 'Kibasan sapu lidi kanggo ngusir musuh cedak',
    projName: 'Mercon Banting',
    projDesc: 'Bom petasan sing mumbul terus mbledos amba',
    ultName: 'Meriam Bazooka Karbit',
    ultDesc: 'Nembak 3 roket artileri karbit + kawah api membara 3 detik',
    ultImpactDesc: '3 Ledakan Area Luas + meninggalkan Kawah Api di tanah yang membakar terus-menerus & memperlambat musuh!',
    ultType: 'mercon',
    slashStyle: 'mercon_burst',
    sarungStyle: 'lipit_dinas',
    defaultElement: 'api',
    sarungSilhouetteName: 'Lipat Dinas Rapi & Sabuk Kopel Linmas',
    slashStyleName: 'Ledakan Kilat Mesiu Karbit',
    maxHp: 105,
    moveSpeed: 200,
    dmgMult: 1.15,
    knockbackMult: 1.25,
    cdMult: 1.0,
    maxJumps: 2,
    dashSpeed: 500,
    projKind: 'mercon_bomb',
    slashColor: '#fb923c',
  },
  mbak_sri: {
    id: 'mbak_sri',
    name: 'Mbak Sri',
    alias: 'Srikandi Rolam',
    tagline: 'Selendang sutra alus tapi mbebayani!',
    archetype: 'Acrobat',
    avatar: '💃',
    paletteIndex: 5,
    accentColor: '#ec4899',
    badgeBg: '#831843',
    weaponName: 'Selendang Sutra',
    weaponDesc: 'Kibasan selendang amba sing narik musuh nyedak',
    projName: 'Piring Terbang',
    projDesc: 'Lemparan piring sambel cepet kaya frisbee',
    ultName: 'Badai Selendang Sutra',
    ultDesc: 'Pusaran pita sutra 360° kecepatan tinggi mengiris & melontarkan musuh ke udara',
    ultImpactDesc: 'Mengangkat & menjuggle musuh terus-menerus di udara (tidak bisa menyerang balik) + lemparan spiral ke atas!',
    ultType: 'selendang',
    slashStyle: 'selendang_cyclone',
    sarungStyle: 'lilit_kebaya',
    defaultElement: 'badai',
    sarungSilhouetteName: 'Sarung Lilit Anggun & Pita Selendang Sutra',
    slashStyleName: 'Pusaran Angin Pita Sutra Merah',
    maxHp: 100,
    moveSpeed: 235,
    dmgMult: 1.05,
    knockbackMult: 1.1,
    cdMult: 0.9,
    maxJumps: 2,
    dashSpeed: 580,
    projKind: 'piring',
    slashColor: '#f472b6',
  },
};

export const HERO_LIST: HeroDef[] = Object.values(HERO_DEFS);

export function getHeroDef(id?: HeroId): HeroDef {
  return (id && HERO_DEFS[id]) || HERO_DEFS.bima;
}
