import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import { getHeroDef } from '../core/heroes';
import type {
  BarricadeState,
  BrawlState,
  EnemyProjectile,
  GameState,
  HazardZone,
  ProjectileState,
  SlashEffect,
  SlashElement,
  SlashStyle,
  SurvivalCore,
} from '../core/types';
import { TOWER_TIER_NAME } from '../modes/survival';
import { drawTopDownMapGround, drawTopDownObstacle } from './backgrounds';
import { drawCrate, drawEnemy, drawPickup, drawPlayer } from './characterRig';
import { drawComboUltArenaFinisher, drawComboUltCutIn } from './comboUltCutin';

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

  // Co-op Synchronized Team Ultimate (Arena Finisher + Wuthering Waves Cut-In Scene)
  if (state.comboUlt) {
    drawComboUltArenaFinisher(ctx, state);
    drawComboUltCutIn(ctx, state);
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
  ctx.scale(1, slash.comboStep % 2 === 0 ? 1 : -1);
  ctx.globalAlpha = alpha;

  const hDef = getHeroDef(slash.heroId);
  const style: SlashStyle = slash.slashStyle || hDef.slashStyle || 'sarung_whip';
  const elem: SlashElement = slash.element || 'none';
  const elemLv = slash.elementLevel || 1;

  // 1. Hero-Specific Signature Slash Geometry
  switch (style) {
    case 'clurit_crescent':
      drawCluritCrescentSlash(ctx, slash, progress);
      break;
    case 'tinju_shockwave':
      drawTinjuShockwaveSlash(ctx, slash, progress);
      break;
    case 'bambu_radiant':
      drawBambuRadiantSlash(ctx, slash, progress);
      break;
    case 'mercon_burst':
      drawMerconBurstSlash(ctx, slash, progress);
      break;
    case 'selendang_cyclone':
      drawSelendangCycloneSlash(ctx, slash, progress);
      break;
    case 'sarung_whip':
    default:
      drawSarungWhipSlash(ctx, slash, progress);
      break;
  }

  // 2. Active Elemental Upgrade Overlay
  if (elem !== 'none') {
    drawSlashElementalOverlay(ctx, slash, progress, elem, elemLv);
  }

  ctx.restore();
}

// === 1. CAK BIMA: Dynamic Braided Sarung Whip-Arcs ===
function drawSarungWhipSlash(ctx: CanvasRenderingContext2D, slash: SlashEffect, progress: number): void {
  const r = 40 + progress * 16;
  const isFinisher = slash.comboStep === 3;

  // Outer primary braided cloth ribbon
  ctx.strokeStyle = slash.color;
  ctx.lineWidth = (isFinisher ? 18 : 14) * (1 - progress * 0.35);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.62, Math.PI * 0.48);
  ctx.stroke();

  // Woven diagonal stripe pattern inside
  ctx.strokeStyle = slash.stripeColor;
  ctx.lineWidth = 4.5;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.arc(2, 0, r - 3, -Math.PI * 0.58, Math.PI * 0.44);
  ctx.stroke();
  ctx.setLineDash([]);

  // Snapping cloth tassels at whip tip
  const tipAngle = Math.PI * 0.48;
  const tx = Math.cos(tipAngle) * r;
  const ty = Math.sin(tipAngle) * r;

  ctx.strokeStyle = slash.color;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.quadraticCurveTo(tx + 12, ty - 6, tx + 18, ty + 4);
  ctx.stroke();

  ctx.strokeStyle = slash.stripeColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.quadraticCurveTo(tx + 8, ty - 12, tx + 16, ty - 8);
  ctx.stroke();

  if (isFinisher) {
    // Twin braided ribbon trailing behind
    ctx.strokeStyle = slash.color;
    ctx.lineWidth = 8 * (1 - progress * 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, -Math.PI * 0.52, Math.PI * 0.38);
    ctx.stroke();
  }
}

// === 2. MAT CLURIT: Razor-Sharp Dual Sickle Crescent Sweeps ===
function drawCluritCrescentSlash(ctx: CanvasRenderingContext2D, slash: SlashEffect, progress: number): void {
  const r = 44 + progress * 14;

  // High-gloss Chrome Silver Outer Cutting Edge
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 6 * (1 - progress * 0.25);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.52, Math.PI * 0.42);
  ctx.stroke();

  // Crimson / Sakera Blood Red Cutting Wake
  ctx.strokeStyle = slash.color || '#3b82f6';
  ctx.lineWidth = 13 * (1 - progress * 0.4);
  ctx.beginPath();
  ctx.arc(-3, 0, r - 4, -Math.PI * 0.58, Math.PI * 0.38);
  ctx.stroke();

  // Inner Razor Spine
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(-1, 0, r - 2, -Math.PI * 0.48, Math.PI * 0.32);
  ctx.stroke();

  // Secondary Cross-Slashing Ghost Sickle (Dual Sickles Scissor Cut!)
  ctx.save();
  ctx.rotate(-0.32);
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.75)';
  ctx.lineWidth = 4 * (1 - progress * 0.3);
  ctx.beginPath();
  ctx.arc(4, 0, r * 0.88, -Math.PI * 0.46, Math.PI * 0.36);
  ctx.stroke();
  ctx.restore();

  // Shining 4-point star glint at apex
  const apexX = r - 2;
  const glint = Math.max(0, 1 - Math.abs(progress - 0.3) * 3);
  if (glint > 0.1) {
    ctx.fillStyle = '#ffffff';
    const s = 7 * glint;
    ctx.beginPath();
    ctx.moveTo(apexX, -s);
    ctx.lineTo(apexX + s * 0.25, -s * 0.25);
    ctx.lineTo(apexX + s, 0);
    ctx.lineTo(apexX + s * 0.25, s * 0.25);
    ctx.lineTo(apexX, s);
    ctx.lineTo(apexX - s * 0.25, s * 0.25);
    ctx.lineTo(apexX - s, 0);
    ctx.lineTo(apexX - s * 0.25, -s * 0.25);
    ctx.closePath();
    ctx.fill();
  }
}

// === 3. BANG BAMBANG: Heavy Tectonic Ground-Cleaving Shockwaves ===
function drawTinjuShockwaveSlash(ctx: CanvasRenderingContext2D, slash: SlashEffect, progress: number): void {
  const reach = 46 + progress * 32;

  // Expanding Concussive Tectonic Cone with Jagged Stone Rupture Teeth
  ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
  ctx.strokeStyle = slash.color || '#f59e0b';
  ctx.lineWidth = 4.5 * (1 - progress * 0.3);
  ctx.lineJoin = 'miter';

  const segments = 10;
  const startAng = -Math.PI * 0.36;
  const endAng = Math.PI * 0.36;
  const span = endAng - startAng;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= segments; i++) {
    const a = startAng + (span * i) / segments;
    const jag = (i % 2 === 0 ? 6 : -4) * (1 - progress * 0.5);
    const cr = reach + jag;
    const vx = Math.cos(a) * cr;
    const vy = Math.sin(a) * cr;
    ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner Concussive Pressure Wave Ring
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, reach * 0.55, startAng, endAng);
  ctx.stroke();

  // Flying earthen rock debris polygons
  ctx.fillStyle = '#b45309';
  for (let i = 0; i < 4; i++) {
    const ra = startAng + (span * (i + 0.5)) / 4;
    const dist = reach + 8 + progress * 14;
    const rx = Math.cos(ra) * dist;
    const ry = Math.sin(ra) * dist;
    ctx.beginPath();
    ctx.arc(rx, ry, 3.5 * (1 - progress * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
}

// === 4. GUS DIMAS: Celestial Radiant Calligraphy Arcs ===
function drawBambuRadiantSlash(ctx: CanvasRenderingContext2D, slash: SlashEffect, progress: number): void {
  const r = 42 + progress * 12;

  // Luminous outer aura glow
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 22 * (1 - progress * 0.3);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.54, Math.PI * 0.44);
  ctx.stroke();

  // Flowing thick jade calligraphy brush spine
  ctx.strokeStyle = slash.color || '#10b981';
  ctx.lineWidth = 11 * (1 - progress * 0.4);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.52, Math.PI * 0.42);
  ctx.stroke();

  // Auric Gold Inner Calligraphy Ribbon
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(2, 0, r - 3, -Math.PI * 0.46, Math.PI * 0.36);
  ctx.stroke();

  // Divine radiant beam lines projecting perpendicularly
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 1.8;
  const rayCount = 6;
  for (let i = 0; i < rayCount; i++) {
    const a = -Math.PI * 0.46 + ((Math.PI * 0.82) * i) / (rayCount - 1);
    const x1 = Math.cos(a) * (r - 4);
    const y1 = Math.sin(a) * (r - 4);
    const x2 = Math.cos(a) * (r + 14 + (1 - progress) * 8);
    const y2 = Math.sin(a) * (r + 14 + (1 - progress) * 8);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Floating sacred glowing motes
  ctx.fillStyle = '#fef08a';
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI * 0.38 + i * 0.35;
    const mx = Math.cos(a) * (r + 6);
    const my = Math.sin(a) * (r + 6);
    ctx.beginPath();
    ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// === 5. PAK RT: Explosive Bamboo Gunpowder Flashes ===
function drawMerconBurstSlash(ctx: CanvasRenderingContext2D, slash: SlashEffect, progress: number): void {
  const r = 40 + progress * 15;

  // Expanding cluster of overlapping explosion bursts
  const burstCount = 5;
  const burstColors = ['#fef08a', '#f97316', slash.color || '#ef4444', '#dc2626'];

  for (let i = 0; i < burstCount; i++) {
    const a = -Math.PI * 0.48 + ((Math.PI * 0.88) * i) / (burstCount - 1);
    const bx = Math.cos(a) * (r + (i % 2 === 0 ? 4 : -4));
    const by = Math.sin(a) * (r + (i % 2 === 0 ? 4 : -4));
    const rad = (9 + (i % 3) * 3) * (1 - progress * 0.35);

    ctx.fillStyle = burstColors[i % burstColors.length];
    ctx.beginPath();
    ctx.arc(bx, by, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // White-hot detonation core line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4 * (1 - progress * 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, -Math.PI * 0.45, Math.PI * 0.35);
  ctx.stroke();

  // Scattering high-velocity sparks & ember lines
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI * 0.5 + ((Math.PI * 0.95) * i) / 7;
    const dist = r + 10 + progress * 20;
    const sx = Math.cos(a) * dist;
    const sy = Math.sin(a) * dist;
    ctx.beginPath();
    ctx.moveTo(sx * 0.88, sy * 0.88);
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }
}

// === 6. MBAK SRI: Swift Cyclone Wind Ribbons & Silk Sweeps ===
function drawSelendangCycloneSlash(ctx: CanvasRenderingContext2D, slash: SlashEffect, progress: number): void {
  const r = 42 + progress * 14;

  // Double intertwined flowing silk ribbon bands
  ctx.strokeStyle = slash.color || '#ec4899';
  ctx.lineWidth = 14 * (1 - progress * 0.3);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.58, Math.PI * 0.48);
  ctx.stroke();

  // White/Rose silk highlight band
  ctx.strokeStyle = '#fdf2f8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(2, 0, r - 3, -Math.PI * 0.52, Math.PI * 0.42);
  ctx.stroke();

  // Swirling aerodynamic wind vortex spirals
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.7)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, -Math.PI * 0.48, Math.PI * 0.36);
  ctx.stroke();

  // Fluttering silk fringes & flower petals along the wake
  ctx.fillStyle = '#f472b6';
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI * 0.42 + i * 0.28;
    const px = Math.cos(a) * (r + 8);
    const py = Math.sin(a) * (r + 8);
    ctx.beginPath();
    ctx.ellipse(px, py, 4 * (1 - progress * 0.3), 2.2, a + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// === ACTIVE ELEMENTAL UPGRADE OVERLAYS ===
function drawSlashElementalOverlay(
  ctx: CanvasRenderingContext2D,
  _slash: SlashEffect,
  progress: number,
  element: SlashElement,
  level: number
): void {
  const r = 40 + progress * 15;

  if (element === 'petir') {
    // === PETIR: Lightning Halilintar (Electric Arc Trails & Spark Bursts) ===
    const boltCount = 2 + level;
    for (let b = 0; b < boltCount; b++) {
      const boltR = r + (b - 1) * 7;
      const startAng = -Math.PI * 0.52;
      const endAng = Math.PI * 0.42;
      const segs = 7;

      ctx.strokeStyle = b % 2 === 0 ? '#38bdf8' : '#facc15';
      ctx.lineWidth = (2.8 + level * 0.6) * (1 - progress * 0.3);
      ctx.beginPath();

      for (let s = 0; s <= segs; s++) {
        const a = startAng + ((endAng - startAng) * s) / segs;
        const jag = Math.sin(s * 17.3 + progress * 24 + b * 5) * (5 + level * 2);
        const bx = Math.cos(a) * (boltR + jag);
        const by = Math.sin(a) * (boltR + jag);
        if (s === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.stroke();
    }

    // Bright electric spark nodes at tips
    ctx.fillStyle = '#ffffff';
    const tipA1 = -Math.PI * 0.52;
    const tipA2 = Math.PI * 0.42;
    ctx.beginPath();
    ctx.arc(Math.cos(tipA1) * r, Math.sin(tipA1) * r, 3 + level, 0, Math.PI * 2);
    ctx.arc(Math.cos(tipA2) * r, Math.sin(tipA2) * r, 3 + level, 0, Math.PI * 2);
    ctx.fill();

  } else if (element === 'api') {
    // === API: Kobaran Api Mercon (Flaming Streaks & Burning Embers) ===
    const flameCount = 5 + level * 2;
    for (let i = 0; i < flameCount; i++) {
      const a = -Math.PI * 0.5 + ((Math.PI * 0.9) * i) / (flameCount - 1);
      const fr = r + 4;
      const fx = Math.cos(a) * fr;
      const fy = Math.sin(a) * fr;
      const tongueLen = (8 + level * 4) * (1 - progress * 0.4);

      // Flickering flame tongue
      ctx.fillStyle = i % 2 === 0 ? '#ea580c' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(fx - 4, fy);
      ctx.lineTo(fx + Math.cos(a) * tongueLen, fy + Math.sin(a) * tongueLen);
      ctx.lineTo(fx + 4, fy);
      ctx.closePath();
      ctx.fill();

      // Yellow hot core
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5 + level * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (element === 'badai') {
    // === BADAI: Topan Angin (Razor Vortex Cutting Ribbons & Vacuum Rings) ===
    const reachBonus = 18 * level;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + reachBonus * 0.6, -Math.PI * 0.6, Math.PI * 0.48);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, r + reachBonus, -Math.PI * 0.54, Math.PI * 0.42);
    ctx.stroke();

    // Swirling vortex mini-cyclones
    for (let i = 0; i < 2 + level; i++) {
      const va = -Math.PI * 0.4 + i * 0.4;
      const vx = Math.cos(va) * (r + reachBonus * 0.5);
      const vy = Math.sin(va) * (r + reachBonus * 0.5);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(vx, vy, 5 + level, 0, Math.PI * 1.6);
      ctx.stroke();
    }

  } else if (element === 'suci') {
    // === SUCI: Cahaya Suci Ampel (Celestial Radiant Aura & Sacred Runes) ===
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 4 + level * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, -Math.PI * 0.52, Math.PI * 0.42);
    ctx.stroke();

    // Sacred luminous sunburst rays
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    const rayCount = 5 + level * 2;
    for (let i = 0; i < rayCount; i++) {
      const a = -Math.PI * 0.48 + ((Math.PI * 0.88) * i) / (rayCount - 1);
      const x1 = Math.cos(a) * (r + 4);
      const y1 = Math.sin(a) * (r + 4);
      const x2 = Math.cos(a) * (r + 14 + level * 5);
      const y2 = Math.sin(a) * (r + 14 + level * 5);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Sacred glowing diamond runes
    ctx.fillStyle = '#fef08a';
    for (let i = 0; i < 3 + level; i++) {
      const a = -Math.PI * 0.42 + i * 0.3;
      const rx = Math.cos(a) * (r + 8);
      const ry = Math.sin(a) * (r + 8);
      ctx.beginPath();
      ctx.moveTo(rx, ry - 3);
      ctx.lineTo(rx + 2.5, ry);
      ctx.lineTo(rx, ry + 3);
      ctx.lineTo(rx - 2.5, ry);
      ctx.closePath();
      ctx.fill();
    }
  } else if (element === 'es') {
    // === ES: Gletser Es (Jagged Frost Icicles & Crystalline Ice Arc) ===
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.9)';
    ctx.lineWidth = 4 + level * 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, -Math.PI * 0.52, Math.PI * 0.42);
    ctx.stroke();

    const shardCount = 5 + level * 2;
    for (let i = 0; i < shardCount; i++) {
      const a = -Math.PI * 0.48 + ((Math.PI * 0.88) * i) / (shardCount - 1);
      const sx = Math.cos(a) * (r + 3);
      const sy = Math.sin(a) * (r + 3);
      const spikeLen = (11 + level * 4.5) * (1 - progress * 0.35);

      ctx.fillStyle = i % 2 === 0 ? '#a5f3fc' : '#e0f2fe';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a + 1.57) * 3.5, sy + Math.sin(a + 1.57) * 3.5);
      ctx.lineTo(sx + Math.cos(a) * spikeLen, sy + Math.sin(a) * spikeLen);
      ctx.lineTo(sx - Math.cos(a + 1.57) * 3.5, sy - Math.sin(a + 1.57) * 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (element === 'daun') {
    // === DAUN: Daun Rimba (Emerald Razor Leaves & Swirling Blossom Arc) ===
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.88)';
    ctx.lineWidth = 3.5 + level * 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, -Math.PI * 0.54, Math.PI * 0.44);
    ctx.stroke();

    const leafCount = 5 + level * 2;
    for (let i = 0; i < leafCount; i++) {
      const a = -Math.PI * 0.48 + ((Math.PI * 0.9) * i) / (leafCount - 1);
      const lx = Math.cos(a) * (r + 7 + (i % 2) * 5);
      const ly = Math.sin(a) * (r + 7 + (i % 2) * 5);

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + 0.55 + progress * 2.2);
      ctx.fillStyle = i % 3 === 0 ? '#f472b6' : '#22c55e';
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(0, -4.5, 7, 0);
      ctx.quadraticCurveTo(0, 4.5, -6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
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
  const theme = brawl.stageTheme || 'alun_alun';
  ctx.save();

  // 1. Stage-Specific Thematic Sky & Background Scenery
  if (theme === 'atap_warga') {
    // Twilight dusk sky over Suroboyo kampung rooftops
    const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    grad.addColorStop(0, '#2e1065'); // Deep twilight purple
    grad.addColorStop(0.45, '#7c2d12'); // Amber terracotta dusk
    grad.addColorStop(0.85, '#431407'); // Deep rust
    grad.addColorStop(1, '#1c1917');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Warm setting sun orb dipping behind rooftops
    ctx.fillStyle = 'rgba(251, 146, 60, 0.28)';
    ctx.beginPath();
    ctx.arc(480, 220, 95, 0, Math.PI * 2);
    ctx.fill();

    // Silhouetted Kampung houses & genteng roofs
    ctx.fillStyle = '#0c0a09';
    for (let hx = 20; hx < 940; hx += 80) {
      const hh = 70 + ((hx * 13) % 90);
      // Triangle roof gable
      ctx.beginPath();
      ctx.moveTo(hx - 10, 440 - hh);
      ctx.lineTo(hx + 35, 410 - hh);
      ctx.lineTo(hx + 80, 440 - hh);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(hx, 440 - hh, 70, hh);

      // TV Antenna sticks on roofs
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx + 35, 410 - hh);
      ctx.lineTo(hx + 35, 380 - hh);
      ctx.moveTo(hx + 25, 390 - hh);
      ctx.lineTo(hx + 45, 390 - hh);
      ctx.stroke();
    }
  } else if (theme === 'jembatan_kali') {
    // Night river harbor with Suramadu / Kali Mas bridge aesthetic
    const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    grad.addColorStop(0, '#020617'); // Dark night sky
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(0.85, '#082f49'); // Deep river water reflection
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Iconic bridge suspension towers in background
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Left tower
    ctx.moveTo(250, 440);
    ctx.lineTo(280, 60);
    ctx.lineTo(310, 440);
    // Right tower
    ctx.moveTo(650, 440);
    ctx.lineTo(680, 60);
    ctx.lineTo(710, 440);
    ctx.stroke();

    // Diagonal suspension steel cables
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let c = 0; c < 5; c++) {
      ctx.moveTo(280, 60 + c * 40);
      ctx.lineTo(100 + c * 35, 400);
      ctx.moveTo(280, 60 + c * 40);
      ctx.lineTo(460 - c * 35, 400);

      ctx.moveTo(680, 60 + c * 40);
      ctx.lineTo(500 + c * 35, 400);
      ctx.moveTo(680, 60 + c * 40);
      ctx.lineTo(860 - c * 35, 400);
    }
    ctx.stroke();

    // Flashing red aircraft warning beacons atop towers
    const beaconAlpha = Math.sin(time * 3) > 0 ? 0.9 : 0.2;
    ctx.fillStyle = `rgba(239, 68, 68, ${beaconAlpha})`;
    ctx.beginPath();
    ctx.arc(280, 58, 4.5, 0, Math.PI * 2);
    ctx.arc(680, 58, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Water ripple reflections underneath
    ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
    for (let wr = 0; wr < 4; wr++) {
      const wy = 450 + wr * 22;
      const wOff = Math.sin(time * 1.5 + wr) * 30;
      ctx.fillRect(80 + wOff, wy, 800, 3);
    }
  } else {
    // 'alun_alun': Cyber Alun-Alun Suroboyo Stadium
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
      ctx.fillStyle =
        (bx + Math.floor(time * 2)) % 3 === 0
          ? 'rgba(253, 224, 71, 0.35)'
          : 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(bx + 12, 440 - bh + 18, 7, 7);
      ctx.fillRect(bx + 32, 440 - bh + 32, 7, 7);
      ctx.fillStyle = '#0f172a';
    }
  }

  // 2. Blast Zone Danger Warning Borders (Red dashed perimeter)
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(8, 8, VIRTUAL_WIDTH - 16, VIRTUAL_HEIGHT - 16);
  ctx.restore();

  // 3. Stage Platforms
  for (const plat of brawl.platforms) {
    if (!plat.dropThrough) {
      // Solid Ground Platforms
      ctx.save();
      if (theme === 'atap_warga') {
        // Terracotta genteng clay brick rooftop
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(plat.x, plat.y + plat.h, plat.w, 48);

        // Brick wall lines
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let by = plat.y + plat.h; by < plat.y + plat.h + 48; by += 12) {
          ctx.moveTo(plat.x, by);
          ctx.lineTo(plat.x + plat.w, by);
        }
        ctx.stroke();

        // Main clay roof deck
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Clay tile ridge pattern
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);

        ctx.strokeStyle = '#0c0a09';
        ctx.lineWidth = 3;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        ctx.font = '900 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fed7aa';
        ctx.fillText('🏘️ ATAP KAMPUNG WARGA 🏘️', plat.x + plat.w / 2, plat.y + 22);
      } else if (theme === 'jembatan_kali') {
        // Massive steel bridge road deck
        ctx.fillStyle = '#020617';
        ctx.fillRect(plat.x, plat.y + plat.h, plat.w, 42);

        // Steel truss beams
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let tx = plat.x; tx < plat.x + plat.w; tx += 64) {
          ctx.moveTo(tx, plat.y + plat.h);
          ctx.lineTo(tx + 32, plat.y + plat.h + 42);
          ctx.lineTo(tx + 64, plat.y + plat.h);
        }
        ctx.stroke();

        // Asphalt road surface
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Yellow road divider dashed line
        ctx.fillStyle = '#facc15';
        ctx.fillRect(plat.x, plat.y, plat.w, 4.5);

        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 3;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        ctx.font = '900 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('🌉 JEMBATAN KALI MAS & SURAMADU 🌉', plat.x + plat.w / 2, plat.y + 22);
      } else {
        // 'alun_alun': Cyber Stadium Main Stage
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

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(plat.x, plat.y, plat.w, 6);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(plat.x + 20, plat.y + 11, plat.w - 40, 3.5);

        ctx.strokeStyle = '#090c14';
        ctx.lineWidth = 3;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        ctx.font = '900 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText('🥊 ARENA TAWURAN ALUN-ALUN SUROBOYO 🥊', plat.x + plat.w / 2, plat.y + 23);
      }
      ctx.restore();
    } else {
      // Soft Floating Platforms
      ctx.save();
      const glow = Math.sin(time * 4 + plat.x) * 0.2 + 0.8;

      if (theme === 'atap_warga') {
        // Wooden bamboo plank / hanging sarung clothesline
        ctx.fillStyle = '#78350f';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Golden bamboo rings
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        // Tiny flapping laundry sarung fluttering in wind
        const flap = Math.sin(time * 6 + plat.x) * 3;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(plat.x + 22, plat.y + plat.h, 16, 12 + flap);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(plat.x + plat.w - 38, plat.y + plat.h, 16, 12 - flap);
      } else if (theme === 'jembatan_kali') {
        // Steel suspension gantry with nautical cyan glow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
        ctx.fillRect(plat.x, plat.y, plat.w, 4);

        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        // Nautical harbor beacon lights underneath
        ctx.fillStyle = `rgba(56, 189, 248, ${glow * 0.8})`;
        ctx.beginPath();
        ctx.arc(plat.x + 16, plat.y + plat.h + 3, 3, 0, Math.PI * 2);
        ctx.arc(plat.x + plat.w - 16, plat.y + plat.h + 3, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Cyber energy platform with thruster flames
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
        ctx.fillRect(plat.x, plat.y, plat.w, 4);

        ctx.strokeStyle = '#090c14';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        ctx.fillStyle = `rgba(245, 158, 11, ${glow * 0.75})`;
        ctx.beginPath();
        ctx.ellipse(plat.x + 24, plat.y + plat.h + 3, 8, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(plat.x + plat.w - 24, plat.y + plat.h + 3, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  ctx.restore();
}
