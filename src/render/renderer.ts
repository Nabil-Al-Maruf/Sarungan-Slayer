import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import type {
  BarricadeState,
  BrawlState,
  EnemyProjectile,
  GameState,
  HazardZone,
  ProjectileState,
  SlashEffect,
  SurvivalCore,
} from '../core/types';
import { TOWER_TIER_NAME } from '../modes/survival';
import { drawTopDownMapGround, drawTopDownObstacle } from './backgrounds';
import { drawCrate, drawEnemy, drawPickup, drawPlayer } from './characterRig';

const enum RenderType {
  OBSTACLE = 1,
  CORE = 2,
  BARRICADE = 3,
  CRATE = 4,
  PICKUP = 5,
  ENEMY = 6,
  PLAYER = 7,
}

interface PooledRenderItem {
  sortY: number;
  type: RenderType;
  ref: any;
  extra?: any;
}

const renderPool: PooledRenderItem[] = [];
let poolCount = 0;

function addRenderItem(sortY: number, type: RenderType, ref: any, extra?: any): void {
  if (poolCount < renderPool.length) {
    const it = renderPool[poolCount];
    it.sortY = sortY;
    it.type = type;
    it.ref = ref;
    it.extra = extra;
  } else {
    renderPool.push({ sortY, type, ref, extra });
  }
  poolCount++;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  localPlayerId = 'p1',
  isMonitor = false
): void {
  ctx.save();
  ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  let shakeX = 0;
  let shakeY = 0;
  if (state.status === 'playing' && state.shakeTimer > 0) {
    // Subtle, integer-rounded screen vibration (crisp, not jarring, zero canvas anti-alias blur)
    const decay = Math.min(1, state.shakeTimer / 0.12);
    const amp = Math.min(1.5, state.shakeIntensity * 0.22) * decay;
    const phase = state.shakeTimer * 85;
    shakeX = Math.round((Math.sin(phase) * 0.8 + Math.sin(phase * 2.1) * 0.2) * amp);
    shakeY = Math.round((Math.cos(phase * 1.3) * 0.8 + Math.cos(phase * 2.5) * 0.2) * (amp * 0.6));
  }

  // ===== WORLD SPACE =====
  ctx.save();
  ctx.translate(-Math.round(state.cameraX) + shakeX, shakeY);

  if (state.mode === 'brawl' && state.brawl) {
    drawSmashArena(ctx, state.brawl, state.time);
  } else {
    drawTopDownMapGround(ctx, state.theme, state.arenaWidth, state.cameraX, state.time);
  }

  for (let i = 0; i < state.hazards.length; i++) {
    drawHazardZone(ctx, state.hazards[i]);
  }

  poolCount = 0;

  for (let i = 0; i < state.obstacles.length; i++) {
    const obs = state.obstacles[i];
    addRenderItem(obs.y + obs.h, RenderType.OBSTACLE, obs);
  }

  if (state.survival) {
    const core = state.survival.core;
    const p0 = state.players[0];
    const nearCore =
      !!p0 &&
      (state.survival.phase === 'intermission' ||
        Math.hypot(p0.x - (core.x + core.w * 0.5), p0.y - (core.y + core.h * 0.5)) <= 130);

    addRenderItem(core.y + core.h, RenderType.CORE, core, nearCore);

    for (let i = 0; i < state.survival.barricades.length; i++) {
      const bar = state.survival.barricades[i];
      addRenderItem(bar.y + bar.h, RenderType.BARRICADE, bar);
    }
  }

  for (let i = 0; i < state.crates.length; i++) {
    const crate = state.crates[i];
    addRenderItem(crate.y, RenderType.CRATE, crate);
  }

  for (let i = 0; i < state.pickups.length; i++) {
    const pickup = state.pickups[i];
    addRenderItem(pickup.y, RenderType.PICKUP, pickup);
  }

  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    addRenderItem(enemy.y, RenderType.ENEMY, enemy);
  }

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (state.mode === 'brawl' && (player.brawlStocks ?? 0) <= 0) continue;
    addRenderItem(player.y, RenderType.PLAYER, player);
  }

  // Zero-allocation insertion sort on pooled render items (avoids 60 array allocations/sec!)
  for (let i = 1; i < poolCount; i++) {
    const key = renderPool[i];
    let j = i - 1;
    while (j >= 0 && renderPool[j].sortY > key.sortY) {
      renderPool[j + 1] = renderPool[j];
      j--;
    }
    renderPool[j + 1] = key;
  }

  for (let i = 0; i < poolCount; i++) {
    const item = renderPool[i];
    switch (item.type) {
      case RenderType.OBSTACLE:
        drawTopDownObstacle(ctx, item.ref);
        break;
      case RenderType.CORE:
        drawSurvivalCore(ctx, item.ref, item.extra);
        break;
      case RenderType.BARRICADE:
        drawBarricade(ctx, item.ref);
        break;
      case RenderType.CRATE:
        drawCrate(ctx, item.ref);
        break;
      case RenderType.PICKUP:
        drawPickup(ctx, item.ref);
        break;
      case RenderType.ENEMY:
        drawEnemy(ctx, item.ref, state.time);
        break;
      case RenderType.PLAYER:
        drawPlayer(ctx, item.ref, state.time, item.ref.id === localPlayerId, isMonitor);
        break;
    }
  }

  for (let i = 0; i < state.slashes.length; i++) {
    drawSlashEffect(ctx, state.slashes[i]);
  }

  for (let i = 0; i < state.projectiles.length; i++) {
    drawProjectile(ctx, state.projectiles[i]);
  }

  for (let i = 0; i < state.enemyProjectiles.length; i++) {
    drawEnemyProjectile(ctx, state.enemyProjectiles[i]);
  }

  if (state.particles.length > 0) {
    ctx.save();
    let curAlpha = -1;
    let curColor = '';
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      if (curAlpha !== p.alpha) {
        ctx.globalAlpha = p.alpha;
        curAlpha = p.alpha;
      }
      if (curColor !== p.color) {
        ctx.fillStyle = p.color;
        curColor = p.color;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y - p.z, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (state.floatingTexts.length > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#090c14';
    for (let i = 0; i < state.floatingTexts.length; i++) {
      const ft = state.floatingTexts[i];
      const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(15 * ft.scale)}px "Segoe UI", system-ui, sans-serif`;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  ctx.restore();

  // ===== SCREEN SPACE OVERLAYS =====
  if (state.goPromptTimer > 0 && Math.floor(state.time * 6) % 2 === 0) {
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 5;
    ctx.font = '900 28px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.strokeText('MAJU REK ➔', VIRTUAL_WIDTH - 28, VIRTUAL_HEIGHT * 0.5);
    ctx.fillText('MAJU REK ➔', VIRTUAL_WIDTH - 28, VIRTUAL_HEIGHT * 0.5);
    ctx.restore();
  }

  const boss = state.enemies.find((e) => e.isBoss && e.hp > 0);
  if (boss) {
    const barW = 460;
    const barH = 18;
    const bx = (VIRTUAL_WIDTH - barW) * 0.5;
    const by = VIRTUAL_HEIGHT - 56;
    const ratio = Math.max(0, boss.hp / boss.maxHp);

    ctx.save();
    ctx.fillStyle = 'rgba(9, 12, 20, 0.82)';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx - 12, by - 24, barW + 24, 48, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = '900 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      boss.phase === 2 ? `${boss.name} (FASE 2 AMUK)` : boss.name,
      VIRTUAL_WIDTH * 0.5,
      by - 8
    );

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = boss.phase === 2 ? '#38bdf8' : '#ef4444';
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.strokeRect(bx, by, barW, barH);
    ctx.restore();
  }

  // Survival Intermission & Map Rotation Banner
  if (state.survival) {
    const surv = state.survival;
    if (surv.phase === 'intermission') {
      ctx.save();
      ctx.fillStyle = 'rgba(9, 12, 20, 0.84)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(VIRTUAL_WIDTH * 0.5 - 205, 62, 410, 34, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = '900 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `JEDA WARUNG: ${Math.ceil(surv.intermissionTimer)}s  •  TEKAN [B] BUKA WARUNG`,
        VIRTUAL_WIDTH * 0.5,
        84
      );
      ctx.restore();
    }

    if (surv.mapBannerTimer > 0) {
      const alpha = Math.min(1, surv.mapBannerTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#090c14';
      ctx.lineWidth = 5;
      ctx.font = '900 24px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(surv.mapBannerText, VIRTUAL_WIDTH * 0.5, 146);
      ctx.fillText(surv.mapBannerText, VIRTUAL_WIDTH * 0.5, 146);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawSurvivalCore(
  ctx: CanvasRenderingContext2D,
  core: SurvivalCore,
  nearShop: boolean
): void {
  const cx = core.x + core.w * 0.5;
  const cy = core.y + core.h * 0.5;

  // 1-Wave Energy Shield (Tameng Gaib Warkop)
  if (core.shieldActive && core.shieldHp > 0) {
    ctx.save();
    ctx.translate(cx, cy + 4);
    // Glowing translucent shield field
    const shieldGrad = ctx.createRadialGradient(0, 0, 30, 0, 0, 84);
    shieldGrad.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
    shieldGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.22)');
    shieldGrad.addColorStop(1, 'rgba(14, 165, 233, 0.45)');
    ctx.fillStyle = shieldGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 84, 52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing energetic outer edge
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 4]);
    ctx.stroke();

    // Shield label & mini HP
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 8.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🛡️ TAMENG GAIB ${Math.ceil(core.shieldHp)}/${core.shieldMaxHp || 250}`, 0, 64);
    ctx.restore();
  }

  if (nearShop) {
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 76, 46, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawTopDownObstacle(ctx, {
    x: core.x,
    y: core.y,
    w: core.w,
    h: core.h,
    kind: 'pos_ronda',
    label: core.hitFlashTimer > 0 ? 'DISERANG!' : 'POS WARKOP',
  });

  // Upgradable Defense Tower on roof (Permanent across waves!)
  const towerLv = core.towerLevel || (core.towerActive ? 1 : 0);
  if (towerLv > 0) {
    ctx.save();
    ctx.translate(cx, core.y - 38);
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.5;

    // Turret tripod & base
    const baseCol =
      towerLv === 1
        ? '#a16207'
        : towerLv === 2
          ? '#15803d'
          : towerLv === 3
            ? '#334155'
            : '#ca8a04';
    ctx.fillStyle = baseCol;
    ctx.beginPath();
    ctx.arc(0, 0, 11 + (towerLv - 1) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating cannon barrel
    ctx.save();
    ctx.rotate(core.towerAimAngle || 0);
    const barrelCol =
      towerLv === 1
        ? '#78350f'
        : towerLv === 2
          ? '#166534'
          : towerLv === 3
            ? '#1e293b'
            : '#713f12';
    const barrelLen = 16 + towerLv * 3;
    const barrelThick = 6 + towerLv * 1.5;
    ctx.fillStyle = barrelCol;
    ctx.fillRect(2, -barrelThick * 0.5, barrelLen, barrelThick);
    ctx.strokeRect(2, -barrelThick * 0.5, barrelLen, barrelThick);

    // Tip glow
    ctx.fillStyle = towerLv >= 4 ? '#facc15' : towerLv === 3 ? '#ef4444' : '#f97316';
    ctx.fillRect(barrelLen - 2, -barrelThick * 0.5 + 1, 4, barrelThick - 2);

    // Twin barrel for Lv 4 Gatling
    if (towerLv >= 4) {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(2, -barrelThick * 0.5 - 4, barrelLen, 3);
      ctx.strokeRect(2, -barrelThick * 0.5 - 4, barrelLen, 3);
      ctx.fillRect(2, barrelThick * 0.5 + 1, barrelLen, 3);
      ctx.strokeRect(2, barrelThick * 0.5 + 1, barrelLen, 3);
    }
    ctx.restore();

    ctx.restore();

    // Tower Active badge
    ctx.save();
    ctx.fillStyle = towerLv >= 4 ? '#facc15' : '#fb923c';
    ctx.font = '900 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 3;
    const towerTitle = `🗼 TOWER LV.${towerLv} (${TOWER_TIER_NAME[towerLv as 1 | 2 | 3 | 4] ?? 'MERCON'})`;
    ctx.strokeText(towerTitle, cx, core.y - 82);
    ctx.fillText(towerTitle, cx, core.y - 82);
    ctx.restore();
  }

  const barW = 104;
  const barH = 10;
  const bx = cx - barW * 0.5;
  const by = core.y - 66;
  const ratio = Math.max(0, core.hp / core.maxHp);

  ctx.save();
  ctx.fillStyle = '#090c14';
  ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
  ctx.fillStyle = ratio > 0.4 ? '#22c55e' : '#ef4444';
  ctx.fillRect(bx, by, barW * ratio, barH);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 9px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`INTI ${Math.ceil(core.hp)}/${core.maxHp}`, cx, by - 4);
  ctx.restore();
}

function drawBarricade(ctx: CanvasRenderingContext2D, bar: BarricadeState): void {
  ctx.save();
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.8;

  if (bar.hp <= 0) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#ef4444';
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
    ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '900 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JEBOL!', bar.x + bar.w * 0.5, bar.y + bar.h * 0.5 + 3);
    ctx.restore();
    return;
  }

  ctx.fillStyle = 'rgba(9, 12, 20, 0.3)';
  ctx.fillRect(bar.x + 3, bar.y + 5, bar.w, bar.h);

  const fillColor =
    bar.hitFlashTimer > 0
      ? '#ffffff'
      : bar.level === 1
        ? '#c28f5c'
        : bar.level === 2
          ? '#a16207'
          : bar.level === 3
            ? '#64748b'
            : '#1e293b'; // Lv 4 dark steel
  const accentColor =
    bar.level === 1 ? '#fde68a' : bar.level === 2 ? '#eab308' : bar.level === 3 ? '#38bdf8' : '#facc15';

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.roundRect(bar.x, bar.y - 8, bar.w, bar.h + 8, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = accentColor;
  if (bar.w > bar.h) {
    ctx.fillRect(bar.x + 4, bar.y - 2, bar.w - 8, 6);
  } else {
    ctx.fillRect(bar.x + 6, bar.y - 4, bar.w - 12, bar.h);
  }

  // Level 4 Barricade Thorns (Spikes along the outer edge)
  if (bar.level === 4) {
    ctx.save();
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 1.5;
    if (bar.w > bar.h) {
      const step = bar.w / 5;
      for (let i = 0; i < 5; i++) {
        const sx = bar.x + i * step + step * 0.5;
        // Top spike
        ctx.beginPath();
        ctx.moveTo(sx - 4, bar.y - 8);
        ctx.lineTo(sx, bar.y - 15);
        ctx.lineTo(sx + 4, bar.y - 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Bottom spike
        ctx.beginPath();
        ctx.moveTo(sx - 4, bar.y + bar.h);
        ctx.lineTo(sx, bar.y + bar.h + 7);
        ctx.lineTo(sx + 4, bar.y + bar.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      const step = bar.h / 5;
      for (let i = 0; i < 5; i++) {
        const sy = bar.y + i * step + step * 0.5;
        // Left spike
        ctx.beginPath();
        ctx.moveTo(bar.x, sy - 4);
        ctx.lineTo(bar.x - 7, sy);
        ctx.lineTo(bar.x, sy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Right spike
        ctx.beginPath();
        ctx.moveTo(bar.x + bar.w, sy - 4);
        ctx.lineTo(bar.x + bar.w + 7, sy);
        ctx.lineTo(bar.x + bar.w, sy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const cx = bar.x + bar.w * 0.5;
  const barW = 54;
  const ratio = Math.max(0, bar.hp / bar.maxHp);
  ctx.fillStyle = '#090c14';
  ctx.fillRect(cx - barW * 0.5 - 1, bar.y - 20, barW + 2, 7);
  ctx.fillStyle = ratio > 0.4 ? '#38bdf8' : '#ef4444';
  ctx.fillRect(cx - barW * 0.5, bar.y - 19, barW * ratio, 5);

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 9px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bar.level === 4 ? 'LV.4 DURI ⚡' : `LV.${bar.level}`, cx, bar.y - 23);
  ctx.restore();
}

function drawHazardZone(ctx: CanvasRenderingContext2D, hz: HazardZone): void {
  ctx.save();
  ctx.translate(hz.x, hz.y);
  ctx.scale(1, 0.72);

  if (hz.kind === 'acid_puddle') {
    const alpha = Math.min(1, hz.flashTimer / 0.5);
    ctx.globalAlpha = alpha * 0.75;
    // Outer green puddle edge
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright bubbling green core
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
    return;
  }

  // Player Fire Hazards (Fire Crater & Naga Flame)
  if (hz.kind === 'fire_crater' || hz.kind === 'naga_flame') {
    const alpha = Math.min(1, hz.flashTimer / 0.5);
    ctx.globalAlpha = alpha;

    // Scorched dark crater ground
    ctx.fillStyle = 'rgba(26, 12, 6, 0.65)';
    ctx.beginPath();
    ctx.ellipse(0, 0, hz.radius, hz.radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer blazing flame ring
    const flameFlicker = Math.sin(Date.now() * 0.015 + hz.id) * 3;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, hz.radius + flameFlicker, (hz.radius + flameFlicker) * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner fiery core
    ctx.fillStyle = 'rgba(249, 115, 22, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, hz.radius * 0.65, hz.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright yellow flame tongue
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(0, -2, hz.radius * 0.35, hz.radius * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  if (!hz.detonated) {
    const progress = 1 - Math.max(0, hz.delay / hz.maxDelay);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius * progress, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const alpha = Math.max(0, hz.flashTimer / 0.24);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSlashEffect(ctx: CanvasRenderingContext2D, slash: SlashEffect): void {
  const progress = 1 - slash.life / slash.maxLife;
  const alpha = Math.max(0, 1 - progress);

  ctx.save();
  ctx.translate(slash.x, slash.y);
  ctx.rotate(slash.angle);
  ctx.scale(1, slash.comboStep === 0 ? 1 : -1);
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = slash.color;
  ctx.lineWidth = 14 * (1 - progress * 0.4);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 38 + progress * 10, -Math.PI * 0.55, Math.PI * 0.45);
  ctx.stroke();

  ctx.strokeStyle = slash.stripeColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(2, 0, 34 + progress * 10, -Math.PI * 0.48, Math.PI * 0.38);
  ctx.stroke();

  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: ProjectileState): void {
  ctx.save();
  ctx.fillStyle = 'rgba(9, 12, 20, 0.22)';
  ctx.beginPath();
  ctx.ellipse(proj.x, proj.y + 4, proj.radius * 0.8, proj.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(proj.x, proj.y - 18);
  ctx.rotate(proj.angle);

  if (proj.kind === 'mercon') {
    // Meriam Bambu Karbit Bazooka Artillery Shell
    // Rocket exhaust flame behind
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-28, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(-18, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Bamboo cannon rocket cylinder
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-16, -11, 26, 22, 4);
    ctx.fill();
    ctx.stroke();

    // Brass bands
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-8, -11, 4, 22);
    ctx.fillRect(2, -11, 4, 22);

    // Red explosive nose cone
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(10, -11);
    ctx.lineTo(24, 0);
    ctx.lineTo(10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    return;
  }

  if (proj.kind === 'naga') {
    // Naga Barong Api Suroboyo Spirit
    // Blazing outer spirit aura
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(251, 146, 60, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();

    // Sinuous flaming dragon body behind
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-26, 0, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mythical Barong Dragon Mask Head
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = '#090c14';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(4, 0, 26, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Golden Dragon Horns & Crest
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(8, -20);
    ctx.lineTo(18, -32);
    ctx.lineTo(14, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(18, 32);
    ctx.lineTo(14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Ruby Eyes
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(12, -8, 5, 0, Math.PI * 2);
    ctx.arc(12, 8, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#090c14';
    ctx.beginPath();
    ctx.arc(14, -8, 2.5, 0, Math.PI * 2);
    ctx.arc(14, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // White Sharp Fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(22, -6);
    ctx.lineTo(28, -3);
    ctx.lineTo(22, 0);
    ctx.lineTo(28, 3);
    ctx.lineTo(22, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    return;
  }

  // Classic Crescent Wind Slash (Pecut)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.34)';
  ctx.beginPath();
  ctx.ellipse(-4, 0, 24, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-6, -20);
  ctx.quadraticCurveTo(22, 0, -6, 20);
  ctx.quadraticCurveTo(8, 0, -6, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = proj.color;
  ctx.beginPath();
  ctx.moveTo(-2, -13);
  ctx.quadraticCurveTo(14, 0, -2, 13);
  ctx.quadraticCurveTo(4, 0, -2, -13);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawEnemyProjectile(ctx: CanvasRenderingContext2D, ep: EnemyProjectile): void {
  ctx.save();
  ctx.fillStyle = 'rgba(9, 12, 20, 0.24)';
  ctx.beginPath();
  ctx.ellipse(ep.x, ep.y + 4, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(ep.x, ep.y - 16);
  ctx.rotate(ep.angle);
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 2.5;

  if (ep.kind === 'sandal') {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(4, 0);
    ctx.lineTo(-4, 3);
    ctx.stroke();
  } else if (ep.kind === 'acid_spit') {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Dripping slime droplets
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(-5, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = ep.color;
    ctx.beginPath();
    ctx.moveTo(-6, -16);
    ctx.quadraticCurveTo(18, 0, -6, 16);
    ctx.quadraticCurveTo(6, 0, -6, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawSmashArena(
  ctx: CanvasRenderingContext2D,
  brawl: BrawlState,
  time: number
): void {
  // 1. Cyber Stadium Background
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
  grad.addColorStop(0, '#0a0f1d');
  grad.addColorStop(0.5, '#131d33');
  grad.addColorStop(1, '#080c16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // Neon searchlights sweeping across sky
  const l1 = Math.sin(time * 0.8) * 240;
  const l2 = Math.cos(time * 0.9) * 240;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.beginPath();
  ctx.moveTo(120 + l1, 0);
  ctx.lineTo(260 + l1, 540);
  ctx.lineTo(40 + l1, 540);
  ctx.fill();

  ctx.fillStyle = 'rgba(234, 179, 8, 0.05)';
  ctx.beginPath();
  ctx.moveTo(800 + l2, 0);
  ctx.lineTo(940 + l2, 540);
  ctx.lineTo(720 + l2, 540);
  ctx.fill();

  // Distant city silhouette with glowing windows
  ctx.fillStyle = '#0f172a';
  for (let bx = 30; bx < 930; bx += 75) {
    const bh = 80 + ((bx * 17) % 120);
    ctx.fillRect(bx, 440 - bh, 60, bh);
    ctx.fillStyle = (bx + Math.floor(time * 2)) % 3 === 0 ? 'rgba(253, 224, 71, 0.35)' : 'rgba(56, 189, 248, 0.25)';
    ctx.fillRect(bx + 12, 440 - bh + 18, 7, 7);
    ctx.fillRect(bx + 32, 440 - bh + 32, 7, 7);
    ctx.fillStyle = '#0f172a';
  }

  // 2. Blast Zone Danger Warning Borders (Red dashed perimeter)
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(8, 8, VIRTUAL_WIDTH - 16, VIRTUAL_HEIGHT - 16);
  ctx.restore();

  // 3. Floating Platforms
  for (const plat of brawl.platforms) {
    if (!plat.dropThrough) {
      // Main Center Stage Platform
      ctx.save();
      // Platform depth & girder shadow
      ctx.fillStyle = '#090d16';
      ctx.fillRect(plat.x, plat.y + plat.h, plat.w, 42);

      // Steel girder truss supports
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let tx = plat.x; tx < plat.x + plat.w; tx += 62) {
        ctx.moveTo(tx, plat.y + plat.h);
        ctx.lineTo(tx + 31, plat.y + plat.h + 42);
        ctx.lineTo(tx + 62, plat.y + plat.h);
      }
      ctx.stroke();

      // Main stage platform block
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

      // Glowing gold stage rim
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(plat.x, plat.y, plat.w, 6);

      // LED strip
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(plat.x + 20, plat.y + 11, plat.w - 40, 3.5);

      // Border outline
      ctx.strokeStyle = '#090c14';
      ctx.lineWidth = 3;
      ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

      // Center neon sign
      ctx.font = '900 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.fillText('🥊 ARENA TAWURAN SMASH SUROBOYO 🥊', plat.x + plat.w / 2, plat.y + 23);
      ctx.restore();
    } else {
      // Soft Floating Energy Platforms
      ctx.save();
      const glow = Math.sin(time * 4 + plat.x) * 0.2 + 0.8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

      // Glowing top energy rail
      ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
      ctx.fillRect(plat.x, plat.y, plat.w, 4);

      // Base border
      ctx.strokeStyle = '#090c14';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

      // Hover thruster flames underneath
      ctx.fillStyle = `rgba(245, 158, 11, ${glow * 0.75})`;
      ctx.beginPath();
      ctx.ellipse(plat.x + 24, plat.y + plat.h + 3, 8, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(plat.x + plat.w - 24, plat.y + plat.h + 3, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}
