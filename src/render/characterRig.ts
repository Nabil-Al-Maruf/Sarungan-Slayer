import { CRATE_SIZE, PLAYER_PALETTES, ULT_RADIUS } from '../core/constants';
import { getHeroDef } from '../core/heroes';
import type { CrateState, EnemyState, PickupState, PlayerState } from '../core/types';

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  time: number,
  isLocalPlayer = false,
  isMonitor = false
): void {
  const palette = PLAYER_PALETTES[player.paletteIndex % PLAYER_PALETTES.length];

  // 1. High-Visibility Pulsing Foot Ring (Aura Kaki) — Never lose track of your character!
  if (isLocalPlayer && !isMonitor) {
    const pulse = Math.sin(time * 6) * 2.5;
    ctx.save();
    // Glowing cyan spotlight under local player
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, 24 + pulse, 11 + pulse * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.8;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, 23 + pulse, 10.5 + pulse * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (isMonitor) {
    // In Monitor mode, color-code every player's foot ring so everyone sees their color clearly
    ctx.save();
    ctx.fillStyle = `${palette.accent}33`;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, 19, 8.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const ghost of player.afterimages) {
    ctx.save();
    ctx.globalAlpha = ghost.alpha * 0.48;
    ctx.fillStyle = ghost.color;
    ctx.beginPath();
    ctx.ellipse(ghost.x, ghost.y - ghost.z - 22, 14, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Active Ultimate Visual Effects
  if (player.ultActiveTimer > 0) {
    const ultType = player.ultType ?? 'gasing';
    ctx.save();
    ctx.translate(player.x, player.y - 6);

    if (ultType === 'petir') {
      // Petir Halilintar Aura: Electric shockwaves & lightning arcs
      ctx.scale(1, 0.75);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 140, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 4; i++) {
        const a1 = time * 24 + (i * Math.PI) / 2;
        const r1 = 35 + ((time * 180 + i * 40) % 95);
        ctx.strokeStyle = i % 2 === 0 ? '#38bdf8' : '#fde047';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a1) * 20, Math.sin(a1) * 20);
        ctx.lineTo(Math.cos(a1 + 0.3) * (r1 * 0.6), Math.sin(a1 + 0.3) * (r1 * 0.6));
        ctx.lineTo(Math.cos(a1 - 0.2) * r1, Math.sin(a1 - 0.2) * r1);
        ctx.stroke();
      }
    } else if (ultType === 'naga') {
      // Naga Api Aura: Fiery flame rings and embers
      ctx.scale(1, 0.72);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
      ctx.beginPath();
      ctx.arc(0, 0, 125, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(-time * 14 + (i * Math.PI * 2) / 3);
        ctx.strokeStyle = i % 2 === 0 ? '#ef4444' : '#f97316';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 48 + i * 22, 0, Math.PI * 0.75);
        ctx.stroke();
        ctx.restore();
      }
    } else if (ultType === 'mercon') {
      // Mercon Bazooka Aura: Sparks & explosion flash
      ctx.scale(1, 0.72);
      ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 6; i++) {
        const sa = (i * Math.PI * 2) / 6 + time * 12;
        const sr = 35 + ((time * 240 + i * 25) % 65);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Badai Gasing Sarung: Classic Whirlwind Vortex
      ctx.scale(1, 0.72);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, ULT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(time * 16 + (i * Math.PI * 2) / 3);
        ctx.strokeStyle = i % 2 === 0 ? palette.sarung : palette.sarungStripe;
        ctx.lineWidth = 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 52 + i * 20, 0, Math.PI * 0.85);
        ctx.stroke();

        ctx.strokeStyle = '#090c14';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 58 + i * 20, 0, Math.PI * 0.85);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  const shadowScale = Math.max(0.55, 1 - player.z / 160);
  ctx.save();
  ctx.fillStyle = 'rgba(9, 12, 20, 0.34)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 2, 16 * shadowScale, 7.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const aimAngle = Math.atan2(player.dirY, player.dirX);
  ctx.save();
  ctx.translate(player.x + player.dirX * 22, player.y + player.dirY * 15);
  ctx.rotate(aimAngle);
  ctx.fillStyle = 'rgba(253, 224, 71, 0.75)';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (player.knockedDown) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(Math.PI * 0.45);
    ctx.globalAlpha = 0.72;
    drawTopDownArekRig(ctx, { ...player, x: 0, y: 0, z: 0 }, palette, time);
    ctx.restore();

    ctx.save();
    ctx.font = '900 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#090c14';
    ctx.strokeText(`${palette.label} TUMBANG!`, player.x, player.y - 28);
    ctx.fillStyle = '#f87171';
    ctx.fillText(`${palette.label} TUMBANG!`, player.x, player.y - 28);
    ctx.restore();
    return;
  }

  if (player.invulnTimer > 0 && player.ultActiveTimer <= 0 && Math.floor(time * 20) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawTopDownArekRig(ctx, player, palette, time);
    ctx.restore();
  } else {
    drawTopDownArekRig(ctx, player, palette, time);
  }

  // 3. Clean Nametag Above Head (with Hero Icon & Stocks if in Brawl)
  ctx.save();
  const tagY = player.y - player.z - 60;
  const hDef = getHeroDef(player.heroId);
  const heroBadge = player.heroId ? `${hDef.avatar} ` : '';
  const stocksText = player.brawlStocks !== undefined ? ` [${player.brawlStocks}❤️]` : '';
  const displayName = player.name
    ? `${palette.label} • ${heroBadge}${player.name}${stocksText}`
    : `${palette.label}${stocksText}`;
  ctx.font = '900 10.5px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#090c14';
  ctx.strokeText(displayName, player.x, tagY);
  ctx.fillStyle = isLocalPlayer && !isMonitor ? '#38bdf8' : palette.accent;
  ctx.fillText(displayName, player.x, tagY);
  ctx.restore();
}

function drawTopDownArekRig(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  palette: (typeof PLAYER_PALETTES)[number],
  time: number
): void {
  const footX = player.x;
  const footY = player.y - player.z;
  const facingUp = player.dirY < -0.5;
  const flipX = player.dirX < -0.15 ? -1 : 1;

  ctx.save();
  ctx.translate(footX, footY);

  const spinScale = player.ultActiveTimer > 0 ? Math.cos(time * 28) || 0.2 : flipX;
  ctx.scale(spinScale * player.scaleX, player.scaleY);

  const speed = Math.hypot(player.vx, player.vy);
  const isWalking = speed > 20 && player.z === 0;
  const legStep = isWalking ? Math.sin(player.animTime) * 4.5 : 0;
  const bob = isWalking ? Math.abs(Math.sin(player.animTime)) * -2.5 : Math.sin(player.animTime) * 1;

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-9, -11 + legStep, 7, 11, 3);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(2, -11 - legStep, 7, 11, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = player.hitFlashTimer > 0 ? '#ffffff' : palette.shirt;
  ctx.beginPath();
  ctx.roundRect(-13, -31 + bob, 26, 22, 8);
  ctx.fill();
  ctx.stroke();

  if (player.hitFlashTimer <= 0) {
    ctx.fillStyle = palette.shirtShadow;
    ctx.fillRect(-11, -15 + bob, 22, 4);
  }

  ctx.fillStyle = player.hitFlashTimer > 0 ? '#ffffff' : palette.sarung;
  ctx.beginPath();
  ctx.moveTo(-12, -30 + bob);
  ctx.lineTo(-4, -30 + bob);
  ctx.lineTo(12, -11 + bob);
  ctx.lineTo(4, -10 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = palette.sarungStripe;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-8, -28 + bob);
  ctx.lineTo(8, -12 + bob);
  ctx.stroke();

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.8;
  ctx.fillStyle = player.hitFlashTimer > 0 ? '#ffffff' : '#f1c29b';
  ctx.beginPath();
  ctx.arc(0, -40 + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (!facingUp) {
    const eyeShift = Math.abs(player.dirX) > 0.35 ? 3 : 0;
    ctx.fillStyle = '#090c14';
    ctx.beginPath();
    ctx.arc(-4 + eyeShift, -39 + bob, 2.2, 0, Math.PI * 2);
    ctx.arc(5 + eyeShift, -39 + bob, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -40 + bob, 12, Math.PI * 0.1, Math.PI * 0.9);
    ctx.fill();
  }

  // Distinct Headwear & Accessories per Character Silhouette
  const hg = palette.headgear ?? 'peci_garuda';
  if (hg === 'udeng_kenjeran') {
    // Cak Bagus: Udeng segitiga khas Suroboyo + Kacamata hitam
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(-14, -46 + bob);
    ctx.lineTo(0, -60 + bob); // pointed peak
    ctx.lineTo(14, -46 + bob);
    ctx.lineTo(11, -43 + bob);
    ctx.lineTo(-11, -43 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Batik orange trim on udeng
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-10, -46 + bob, 20, 2.5);

    // Kacamata hitam (sunglasses) if facing forward
    if (!facingUp) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-8, -42 + bob, 7, 5);
      ctx.fillRect(1, -42 + bob, 7, 5);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-8, -40 + bob);
      ctx.lineTo(8, -40 + bob);
      ctx.stroke();
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#090c14';
    }
  } else if (hg === 'blangkon_batik') {
    // Cak Dimas: Blangkon Jawa Timuran dengan mondolan
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(-13, -54 + bob, 26, 12, [8, 8, 3, 3]);
    ctx.fill();
    ctx.stroke();

    // Mondolan knot behind head
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(facingUp ? 0 : -10, -48 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Batik gold band
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-11, -46 + bob, 22, 2.5);
  } else if (hg === 'baret_bonek') {
    // Cak Raka: Topi Baret Hijau Bonek miring + Syal loreng
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    // Tilted beret
    ctx.moveTo(-14, -45 + bob);
    ctx.quadraticCurveTo(-16, -58 + bob, 4, -58 + bob);
    ctx.lineTo(15, -48 + bob);
    ctx.lineTo(-11, -44 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Silver emblem pin
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(-6, -51 + bob, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Syal leher loreng hijau
    ctx.fillStyle = '#047857';
    ctx.fillRect(-8, -32 + bob, 16, 4);
    ctx.fillStyle = '#022c22';
    ctx.fillRect(-4, -32 + bob, 4, 4);
  } else if (hg === 'sorban_putih') {
    // Cak Yudi: Sorban Putih Melingkar berlapis + ekor sorban
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(-14, -56 + bob, 28, 14, [10, 10, 5, 5]);
    ctx.fill();
    ctx.stroke();

    // Sorban folds
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-11, -50 + bob);
    ctx.lineTo(11, -50 + bob);
    ctx.moveTo(-10, -45 + bob);
    ctx.lineTo(10, -45 + bob);
    ctx.stroke();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#090c14';

    // Hanging sorban tail over shoulder
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(-14, -44 + bob, 5, 12, 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Cak Bima (Default): Peci Hitam Klasik dengan Bros Garuda Emas
    ctx.fillStyle = palette.peci;
    ctx.beginPath();
    ctx.roundRect(-12, -55 + bob, 24, 12, [6, 6, 2, 2]);
    ctx.fill();
    ctx.stroke();

    // Gold diamond/Garuda pin
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, -52 + bob);
    ctx.lineTo(3.5, -48 + bob);
    ctx.lineTo(0, -44 + bob);
    ctx.lineTo(-3.5, -48 + bob);
    ctx.closePath();
    ctx.fill();

    // Selempang Merah Putih di pundak
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-10, -32 + bob, 20, 3);
  }

  const meleeActive = player.meleeTimer > 0;
  const swingAngle = meleeActive ? -0.9 + (1 - player.meleeTimer / 0.22) * 2.1 : 0.25;

  ctx.save();
  ctx.translate(9, -22 + bob);
  ctx.rotate(swingAngle);

  // Render hero-specific weapon in hand!
  if (player.heroId === 'mat_clurit') {
    // Madura Sickle (Celurit)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(10, -6, 14, 0, Math.PI * 0.75);
    ctx.stroke();
    // Wooden handle
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, -4);
    ctx.stroke();
  } else if (player.heroId === 'bambang') {
    // Red boxing glove / Tinju Beton
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(8, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (player.heroId === 'gus_dimas') {
    // Yellow bamboo staff (Bambu Kuning)
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, 8);
    ctx.lineTo(26, -16);
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(26, -16);
    ctx.lineTo(34, -22);
    ctx.lineTo(28, -12);
    ctx.fill();
  } else if (player.heroId === 'pak_rt') {
    // Sapu Lidi
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(24, -10);
    ctx.stroke();
    ctx.fillStyle = '#a16207';
    ctx.fillRect(16, -14, 12, 8);
  } else if (player.heroId === 'mbak_sri') {
    // Selendang sutra
    ctx.fillStyle = '#ec4899';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(18, -14, 28, 4);
    ctx.quadraticCurveTo(12, 10, 0, 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Default Bima Sarung
    const sarungLen = meleeActive ? 34 : 16;
    ctx.fillStyle = palette.sarung;
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(sarungLen * 0.6, -10, sarungLen, 0);
    ctx.quadraticCurveTo(sarungLen * 0.5, 8, 0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyState, time: number): void {
  const shadowScale = Math.max(0.55, 1 - enemy.z / 160);
  const sizeScale = enemy.isBoss
    ? 1.48
    : enemy.kind === 'zombie_buto_ijo'
      ? 1.42
      : enemy.kind === 'zombie_gendruwo'
        ? 1.32
        : enemy.kind === 'zombie_tuyul' || enemy.kind === 'zombie_bocil' || enemy.kind === 'zombie_petasan'
          ? 0.84
          : 1;

  // Phase 2 glowing aura on Raja Sarung Baja Suramadu
  if (enemy.isBoss && enemy.phase === 2) {
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y, 44 + Math.sin(time * 12) * 4, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Ground shadow
  ctx.save();
  ctx.fillStyle = 'rgba(9, 12, 20, 0.34)';
  ctx.beginPath();
  ctx.ellipse(
    enemy.x,
    enemy.y + 2,
    14 * sizeScale * shadowScale,
    6.5 * sizeScale * shadowScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(enemy.x, enemy.y - enemy.z);
  const flipX = enemy.dirX < -0.15 ? -1 : 1;
  ctx.scale(flipX * enemy.scaleX * sizeScale, enemy.scaleY * sizeScale);

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';

  if (enemy.kind === 'dummy') {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-5, -12, 10, 12);
    ctx.strokeRect(-5, -12, 10, 12);

    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#d6b283';
    ctx.beginPath();
    ctx.roundRect(-14, -44, 28, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -33);
    ctx.lineTo(6, -21);
    ctx.moveTo(6, -33);
    ctx.lineTo(-6, -21);
    ctx.stroke();
  } else if (enemy.kind === 'zombie_pocong') {
    // Classic Indonesian Pocong wrapped in white kain kafan with top knot!
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(-10, -42, 20, 42, 10);
    ctx.fill();
    ctx.stroke();

    // Top tied knot (ikatan pocong)
    ctx.beginPath();
    ctx.moveTo(-5, -42);
    ctx.lineTo(0, -52);
    ctx.lineTo(5, -42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cloth ties
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -26);
    ctx.lineTo(9, -26);
    ctx.moveTo(-8, -12);
    ctx.lineTo(8, -12);
    ctx.stroke();

    // Pale face oval & spooky dark eyes
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(1, -33, 6.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090c14';
    ctx.beginPath();
    ctx.arc(-1, -33, 1.8, 0, Math.PI * 2);
    ctx.arc(4, -33, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'zombie_kuntilanak') {
    // Mbak Kunti: Floating pale apparition with flowing ragged gown & wild long black hair
    const floatY = Math.sin(time * 5 + enemy.id) * 3;
    // Flowing ragged gown
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-9, -28 + floatY);
    ctx.lineTo(9, -28 + floatY);
    ctx.lineTo(14, 2 + floatY);
    ctx.lineTo(8, -2 + floatY);
    ctx.lineTo(0, 3 + floatY);
    ctx.lineTo(-7, -2 + floatY);
    ctx.lineTo(-14, 2 + floatY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red bloodstain on dress
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(2, -14 + floatY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Pale ghost face
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#f1f5f9';
    ctx.beginPath();
    ctx.arc(0, -33 + floatY, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Long wild black hair draped over shoulders
    ctx.fillStyle = '#090c14';
    ctx.beginPath();
    ctx.moveTo(-10, -33 + floatY);
    ctx.quadraticCurveTo(-14, -18 + floatY, -12, -4 + floatY);
    ctx.lineTo(-7, -4 + floatY);
    ctx.quadraticCurveTo(-8, -20 + floatY, -5, -38 + floatY);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(10, -33 + floatY);
    ctx.quadraticCurveTo(14, -18 + floatY, 12, -4 + floatY);
    ctx.lineTo(7, -4 + floatY);
    ctx.quadraticCurveTo(8, -20 + floatY, 5, -38 + floatY);
    ctx.fill();

    // Forehead bangs
    ctx.beginPath();
    ctx.arc(0, -36 + floatY, 9.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    // Piercing glowing blood-red eyes
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(-2, -32 + floatY, 2, 0, Math.PI * 2);
    ctx.arc(4, -32 + floatY, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'zombie_petasan') {
    // Bocil Petasan Kamikaze: Red firecracker tubes on back with glowing fuse spark!
    const hop = Math.abs(Math.sin(enemy.animTime)) * -3.5;
    // Red petasan bundle on back
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-13, -24 + hop, 7, 15);
    ctx.strokeRect(-13, -24 + hop, 7, 15);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-13, -18 + hop, 7, 3);

    // Running legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6, -8, 4, 8);
    ctx.strokeRect(-6, -8, 4, 8);
    ctx.fillRect(2, -8, 4, 8);
    ctx.strokeRect(2, -8, 4, 8);

    // Torso & Sarung
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : enemy.shirtColor;
    ctx.beginPath();
    ctx.roundRect(-9, -22 + hop, 18, 15, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = enemy.sarungColor;
    ctx.fillRect(-8, -12 + hop, 16, 5);
    ctx.strokeRect(-8, -12 + hop, 16, 5);

    // Head
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#86efac';
    ctx.beginPath();
    ctx.arc(0, -29 + hop, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spark fuse on head
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -37 + hop);
    ctx.quadraticCurveTo(4, -43 + hop, 2, -47 + hop);
    ctx.stroke();

    // Burning spark tip
    ctx.fillStyle = Math.floor(time * 25) % 2 === 0 ? '#fde047' : '#f97316';
    ctx.beginPath();
    ctx.arc(2, -47 + hop, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Crazy eyes
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(-2, -29 + hop, 1.8, 0, Math.PI * 2);
    ctx.arc(4, -29 + hop, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'zombie_buto_ijo') {
    // Buto Ijo: Massive muscular ogre with tusks and acid drool
    const hop = Math.abs(Math.sin(enemy.animTime)) * -2;
    // Heavy green legs
    ctx.fillStyle = '#14532d';
    ctx.fillRect(-9, -10, 7, 10);
    ctx.strokeRect(-9, -10, 7, 10);
    ctx.fillRect(2, -10, 7, 10);
    ctx.strokeRect(2, -10, 7, 10);

    // Muscular green torso
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#16a34a';
    ctx.beginPath();
    ctx.roundRect(-15, -32 + hop, 30, 24, 7);
    ctx.fill();
    ctx.stroke();

    // Dark purple loincloth / sarung
    ctx.fillStyle = '#581c87';
    ctx.fillRect(-14, -16 + hop, 28, 8);
    ctx.strokeRect(-14, -16 + hop, 28, 8);

    // Giant ogre head
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#22c55e';
    ctx.beginPath();
    ctx.arc(0, -42 + hop, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing yellow eyes
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(-4, -42 + hop, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -42 + hop, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Upward ivory tusks
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, -35 + hop);
    ctx.lineTo(-8, -44 + hop);
    ctx.lineTo(-4, -36 + hop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(7, -35 + hop);
    ctx.lineTo(8, -44 + hop);
    ctx.lineTo(4, -36 + hop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Green acid drool from jaw
    ctx.fillStyle = '#84cc16';
    ctx.beginPath();
    ctx.arc(1, -33 + hop, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'zombie_dukun') {
    // Mbah Dukun Santet: Blangkon, batik sarung, pedupaan kemenyan
    const hop = Math.abs(Math.sin(enemy.animTime)) * -2.5;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-7, -9, 5, 9);
    ctx.strokeRect(-7, -9, 5, 9);
    ctx.fillRect(2, -9, 5, 9);
    ctx.strokeRect(2, -9, 5, 9);

    // Midnight purple shirt & batik sarung
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#1e1b4b';
    ctx.beginPath();
    ctx.roundRect(-11, -26 + hop, 22, 18, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(-10, -14 + hop, 20, 6);
    ctx.strokeRect(-10, -14 + hop, 20, 6);

    // Pale greenish head
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#a7f3d0';
    ctx.beginPath();
    ctx.arc(0, -34 + hop, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Traditional Javanese Blangkon
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.ellipse(0, -41 + hop, 11, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Mondholan (back knot)
    ctx.beginPath();
    ctx.arc(-11, -38 + hop, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing purple occult eyes
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(-2, -33 + hop, 2.2, 0, Math.PI * 2);
    ctx.arc(5, -33 + hop, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Smoking pedupaan kemenyan held in hand
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.roundRect(11, -22 + hop, 8, 9, 2);
    ctx.fill();
    ctx.stroke();

    // Rising purple smoke spiral
    ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
    ctx.beginPath();
    ctx.arc(15, -27 + hop + Math.sin(time * 8) * 2, 3, 0, Math.PI * 2);
    ctx.arc(17, -33 + hop + Math.cos(time * 8) * 3, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const hop = Math.abs(Math.sin(enemy.animTime)) * -3;
    const isZombie = enemy.kind.startsWith('zombie_');
    const skinColor =
      enemy.kind === 'zombie_gendruwo'
        ? '#4c1d95'
        : enemy.kind === 'zombie_tuyul'
          ? '#d9f99d'
          : isZombie
            ? '#86efac'
            : '#f1c29b';

    // Legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-7, -9, 5, 9);
    ctx.strokeRect(-7, -9, 5, 9);
    ctx.fillRect(2, -9, 5, 9);
    ctx.strokeRect(2, -9, 5, 9);

    // Body / Shirt
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : enemy.shirtColor;
    ctx.beginPath();
    ctx.roundRect(-11, -26 + hop, 22, 18, 6);
    ctx.fill();
    ctx.stroke();

    // Sarung wrap
    ctx.fillStyle = enemy.sarungColor;
    ctx.fillRect(-10, -14 + hop, 20, 6);
    ctx.strokeRect(-10, -14 + hop, 20, 6);

    // Head
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : skinColor;
    ctx.beginPath();
    ctx.arc(0, -34 + hop, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Variant headwear
    if (enemy.kind === 'boss_suramadu') {
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-11, -40 + hop);
      ctx.lineTo(-8, -51 + hop);
      ctx.lineTo(0, -45 + hop);
      ctx.lineTo(8, -51 + hop);
      ctx.lineTo(11, -40 + hop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (enemy.kind === 'boss_tunjungan' || enemy.kind === 'boss_koordinator') {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-11, -47 + hop, 22, 10, [5, 5, 1, 1]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-9, -40 + hop, 18, 2.5);
    } else if (enemy.kind === 'elite') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-10, -43 + hop, 20, 7);
      ctx.strokeRect(-10, -43 + hop, 20, 7);
    } else if (enemy.kind === 'zombie_gendruwo') {
      // Spiky horns
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-8, -42 + hop);
      ctx.lineTo(-13, -51 + hop);
      ctx.lineTo(-3, -44 + hop);
      ctx.moveTo(8, -42 + hop);
      ctx.lineTo(13, -51 + hop);
      ctx.lineTo(3, -44 + hop);
      ctx.fill();
      ctx.stroke();
    } else if (!isZombie) {
      ctx.fillStyle = enemy.kind === 'pelari_cepat' ? '#fde047' : '#ef4444';
      ctx.fillRect(-10, -40 + hop, 20, 4);
      ctx.strokeRect(-10, -40 + hop, 20, 4);
    }

    // Eyes / Sunglasses
    if (enemy.dirY >= -0.5) {
      if (enemy.kind === 'boss_tunjungan') {
        ctx.fillStyle = '#090c14';
        ctx.fillRect(-5, -36 + hop, 14, 4.5);
      } else {
        ctx.fillStyle =
          enemy.kind === 'boss_suramadu'
            ? '#38bdf8'
            : enemy.kind === 'zombie_gendruwo'
              ? '#facc15'
              : isZombie
                ? '#dc2626'
                : '#090c14';
        ctx.beginPath();
        ctx.arc(-2, -33 + hop, 1.9, 0, Math.PI * 2);
        ctx.arc(5, -33 + hop, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Special held gear
    if (enemy.kind === 'perisai_kardus') {
      ctx.fillStyle = '#d6a574';
      ctx.fillRect(8, -32 + hop, 10, 26);
      ctx.strokeRect(8, -32 + hop, 10, 26);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(10, -22 + hop, 6, 6);
    } else if (enemy.kind === 'pelempar_sandal') {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(13, -21 + hop, 5, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();

  // Regular Enemy HP Bar (Boss has dedicated screen-bottom HUD bar)
  if (!enemy.isBoss) {
    const barW = 34;
    const barH = 5;
    const bx = enemy.x - barW * 0.5;
    const by = enemy.y - enemy.z - 54;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = ratio > 0.4 ? '#22c55e' : '#ef4444';
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.restore();
  }
}

export function drawCrate(ctx: CanvasRenderingContext2D, crate: CrateState): void {
  const half = CRATE_SIZE * 0.5;
  const sx = crate.x - half;
  const sy = crate.y - crate.z - CRATE_SIZE + 8;

  ctx.save();
  ctx.fillStyle = 'rgba(9, 12, 20, 0.3)';
  ctx.beginPath();
  ctx.ellipse(crate.x, crate.y + 4, 21, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.8;

  const frontColor =
    crate.hitFlashTimer > 0 ? '#ffffff' : crate.style === 'wood' ? '#b45309' : '#b8834f';
  const topColor =
    crate.hitFlashTimer > 0 ? '#ffffff' : crate.style === 'wood' ? '#d97706' : '#d6a574';

  ctx.fillStyle = topColor;
  ctx.fillRect(sx, sy, CRATE_SIZE, 14);
  ctx.strokeRect(sx, sy, CRATE_SIZE, 14);

  ctx.fillStyle = frontColor;
  ctx.fillRect(sx, sy + 14, CRATE_SIZE, CRATE_SIZE - 14);
  ctx.strokeRect(sx, sy + 14, CRATE_SIZE, CRATE_SIZE - 14);

  if (crate.style === 'wood') {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx + 5, sy + 18);
    ctx.lineTo(sx + CRATE_SIZE - 5, sy + CRATE_SIZE - 4);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(sx + half - 4, sy + 1, 8, CRATE_SIZE - 2);
  }

  ctx.restore();
}

export function drawPickup(ctx: CanvasRenderingContext2D, item: PickupState): void {
  const bobY = Math.sin(item.bobPhase) * 4;
  const cx = item.x;
  const cy = item.y - item.z - 16 + bobY;

  ctx.save();
  ctx.fillStyle = 'rgba(9, 12, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(item.x, item.y + 2, 12, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle =
    item.kind === 'es_teh' ? 'rgba(74, 222, 128, 0.26)' : 'rgba(250, 204, 21, 0.3)';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.5;

  if (item.kind === 'es_teh') {
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.roundRect(cx - 9, cy - 10, 18, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(cx - 5, cy - 6, 4.5, 4.5);
    ctx.fillRect(cx + 1, cy - 4, 4.5, 4.5);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - 10);
    ctx.lineTo(cx + 8, cy - 18);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(cx - 9, cy - 8, 18, 16, [2, 2, 6, 6]);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 7, cy - 6, 14, 4.5);

    ctx.beginPath();
    ctx.arc(cx + 9, cy, 4.5, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - 2);
    ctx.lineTo(cx - 4, cy + 3);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - 2, cy + 7);
    ctx.lineTo(cx + 4, cy + 1);
    ctx.lineTo(cx, cy + 1);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
