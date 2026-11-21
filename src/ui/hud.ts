import { PLAYER_PALETTES, PROJ_COOLDOWN } from '../core/constants';
import type { GameState } from '../core/types';

export class HudController {
  private badgeEl = document.getElementById('hud-player-badge')!;
  private hpFillEl = document.getElementById('hud-hp-fill')!;
  private hpTextEl = document.getElementById('hud-hp-text')!;
  private ultFillEl = document.getElementById('hud-ult-fill')!;
  private ultTextEl = document.getElementById('hud-ult-text')!;
  private projFillEl = document.getElementById('hud-proj-fill')!;
  private projTextEl = document.getElementById('hud-proj-text')!;
  private coinsEl = document.getElementById('hud-coins')!;
  private warungHudBtn = document.getElementById('btn-warung-hud')!;
  private koCountEl = document.getElementById('hud-ko-count')!;
  private modeTitleEl = document.getElementById('hud-mode-title')!;

  private vbtnUltEl = document.getElementById('vbtn-ult');
  private vbtnProjEl = document.getElementById('vbtn-proj');
  private vbtnProjCdEl = document.getElementById('vbtn-proj-cd');

  public update(state: GameState, localPlayerId = 'p1'): void {
    const player = state.players.find((p) => p.id === localPlayerId) ?? state.players[0];
    if (!player) return;

    this.modeTitleEl.textContent = state.stageTitle;

    const palette = PLAYER_PALETTES[player.paletteIndex % PLAYER_PALETTES.length];
    this.badgeEl.textContent = palette.label;
    this.badgeEl.style.background = palette.accent;

    // HP Bar
    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    this.hpFillEl.style.width = `${hpPct}%`;
    this.hpTextEl.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;

    // Ultimate Bar
    const ultPct = Math.max(0, Math.min(100, (player.ult / player.maxUlt) * 100));
    const ultReady = ultPct >= 100 || player.ultActiveTimer > 0;
    this.ultFillEl.style.width =
      player.ultActiveTimer > 0 ? `${(player.ultActiveTimer / 3) * 100}%` : `${ultPct}%`;
    this.ultFillEl.classList.toggle('ready', ultReady);
    this.ultTextEl.textContent =
      player.ultActiveTimer > 0
        ? 'BADAI!'
        : ultPct >= 100
          ? 'SIAP!'
          : `${Math.floor(ultPct)}%`;

    if (this.vbtnUltEl) {
      this.vbtnUltEl.classList.toggle('ready', ultReady);
    }

    // Projectile Cooldown (2.5s)
    const cd = player.projCooldown;
    const cdRatio = Math.max(0, Math.min(1, 1 - cd / PROJ_COOLDOWN));
    this.projFillEl.style.width = `${cdRatio * 100}%`;
    const cdLabel = cd > 0 ? `${cd.toFixed(1)}s` : 'SIAP';
    this.projTextEl.textContent = cdLabel;

    if (this.vbtnProjEl) {
      this.vbtnProjEl.classList.toggle('cooling', cd > 0);
    }
    if (this.vbtnProjCdEl) {
      this.vbtnProjCdEl.textContent = cdLabel;
    }

    // KO counter & Survival Coins/Warung button
    this.koCountEl.textContent = `KO: ${state.koCount}`;
    const isSurvival = state.mode === 'survival';
    this.coinsEl.classList.toggle('hidden', !isSurvival);
    this.warungHudBtn.classList.toggle('hidden', !isSurvival);
    if (isSurvival) {
      this.coinsEl.textContent = `Rp ${player.coins}`;
    }
  }
}
