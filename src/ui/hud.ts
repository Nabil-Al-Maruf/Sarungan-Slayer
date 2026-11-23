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
  private perfEl = document.getElementById('hud-perf')!;
  private coinsEl = document.getElementById('hud-coins')!;
  private warungHudBtn = document.getElementById('btn-warung-hud')!;
  private koCountEl = document.getElementById('hud-ko-count')!;
  private modeTitleEl = document.getElementById('hud-mode-title')!;

  private vbtnUltEl = document.getElementById('vbtn-ult');
  private vbtnProjEl = document.getElementById('vbtn-proj');
  private vbtnProjCdEl = document.getElementById('vbtn-proj-cd');

  private lastModeTitle = '';
  private lastBadge = '';
  private lastHpText = '';
  private lastHpWidth = '';
  private lastUltText = '';
  private lastUltWidth = '';
  private lastUltReady = false;
  private lastProjText = '';
  private lastProjWidth = '';
  private lastKoText = '';
  private lastCoinsText = '';
  private lastIsSurvival = false;
  private lastPerfText = '';

  public update(
    state: GameState,
    localPlayerId = 'p1',
    perfText = '60 FPS'
  ): void {
    if (this.lastPerfText !== perfText) {
      this.lastPerfText = perfText;
      this.perfEl.textContent = perfText;
    }

    if (this.lastModeTitle !== state.stageTitle) {
      this.lastModeTitle = state.stageTitle;
      this.modeTitleEl.textContent = state.stageTitle;
    }

    const koTxt = `KO: ${state.koCount}`;
    if (this.lastKoText !== koTxt) {
      this.lastKoText = koTxt;
      this.koCountEl.textContent = koTxt;
    }

    const player = state.players.find((p) => p.id === localPlayerId) ?? state.players[0];
    if (!player) return;

    const palette = PLAYER_PALETTES[player.paletteIndex % PLAYER_PALETTES.length];
    if (this.lastBadge !== palette.label) {
      this.lastBadge = palette.label;
      this.badgeEl.textContent = palette.label;
      this.badgeEl.style.background = palette.accent;
    }

    // HP Bar
    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const hpW = `${hpPct.toFixed(1)}%`;
    const hpTxt = `${Math.ceil(player.hp)}/${player.maxHp}`;
    if (this.lastHpWidth !== hpW) {
      this.lastHpWidth = hpW;
      this.hpFillEl.style.width = hpW;
    }
    if (this.lastHpText !== hpTxt) {
      this.lastHpText = hpTxt;
      this.hpTextEl.textContent = hpTxt;
    }

    // Ultimate Bar
    const ultPct = Math.max(0, Math.min(100, (player.ult / player.maxUlt) * 100));
    const ultReady = ultPct >= 100 || player.ultActiveTimer > 0;
    const ultW =
      player.ultActiveTimer > 0
        ? `${((player.ultActiveTimer / 3) * 100).toFixed(1)}%`
        : `${ultPct.toFixed(1)}%`;
    const ultType = player.ultType ?? 'gasing';
    const ultLabelName =
      ultType === 'petir'
        ? '⚡ PETIR'
        : ultType === 'mercon'
          ? '💥 BAZOOKA'
          : ultType === 'naga'
            ? '🐉 NAGA'
            : '🌀 GASING';
    const ultTxt =
      player.ultActiveTimer > 0
        ? `${ultLabelName}!`
        : ultPct >= 100
          ? `${ultLabelName} SIAP!`
          : `${Math.floor(ultPct)}%`;

    if (this.lastUltWidth !== ultW) {
      this.lastUltWidth = ultW;
      this.ultFillEl.style.width = ultW;
    }
    if (this.lastUltReady !== ultReady) {
      this.lastUltReady = ultReady;
      this.ultFillEl.classList.toggle('ready', ultReady);
      if (this.vbtnUltEl) this.vbtnUltEl.classList.toggle('ready', ultReady);
    }
    if (this.lastUltText !== ultTxt) {
      this.lastUltText = ultTxt;
      this.ultTextEl.textContent = ultTxt;
    }

    // Projectile Cooldown (2.5s * cdMult)
    const cd = player.projCooldown;
    const maxCd = PROJ_COOLDOWN * (player.cdMult || 1);
    const cdRatio = Math.max(0, Math.min(1, 1 - cd / maxCd));
    const cdW = `${(cdRatio * 100).toFixed(1)}%`;
    const cdLabel = cd > 0 ? `${cd.toFixed(1)}s` : 'SIAP';

    if (this.lastProjWidth !== cdW) {
      this.lastProjWidth = cdW;
      this.projFillEl.style.width = cdW;
    }
    if (this.lastProjText !== cdLabel) {
      this.lastProjText = cdLabel;
      this.projTextEl.textContent = cdLabel;
      if (this.vbtnProjEl) this.vbtnProjEl.classList.toggle('cooling', cd > 0);
      if (this.vbtnProjCdEl) this.vbtnProjCdEl.textContent = cdLabel;
    }

    // Survival Coins/Warung button
    const isSurvival = state.mode === 'survival';
    if (this.lastIsSurvival !== isSurvival) {
      this.lastIsSurvival = isSurvival;
      this.coinsEl.classList.toggle('hidden', !isSurvival);
      this.warungHudBtn.classList.toggle('hidden', !isSurvival);
    }
    if (isSurvival) {
      const coinsTxt = `Rp ${player.coins}`;
      if (this.lastCoinsText !== coinsTxt) {
        this.lastCoinsText = coinsTxt;
        this.coinsEl.textContent = coinsTxt;
      }
    }
  }
}
