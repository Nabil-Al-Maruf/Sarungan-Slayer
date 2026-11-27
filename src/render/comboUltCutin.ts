import { PLAYER_PALETTES, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import { getHeroDef } from '../core/heroes';
import type { ComboUltState, GameState, PlayerState, SlashElement } from '../core/types';
import { createPlayer } from '../entities/player';
import { drawPlayer } from './characterRig';

const ELEM_COLOR: Record<SlashElement, string> = {
  none: '#94a3b8',
  badai: '#38bdf8',
  petir: '#facc15',
  es: '#67e8f9',
  suci: '#fde047',
  api: '#f97316',
  daun: '#4ade80',
};

const ELEM_ICON: Record<SlashElement, string> = {
  none: '🧣',
  badai: '🌀',
  petir: '⚡',
  es: '❄️',
  suci: '✨',
  api: '🔥',
  daun: '🍃',
};

// Reusable dummy player pool for zero-GC cut-in portrait rendering
const portraitCache: Record<string, PlayerState> = {};

function getPortraitPlayer(
  heroId: ComboUltState['participants'][number]['heroId'],
  paletteIndex: number,
  name: string,
  element: SlashElement,
  time: number
): PlayerState {
  const key = `${heroId}:${paletteIndex}:${element}`;
  let p = portraitCache[key];
  if (!p) {
    p = createPlayer(`cutin_${key}`, 0, 0, paletteIndex, name, heroId);
    portraitCache[key] = p;
  }
  p.slashElement = element;
  p.slashElementLevel = 3;
  p.dirX = 1;
  p.dirY = 0;
  p.animTime = time * 10;
  p.ultActiveTimer = 0.5;
  p.scaleX = 1.05;
  p.scaleY = 0.98;
  return p;
}

/**
 * Draws a unique elemental background motif inside each Hero's diagonal Wuthering Waves panel!
 */
function drawPanelElementMotif(
  ctx: CanvasRenderingContext2D,
  elem: SlashElement,
  cx: number,
  cy: number,
  panelW: number,
  bandH: number,
  time: number
): void {
  ctx.save();
  if (elem === 'petir') {
    // Zig-zag electric lightning bolts across panel
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.lineWidth = 2.6;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      let lx = cx - panelW * 0.35 + b * (panelW * 0.32);
      let ly = cy - bandH * 0.45;
      ctx.moveTo(lx, ly);
      for (let s = 1; s <= 5; s++) {
        lx += Math.sin(time * 28 + b * 4 + s * 3) * 18;
        ly += bandH * 0.18;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
  } else if (elem === 'es') {
    // Rotating crystalline frost hexagons & ice shards
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.6)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = time * 1.4 + (k * Math.PI) / 2;
      const rx = cx + Math.cos(a) * (panelW * 0.25);
      const ry = cy + Math.sin(a) * (bandH * 0.22);
      ctx.beginPath();
      for (let h = 0; h <= 6; h++) {
        const ha = (h * Math.PI) / 3 + time * 2;
        const px = rx + Math.cos(ha) * 16;
        const py = ry + Math.sin(ha) * 16;
        if (h === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (elem === 'api') {
    // Rising blazing embers & flame tongues
    for (let f = 0; f < 9; f++) {
      const phase = (time * 2.4 + f * 0.17) % 1;
      const fx = cx + Math.sin(f * 2.1 + time * 6) * (panelW * 0.34);
      const fy = cy + bandH * 0.45 - phase * bandH * 0.9;
      ctx.fillStyle = f % 2 === 0 ? 'rgba(249, 115, 22, 0.58)' : 'rgba(254, 240, 138, 0.65)';
      ctx.beginPath();
      ctx.arc(fx, fy, (1 - phase) * 10 + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (elem === 'suci') {
    // Rotating golden sacred mandala rays
    ctx.save();
    ctx.translate(cx, cy - 12);
    ctx.rotate(time * 1.8);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.48)';
    ctx.lineWidth = 2.2;
    for (let r = 0; r < 8; r++) {
      const a = (r * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a) * (panelW * 0.62), Math.sin(a) * (panelW * 0.62));
      ctx.stroke();
    }
    ctx.restore();
  } else if (elem === 'daun') {
    // Swirling emerald razor leaves & pink blossom petals
    for (let l = 0; l < 8; l++) {
      const a = time * 3.5 + (l * Math.PI * 2) / 8;
      const lx = cx + Math.cos(a) * (panelW * 0.32);
      const ly = cy + Math.sin(a * 1.3) * (bandH * 0.28);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + 0.8);
      ctx.fillStyle = l % 3 === 0 ? 'rgba(244, 114, 182, 0.72)' : 'rgba(74, 222, 128, 0.72)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Badai: Sweeping cyclone wind arcs
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 2.4;
    for (let w = 0; w < 4; w++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy - 40 + w * 32, panelW * 0.36, 14, -0.25, time * 5 + w, time * 5 + w + Math.PI * 1.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Phase 1: Wuthering Waves Style Cinematic Diagonal Cut-In Scene!
 * Renders full-screen slanted portrait panels with per-element animated motifs,
 * speedlines, central resonance emblem, diagonal lens-flare slash, and combo banner.
 */
export function drawComboUltCutIn(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cu = state.comboUlt;
  if (!cu || cu.elapsed >= cu.cutinDuration) return;

  const t = cu.elapsed / cu.cutinDuration; // 0..1
  const easeOut = 1 - Math.pow(1 - Math.min(1, t * 2.8), 3);
  const fadeOut = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, fadeOut));

  // 1. Deep Cosmic Backdrop (Wuthering Waves dark cinematic vignette)
  const bgGrad = ctx.createLinearGradient(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  bgGrad.addColorStop(0, 'rgba(4, 7, 18, 0.95)');
  bgGrad.addColorStop(0.5, 'rgba(10, 15, 34, 0.93)');
  bgGrad.addColorStop(1, 'rgba(4, 7, 18, 0.97)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // 2. High-Speed Diagonal Anime Speedlines
  ctx.save();
  ctx.globalAlpha = 0.28 * fadeOut;
  for (let i = 0; i < 28; i++) {
    const sy = ((i * 34 + cu.elapsed * 980) % (VIRTUAL_HEIGHT + 160)) - 80;
    ctx.strokeStyle = i % 2 === 0 ? cu.primaryColor : cu.secondaryColor;
    ctx.lineWidth = i % 3 === 0 ? 3.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(-60, sy + 60);
    ctx.lineTo(VIRTUAL_WIDTH + 60, sy - 60);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Diagonal Slanted Character Cut-In Panels (2, 3, 4, 5, or 6 strips!)
  const count = cu.participants.length;
  const bandTop = 74;
  const bandBottom = VIRTUAL_HEIGHT - 112;
  const bandH = bandBottom - bandTop;
  const skew = 52;
  const totalSpan = VIRTUAL_WIDTH - 40;
  const gap = 10;
  const panelW = (totalSpan - gap * (count - 1)) / count;

  for (let i = 0; i < count; i++) {
    const part = cu.participants[i];
    const elemCol = ELEM_COLOR[part.element] || cu.primaryColor;
    const pal = PLAYER_PALETTES[part.paletteIndex % PLAYER_PALETTES.length];
    const hDef = getHeroDef(part.heroId);

    const slideDir = i % 2 === 0 ? -1 : 1;
    const slideOffset = (1 - easeOut) * 230 * slideDir;

    const x0 = 20 + i * (panelW + gap);
    const x1 = x0 + panelW;
    const y0 = bandTop + slideOffset;
    const y1 = bandBottom + slideOffset;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 + skew * 0.5, y0);
    ctx.lineTo(x1 + skew * 0.5, y0);
    ctx.lineTo(x1 - skew * 0.5, y1);
    ctx.lineTo(x0 - skew * 0.5, y1);
    ctx.closePath();

    const pGrad = ctx.createLinearGradient(x0, y0, x1, y1);
    pGrad.addColorStop(0, '#0f172a');
    pGrad.addColorStop(0.55, `${elemCol}4c`);
    pGrad.addColorStop(1, '#020617');
    ctx.fillStyle = pGrad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    const cx = (x0 + x1) * 0.5;
    const cy = y0 + bandH * 0.56;
    const radGlow = ctx.createRadialGradient(cx, cy - 18, 10, cx, cy - 18, panelW * 0.9);
    radGlow.addColorStop(0, `${elemCol}88`);
    radGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radGlow;
    ctx.fillRect(x0 - skew, y0, panelW + skew * 2, bandH);

    // Unique per-element animated motif behind Hero!
    drawPanelElementMotif(ctx, part.element, cx, cy - 10, panelW, bandH, state.time + cu.elapsed);

    // Dynamic zoom-in Hero character portrait
    const zoomPulse = 1 + Math.min(0.14, t * 0.16);
    const portraitScale = (count <= 2 ? 2.65 : count <= 3 ? 2.3 : count <= 4 ? 2.0 : 1.75) * zoomPulse;
    const dummy = getPortraitPlayer(part.heroId, part.paletteIndex, part.name, part.element, state.time + cu.elapsed);
    ctx.save();
    ctx.translate(cx, cy + 44);
    ctx.scale(portraitScale, portraitScale);
    drawPlayer(ctx, dummy, state.time + cu.elapsed, false, true);
    ctx.restore();

    // Top Elemental Emblem inside panel
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(x0 - skew * 0.5, y0, panelW + skew, 34);
    ctx.font = `900 ${count >= 5 ? 11 : 13}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = elemCol;
    ctx.fillText(
      `${ELEM_ICON[part.element]} ${hDef.name.toUpperCase()}`,
      cx + skew * 0.25,
      y0 + 22
    );

    // Bottom Player Name strip
    ctx.fillStyle = 'rgba(2, 6, 23, 0.84)';
    ctx.fillRect(x0 - skew * 0.5, y1 - 30, panelW + skew, 30);
    ctx.font = `800 ${count >= 5 ? 10 : 12}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = pal.accent;
    ctx.fillText(part.name.toUpperCase(), cx - skew * 0.2, y1 - 10);

    ctx.restore();

    // Glowing Neon Panel Border
    ctx.strokeStyle = elemCol;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  // 4. Central Spinning Resonance Ring Emblem + Dual Diagonal Lens-Flare Slash
  if (t > 0.12 && t < 0.78) {
    const slashP = (t - 0.12) / 0.66;
    const sx = -120 + slashP * (VIRTUAL_WIDTH + 240);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7 * (1 - Math.abs(slashP - 0.5) * 1.5);
    ctx.beginPath();
    ctx.moveTo(sx - 280, VIRTUAL_HEIGHT * 0.64);
    ctx.lineTo(sx + 280, VIRTUAL_HEIGHT * 0.32);
    ctx.stroke();

    const flareGrad = ctx.createRadialGradient(sx, VIRTUAL_HEIGHT * 0.48, 4, sx, VIRTUAL_HEIGHT * 0.48, 95);
    flareGrad.addColorStop(0, 'rgba(255,255,255,0.96)');
    flareGrad.addColorStop(0.4, `${cu.primaryColor}99`);
    flareGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = flareGrad;
    ctx.beginPath();
    ctx.arc(sx, VIRTUAL_HEIGHT * 0.48, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. Top Resonance Tier Pill
  ctx.save();
  const bannerScale = 0.86 + easeOut * 0.14;
  ctx.translate(VIRTUAL_WIDTH * 0.5, 40);
  ctx.scale(bannerScale, bannerScale);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
  ctx.strokeStyle = cu.primaryColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-195, -20, 390, 38, 19);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#fef08a';
  ctx.fillText(cu.tierLabel, 0, 6);
  ctx.restore();

  // Bottom Dramatic Title Plate
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
  ctx.fillRect(0, VIRTUAL_HEIGHT - 102, VIRTUAL_WIDTH, 102);

  const lineGrad = ctx.createLinearGradient(0, 0, VIRTUAL_WIDTH, 0);
  lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
  lineGrad.addColorStop(0.25, cu.primaryColor);
  lineGrad.addColorStop(0.75, cu.secondaryColor);
  lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, VIRTUAL_HEIGHT - 102, VIRTUAL_WIDTH, 3);

  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#020617';
  ctx.font = '900 32px "Segoe UI", system-ui, sans-serif';
  ctx.strokeText(cu.title, VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT - 54);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(cu.title, VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT - 54);

  ctx.font = '800 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = cu.primaryColor;
  ctx.fillText(cu.subtitle, VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT - 22);
  ctx.restore();

  // 6. Opening Impact White Flash
  if (t < 0.14) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - t / 0.14) * 0.72})`;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }

  ctx.restore();
}

/**
 * Phase 2: 9 Distinct Elemental & Tier Arena Finisher Animations!
 * Every hero combination produces a genuinely different visual spectacle in the arena!
 */
export function drawComboUltArenaFinisher(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cu = state.comboUlt;
  if (!cu || cu.elapsed < cu.cutinDuration) return;

  const finDur = Math.max(0.1, cu.totalDuration - cu.cutinDuration);
  const p = Math.max(0, Math.min(1, (cu.elapsed - cu.cutinDuration) / finDur));
  const fade = 1 - p;
  const cx = VIRTUAL_WIDTH * 0.5;
  const cy = VIRTUAL_HEIGHT * 0.52;
  const colors = cu.participants.map((part) => ELEM_COLOR[part.element] || cu.primaryColor);

  ctx.save();

  // White detonation flash right on release
  if (p < 0.16) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - p / 0.16) * 0.72})`;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }

  if (cu.visualPattern === 'storm_lightning') {
    // === 1. STORM LIGHTNING: Sky-to-Ground Thunderbolts + Swirling Electric Vortex ===
    ctx.globalAlpha = fade;
    for (let i = 0; i < 8; i++) {
      const bx = 90 + i * 112 + Math.sin(p * 30 + i * 2) * 18;
      ctx.strokeStyle = i % 2 === 0 ? '#facc15' : '#38bdf8';
      ctx.lineWidth = (7 - (i % 2) * 2) * fade;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      for (let seg = 1; seg <= 6; seg++) {
        ctx.lineTo(bx + Math.sin(seg * 13 + i * 5 + p * 40) * 28, seg * 92);
      }
      ctx.stroke();
    }
    // Electric shockwave rings
    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = r % 2 === 0 ? '#38bdf8' : '#fef08a';
      ctx.lineWidth = 8 * fade;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 60 + p * (280 + r * 90), 34 + p * (150 + r * 45), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cu.visualPattern === 'frost_shatter') {
    // === 2. FROST SHATTER: 12 Giant Glacier Ice Spikes + Crystalline Shatter Burst ===
    ctx.globalAlpha = fade;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const dist = 60 + p * 260;
      const sx = cx + Math.cos(a) * dist;
      const sy = cy + Math.sin(a) * (dist * 0.62);
      const spikeH = (78 + (i % 3) * 24) * Math.sin(Math.min(1, p * 1.4) * Math.PI * 0.7);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = i % 2 === 0 ? '#67e8f9' : '#e0f2fe';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.lineTo(0, -spikeH);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Frost ring
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 10 * fade;
    ctx.beginPath();
    ctx.arc(cx, cy, 45 + p * 390, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cu.visualPattern === 'inferno_vortex') {
    // === 3. INFERNO VORTEX / THERMAL SHOCK: Giant Spiral Fire Pillars + Meteor Blasts ===
    ctx.globalAlpha = fade;
    for (let tier = 0; tier < 5; tier++) {
      const ty = cy + 120 - tier * 58;
      const tr = 90 + tier * 42 + p * 140;
      ctx.strokeStyle = tier % 2 === 0 ? '#f97316' : '#fef08a';
      ctx.lineWidth = (14 - tier * 1.5) * fade;
      ctx.beginPath();
      ctx.ellipse(cx, ty, tr, tr * 0.34, 0, p * 10 + tier, p * 10 + tier + Math.PI * 1.45);
      ctx.stroke();
    }
    // Dual opposing energy beams (Thermal / Overload clash!)
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(i === 0 ? -0.3 : 0.3);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-VIRTUAL_WIDTH, -(20 * fade), VIRTUAL_WIDTH * 2, 40 * fade);
      ctx.restore();
    }
  } else if (cu.visualPattern === 'sacred_dragon') {
    // === 4. SACRED DRAGON: Giant Octagonal Karomah Mandala + Twin Orbiting Gold Dragons ===
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p * 1.6);
    const mRad = 90 + p * 230;
    for (let sq = 0; sq < 2; sq++) {
      ctx.save();
      ctx.rotate((sq * Math.PI) / 4);
      ctx.strokeStyle = sq === 0 ? '#fde047' : '#34d399';
      ctx.lineWidth = 7 * fade;
      ctx.strokeRect(-mRad * 0.65, -mRad * 0.65, mRad * 1.3, mRad * 1.3);
      ctx.restore();
    }
    // Twin radiant spirit ribbons
    for (let d = 0; d < 2; d++) {
      ctx.strokeStyle = d === 0 ? '#facc15' : colors[1] || '#38bdf8';
      ctx.lineWidth = 11 * fade;
      ctx.beginPath();
      for (let s = 0; s <= 18; s++) {
        const ang = d * Math.PI + p * 8 + (s / 18) * Math.PI * 1.8;
        const r = 55 + s * 14 + p * 90;
        const rx = Math.cos(ang) * r;
        const ry = Math.sin(ang) * r * 0.64;
        if (s === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.stroke();
    }
    ctx.restore();
  } else if (cu.visualPattern === 'emerald_cyclone') {
    // === 5. EMERALD CYCLONE: 20 Swirling Razor Leaves & Silk Ribbons ===
    ctx.globalAlpha = fade;
    for (let l = 0; l < 20; l++) {
      const ang = (l * Math.PI * 2) / 20 + p * 7;
      const dist = 40 + p * (340 + (l % 3) * 55);
      const lx = cx + Math.cos(ang) * dist;
      const ly = cy + Math.sin(ang) * (dist * 0.64);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(ang + 0.6);
      ctx.fillStyle = l % 3 === 0 ? '#f472b6' : l % 2 === 0 ? '#4ade80' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.quadraticCurveTo(0, -8, 16, 0);
      ctx.quadraticCurveTo(0, 8, -14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 9 * fade;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70 + p * 360, 42 + p * 210, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cu.visualPattern === 'trinity_prism') {
    // === 6. 3x TRIO: Rotating 3-Beam Trinity Prism Triangle + 3-Color Rings ===
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p * 1.5);
    const rad = 70 + p * 260;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8 * fade;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI * 0.5;
      const vx = Math.cos(a) * rad;
      const vy = Math.sin(a) * rad * 0.72;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI * 0.5;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 18 * fade;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 520, Math.sin(a) * 340);
      ctx.lineTo(0, 0);
      ctx.stroke();
    }
    ctx.restore();
  } else if (cu.visualPattern === 'quartet_cross') {
    // === 7. 4x QUARTET: 4-Corner Diagonal Cross-Slash X-Nova ===
    ctx.globalAlpha = fade;
    const corners = [
      [0, 0],
      [VIRTUAL_WIDTH, 0],
      [VIRTUAL_WIDTH, VIRTUAL_HEIGHT],
      [0, VIRTUAL_HEIGHT],
    ];
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 24 * fade;
      ctx.beginPath();
      ctx.moveTo(corners[i][0], corners[i][1]);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12 * fade;
    ctx.beginPath();
    ctx.arc(cx, cy, 50 + p * 440, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cu.visualPattern === 'penta_star') {
    // === 8. 5x PENTA: Glowing 5-Point Starburst Pentagram + 5-Color Shockwaves ===
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p * 0.9);
    const rad = 80 + p * 270;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 7 * fade;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const idx = (i * 2) % 5;
      const a = (idx * Math.PI * 2) / 5 - Math.PI * 0.5;
      const vx = Math.cos(a) * rad;
      const vy = Math.sin(a) * rad * 0.76;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.stroke();

    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 6 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, 30 + p * (200 + i * 65), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // === 9. 6x HEXAD: 6-Element Hexagram Mandala + Wuthering Waves Dimensional Glass Shatter! ===
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p * 0.7);
    const rad = 95 + p * 280;

    for (let tri = 0; tri < 2; tri++) {
      ctx.strokeStyle = tri === 0 ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 7 * fade;
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = (i * Math.PI * 2) / 3 + (tri === 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
        const vx = Math.cos(a) * rad;
        const vy = Math.sin(a) * rad * 0.78;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 18 * fade;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 600, Math.sin(a) * 420);
      ctx.stroke();
    }

    // Dimensional Glass-Shatter Fracture Lines across screen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 3 * fade;
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI * 2) / 12 + 0.13;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a + 0.08) * 190, Math.sin(a + 0.08) * 130);
      ctx.lineTo(Math.cos(a - 0.06) * 480, Math.sin(a - 0.06) * 320);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
