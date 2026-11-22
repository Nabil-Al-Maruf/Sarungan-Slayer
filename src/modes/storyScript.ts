export type StoryBeat = 'intro' | 'boss' | 'outro';

export interface StoryLine {
  speaker: string;
  role: string;
  avatar: string;
  accent: string;
  side: 'left' | 'right';
  text: string;
  mission?: string;
}

export function getStoryDialogue(
  stage: 1 | 2 | 3,
  beat: StoryBeat,
  rawPlayerName: string
): StoryLine[] {
  const hero = rawPlayerName.trim().slice(0, 14) || 'Cak Bima';

  if (stage === 1) {
    if (beat === 'intro') {
      return [
        {
          speaker: 'PAK RT WARKOP',
          role: 'SESEPUH KAMPUNG',
          avatar: '👴',
          accent: '#eab308',
          side: 'right',
          mission: 'MISI: Kejar Geng Sarung Baja di Gang Tambak & kalahkan Cak Koordinator!',
          text: `Waduh ${hero}! Geng Sarung Baja barusan nyerang Pos Tambak. Kendi kopi sama Sarung Pusaka kampung digondol mereka!`,
        },
        {
          speaker: hero.toUpperCase(),
          role: 'AREK SUROBOYO',
          avatar: '🧣',
          accent: '#ef4444',
          side: 'left',
          mission: 'MISI: Kejar Geng Sarung Baja di Gang Tambak & kalahkan Cak Koordinator!',
          text: 'Kurang ajar tenan! Gak bakal tak biarno kampung iki diobrak-abrik. Tak kejar saiki juga, Pak RT!',
        },
        {
          speaker: 'PAK RT WARKOP',
          role: 'SESEPUH KAMPUNG',
          avatar: '👴',
          accent: '#eab308',
          side: 'right',
          mission: 'MISI: Kejar Geng Sarung Baja di Gang Tambak & kalahkan Cak Koordinator!',
          text: 'Ati-ati nang ujung gang, anak buah Cak Koordinator wis jaga! Pake Kibas Sarung & Pecutmu buat buka jalan!',
        },
      ];
    }
    if (beat === 'boss') {
      return [
        {
          speaker: 'CAK KOORDINATOR',
          role: 'BOSS STAGE 1 • GANG TAMBAK',
          avatar: '🕶️',
          accent: '#f97316',
          side: 'right',
          text: 'Weh, arek Tambak nekat juga sampek sini! Mau lewat? Hadapi dulu pasukanku, rek!',
        },
        {
          speaker: hero.toUpperCase(),
          role: 'AREK SUROBOYO',
          avatar: '🧣',
          accent: '#ef4444',
          side: 'left',
          text: 'Balikno kendi kopi sama Sarung Pusaka Pos Warkop, utowo tak kibas sarungmu sampek mabur!',
        },
      ];
    }
    return [
      {
        speaker: 'CAK KOORDINATOR',
        role: 'BOSS STAGE 1 • KALAH',
        avatar: '😵',
        accent: '#f97316',
        side: 'right',
        text: 'Aduh ampun Cak! Aku cuma disuruh jaga gang... Sarung Pusaka wis dibawa bos-ku ke Jalan Tunjungan!',
      },
      {
        speaker: hero.toUpperCase(),
        role: 'AREK SUROBOYO',
        avatar: '🧣',
        accent: '#ef4444',
        side: 'left',
        text: 'Jalan Tunjungan? Oke, tak susul saiki juga. Kampung kudu aman malam iki!',
      },
    ];
  }

  if (stage === 2) {
    if (beat === 'intro') {
      return [
        {
          speaker: 'CAK TAHU TEK',
          role: 'PEDAGANG TUNJUNGAN',
          avatar: '🍜',
          accent: '#22c55e',
          side: 'right',
          mission: 'MISI: Buka blokade Jalan Tunjungan & tumbangkan Jagoan Tunjungan!',
          text: `Tolong rek ${hero}! Geng sebelah nutup Jalan Tunjungan, gerobak-gerobak dipalak semua sama anak buah Jagoan Tunjungan!`,
        },
        {
          speaker: hero.toUpperCase(),
          role: 'AREK SUROBOYO',
          avatar: '🧣',
          accent: '#ef4444',
          side: 'left',
          mission: 'MISI: Buka blokade Jalan Tunjungan & tumbangkan Jagoan Tunjungan!',
          text: 'Tenang Cak, munduro sek biar aman! Mereka juga bawa Sarung Pusaka kampungku — biar tak beresno semua!',
        },
      ];
    }
    if (beat === 'boss') {
      return [
        {
          speaker: 'JAGOAN TUNJUNGAN',
          role: 'BOSS STAGE 2 • JALAN TUNJUNGAN',
          avatar: '🔥',
          accent: '#dc2626',
          side: 'right',
          text: `Haha, iki toh ${hero} sing ngalahno Koordinator? Nang Tunjungan, sarungku sing paling sakti!`,
        },
        {
          speaker: hero.toUpperCase(),
          role: 'AREK SUROBOYO',
          avatar: '🧣',
          accent: '#ef4444',
          side: 'left',
          text: 'Ojo kakehan omong! Ayo adu kibas sarung nang kene, tunjukno kekuatanmu!',
        },
      ];
    }
    return [
      {
        speaker: 'JAGOAN TUNJUNGAN',
        role: 'BOSS STAGE 2 • KALAH',
        avatar: '😵',
        accent: '#dc2626',
        side: 'right',
        text: 'Gila, cepet banget kibasmu... Raja Sarung Baja wis nunggu nang tengah Jembatan Suramadu malam iki!',
      },
      {
        speaker: hero.toUpperCase(),
        role: 'AREK SUROBOYO',
        avatar: '🧣',
        accent: '#ef4444',
        side: 'left',
        text: 'Jembatan Suramadu... Duel terakhir. Aku bakal rebut balik Sarung Pusaka malam iki!',
      },
    ];
  }

  // Stage 3: Jembatan Suramadu (Malam)
  if (beat === 'intro') {
    return [
      {
        speaker: hero.toUpperCase(),
        role: 'AREK SUROBOYO',
        avatar: '🧣',
        accent: '#ef4444',
        side: 'left',
        mission: 'MISI FINAL: Tembus Jembatan Suramadu & rebut Sarung Pusaka dari Raja Sarung Baja!',
        text: 'Angin laut Suramadu adem banget... tapi obor Geng Sarung Baja wis nyala nang ujung jembatan.',
      },
      {
        speaker: 'PAK RT (VIA HT)',
        role: 'POS WARKOP SUROBOYO',
        avatar: '📻',
        accent: '#38bdf8',
        side: 'right',
        mission: 'MISI FINAL: Tembus Jembatan Suramadu & rebut Sarung Pusaka dari Raja Sarung Baja!',
        text: `Ati-ati ${hero}! Raja Sarung Baja punya jurus putaran badai. Tunjukkan semangat Arek Suroboyo — sak kampung ndukung awakmu!`,
      },
    ];
  }
  if (beat === 'boss') {
    return [
      {
        speaker: 'RAJA SARUNG BAJA',
        role: 'FINAL BOSS • JEMBATAN SURAMADU',
        avatar: '👑',
        accent: '#a855f7',
        side: 'right',
        text: `Selamat datang nang Suramadu, ${hero}! Sarung Pusaka saiki milikku — gak ono arek sing iso nahan Sarung Baja!`,
      },
      {
        speaker: hero.toUpperCase(),
        role: 'AREK SUROBOYO',
        avatar: '🧣',
        accent: '#ef4444',
        side: 'left',
        text: 'Sarung Pusaka iku simbol kerukunan kampung, duduk buat pamer kekuatan! Waktunya tak rebut balik!',
      },
    ];
  }
  return [
    {
      speaker: 'RAJA SARUNG BAJA',
      role: 'FINAL BOSS • TUMBANG',
      avatar: '😵',
      accent: '#a855f7',
      side: 'right',
      text: 'Mustahil... Sarung Baja-ku kalah sama semangat arek kampung... Ambil balik pusakamu, aku ngaku kalah!',
    },
    {
      speaker: 'PAK RT WARKOP',
      role: 'ENDING • KAMPUNG AMAN!',
      avatar: '🎉',
      accent: '#22c55e',
      side: 'right',
      text: `MANTAP ${hero}! Sarung Pusaka & kendi kopi wis balik! Ayo mulih nang Pos Warkop, Es Teh Jumbo gratis sak kampung!`,
    },
  ];
}
