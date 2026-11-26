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
 * Phase 1: Wuthering Waves Style Cinematic Diagonal Cut-In Scene!
 * Renders full-screen slanted portrait panels, speedlines, glowing elemental seams,
 * diagonal lens-flare slash, and resonance title banner.
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
  bgGrad.addColorStop(0, 'rgba(4, 7, 18, 0.94)');
  bgGrad.addColorStop(0.5, 'rgba(10, 15, 34, 0.92)');
  bgGrad.addColorStop(1, 'rgba(4, 7, 18, 0.96)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // 2. High-Speed Diagonal Anime Speedlines
  ctx.save();
  ctx.globalAlpha = 0.24 * fadeOut;
  for (let i = 0; i < 24; i++) {
    const sy = ((i * 39 + cu.elapsed * 900) % (VIRTUAL_HEIGHT + 160)) - 80;
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
  const bandTop = 78;
  const bandBottom = VIRTUAL_HEIGHT - 116;
  const bandH = bandBottom - bandTop;
  const skew = 48;
  const totalSpan = VIRTUAL_WIDTH - 40;
  const gap = 10;
  const panelW = (totalSpan - gap * (count - 1)) / count;

  for (let i = 0; i < count; i++) {
    const part = cu.participants[i];
    const elemCol = ELEM_COLOR[part.element] || cu.primaryColor;
    const pal = PLAYER_PALETTES[part.paletteIndex % PLAYER_PALETTES.length];
    const hDef = getHeroDef(part.heroId);

    // Alternating slide-in from top/bottom for dynamic Wuthering Waves impact
    const slideDir = i % 2 === 0 ? -1 : 1;
    const slideOffset = (1 - easeOut) * 220 * slideDir;

    const x0 = 20 + i * (panelW + gap);
    const x1 = x0 + panelW;
    const y0 = bandTop + slideOffset;
    const y1 = bandBottom + slideOffset;

    ctx.save();
    // Slanted parallelogram clip path
    ctx.beginPath();
    ctx.moveTo(x0 + skew * 0.5, y0);
    ctx.lineTo(x1 + skew * 0.5, y0);
    ctx.lineTo(x1 - skew * 0.5, y1);
    ctx.lineTo(x0 - skew * 0.5, y1);
    ctx.closePath();

    // Panel metallic elemental gradient fill
    const pGrad = ctx.createLinearGradient(x0, y0, x1, y1);
    pGrad.addColorStop(0, '#0f172a');
    pGrad.addColorStop(0.55, `${elemCol}44`);
    pGrad.addColorStop(1, '#020617');
    ctx.fillStyle = pGrad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    // Radial energy glow behind hero portrait
    const cx = (x0 + x1) * 0.5;
    const cy = y0 + bandH * 0.56;
    const radGlow = ctx.createRadialGradient(cx, cy - 18, 10, cx, cy - 18, panelW * 0.85);
    radGlow.addColorStop(0, `${elemCol}88`);
    radGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radGlow;
    ctx.fillRect(x0 - skew, y0, panelW + skew * 2, bandH);

    // Render live animated Hero character scaled up inside the cut-in panel!
    const portraitScale = count <= 2 ? 2.6 : count <= 3 ? 2.3 : count <= 4 ? 2.0 : 1.75;
    const dummy = getPortraitPlayer(part.heroId, part.paletteIndex, part.name, part.element, state.time + cu.elapsed);
    ctx.save();
    ctx.translate(cx, cy + 44);
    ctx.scale(portraitScale, portraitScale);
    // Draw only the character rig (hide nametag by translating or drawing cleanly)
    drawPlayer(ctx, dummy, state.time + cu.elapsed, false, true);
    ctx.restore();

    // Top-left Elemental Emblem inside panel
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
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
    ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
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

  // 4. Wuthering Waves Signature Diagonal Lens-Flare Resonance Slash across screen
  if (t > 0.12 && t < 0.72) {
    const slashP = (t - 0.12) / 0.6;
    const sx = -120 + slashP * (VIRTUAL_WIDTH + 240);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6 * (1 - Math.abs(slashP - 0.5) * 1.6);
    ctx.beginPath();
    ctx.moveTo(sx - 260, VIRTUAL_HEIGHT * 0.62);
    ctx.lineTo(sx + 260, VIRTUAL_HEIGHT * 0.34);
    ctx.stroke();

    const flareGrad = ctx.createRadialGradient(sx, VIRTUAL_HEIGHT * 0.48, 4, sx, VIRTUAL_HEIGHT * 0.48, 90);
    flareGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
    flareGrad.addColorStop(0.4, `${cu.primaryColor}88`);
    flareGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = flareGrad;
    ctx.beginPath();
    ctx.arc(sx, VIRTUAL_HEIGHT * 0.48, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. Top Resonance Tier Pill & Bottom Combo Title Banner
  ctx.save();
  const bannerScale = 0.86 + easeOut * 0.14;
  ctx.translate(VIRTUAL_WIDTH * 0.5, 42);
  ctx.scale(bannerScale, bannerScale);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.strokeStyle = cu.primaryColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-185, -20, 370, 38, 19);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#fef08a';
  ctx.fillText(cu.tierLabel, 0, 6);
  ctx.restore();

  // Bottom Dramatic Title Plate
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
  ctx.fillRect(0, VIRTUAL_HEIGHT - 104, VIRTUAL_WIDTH, 104);

  const lineGrad = ctx.createLinearGradient(0, 0, VIRTUAL_WIDTH, 0);
  lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
  lineGrad.addColorStop(0.25, cu.primaryColor);
  lineGrad.addColorStop(0.75, cu.secondaryColor);
  lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, VIRTUAL_HEIGHT - 104, VIRTUAL_WIDTH, 3);

  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#020617';
  ctx.font = '900 32px "Segoe UI", system-ui, sans-serif';
  ctx.strokeText(cu.title, VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT - 56);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(cu.title, VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT - 56);

  ctx.font = '800 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = cu.primaryColor;
  ctx.fillText(cu.subtitle, VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT - 24);
  ctx.restore();

  // 6. Opening Impact White Flash
  if (t < 0.14) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - t / 0.14) * 0.72})`;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }

  ctx.restore();
}

/**
 * Phase 2: Distinct Arena Finisher Animations per Tier (2x, 3x, 4x, 5x, 6x)!
 * Drawn in world/screen space right after the Wuthering Waves cut-in finishes.
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
  if (p < 0.18) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - p / 0.18) * 0.75})`;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }

  if (cu.visualPattern === 'dual_clash') {
    // === 2x DUO: Dual Crossing Elemental Beams + Central Energy Clash Ring ===
    ctx.globalAlpha = fade;
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(i === 0 ? -0.35 : 0.35);
      ctx.fillStyle = colors[i] || cu.primaryColor;
      ctx.fillRect(-VIRTUAL_WIDTH, -(26 * fade), VIRTUAL_WIDTH * 2, 52 * fade);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-VIRTUAL_WIDTH, -(9 * fade), VIRTUAL_WIDTH * 2, 18 * fade);
      ctx.restore();
    }
    ctx.strokeStyle = cu.primaryColor;
    ctx.lineWidth = 10 * fade;
    ctx.beginPath();
    ctx.arc(cx, cy, 40 + p * 380, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cu.visualPattern === 'trinity_prism') {
    // === 3x TRIO: Rotating 3-Beam Trinity Prism Triangle + Prismatic Implosion ===
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p * 1.4);
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
    // === 4x QUARTET: 4-Corner Diagonal Cross-Slash X-Nova ===
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
    // === 5x PENTA: Glowing 5-Point Starburst Pentagram + 5-Color Shockwaves ===
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
    // === 6x HEXAD: 6-Element Hexagram Mandala + Wuthering Waves Dimensional Glass Shatter! ===
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p * 0.7);
    const rad = 95 + p * 280;

    // 6-Element Hexagram (2 counter-pointing triangles)
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

    // 6 Elemental Pillars radiating to edges
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
