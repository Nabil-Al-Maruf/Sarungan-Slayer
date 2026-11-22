import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import type { MapTheme, Obstacle } from '../core/types';

let cachedBgCanvas: HTMLCanvasElement | null = null;
let cachedBgKey = '';

function getOrBuildStaticGround(theme: MapTheme, arenaWidth: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${theme}:${arenaWidth}`;
  if (cachedBgCanvas && cachedBgKey === key) {
    return cachedBgCanvas;
  }

  const off = cachedBgCanvas ?? document.createElement('canvas');
  off.width = arenaWidth;
  off.height = VIRTUAL_HEIGHT;
  const octx = off.getContext('2d');
  if (!octx) return null;

  if (theme === 'tunjungan') {
    drawTunjunganGround(octx, arenaWidth, 0, 0);
  } else if (theme === 'suramadu') {
    drawSuramaduGround(octx, arenaWidth, 0, 0);
  } else if (theme === 'perempatan') {
    drawPerempatanGround(octx, arenaWidth, 0, 0);
  } else {
    drawTambakGround(octx, arenaWidth, 0, 0);
  }

  cachedBgCanvas = off;
  cachedBgKey = key;
  return off;
}

export function drawTopDownMapGround(
  ctx: CanvasRenderingContext2D,
  theme: MapTheme,
  arenaWidth: number,
  cameraX: number,
  time: number
): void {
  const cached = getOrBuildStaticGround(theme, arenaWidth);
  if (cached) {
    const sx = Math.max(0, Math.min(arenaWidth - VIRTUAL_WIDTH, Math.round(cameraX)));
    ctx.drawImage(
      cached,
      sx,
      0,
      VIRTUAL_WIDTH,
      VIRTUAL_HEIGHT,
      sx,
      0,
      VIRTUAL_WIDTH,
      VIRTUAL_HEIGHT
    );

    // Lightweight animated accents only (1-6 strokes/frame instead of 300+ vector shapes!)
    if (theme === 'tambak') {
      const wave = Math.sin(time * 2.5) * 4;
      ctx.save();
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.lineWidth = 2.5;
      for (let seg = 0; seg < arenaWidth; seg += 960) {
        if (seg + 200 < cameraX || seg > cameraX + VIRTUAL_WIDTH) continue;
        ctx.beginPath();
        ctx.moveTo(seg + 45 + wave, 502);
        ctx.lineTo(seg + 95 + wave, 502);
        ctx.stroke();
      }
      ctx.restore();
    } else if (theme === 'suramadu') {
      ctx.save();
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const wx = cameraX + VIRTUAL_WIDTH - (((time * 340 + i * 210) % (VIRTUAL_WIDTH + 180)) - 90);
        const wy = 155 + i * 62;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 65, wy + 4);
        ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }

  if (theme === 'tunjungan') {
    drawTunjunganGround(ctx, arenaWidth, cameraX, time);
    return;
  }
  if (theme === 'suramadu') {
    drawSuramaduGround(ctx, arenaWidth, cameraX, time);
    return;
  }
  if (theme === 'perempatan') {
    drawPerempatanGround(ctx, arenaWidth, cameraX, time);
    return;
  }
  drawTambakGround(ctx, arenaWidth, cameraX, time);
}

function drawTambakGround(
  ctx: CanvasRenderingContext2D,
  arenaWidth: number,
  cameraX: number,
  time: number
): void {
  const startX = Math.max(0, Math.floor(cameraX / 48) * 48 - 48);
  const endX = arenaWidth;

  // 1. Lush village grass
  ctx.fillStyle = '#5c9e47';
  ctx.fillRect(0, 0, arenaWidth, VIRTUAL_HEIGHT);

  const tile = 48;
  ctx.fillStyle = '#549340';
  for (let row = 2; row < Math.ceil(VIRTUAL_HEIGHT / tile); row++) {
    for (let x = startX; x < endX; x += tile) {
      const col = Math.floor(x / tile);
      if ((row + col) % 2 === 0) {
        ctx.fillRect(x, row * tile, tile, tile);
      }
    }
  }

  // 2. Kenjeran Coastal Water / Tambak Pond strips along bottom edge
  const wave = Math.sin(time * 2.5) * 4;
  for (let seg = 0; seg < arenaWidth; seg += 960) {
    ctx.save();
    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(seg + 80, 505, 86, 40, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(seg + 45 + wave, 502);
    ctx.lineTo(seg + 95 + wave, 502);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Main Horizontal Kampung Paving Road
  drawPavingRoad(ctx, 0, 276, arenaWidth, 134);

  // Vertical side alleys per 960px segment
  for (let seg = 0; seg < arenaWidth; seg += 960) {
    drawPavingRoad(ctx, seg + 396, 120, 168, VIRTUAL_HEIGHT - 120);
    ctx.save();
    ctx.fillStyle = '#d6c3a3';
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(seg + 350, 236, 260, 194, 26);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Paving block lines
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 97, 72, 0.26)';
  ctx.lineWidth = 1.5;
  for (let x = Math.floor(cameraX / 36) * 36; x < endX; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 284);
    ctx.lineTo(x, 402);
    ctx.stroke();
  }
  ctx.restore();

  // 4. North Row of 3/4 Kampung Houses + Gapura
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.fillRect(0, 114, arenaWidth, 18);

  for (let seg = 0; seg < arenaWidth; seg += 960) {
    drawTopDownHouse(ctx, seg + 18, 6, 178, 114, '#f5e6ca', '#b45309', '#92400e');
    drawTopDownHouse(ctx, seg + 212, 12, 164, 108, '#e2e8f0', '#9a3412', '#7c2d12');
    drawKampungGate(
      ctx,
      seg + 396,
      20,
      168,
      96,
      seg >= 1920 ? 'KENJERAN • SBY' : 'GANG TAMBAK • SBY'
    );
    drawTopDownHouse(ctx, seg + 584, 10, 172, 110, '#fef3c7', '#b91c1c', '#7f1d1d');
    drawTopDownHouse(ctx, seg + 772, 6, 170, 114, '#dbeafe', '#9a3412', '#7c2d12');
  }
}

function drawTunjunganGround(
  ctx: CanvasRenderingContext2D,
  arenaWidth: number,
  cameraX: number,
  _time: number
): void {
  const endX = arenaWidth;

  // 1. Warm Golden-Hour Tunjungan Sidewalk (Top & Bottom)
  ctx.fillStyle = '#d6c7b2';
  ctx.fillRect(0, 0, arenaWidth, VIRTUAL_HEIGHT);

  // 2. Wide Heritage Asphalt Road (Jalan Tunjungan)
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 175, arenaWidth, 315);

  // Warm sunset tint on asphalt
  ctx.fillStyle = 'rgba(251, 146, 60, 0.14)';
  ctx.fillRect(0, 175, arenaWidth, 315);

  // Curb borders
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 165, arenaWidth, 14);
  ctx.fillRect(0, 486, arenaWidth, 14);
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 179);
  ctx.lineTo(arenaWidth, 179);
  ctx.moveTo(0, 486);
  ctx.lineTo(arenaWidth, 486);
  ctx.stroke();

  // Dashed yellow Tunjungan road divider
  ctx.fillStyle = '#facc15';
  for (let x = Math.floor(cameraX / 90) * 90; x < endX; x += 90) {
    ctx.fillRect(x + 12, 328, 48, 8);
  }

  // Crosswalk stripes every 960px
  ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
  for (let seg = 0; seg < arenaWidth; seg += 960) {
    for (let y = 195; y < 465; y += 34) {
      ctx.fillRect(seg + 420, y, 56, 18);
    }
  }

  // 3. North Heritage Colonial Buildings (Tunjungan / Siola / Hotel Majapahit style)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.fillRect(0, 114, arenaWidth, 18);

  const signs = ['TOKO TUNJUNGAN', 'GEDUNG SIOLA', 'WARKOP HERITAGE', 'BIOSKOP KUNO'];
  for (let x = 0; x < arenaWidth; x += 240) {
    const idx = Math.floor(x / 240) % signs.length;
    drawHeritageBuilding(ctx, x + 8, 4, 224, 116, signs[idx], idx % 2 === 0 ? '#fef3c7' : '#f1f5f9');
  }
}

function drawSuramaduGround(
  ctx: CanvasRenderingContext2D,
  arenaWidth: number,
  cameraX: number,
  time: number
): void {
  const endX = arenaWidth;

  // 1. Night Sea Water (Madura Strait) at top & bottom strips
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, arenaWidth, VIRTUAL_HEIGHT);

  // Twinkling distant city lights on horizon (y: 0..64)
  ctx.fillStyle = '#fde047';
  for (let x = Math.floor(cameraX / 70) * 70; x < endX; x += 70) {
    ctx.fillRect(x + 18, 22 + (x % 24), 4, 4);
    ctx.fillStyle = x % 140 === 0 ? '#38bdf8' : '#fb923c';
    ctx.fillRect(x + 44, 34 + (x % 18), 3, 3);
    ctx.fillStyle = '#fde047';
  }

  // 2. Suramadu Bridge Asphalt Deck (y: 112..512)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 112, arenaWidth, 404);

  // Bridge Guardrails (Top & Bottom)
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 104, arenaWidth, 16);
  ctx.fillRect(0, 508, arenaWidth, 16);

  // Glowing cyan/gold LED bridge lights along top rail
  for (let x = Math.floor(cameraX / 120) * 120; x < endX; x += 120) {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x + 60, 112, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.arc(x + 60, 112, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Yellow & white highway lane markings
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 308, arenaWidth, 5);
  ctx.fillRect(0, 318, arenaWidth, 5);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.6)';
  for (let x = Math.floor(cameraX / 100) * 100; x < endX; x += 100) {
    ctx.fillRect(x + 14, 210, 44, 5);
    ctx.fillRect(x + 14, 412, 44, 5);
  }

  // 3. Iconic Suramadu Cable-Stayed Pylons & Cables (along north bridge edge)
  for (let px = 480; px < arenaWidth; px += 960) {
    ctx.save();
    // Diagonal stay cables
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
    ctx.lineWidth = 2;
    for (let c = 1; c <= 5; c++) {
      ctx.beginPath();
      ctx.moveTo(px, 12);
      ctx.lineTo(px - c * 68, 112);
      ctx.moveTo(px, 12);
      ctx.lineTo(px + c * 68, 112);
      ctx.stroke();
    }

    // Main Pylon Tower Base
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 3;
    ctx.fillRect(px - 18, 0, 36, 114);
    ctx.strokeRect(px - 18, 0, 36, 114);

    // Glowing Surabaya accent band
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(px - 16, 46, 32, 10);
    ctx.restore();
  }

  // 4. Animated Sea Wind Streaks across bridge
  ctx.save();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const wx = cameraX + VIRTUAL_WIDTH - (((time * 340 + i * 210) % (VIRTUAL_WIDTH + 180)) - 90);
    const wy = 155 + i * 62;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + 65, wy + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerempatanGround(
  ctx: CanvasRenderingContext2D,
  arenaWidth: number,
  _cameraX: number,
  _time: number
): void {
  // 1. Dark Urban Base Ground (Joyoboyo District Asphalt & Sidewalks)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, arenaWidth, VIRTUAL_HEIGHT);

  // 2. The 4 Corner Neighborhood Blocks (Sidewalks, Buildings, Street Food)
  // Corner Sidewalk concrete base
  ctx.fillStyle = '#64748b';
  // NW corner (Top-Left)
  ctx.fillRect(0, 0, 360, 210);
  // NE corner (Top-Right)
  ctx.fillRect(596, 0, arenaWidth - 596, 210);
  // SW corner (Bottom-Left)
  ctx.fillRect(0, 404, 360, VIRTUAL_HEIGHT - 404);
  // SE corner (Bottom-Right)
  ctx.fillRect(596, 404, arenaWidth - 596, VIRTUAL_HEIGHT - 404);

  // Decorative paving tiles in all 4 corners
  ctx.fillStyle = '#475569';
  const tile = 36;
  for (let y = 0; y < 210; y += tile) {
    for (let x = 0; x < 360; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
    for (let x = 596; x < arenaWidth; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }
  for (let y = 404; y < VIRTUAL_HEIGHT; y += tile) {
    for (let x = 0; x < 360; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
    for (let x = 596; x < arenaWidth; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }

  // Corner curbs (stone borders facing the streets)
  ctx.fillStyle = '#cbd5e1';
  // NW curbs
  ctx.fillRect(352, 0, 10, 210);
  ctx.fillRect(0, 202, 360, 10);
  // NE curbs
  ctx.fillRect(596, 0, 10, 210);
  ctx.fillRect(596, 202, arenaWidth - 596, 10);
  // SW curbs
  ctx.fillRect(352, 404, 10, VIRTUAL_HEIGHT - 404);
  ctx.fillRect(0, 404, 360, 10);
  // SE curbs
  ctx.fillRect(596, 404, 10, VIRTUAL_HEIGHT - 404);
  ctx.fillRect(596, 404, arenaWidth - 596, 10);

  // 3. The 4 Intersecting Roads (Asphalt)
  // Horizontal Highway (West <-> East)
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 212, arenaWidth, 192);

  // Vertical Avenue (North <-> South)
  ctx.fillRect(362, 0, 234, VIRTUAL_HEIGHT);

  // 4. Central Roundabout / Courtyard Plaza (Around Pos Warkop)
  ctx.save();
  ctx.fillStyle = '#d6c3a3';
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(338, 194, 284, 228, 30);
  ctx.fill();
  ctx.stroke();

  // Decorative inner paving circle
  ctx.strokeStyle = 'rgba(139, 115, 85, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(480, 308, 105, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 5. Road Markings & Dashed Lines
  // Yellow center divider for West and East roads
  ctx.fillStyle = '#facc15';
  for (let x = 0; x < 320; x += 48) {
    ctx.fillRect(x, 305, 28, 6);
  }
  for (let x = 640; x < arenaWidth; x += 48) {
    ctx.fillRect(x, 305, 28, 6);
  }
  // Yellow center divider for North and South avenues
  for (let y = 0; y < 180; y += 42) {
    ctx.fillRect(477, y, 6, 24);
  }
  for (let y = 430; y < VIRTUAL_HEIGHT; y += 42) {
    ctx.fillRect(477, y, 6, 24);
  }

  // 6. White Zebra Crosswalks on All 4 Approaches
  ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
  // North crosswalk
  for (let x = 376; x < 580; x += 22) {
    ctx.fillRect(x, 184, 14, 8);
  }
  // South crosswalk
  for (let x = 376; x < 580; x += 22) {
    ctx.fillRect(x, 424, 14, 8);
  }
  // West crosswalk
  for (let y = 226; y < 390; y += 22) {
    ctx.fillRect(324, y, 8, 14);
  }
  // East crosswalk
  for (let y = 226; y < 390; y += 22) {
    ctx.fillRect(626, y, 8, 14);
  }

  // 7. Buildings along North edge
  drawHeritageBuilding(ctx, 16, 6, 150, 110, 'TERMINAL JOYOBOYO', '#fef3c7');
  drawHeritageBuilding(ctx, 180, 6, 150, 110, 'WARKOP SIMPANG', '#f1f5f9');
  drawHeritageBuilding(ctx, 620, 6, 150, 110, 'DEPOT BEGAL', '#fed7aa');
  drawHeritageBuilding(ctx, 785, 6, 150, 110, 'BENGKEL SUROBOYO', '#e2e8f0');

  // North Gapura
  drawKampungGate(ctx, 396, 16, 168, 96, 'SIMPANG 4 • JOYOBOYO');
}

function drawHeritageBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sign: string,
  wallColor: string
): void {
  ctx.save();
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 3;

  // Roof terrace
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(x, y, w, 40);
  ctx.strokeRect(x, y, w, 40);

  // Cream colonial facade
  ctx.fillStyle = wallColor;
  ctx.fillRect(x + 4, y + 36, w - 8, h - 36);
  ctx.strokeRect(x + 4, y + 36, w - 8, h - 36);

  // Vintage shop sign
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x + 24, y + 46, w - 48, 20);
  ctx.strokeRect(x + 24, y + 46, w - 48, 20);
  ctx.fillStyle = '#fde047';
  ctx.font = '900 10px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sign, x + w * 0.5, y + 60);

  // Arched colonial windows & door
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x + 24, y + 76, 30, 32);
  ctx.strokeRect(x + 24, y + 76, 30, 32);
  ctx.fillRect(x + w - 54, y + 76, 30, 32);
  ctx.strokeRect(x + w - 54, y + 76, 30, 32);

  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + w * 0.5 - 16, y + 76, 32, 40);
  ctx.strokeRect(x + w * 0.5 - 16, y + 76, 32, 40);
  ctx.restore();
}

function drawPavingRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.fillStyle = '#a89274';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#cbb799';
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.restore();
}

function drawTopDownHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  wallColor: string,
  roofColor: string,
  roofShade: string
): void {
  ctx.save();
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 3;

  const roofH = h * 0.62;
  ctx.fillStyle = wallColor;
  ctx.fillRect(x + 6, y + roofH - 4, w - 12, h - roofH + 4);
  ctx.strokeRect(x + 6, y + roofH - 4, w - 12, h - roofH + 4);

  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + w * 0.5 - 14, y + h - 32, 28, 32);
  ctx.strokeRect(x + w * 0.5 - 14, y + h - 32, 28, 32);

  ctx.fillStyle = '#fef08a';
  ctx.fillRect(x + 20, y + h - 28, 22, 18);
  ctx.strokeRect(x + 20, y + h - 28, 22, 18);
  ctx.fillRect(x + w - 42, y + h - 28, 22, 18);
  ctx.strokeRect(x + w - 42, y + h - 28, 22, 18);

  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + w - 14, y);
  ctx.lineTo(x + w, y + roofH);
  ctx.lineTo(x, y + roofH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = roofShade;
  ctx.fillRect(x + 16, y + 18, w - 32, 8);
  ctx.restore();
}

function drawKampungGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string
): void {
  ctx.save();
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 3;

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x + 4, y + 26, 22, h - 26);
  ctx.strokeRect(x + 4, y + 26, 22, h - 26);
  ctx.fillRect(x + w - 26, y + 26, 22, h - 26);
  ctx.strokeRect(x + w - 26, y + 26, 22, h - 26);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x + 4, y + 54, 22, 18);
  ctx.fillRect(x + w - 26, y + 54, 22, 18);

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.roundRect(x - 2, y + 6, w + 4, 30, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w * 0.5, y + 25);
  ctx.restore();
}

export function drawTopDownObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  ctx.save();
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 3;

  ctx.fillStyle = 'rgba(9, 12, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(
    obs.x + obs.w * 0.5,
    obs.y + obs.h + 2,
    obs.w * 0.54,
    obs.h * 0.32,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  if (obs.kind === 'pos_ronda') {
    ctx.fillStyle = '#a16207';
    ctx.fillRect(obs.x, obs.y + 8, obs.w, obs.h - 8);
    ctx.strokeRect(obs.x, obs.y + 8, obs.w, obs.h - 8);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(obs.x + 4, obs.y - 26, 8, 38);
    ctx.strokeRect(obs.x + 4, obs.y - 26, 8, 38);
    ctx.fillRect(obs.x + obs.w - 12, obs.y - 26, 8, 38);
    ctx.strokeRect(obs.x + obs.w - 12, obs.y - 26, 8, 38);

    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.roundRect(obs.x + 15, obs.y - 16, 7, 18, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(obs.x - 10, obs.y - 18);
    ctx.lineTo(obs.x + obs.w * 0.5, obs.y - 52);
    ctx.lineTo(obs.x + obs.w + 10, obs.y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(obs.x + 14, obs.y - 26, obs.w - 28, 15);
    ctx.strokeRect(obs.x + 14, obs.y - 26, obs.w - 28, 15);
    ctx.fillStyle = '#090c14';
    ctx.font = '900 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obs.label ?? 'POS RONDA', obs.x + obs.w * 0.5, obs.y - 15);
  } else if (obs.kind === 'tree') {
    const cx = obs.x + obs.w * 0.5;
    const by = obs.y + obs.h;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 8, by - 28, 16, 28);
    ctx.strokeRect(cx - 8, by - 28, 16, 28);

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(cx - 16, by - 36, 22, 0, Math.PI * 2);
    ctx.arc(cx + 16, by - 36, 22, 0, Math.PI * 2);
    ctx.arc(cx, by - 50, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(cx - 6, by - 52, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(cx - 14, by - 34, 4, 0, Math.PI * 2);
    ctx.arc(cx + 12, by - 42, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (obs.kind === 'gerobak') {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(obs.x, obs.y - 20, obs.w, obs.h + 14);
    ctx.strokeRect(obs.x, obs.y - 20, obs.w, obs.h + 14);

    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(obs.x + 6, obs.y - 16, obs.w - 12, 14);
    ctx.strokeRect(obs.x + 6, obs.y - 16, obs.w - 12, 14);

    ctx.fillStyle = '#0369a1';
    ctx.fillRect(obs.x - 4, obs.y - 34, obs.w + 8, 14);
    ctx.strokeRect(obs.x - 4, obs.y - 34, obs.w + 8, 14);

    ctx.fillStyle = '#fef08a';
    ctx.font = '900 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obs.label ?? 'TAHU TEK', obs.x + obs.w * 0.5, obs.y + 8);
  } else if (obs.kind === 'barrier') {
    // Suramadu Highway Road Barrier
    ctx.fillStyle = '#f97316';
    ctx.fillRect(obs.x, obs.y - 10, obs.w, obs.h + 10);
    ctx.strokeRect(obs.x, obs.y - 10, obs.w, obs.h + 10);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(obs.x + 12, obs.y - 8, 14, obs.h + 6);
    ctx.fillRect(obs.x + 38, obs.y - 8, 14, obs.h + 6);
  }

  ctx.restore();
}
