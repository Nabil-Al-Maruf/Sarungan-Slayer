import { CRATE_SIZE, PLAYER_PALETTES, ULT_RADIUS } from '../core/constants';
import { getHeroDef } from '../core/heroes';
import type { CrateState, EnemyState, PickupState, PlayerState, SarungStyle } from '../core/types';

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

  // 2. Active Ultimate Visual Effects (6 Distinct Signature Hero Animations)
  if (player.ultActiveTimer > 0) {
    const ultType = player.ultType ?? 'gasing';
    const aimAngle = Math.atan2(player.dirY, player.dirX);
    ctx.save();
    ctx.translate(player.x, player.y - 6);

    if (ultType === 'petir') {
      // === MAT CLURIT: Sky-to-Ground Thunderbolts + Forked Lightning + Twin Electric Blades ===
      // Ground electric surge ring
      ctx.save();
      ctx.scale(1, 0.7);
      const pulse = 0.85 + Math.sin(time * 45) * 0.15;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 128 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, 96, time * 12, time * 12 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 3 Vertical Sky Thunderbolts crashing down around Mat Clurit
      for (let b = 0; b < 3; b++) {
        const bx = Math.cos(time * 18 + b * 2.1) * (48 + b * 26);
        const by = Math.sin(time * 14 + b * 2.1) * 28;
        ctx.strokeStyle = b === 0 ? '#ffffff' : '#38bdf8';
        ctx.lineWidth = b === 0 ? 5.5 : 3.5;
        ctx.beginPath();
        ctx.moveTo(bx + Math.sin(time * 60 + b) * 18, -220);
        for (let seg = 1; seg <= 6; seg++) {
          const sy = -220 + ((by + 220) * seg) / 6;
          const jitter = Math.sin(time * 90 + seg * 7 + b * 13) * 16;
          ctx.lineTo(bx + jitter, sy);
        }
        ctx.stroke();
        // Ground impact flash
        ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
        ctx.beginPath();
        ctx.ellipse(bx, by, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Twin orbiting electric crescent sickles
      for (let s = 0; s < 2; s++) {
        ctx.save();
        ctx.scale(1, 0.72);
        ctx.rotate(time * 24 + s * Math.PI);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 74, -0.55, 0.55);
        ctx.stroke();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 82, -0.45, 0.45);
        ctx.stroke();
        ctx.restore();
      }
    } else if (ultType === 'gempa') {
      // === BANG BAMBANG: Seismic Earth Shatter + Magma Fissures + Expanding Shockwave Rings ===
      const progress = Math.max(0, Math.min(1, 1 - player.ultActiveTimer / 0.65));
      ctx.save();
      ctx.scale(1, 0.68);

      // Expanding seismic shockwave rings
      for (let rIdx = 0; rIdx < 2; rIdx++) {
        const ringP = Math.min(1, progress * 1.35 - rIdx * 0.22);
        if (ringP > 0) {
          const rad = 30 + ringP * 195;
          ctx.strokeStyle = rIdx === 0 ? `rgba(245, 158, 11, ${1 - ringP})` : `rgba(239, 68, 68, ${(1 - ringP) * 0.9})`;
          ctx.lineWidth = 10 * (1 - ringP * 0.6);
          ctx.beginPath();
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 8 Jagged Ground Magma Cracks radiating outward
      for (let c = 0; c < 8; c++) {
        const ang = (c * Math.PI * 2) / 8 + 0.18;
        const maxLen = 95 + (c % 2) * 55;
        const len = maxLen * Math.min(1, progress * 2.2);
        ctx.strokeStyle = '#090c14';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang + 0.12) * (len * 0.48), Math.sin(ang + 0.12) * (len * 0.48));
        ctx.lineTo(Math.cos(ang - 0.08) * len, Math.sin(ang - 0.08) * len);
        ctx.stroke();

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang + 0.12) * (len * 0.48), Math.sin(ang + 0.12) * (len * 0.48));
        ctx.lineTo(Math.cos(ang - 0.08) * len, Math.sin(ang - 0.08) * len);
        ctx.stroke();
      }
      ctx.restore();

      // Erupting rock/paving debris chunks flying upward
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI * 2) / 8 + 0.4;
        const dist = 32 + progress * 115;
        const lift = Math.sin(progress * Math.PI) * (58 + (k % 3) * 24);
        ctx.save();
        ctx.translate(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.65 - lift);
        ctx.rotate(progress * 8 + k);
        ctx.fillStyle = k % 2 === 0 ? '#78716c' : '#a8a29e';
        ctx.strokeStyle = '#090c14';
        ctx.lineWidth = 2;
        ctx.fillRect(-7, -5, 14, 10);
        ctx.strokeRect(-7, -5, 14, 10);
        ctx.restore();
      }
    } else if (ultType === 'naga') {
      // === GUS DIMAS: Sacred Emerald-Gold Octagonal Mandala + Healing Pillars + Spirit Dragon Coils ===
      ctx.save();
      ctx.scale(1, 0.68);
      // Rotating Sacred Geometric Mandala (2 counter-rotating squares = 8-point star)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, 118, 0, Math.PI * 2);
      ctx.fill();

      for (let sq = 0; sq < 2; sq++) {
        ctx.save();
        ctx.rotate((sq === 0 ? 1 : -1) * time * 3.5 + (sq * Math.PI) / 4);
        ctx.strokeStyle = sq === 0 ? '#34d399' : '#facc15';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(-68, -68, 136, 136);
        ctx.restore();
      }
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 102, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Rising Golden-Emerald Karomah Light Pillars
      for (let p = 0; p < 5; p++) {
        const px = Math.cos(time * 4 + p * 1.25) * 58;
        const py = Math.sin(time * 4 + p * 1.25) * 26;
        const grad = ctx.createLinearGradient(px, py, px, py - 120);
        grad.addColorStop(0, 'rgba(52, 211, 153, 0.65)');
        grad.addColorStop(0.5, 'rgba(250, 204, 21, 0.45)');
        grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(px - 6, py - 120, 12, 120);
      }

      // Coiling Emerald-Gold Spirit Dragon Ribbon around Gus Dimas
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0; t <= 16; t++) {
        const f = t / 16;
        const angle = time * 12 + f * Math.PI * 3.2;
        const rx = Math.cos(angle) * (46 - f * 18);
        const ry = -f * 95 + Math.sin(angle) * 14;
        if (t === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.stroke();
    } else if (ultType === 'mercon') {
      // === PAK RT KARBIT: Directional Bamboo Cannon Muzzle Blast Cone + Smoke Plumes + Fuse Sparks ===
      ctx.save();
      ctx.rotate(aimAngle);

      // Giant Bamboo Karbit Cannon Barrel held at side
      ctx.fillStyle = '#15803d';
      ctx.strokeStyle = '#090c14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-14, -22, 54, 18, 5);
      ctx.fill();
      ctx.stroke();
      // Bamboo nodes
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(4, -22);
      ctx.lineTo(4, -4);
      ctx.moveTo(22, -22);
      ctx.lineTo(22, -4);
      ctx.stroke();

      // Explosive Forward Muzzle Blast Cone
      const flare = 0.85 + Math.sin(time * 55) * 0.25;
      ctx.fillStyle = 'rgba(249, 115, 22, 0.72)';
      ctx.beginPath();
      ctx.moveTo(40, -13);
      ctx.lineTo(135 * flare, -52 * flare);
      ctx.lineTo(155 * flare, -13);
      ctx.lineTo(135 * flare, 26 * flare);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(254, 240, 138, 0.92)';
      ctx.beginPath();
      ctx.moveTo(40, -13);
      ctx.lineTo(92 * flare, -32 * flare);
      ctx.lineTo(106 * flare, -13);
      ctx.lineTo(92 * flare, 6 * flare);
      ctx.closePath();
      ctx.fill();

      // Billowing Gunpowder Smoke Rings
      for (let sm = 0; sm < 4; sm++) {
        const sp = ((time * 5 + sm * 0.25) % 1);
        ctx.fillStyle = `rgba(148, 163, 184, ${(1 - sp) * 0.55})`;
        ctx.beginPath();
        ctx.arc(46 + sp * 95, -13 + Math.sin(sm * 3 + time * 10) * 18, 10 + sp * 20, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (ultType === 'selendang') {
      // === MBAK SRI: Flowing Crimson-Pink Silk Ribbon Rose-Cyclone + Floating Petals ===
      ctx.save();
      ctx.scale(1, 0.72);

      // Soft magenta cyclone glow
      const grad = ctx.createRadialGradient(0, 0, 18, 0, 0, 138);
      grad.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
      grad.addColorStop(0.7, 'rgba(244, 114, 182, 0.16)');
      grad.addColorStop(1, 'rgba(244, 114, 182, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 138, 0, Math.PI * 2);
      ctx.fill();

      // 2 Long Undulating Silk Ribbons tracing a 3-petal rose curve
      for (let rib = 0; rib < 2; rib++) {
        ctx.strokeStyle = rib === 0 ? '#ec4899' : '#fbcfe8';
        ctx.lineWidth = rib === 0 ? 9 : 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let step = 0; step <= 28; step++) {
          const theta = (step / 28) * Math.PI * 2 + time * (rib === 0 ? 10 : -8);
          const r = 78 + Math.sin(theta * 3 + time * 14 + rib * 1.5) * 42;
          const rx = Math.cos(theta) * r;
          const ry = Math.sin(theta) * r;
          if (step === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.stroke();
      }

      // Orbiting Silk Flower Petals
      for (let pt = 0; pt < 10; pt++) {
        const pa = time * 9 + (pt * Math.PI * 2) / 10;
        const pr = 52 + ((pt * 29 + time * 90) % 80);
        ctx.save();
        ctx.translate(Math.cos(pa) * pr, Math.sin(pa) * pr);
        ctx.rotate(pa + 0.8);
        ctx.fillStyle = pt % 2 === 0 ? '#fdf2f8' : '#f472b6';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else {
      // === CAK BIMA (gasing): Rising 3D Funnel Tornado + Woven Sarung Whip Rings ===
      // Stacked rising tornado funnel rings from feet to above head
      for (let tier = 0; tier < 4; tier++) {
        const tierY = -tier * 22;
        const tierR = 44 + tier * 24 + Math.sin(time * 22 + tier) * 6;
        ctx.save();
        ctx.translate(0, tierY);
        ctx.scale(1, 0.45);
        ctx.rotate(time * (18 + tier * 3) * (tier % 2 === 0 ? 1 : -1));

        ctx.strokeStyle = tier % 2 === 0 ? palette.sarung : palette.sarungStripe;
        ctx.lineWidth = 10 - tier * 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, tierR, 0, Math.PI * 1.15);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, tierR + 8, Math.PI * 0.4, Math.PI * 1.45);
        ctx.stroke();
        ctx.restore();
      }

      // Ground vortex suction swirl
      ctx.save();
      ctx.scale(1, 0.68);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, ULT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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

  // Per-Hero Distinct Ultimate Body Motion (no generic spin slop!)
  let ultScaleX = flipX;
  let ultScaleY = 1;
  let ultRot = 0;
  let ultOffsetX = 0;
  let ultOffsetY = 0;
  if (player.ultActiveTimer > 0) {
    const uType = player.ultType ?? 'gasing';
    if (uType === 'gasing') {
      // Cak Bima: Classic rapid top-spin tornado
      ultScaleX = Math.cos(time * 30) || 0.25;
      ultRot = Math.sin(time * 24) * 0.14;
    } else if (uType === 'petir') {
      // Mat Clurit: Assassin high-speed lightning flash crouch + micro-teleport jitter
      ultOffsetX = Math.sin(time * 95) * 4.5;
      ultRot = flipX * 0.22;
      ultScaleX = flipX * 1.08;
      ultScaleY = 0.92;
    } else if (uType === 'gempa') {
      // Bang Bambang: Heavy Juggernaut Meteor Slam + seismic body tremor
      ultOffsetX = Math.sin(time * 72) * 3;
      ultOffsetY = Math.cos(time * 80) * 2;
      ultScaleX = flipX * 1.2;
      ultScaleY = 0.84;
    } else if (uType === 'naga') {
      // Gus Dimas: Calm Sacred Levitation hover
      ultOffsetY = -12 - Math.sin(time * 8) * 4;
      ultRot = Math.sin(time * 4) * 0.04;
    } else if (uType === 'mercon') {
      // Pak RT: Heavy Bamboo Cannon artillery recoil lean-back
      const recoil = Math.abs(Math.sin(time * 28)) * 5;
      ultOffsetX = -flipX * recoil;
      ultRot = -flipX * 0.22;
    } else if (uType === 'selendang') {
      // Mbak Sri: Graceful dancer pirouette + rhythmic bounce
      ultOffsetY = -5 - Math.abs(Math.sin(time * 14)) * 7;
      ultRot = Math.sin(time * 18) * 0.22;
      ultScaleX = (Math.cos(time * 16) >= 0 ? 1 : -1) * 1.04;
    }
  }
  ctx.translate(ultOffsetX, ultOffsetY);
  if (ultRot !== 0) ctx.rotate(ultRot);
  ctx.scale(ultScaleX * player.scaleX, ultScaleY * player.scaleY);

  const speed = Math.hypot(player.vx, player.vy);
  const isWalking = speed > 20 && player.z === 0;
  const legStep = isWalking ? Math.sin(player.animTime) * 4.5 : 0;
  const bob = isWalking ? Math.abs(Math.sin(player.animTime)) * -2.5 : Math.sin(player.animTime) * 1;

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';

  const hDef = getHeroDef(player.heroId);
  const sarungStyle: SarungStyle =
    player.sarungStyle || (player.heroId ? hDef.sarungStyle : palette.sarungStyle || 'gulung_tempur');

  // 1. Lower Body & Physical Sarung Silhouette (Shape, Cut, Pleats, Belts, Footwear)
  drawHeroSarungAndLowerBody(ctx, player, palette, sarungStyle, legStep, bob, time);

  // 2. Torso & Upper-body Drapery / Sash / Vest
  drawHeroTorsoAndUpperDrapery(ctx, player, palette, sarungStyle, bob);

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

  // Ambient Elemental Aura on Weapon Hand
  if (player.slashElement && player.slashElement !== 'none') {
    drawAmbientElementalWeaponAura(ctx, player, time);
  }

  ctx.restore();

  ctx.restore();
}

function drawHeroSarungAndLowerBody(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  palette: (typeof PLAYER_PALETTES)[number],
  sarungStyle: SarungStyle,
  legStep: number,
  bob: number,
  time: number
): void {
  const isFlash = player.hitFlashTimer > 0;
  const sarungFill = isFlash ? '#ffffff' : palette.sarung;
  const stripeColor = palette.sarungStripe;

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';

  if (sarungStyle === 'sarung_celana') {
    // === 1. MAT CLURIT / SAKERA: Sarung Celana Kombor Cingkrang & Bebat Pergelangan Kaki ===
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(-8, -6 + legStep, 6, 6, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(2, -6 - legStep, 6, 6, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-8, -4 + legStep); ctx.lineTo(-2, -4 + legStep);
    ctx.moveTo(2, -4 - legStep); ctx.lineTo(8, -4 - legStep);
    ctx.stroke();
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.8;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-9, -2 + legStep, 8, 2.5);
    ctx.fillRect(1, -2 - legStep, 8, 2.5);

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-14, -18 + bob);
    ctx.quadraticCurveTo(-16, -11 + bob, -11, -5 + bob);
    ctx.lineTo(-3, -5 + bob);
    ctx.quadraticCurveTo(-1, -11 + bob, 1, -11 + bob);
    ctx.lineTo(3, -5 + bob);
    ctx.lineTo(11, -5 + bob);
    ctx.quadraticCurveTo(16, -11 + bob, 14, -18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-10, -17 + bob); ctx.lineTo(-8, -6 + bob);
    ctx.moveTo(-5, -17 + bob); ctx.lineTo(-4, -6 + bob);
    ctx.moveTo(5, -17 + bob); ctx.lineTo(4, -6 + bob);
    ctx.moveTo(10, -17 + bob); ctx.lineTo(8, -6 + bob);
    ctx.stroke();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#090c14';

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(-13, -19 + bob, 26, 4.5, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(-10, -16 + bob);
    ctx.lineTo(-7, -16 + bob);
    ctx.lineTo(-8, -8 + bob);
    ctx.lineTo(-12, -9 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else if (sarungStyle === 'lipit_jawara') {
    // === 2. BANG BAMBANG: Sarung Tradisional Gagah Berlipit Tebal & Sabuk Kulit Jawara ===
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-9, -10 + legStep, 7, 8, 2);
    ctx.roundRect(2, -10 - legStep, 7, 8, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(-10, -3 + legStep, 9, 3.5);
    ctx.strokeRect(-10, -3 + legStep, 9, 3.5);
    ctx.fillRect(1, -3 - legStep, 9, 3.5);
    ctx.strokeRect(1, -3 - legStep, 9, 3.5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-9, -4.5 + legStep, 7, 2);
    ctx.fillRect(2, -4.5 - legStep, 7, 2);

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-16, -18 + bob);
    ctx.lineTo(16, -18 + bob);
    ctx.lineTo(15, -4 + bob);
    ctx.lineTo(-15, -4 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-10, -18 + bob); ctx.lineTo(-10, -4 + bob);
    ctx.moveTo(-4, -18 + bob); ctx.lineTo(-4, -4 + bob);
    ctx.moveTo(2, -18 + bob); ctx.lineTo(2, -4 + bob);
    ctx.moveTo(8, -18 + bob); ctx.lineTo(8, -4 + bob);
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-12, -16 + bob); ctx.lineTo(-12, -5 + bob);
    ctx.moveTo(-6, -16 + bob); ctx.lineTo(-6, -5 + bob);
    ctx.moveTo(0, -16 + bob); ctx.lineTo(0, -5 + bob);
    ctx.moveTo(6, -16 + bob); ctx.lineTo(6, -5 + bob);
    ctx.moveTo(12, -16 + bob); ctx.lineTo(12, -5 + bob);
    ctx.stroke();
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.8;

    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.roundRect(-15, -19.5 + bob, 30, 5, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -17 + bob, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, -17 + bob, 1.8, 0, Math.PI * 2);
    ctx.fill();

  } else if (sarungStyle === 'jubah_wali') {
    // === 3. GUS DIMAS: Sarung Jubah Panjang Anggun Menjuntai & Sorban Waliyullah ===
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(-5, -1 + legStep * 0.5, 4, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(5, -1 - legStep * 0.5, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-12, -18 + bob);
    ctx.quadraticCurveTo(-14, -9 + bob, -15, -1 + bob);
    ctx.quadraticCurveTo(-7, 1 + bob, 0, -1 + bob);
    ctx.quadraticCurveTo(7, 1 + bob, 15, -1 + bob);
    ctx.quadraticCurveTo(14, -9 + bob, 12, -18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-14, -2.5 + bob);
    ctx.quadraticCurveTo(-7, -0.5 + bob, 0, -2.5 + bob);
    ctx.quadraticCurveTo(7, -0.5 + bob, 14, -2.5 + bob);
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -17 + bob); ctx.quadraticCurveTo(-9, -9 + bob, -10, -3 + bob);
    ctx.moveTo(-2, -17 + bob); ctx.quadraticCurveTo(-2, -9 + bob, -3, -3 + bob);
    ctx.moveTo(4, -17 + bob); ctx.quadraticCurveTo(5, -9 + bob, 6, -3 + bob);
    ctx.moveTo(9, -17 + bob); ctx.quadraticCurveTo(10, -9 + bob, 11, -3 + bob);
    ctx.stroke();
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.8;

    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect(-12, -19 + bob, 24, 4, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ca8a04';
    for (let b = 0; b < 4; b++) {
      ctx.beginPath();
      ctx.arc(-8 + b * 1.5, -14 + b * 2.8 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (sarungStyle === 'lipit_dinas') {
    // === 4. PAK RT KARBIT: Sarung Lipat Dinas Rapi & Sabuk Linmas Kopelrim ===
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-9, -9 + legStep, 6, 8);
    ctx.strokeRect(-9, -9 + legStep, 6, 8);
    ctx.fillRect(3, -9 - legStep, 6, 8);
    ctx.strokeRect(3, -9 - legStep, 6, 8);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7, -8 + legStep, 2, 1.5);
    ctx.fillRect(5, -8 - legStep, 2, 1.5);

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-13, -18 + bob);
    ctx.lineTo(13, -18 + bob);
    ctx.lineTo(12, -6 + bob);
    ctx.lineTo(-12, -6 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -18 + bob);
    ctx.lineTo(0, -6 + bob);
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-6, -17 + bob); ctx.lineTo(-6, -7 + bob);
    ctx.moveTo(6, -17 + bob); ctx.lineTo(6, -7 + bob);
    ctx.stroke();
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.8;

    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.roundRect(-13, -19.5 + bob, 26, 4.5, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(-3, -19.5 + bob, 6, 4.5);
    ctx.strokeRect(-3, -19.5 + bob, 6, 4.5);

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(8, -13 + bob, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(7, -15 + bob, 2, 3);

  } else if (sarungStyle === 'lilit_kebaya') {
    // === 5. MBAK SRI: Sarung Lilit Modern Asimetris & Pita Selendang Sutra ===
    ctx.fillStyle = '#f1c29b';
    ctx.beginPath();
    ctx.roundRect(-6, -8 + legStep, 4.5, 7, 2);
    ctx.roundRect(1.5, -8 - legStep, 4.5, 7, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.ellipse(-4, -1.5 + legStep, 3.5, 1.8, 0, 0, Math.PI * 2);
    ctx.ellipse(3.5, -1.5 - legStep, 3.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-11, -18 + bob);
    ctx.lineTo(11, -18 + bob);
    ctx.lineTo(11, -7 + bob);
    ctx.quadraticCurveTo(4, -4 + bob, -2, -3 + bob);
    ctx.lineTo(-10, -5 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-4, -18 + bob);
    ctx.quadraticCurveTo(3, -10 + bob, -2, -3 + bob);
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-2, -17 + bob); ctx.lineTo(-1, -7 + bob);
    ctx.moveTo(5, -17 + bob); ctx.lineTo(6, -6 + bob);
    ctx.stroke();
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.8;

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.roundRect(-11, -19 + bob, 22, 4, 2);
    ctx.fill();
    ctx.stroke();

    const ribbonWave = Math.sin(time * 6) * 3;
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.moveTo(7, -16 + bob);
    ctx.quadraticCurveTo(12 + ribbonWave, -11 + bob, 10 + ribbonWave * 1.5, -4 + bob);
    ctx.lineTo(7 + ribbonWave * 1.5, -4 + bob);
    ctx.quadraticCurveTo(9 + ribbonWave, -11 + bob, 5, -16 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else {
    // === 6. CAK BIMA / DEFAULT: Sarung Gulung Tempur di Atas Lutut & Sabuk Kancing ===
    ctx.fillStyle = '#f1c29b';
    ctx.beginPath();
    ctx.roundRect(-8, -9 + legStep, 6, 8, 2);
    ctx.roundRect(2, -9 - legStep, 6, 8, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-9, -2 + legStep, 8, 2.5);
    ctx.strokeRect(-9, -2 + legStep, 8, 2.5);
    ctx.fillRect(1, -2 - legStep, 8, 2.5);
    ctx.strokeRect(1, -2 - legStep, 8, 2.5);

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-13, -18 + bob);
    ctx.lineTo(13, -18 + bob);
    ctx.lineTo(14, -7 + bob);
    ctx.lineTo(-14, -7 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-7, -16 + bob); ctx.lineTo(-7, -8 + bob);
    ctx.moveTo(7, -16 + bob); ctx.lineTo(7, -8 + bob);
    ctx.moveTo(-13, -12 + bob); ctx.lineTo(13, -12 + bob);
    ctx.stroke();
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.8;

    ctx.fillStyle = stripeColor;
    ctx.beginPath();
    ctx.roundRect(-14, -19.5 + bob, 28, 4.5, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-3, -16 + bob);
    ctx.lineTo(3, -16 + bob);
    ctx.lineTo(0, -11 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawHeroTorsoAndUpperDrapery(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  palette: (typeof PLAYER_PALETTES)[number],
  sarungStyle: SarungStyle,
  bob: number
): void {
  const isFlash = player.hitFlashTimer > 0;
  const shirtColor = isFlash ? '#ffffff' : palette.shirt;
  const sarungFill = isFlash ? '#ffffff' : palette.sarung;
  const stripeColor = palette.sarungStripe;

  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';

  if (sarungStyle === 'sarung_celana') {
    // Mat Clurit Sakera: Red-white striped shirt + open black vest (Pesak)
    ctx.fillStyle = isFlash ? '#ffffff' : '#ef4444';
    ctx.beginPath();
    ctx.roundRect(-13, -31 + bob, 26, 14, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFlash ? '#ffffff' : '#f8fafc';
    ctx.fillRect(-12, -28 + bob, 24, 2.5);
    ctx.fillRect(-12, -22 + bob, 24, 2.5);

    ctx.fillStyle = isFlash ? '#ffffff' : '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-13, -31 + bob);
    ctx.lineTo(-4, -31 + bob);
    ctx.lineTo(-3, -18 + bob);
    ctx.lineTo(-13, -18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(13, -31 + bob);
    ctx.lineTo(4, -31 + bob);
    ctx.lineTo(3, -18 + bob);
    ctx.lineTo(13, -18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else if (sarungStyle === 'lipit_jawara') {
    // Bang Bambang: Muscle vest + rolled wrestling mantle across left shoulder
    ctx.fillStyle = isFlash ? '#ffffff' : '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-14, -31 + bob, 28, 14, 6);
    ctx.fill();
    ctx.stroke();

    if (!isFlash) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-11, -19 + bob, 22, 3);
    }

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-14, -31 + bob);
    ctx.lineTo(-5, -31 + bob);
    ctx.lineTo(13, -18 + bob);
    ctx.lineTo(5, -18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-10, -30 + bob);
    ctx.lineTo(9, -18 + bob);
    ctx.stroke();

  } else if (sarungStyle === 'jubah_wali') {
    // Gus Dimas: Pure white koko + dual-shoulder Sorban Waliyullah shawl
    ctx.fillStyle = isFlash ? '#ffffff' : '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(-13, -31 + bob, 26, 14, 6);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -30 + bob);
    ctx.lineTo(0, -18 + bob);
    ctx.stroke();

    ctx.fillStyle = isFlash ? '#ffffff' : sarungFill;
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-14, -32 + bob, 6, 15, 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(8, -32 + bob, 6, 15, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(-13, -19 + bob, 4.5, 2);
    ctx.fillRect(9, -19 + bob, 4.5, 2);

  } else if (sarungStyle === 'lipit_dinas') {
    // Pak RT: Official Linmas safari shirt with breast pockets & duty sash
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.roundRect(-13, -31 + bob, 26, 14, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFlash ? '#ffffff' : '#14532d';
    ctx.fillRect(-10, -25 + bob, 6, 5);
    ctx.strokeRect(-10, -25 + bob, 6, 5);
    ctx.fillRect(4, -25 + bob, 6, 5);
    ctx.strokeRect(4, -25 + bob, 6, 5);

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-11, -31 + bob);
    ctx.lineTo(-4, -31 + bob);
    ctx.lineTo(12, -18 + bob);
    ctx.lineTo(5, -18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(-8, -26 + bob, 1.8, 0, Math.PI * 2);
    ctx.fill();

  } else if (sarungStyle === 'lilit_kebaya') {
    // Mbak Sri: Tailored kebaya + billowing silk shawl draped around shoulders
    ctx.fillStyle = isFlash ? '#ffffff' : '#be185d';
    ctx.beginPath();
    ctx.roundRect(-12, -31 + bob, 24, 14, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f1c29b';
    ctx.beginPath();
    ctx.moveTo(-5, -31 + bob);
    ctx.lineTo(5, -31 + bob);
    ctx.lineTo(0, -24 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isFlash ? '#ffffff' : sarungFill;
    ctx.beginPath();
    ctx.moveTo(-13, -29 + bob);
    ctx.quadraticCurveTo(-15, -20 + bob, -11, -17 + bob);
    ctx.lineTo(-6, -17 + bob);
    ctx.quadraticCurveTo(-10, -22 + bob, -9, -29 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(13, -29 + bob);
    ctx.quadraticCurveTo(15, -20 + bob, 11, -17 + bob);
    ctx.lineTo(6, -17 + bob);
    ctx.quadraticCurveTo(10, -22 + bob, 9, -29 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else {
    // Cak Bima / Default: Classic shirt with cross-chest combat sarung sash
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.roundRect(-13, -31 + bob, 26, 14, 6);
    ctx.fill();
    ctx.stroke();

    if (!isFlash) {
      ctx.fillStyle = palette.shirtShadow;
      ctx.fillRect(-11, -18 + bob, 22, 2);
    }

    ctx.fillStyle = sarungFill;
    ctx.beginPath();
    ctx.moveTo(-12, -30 + bob);
    ctx.lineTo(-4, -30 + bob);
    ctx.lineTo(12, -18 + bob);
    ctx.lineTo(4, -18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8, -28 + bob);
    ctx.lineTo(8, -18 + bob);
    ctx.stroke();
  }
}

function drawAmbientElementalWeaponAura(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  time: number
): void {
  const elem = player.slashElement;
  if (!elem || elem === 'none') return;
  const lv = player.slashElementLevel || 1;

  ctx.save();
  ctx.translate(14, -6);

  if (elem === 'petir') {
    const sparkCount = 3 + lv * 2;
    for (let i = 0; i < sparkCount; i++) {
      const a = (time * 14 + (i * Math.PI * 2) / sparkCount) % (Math.PI * 2);
      const dist = 7 + Math.sin(time * 20 + i * 3) * 4;
      const sx = Math.cos(a) * dist;
      const sy = Math.sin(a) * dist;

      ctx.strokeStyle = i % 2 === 0 ? '#38bdf8' : '#facc15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx * 0.4, sy * 0.4);
      ctx.lineTo(sx * 0.7 + Math.sin(time * 25 + i) * 3, sy * 0.7);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  } else if (elem === 'api') {
    const flameCount = 3 + lv;
    for (let i = 0; i < flameCount; i++) {
      const phase = (time * 8 + i * 1.6) % 1;
      const fx = (i - 1.5) * 5 + Math.sin(time * 12 + i) * 2;
      const fy = -phase * 12;
      const size = (1 - phase) * (3.5 + lv);

      ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#ef4444';
      ctx.beginPath();
      ctx.arc(fx, fy, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(fx, fy + 2, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (elem === 'badai') {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 + lv * 2, 5 + lv, time * 10, 0, Math.PI * 1.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 + lv * 2, 3 + lv, -time * 12, 0, Math.PI);
    ctx.stroke();
  } else if (elem === 'suci') {
    const moteCount = 3 + lv;
    for (let i = 0; i < moteCount; i++) {
      const a = time * 4 + (i * Math.PI * 2) / moteCount;
      const r = 8 + lv * 2;
      const mx = Math.cos(a) * r;
      const my = Math.sin(a) * r * 0.6;

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(mx, my - 2.5);
      ctx.lineTo(mx + 2, my);
      ctx.lineTo(mx, my + 2.5);
      ctx.lineTo(mx - 2, my);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 0.75, my - 0.75, 1.5, 1.5);
    }
  }

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
  if (crate.style === 'gold_kendi') {
    drawGoldKendi(ctx, crate);
    return;
  }

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

function drawGoldKendi(ctx: CanvasRenderingContext2D, crate: CrateState): void {
  const t = crate.bobPhase ?? 0;
  const pulse = Math.sin(t * 5) * 0.18 + 0.82;
  const cx = crate.x;
  const cy = crate.y - 14;

  ctx.save();
  // 1. Shimmering Golden Halo / Radiant Aura
  const haloGrad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 34);
  haloGrad.addColorStop(0, `rgba(254, 240, 138, ${0.45 * pulse})`);
  haloGrad.addColorStop(0.5, `rgba(250, 204, 21, ${0.25 * pulse})`);
  haloGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();

  // 2. Celestial Orbiting Ring
  ctx.strokeStyle = `rgba(253, 224, 71, ${0.7 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 26, 8, Math.sin(t * 1.5) * 0.3, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Drop shadow
  ctx.fillStyle = 'rgba(9, 12, 20, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, crate.y + 12, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Flash white on hit
  const isFlash = crate.hitFlashTimer > 0;
  const bodyGrad = ctx.createLinearGradient(cx - 16, cy - 18, cx + 16, cy + 18);
  if (isFlash) {
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(1, '#ffffff');
  } else {
    bodyGrad.addColorStop(0, '#fef08a');
    bodyGrad.addColorStop(0.4, '#facc15');
    bodyGrad.addColorStop(1, '#ca8a04');
  }

  // 4. Kendi Jug Body (Curved traditional pitcher)
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = isFlash ? '#ffffff' : '#78350f';
  ctx.lineWidth = 2.2;

  ctx.beginPath();
  // Main spherical body
  ctx.arc(cx, cy + 2, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Neck and flared rim lid
  ctx.beginPath();
  ctx.rect(cx - 5, cy - 14, 10, 8);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy - 14, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Spout on left side
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 2);
  ctx.quadraticCurveTo(cx - 20, cy - 8, cx - 18, cy - 14);
  ctx.lineTo(cx - 14, cy - 13);
  ctx.quadraticCurveTo(cx - 16, cy - 6, cx - 7, cy + 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Curved handle on right side
  ctx.beginPath();
  ctx.arc(cx + 12, cy, 7, -Math.PI * 0.45, Math.PI * 0.55);
  ctx.strokeStyle = isFlash ? '#ffffff' : '#78350f';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 5. Crown Star Jewel on top
  ctx.fillStyle = isFlash ? '#ffffff' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx, cy - 17, 3, 0, Math.PI * 2);
  ctx.fill();

  // 6. Mini Floating Health Bar
  const hpRatio = Math.max(0, crate.hp / crate.maxHp);
  const barW = 28;
  const barH = 4;
  const bx = cx - barW / 2;
  const by = cy - 26;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(bx, by, barW * hpRatio, barH);

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
