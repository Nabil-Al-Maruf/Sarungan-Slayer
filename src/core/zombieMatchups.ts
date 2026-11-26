import type { EnemyKind, HeroId } from './types';

export interface ZombieMatchup {
  zombieKind: EnemyKind;
  zombieName: string;
  /** Hero yang jadi KELEMAHAN zombie ini (Hero beri 1.55x DMG & terima 0.8x DMG) */
  weakAgainst: HeroId;
  weakReason: string;
  /** Hero yang jadi KELEBIHAN / KEBAL zombie ini (Zombie hanya terima 0.65x DMG & beri 1.35x DMG balik) */
  strongAgainst: HeroId;
  strongReason: string;
}

export const ZOMBIE_WEAK_DMG_MULT = 1.55;
export const ZOMBIE_STRONG_DEF_MULT = 0.65;
export const ZOMBIE_STRONG_ATK_MULT = 1.35;
export const ZOMBIE_WEAK_ATK_MULT = 0.8;

export const ZOMBIE_MATCHUPS: Partial<Record<EnemyKind, ZombieMatchup>> = {
  zombie_warga: {
    zombieKind: 'zombie_warga',
    zombieName: 'Zombie Warga',
    weakAgainst: 'bima',
    weakReason: 'Gerombolan warga langsung tersapu Badai Sarung Cak Bima',
    strongAgainst: 'mbak_sri',
    strongReason: 'Kerumunan padat menahan sabetan daun ringan Mbak Sri',
  },
  zombie_bocil: {
    zombieKind: 'zombie_bocil',
    zombieName: 'Zombie Bocil',
    weakAgainst: 'mbak_sri',
    weakReason: 'Bocil lincah mudah di-juggle Daun Sutra Mbak Sri',
    strongAgainst: 'bambang',
    strongReason: 'Gerakan kecil & gesit menghindari hantaman berat Bang Bambang',
  },
  zombie_pocong: {
    zombieKind: 'zombie_pocong',
    zombieName: 'Zombie Pocong',
    weakAgainst: 'gus_dimas',
    weakReason: 'Kain kafan gaib luluh oleh Cahaya Suci Gus Dimas',
    strongAgainst: 'pak_rt',
    strongReason: 'Tubuh gaib pocong kebal terhadap ledakan karbit Pak RT',
  },
  zombie_tuyul: {
    zombieKind: 'zombie_tuyul',
    zombieName: 'Zombie Tuyul',
    weakAgainst: 'mat_clurit',
    weakReason: 'Tuyul pencuri koin kalah cepat dari kilat Mat Clurit',
    strongAgainst: 'gus_dimas',
    strongReason: 'Tuyul licin kabur dari tebasan ritual lambat Gus Dimas',
  },
  zombie_kuntilanak: {
    zombieKind: 'zombie_kuntilanak',
    zombieName: 'Kuntilanak Terbang',
    weakAgainst: 'mbak_sri',
    weakReason: 'Badai Daun Sutra Mbak Sri merontokkan arwah melayang',
    strongAgainst: 'mat_clurit',
    strongReason: 'Melayang di udara menyulitkan sabetan jarak pendek Mat Clurit',
  },
  zombie_petasan: {
    zombieKind: 'zombie_petasan',
    zombieName: 'Bocil Petasan',
    weakAgainst: 'bambang',
    weakReason: 'Es Gletser Bang Bambang memadamkan sumbu petasan seketika',
    strongAgainst: 'pak_rt',
    strongReason: 'Tahan panas & ledakan api dari Meriam Karbit Pak RT',
  },
  zombie_gendruwo: {
    zombieKind: 'zombie_gendruwo',
    zombieName: 'Zombie Gendruwo',
    weakAgainst: 'pak_rt',
    weakReason: 'Bulu lebat Gendruwo mudah terbakar Api Karbit Pak RT',
    strongAgainst: 'bima',
    strongReason: 'Tubuh raksasa kokoh menahan dorongan angin Badai Cak Bima',
  },
  zombie_buto_ijo: {
    zombieKind: 'zombie_buto_ijo',
    zombieName: 'Buto Ijo Lendir',
    weakAgainst: 'bambang',
    weakReason: 'Lendir raksasa membeku & pecah kena Es Gletser Bang Bambang',
    strongAgainst: 'bima',
    strongReason: 'Lendir kental meredam sabetan angin sarung Cak Bima',
  },
  zombie_dukun: {
    zombieKind: 'zombie_dukun',
    zombieName: 'Mbah Dukun Santet',
    weakAgainst: 'gus_dimas',
    weakReason: 'Ilmu santet patah telak oleh Karomah Suci Gus Dimas',
    strongAgainst: 'mat_clurit',
    strongReason: 'Jimat penangkal petir meredam tebasan kilat Mat Clurit',
  },
};

export interface MatchupResult {
  mult: number;
  relation: 'weak' | 'strong' | 'neutral';
}

/**
 * Multiplier saat Hero menyerang Zombie.
 * - Jika zombie LEMAH ke hero ini -> 1.55x damage ('weak')
 * - Jika zombie KUAT/KEBAL ke hero ini -> 0.65x damage ('strong')
 */
export function getZombieTakenDmgMatchup(
  enemyKind: EnemyKind,
  attackerHeroId?: HeroId
): MatchupResult {
  if (!attackerHeroId) return { mult: 1, relation: 'neutral' };
  const m = ZOMBIE_MATCHUPS[enemyKind];
  if (!m) return { mult: 1, relation: 'neutral' };
  if (m.weakAgainst === attackerHeroId) {
    return { mult: ZOMBIE_WEAK_DMG_MULT, relation: 'weak' };
  }
  if (m.strongAgainst === attackerHeroId) {
    return { mult: ZOMBIE_STRONG_DEF_MULT, relation: 'strong' };
  }
  return { mult: 1, relation: 'neutral' };
}

/**
 * Multiplier saat Zombie menyerang Hero.
 * - Jika zombie KUAT ke hero ini -> 1.35x damage ('strong')
 * - Jika zombie LEMAH ke hero ini -> 0.80x damage ('weak')
 */
export function getZombieDealtDmgMatchup(
  enemyKind: EnemyKind,
  defenderHeroId?: HeroId
): MatchupResult {
  if (!defenderHeroId) return { mult: 1, relation: 'neutral' };
  const m = ZOMBIE_MATCHUPS[enemyKind];
  if (!m) return { mult: 1, relation: 'neutral' };
  if (m.strongAgainst === defenderHeroId) {
    return { mult: ZOMBIE_STRONG_ATK_MULT, relation: 'strong' };
  }
  if (m.weakAgainst === defenderHeroId) {
    return { mult: ZOMBIE_WEAK_ATK_MULT, relation: 'weak' };
  }
  return { mult: 1, relation: 'neutral' };
}

/**
 * Daftar zombie yang unggul / kalah melawan Hero tertentu (untuk Info Hero).
 */
export function getHeroZombieMatchups(heroId: HeroId): {
  strongVsZombies: ZombieMatchup[];
  weakVsZombies: ZombieMatchup[];
} {
  const all = Object.values(ZOMBIE_MATCHUPS).filter(Boolean) as ZombieMatchup[];
  return {
    strongVsZombies: all.filter((z) => z.weakAgainst === heroId),
    weakVsZombies: all.filter((z) => z.strongAgainst === heroId),
  };
}
