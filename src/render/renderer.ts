import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../core/constants';
import type {
  BarricadeState,
  EnemyProjectile,
  GameState,
  HazardZone,
  ProjectileState,
  SlashEffect,
  SurvivalCore,
} from '../core/types';
import { drawTopDownMapGround, drawTopDownObstacle } from './backgrounds';
import { drawCrate, drawEnemy, drawPickup, drawPlayer } from './characterRig';

interface Renderable {
  sortY: number;
  draw: () => void;
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.save();
  ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  let shakeX = 0;
  let shakeY = 0;
  if (state.status === 'playing' && state.shakeTimer > 0) {
    const mag = state.shakeIntensity * (state.shakeTimer / 0.15);
    shakeX = (Math.random() - 0.5) * 2 * Math.min(state.shakeIntensity, mag);
    shakeY = (Math.random() - 0.5) * 2 * Math.min(state.shakeIntensity, mag);
  }

  // ===== WORLD SPACE =====
  ctx.save();
  ctx.translate(-Math.round(state.cameraX) + shakeX, shakeY);

  drawTopDownMapGround(ctx, state.theme, state.arenaWidth, state.cameraX, state.time);

  for (const hz of state.hazards) {
    drawHazardZone(ctx, hz);
  }

  const queue: Renderable[] = [];

  for (const obs of state.obstacles) {
    queue.push({
      sortY: obs.y + obs.h,
      draw: () => drawTopDownObstacle(ctx, obs),
    });
  }

  if (state.survival) {
    const core = state.survival.core;
    const p0 = state.players[0];
    const nearCore =
      !!p0 &&
      (state.survival.phase === 'intermission' ||
        Math.hypot(p0.x - (core.x + core.w * 0.5), p0.y - (core.y + core.h * 0.5)) <= 130);

    queue.push({
      sortY: core.y + core.h,
      draw: () => drawSurvivalCore(ctx, core, nearCore),
    });

    for (const bar of state.survival.barricades) {
      queue.push({
        sortY: bar.y + bar.h,
        draw: () => drawBarricade(ctx, bar),
      });
    }
  }

  for (const crate of state.crates) {
    queue.push({
      sortY: crate.y,
      draw: () => drawCrate(ctx, crate),
    });
  }

  for (const pickup of state.pickups) {
    queue.push({
      sortY: pickup.y,
      draw: () => drawPickup(ctx, pickup),
    });
  }

  for (const enemy of state.enemies) {
    queue.push({
      sortY: enemy.y,
      draw: () => drawEnemy(ctx, enemy, state.time),
    });
  }

  for (const player of state.players) {
    queue.push({
      sortY: player.y,
      draw: () => drawPlayer(ctx, player, state.time),
    });
  }

  queue.sort((a, b) => a.sortY - b.sortY);
  for (const item of queue) {
    item.draw();
  }

  for (const slash of state.slashes) {
    drawSlashEffect(ctx, slash);
  }

  for (const proj of state.projectiles) {
    drawProjectile(ctx, proj);
  }

  for (const ep of state.enemyProjectiles) {
    drawEnemyProjectile(ctx, ep);
  }

  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.z, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const ft of state.floatingTexts) {
    const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${Math.round(15 * ft.scale)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#090c14';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
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
          : '#64748b';
  const accentColor =
    bar.level === 1 ? '#fde68a' : bar.level === 2 ? '#eab308' : '#38bdf8';

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
  ctx.fillText(`LV.${bar.level}`, cx, bar.y - 23);
  ctx.restore();
}

function drawHazardZone(ctx: CanvasRenderingContext2D, hz: HazardZone): void {
  ctx.save();
  ctx.translate(hz.x, hz.y);
  ctx.scale(1, 0.72);

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
  ctx.ellipse(proj.x, proj.y + 4, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(proj.x, proj.y - 18);
  ctx.rotate(proj.angle);

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
