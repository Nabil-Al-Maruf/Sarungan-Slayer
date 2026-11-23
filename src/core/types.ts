export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  // Optional analog vector (-1..1) from mobile virtual joystick for silky 360° movement
  moveX?: number;
  moveY?: number;
  jumpPressed: boolean;
  dashPressed: boolean;
  meleePressed: boolean;
  projPressed: boolean;
  ultPressed: boolean;
  shopPressed: boolean;
}

export type MapTheme = 'tambak' | 'tunjungan' | 'suramadu' | 'perempatan' | 'arena_smash';

export type UltType = 'gasing' | 'petir' | 'mercon' | 'naga';

export type HeroId =
  | 'bima'
  | 'mat_clurit'
  | 'bambang'
  | 'gus_dimas'
  | 'pak_rt'
  | 'mbak_sri';

export type BuffId =
  | 'max_hp'
  | 'dmg_up'
  | 'cd_fast'
  | 'move_speed'
  | 'ult_charge'
  | 'coin_boost';

export type EnemyKind =
  | 'dummy'
  | 'bocil'
  | 'pelempar_sandal'
  | 'pelari_cepat'
  | 'perisai_kardus'
  | 'elite'
  | 'boss_koordinator'
  | 'boss_tunjungan'
  | 'boss_suramadu'
  | 'zombie_warga'
  | 'zombie_bocil'
  | 'zombie_pocong'
  | 'zombie_gendruwo'
  | 'zombie_tuyul'
  | 'zombie_kuntilanak'
  | 'zombie_petasan'
  | 'zombie_buto_ijo'
  | 'zombie_dukun';

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'pos_ronda' | 'tree' | 'gerobak' | 'well' | 'lamp' | 'barrier';
  label?: string;
}

export interface Afterimage {
  x: number;
  y: number;
  z: number;
  alpha: number;
  color: string;
}

export interface PlayerState {
  id: string;
  name: string;
  paletteIndex: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  dirX: number;
  dirY: number;
  jumpsRemaining: number;

  hp: number;
  maxHp: number;
  ult: number;
  maxUlt: number;
  coins: number;
  reviveTickets: number;
  knockedDown: boolean;
  invulnTimer: number;
  hitFlashTimer: number;

  // Survival Roguelike Buff Multipliers (chosen every 2 waves)
  dmgMult: number;
  cdMult: number;
  speedMult: number;
  ultGainMult: number;
  coinMult: number;
  pendingBuffChoices: BuffId[];
  pendingUltChoice?: boolean;
  buffCount: number;

  // Dash
  dashTimer: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirY: number;

  // Melee (Kibas Sarung)
  meleeTimer: number;
  meleeCooldown: number;
  meleeSwingId: number;
  meleeComboStep: number;
  meleeAngle: number;

  // Secondary (Sabetan Angin Pecut)
  projCooldown: number;

  // Ultimate
  ultType?: UltType;
  ultActiveTimer: number;
  ultTickTimer: number;

  // Hero Archetype & Brawl Stats
  heroId?: HeroId;
  brawlStocks?: number;
  brawlKos?: number;
  isBot?: boolean;
  lastHitBy?: string;
  lastHitTime?: number;

  // Visual squash & stretch + walk cycle
  scaleX: number;
  scaleY: number;
  animTime: number;
  afterimages: Afterimage[];
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  name: string;
  isBoss: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  dirX: number;
  dirY: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  stunTimer: number;
  attackCooldown: number;
  specialTimer: number;
  aiState: 'chase' | 'windup' | 'dash' | 'jump_slam';
  aiTimer: number;
  phase: 1 | 2;
  summonedReinforcements: boolean;
  lastHitSwingId: number;
  scaleX: number;
  scaleY: number;
  animTime: number;
  shirtColor: string;
  sarungColor: string;
}

export interface ProjectileState {
  id: number;
  ownerId: string;
  kind?: 'slash' | 'mercon' | 'naga';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  pierceLeft: number;
  hitIds: number[];
  life: number;
  maxLife: number;
  color: string;
}

export interface EnemyProjectile {
  id: number;
  kind: 'sandal' | 'sarung_wave' | 'baja_wave' | 'acid_spit';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface HazardZone {
  id: number;
  kind: 'mercon' | 'slam' | 'acid_puddle' | 'fire_crater' | 'naga_flame';
  ownerId?: string;
  x: number;
  y: number;
  radius: number;
  delay: number;
  maxDelay: number;
  damage: number;
  detonated: boolean;
  flashTimer: number;
}

export interface CrateState {
  id: number;
  x: number;
  y: number;
  z: number;
  vz: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  lastHitSwingId: number;
  style: 'wood' | 'cardboard';
}

export type PickupKind = 'es_teh' | 'kopi_giras';

export interface PickupState {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  life: number;
  bobPhase: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  color: string;
  stripeColor: string;
  life: number;
  maxLife: number;
  comboStep: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export type SoundEvent =
  | 'jump'
  | 'double_jump'
  | 'dash'
  | 'kibas'
  | 'hit'
  | 'pecut'
  | 'ult_start'
  | 'ult_tick'
  | 'crate_hit'
  | 'crate_break'
  | 'pickup_heal'
  | 'pickup_kopi'
  | 'player_hurt'
  | 'ko'
  | 'tower_shoot'
  | 'buff_pick';

export interface StoryZone {
  triggerX: number;
  lockMinX: number;
  lockMaxX: number;
  triggered: boolean;
  cleared: boolean;
  isBossZone: boolean;
  spawns: Array<{ kind: EnemyKind; x: number; y: number }>;
}

export type BarricadeSlot = 'left' | 'top' | 'right' | 'bottom';

export interface BarricadeState {
  id: BarricadeSlot;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  level: 1 | 2 | 3 | 4;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
}

export interface SurvivalCore {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  // Center Building Defense Tower (Permanent weapon system, upgradable Lv 1-4)
  towerLevel: number;
  towerActive: boolean;
  towerCooldown: number;
  towerAimAngle: number;
  // Energy Shield (Tameng Gaib 1 Wave, contact damage to zombies)
  shieldActive: boolean;
  shieldHp: number;
  shieldMaxHp: number;
}

export interface SurvivalState {
  wave: number;
  phase: 'wave' | 'intermission';
  intermissionTimer: number;
  zombiesRemainingToSpawn: number;
  spawnTimer: number;
  core: SurvivalCore;
  barricades: BarricadeState[];
  mapBannerTimer: number;
  mapBannerText: string;
}

export interface BrawlPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  dropThrough?: boolean;
}

export interface BrawlState {
  initialStocks: number;
  matchDuration: number;
  remainingTime: number;
  winnerId?: string;
  winnerName?: string;
  platforms: BrawlPlatform[];
  itemSpawnTimer: number;
  ringOutBound: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface GameState {
  mode: 'sandbox' | 'story' | 'survival' | 'brawl';
  theme: MapTheme;
  stageNumber: 1 | 2 | 3;
  stageTitle: string;
  status: 'playing' | 'victory' | 'gameover';

  time: number;
  arenaWidth: number;
  arenaHeight: number;
  cameraX: number;
  activeMinX: number;
  activeMaxX: number;
  goPromptTimer: number;

  storyZones: StoryZone[];
  survival?: SurvivalState;
  brawl?: BrawlState;
  obstacles: Obstacle[];
  players: PlayerState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  enemyProjectiles: EnemyProjectile[];
  hazards: HazardZone[];
  crates: CrateState[];
  pickups: PickupState[];
  particles: Particle[];
  slashes: SlashEffect[];
  floatingTexts: FloatingText[];
  soundQueue: SoundEvent[];
  shakeTimer: number;
  shakeIntensity: number;
  hitstopTimer: number;
  koCount: number;
  nextEntityId: number;
  crateSpawnTimer: number;
  enemyRespawnTimer: number;
}
