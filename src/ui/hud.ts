import { PLAYER_PALETTES, PROJ_COOLDOWN } from '../core/constants';
import { getHeroDef } from '../core/heroes';
import type { GameState } from '../core/types';

export class HudController {
  private badgeEl = document.getElementById('hud-player-badge');
  private personalBarsEl = document.getElementById('hud-personal-bars');
  private monitorTeamStripEl = document.getElementById('monitor-team-strip');
  private brawlStripEl = document.getElementById('brawl-scoreboard-strip');
  private pecutPillEl = document.getElementById('hud-pecut-pill');
  private hpFillEl = document.getElementById('hud-hp-fill');
  private hpTextEl = document.getElementById('hud-hp-text');
  private ultFillEl = document.getElementById('hud-ult-fill');
  private ultTextEl = document.getElementById('hud-ult-text');
  private projFillEl = document.getElementById('hud-proj-fill');
  private projTextEl = document.getElementById('hud-proj-text');
  private perfEl = document.getElementById('hud-perf');
  private coinsEl = document.getElementById('hud-coins');
  private warungHudBtn = document.getElementById('btn-warung-hud');
  private koCountEl = document.getElementById('hud-ko-count');
  private modeTitleEl = document.getElementById('hud-mode-title');
  private elementPillEl = document.getElementById('hud-element-pill');
  private elementIconEl = document.getElementById('hud-element-icon');
  private elementNameEl = document.getElementById('hud-element-name');

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
  private lastMonitorHtml = '';
  private lastBrawlHtml = '';
  private lastWasMonitor: boolean | null = null;
  private lastProjName = '';
  private lastElementText = '';

  public update(
    state: GameState,
    localPlayerId = 'p1',
    perfText = '60 FPS',
    isMonitor = false
  ): void {
    if (!this.perfEl || !this.modeTitleEl || !this.koCountEl) return;

    const resolvedId = localPlayerId || 'p1';
    const player = state.players.find((p) => p.id === resolvedId) ?? state.players[0];

    if (this.lastPerfText !== perfText) {
      this.lastPerfText = perfText;
      this.perfEl.textContent = perfText;
    }

    const currentTitle =
      state.mode === 'brawl' && state.brawl
        ? `🥊 BRAWL • ${Math.floor(state.brawl.remainingTime / 60)}:${Math.floor(state.brawl.remainingTime % 60)
            .toString()
            .padStart(2, '0')}`
        : state.stageTitle;
    if (this.lastModeTitle !== currentTitle) {
      this.lastModeTitle = currentTitle;
      this.modeTitleEl.textContent = currentTitle;
    }

    const currentKo = state.mode === 'brawl' ? (player?.brawlKos ?? 0) : state.koCount;
    const koTxt = `KO: ${currentKo}`;
    if (this.koCountEl && this.lastKoText !== koTxt) {
      this.lastKoText = koTxt;
      this.koCountEl.textContent = koTxt;
    }

    // Brawl Mode 6-Player Live Scoreboard Strip
    if (this.brawlStripEl) {
      if (state.mode === 'brawl') {
        this.brawlStripEl.classList.remove('hidden');
        document.getElementById('desktop-hints')?.classList.add('hidden');
        const cardsHtml = state.players
          .map((pl) => {
            const hero = getHeroDef(pl.heroId);
            const pal = PLAYER_PALETTES[pl.paletteIndex % PLAYER_PALETTES.length];
            const stocks = pl.brawlStocks ?? 3;
            const kos = pl.brawlKos ?? 0;
            const dead = stocks <= 0;
            const hpPct = Math.max(0, Math.min(100, (pl.hp / Math.max(1, pl.maxHp)) * 100));
            const dmgColor = hpPct > 60 ? '#22c55e' : hpPct > 30 ? '#f59e0b' : '#ef4444';
            const isLocal = pl.id === localPlayerId;
            const hearts = dead ? '💀 K.O.' : '❤️'.repeat(stocks);
            return `<div class="brawl-fighter-card${dead ? ' dead' : ''}${isLocal ? ' local-focus' : ''}" style="--pal-acc:${pal.accent}">
              <div class="brawl-card-top">
                <span class="brawl-hero-avatar">${hero.avatar}</span>
                <div class="brawl-info">
                  <span class="brawl-name">${pl.name}</span>
                  <span class="brawl-alias">${hero.name}</span>
                </div>
                <span class="brawl-ko-tag">⚔️ ${kos}</span>
              </div>
              <div class="brawl-card-mid">
                <div class="brawl-dmg-gauge">
                  <span class="brawl-dmg-val" style="color:${dmgColor}">${Math.ceil(pl.hp)}%</span>
                </div>
                <span class="brawl-stocks">${hearts}</span>
              </div>
            </div>`;
          })
          .join('');
        if (this.lastBrawlHtml !== cardsHtml) {
          this.lastBrawlHtml = cardsHtml;
          this.brawlStripEl.innerHTML = cardsHtml;
        }
      } else {
        this.brawlStripEl.classList.add('hidden');
      }
    }

    // Hide desktop keybind hints in Brawl & Sandbox so bottom docks never overlap
    const hideDesktopHints = state.mode === 'brawl' || state.mode === 'sandbox';
    document.getElementById('desktop-hints')?.classList.toggle('hidden', hideDesktopHints);

    // Monitor Screen Layout Toggle
    if (this.lastWasMonitor !== isMonitor) {
      this.lastWasMonitor = isMonitor;
      if (this.personalBarsEl) this.personalBarsEl.classList.toggle('hidden', isMonitor);
      if (this.monitorTeamStripEl) this.monitorTeamStripEl.classList.toggle('hidden', !isMonitor);
      if (this.pecutPillEl) this.pecutPillEl.classList.toggle('hidden', isMonitor);
      if (isMonitor && this.badgeEl) {
        this.lastBadge = 'TV';
        this.badgeEl.textContent = '📺';
        this.badgeEl.style.background = '#0284c7';
      }
    }

    // Monitor Mode: Display all connected players' status cards across top
    if (isMonitor) {
      if (this.monitorTeamStripEl) {
        const stripHtml = state.players
          .map((pl) => {
            const pal = PLAYER_PALETTES[pl.paletteIndex % PLAYER_PALETTES.length];
            const hpPct = Math.max(0, Math.min(100, (pl.hp / Math.max(1, pl.maxHp)) * 100));
            const ultPct = Math.max(0, Math.min(100, (pl.ult / Math.max(1, pl.maxUlt)) * 100));
            const dead = pl.hp <= 0 || pl.knockedDown;
            const ultReady = ultPct >= 100;
            return `<div class="mon-card${dead ? ' dead' : ''}"><div class="mon-card-header"><span class="mon-avatar" style="background:${pal.accent}">${pal.label}</span><span class="mon-name">${pl.name}</span><span class="mon-coin">🪙 ${pl.coins}</span></div><div class="mon-meter-row"><span class="mon-meter-label">HP</span><div class="mon-meter-track"><div class="mon-hp-fill" style="width:${hpPct.toFixed(0)}%;background:${hpPct > 40 ? pal.accent : '#ef4444'}"></div></div><span class="mon-meter-val">${Math.ceil(pl.hp)}/${pl.maxHp}</span></div><div class="mon-meter-row"><span class="mon-meter-label">ULT</span><div class="mon-meter-track"><div class="mon-ult-fill${ultReady ? ' ready' : ''}" style="width:${ultPct.toFixed(0)}%"></div></div><span class="mon-meter-val${ultReady ? ' ready' : ''}">${ultReady ? 'SIAP! 🔥' : `${ultPct.toFixed(0)}%`}</span></div>${dead ? '<div class="mon-down-badge">⚠️ PINGSAN!</div>' : ''}</div>`;
          })
          .join('');
        if (this.lastMonitorHtml !== stripHtml) {
          this.lastMonitorHtml = stripHtml;
          this.monitorTeamStripEl.innerHTML = stripHtml;
        }
      }
      return;
    }

    if (!player) return;

    if (this.badgeEl) {
      const palette = PLAYER_PALETTES[player.paletteIndex % PLAYER_PALETTES.length];
      if (this.lastBadge !== palette.label) {
        this.lastBadge = palette.label;
        this.badgeEl.textContent = palette.label;
        this.badgeEl.style.background = palette.accent;
      }
    }

    // HP Bar
    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const hpW = `${hpPct.toFixed(1)}%`;
    const hpTxt =
      state.mode === 'brawl'
        ? `${Math.ceil(player.hp)}% • ❤️x${player.brawlStocks ?? 0}`
        : `${Math.ceil(player.hp)}/${player.maxHp}`;
    if (this.hpFillEl && this.lastHpWidth !== hpW) {
      this.lastHpWidth = hpW;
      this.hpFillEl.style.width = hpW;
    }
    if (this.hpTextEl && this.lastHpText !== hpTxt) {
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

    if (this.ultFillEl && this.lastUltWidth !== ultW) {
      this.lastUltWidth = ultW;
      this.ultFillEl.style.width = ultW;
    }
    if (this.ultFillEl && this.lastUltReady !== ultReady) {
      this.lastUltReady = ultReady;
      this.ultFillEl.classList.toggle('ready', ultReady);
      if (this.vbtnUltEl) this.vbtnUltEl.classList.toggle('ready', ultReady);
    }
    if (this.ultTextEl && this.lastUltText !== ultTxt) {
      this.lastUltText = ultTxt;
      this.ultTextEl.textContent = ultTxt;
    }

    // Projectile Cooldown (2.5s * cdMult)
    const localHero = getHeroDef(player.heroId);
    if (this.lastProjName !== localHero.projName) {
      this.lastProjName = localHero.projName;
      if (this.pecutPillEl && this.pecutPillEl.firstElementChild) {
        this.pecutPillEl.firstElementChild.textContent = localHero.projName.toUpperCase();
      }
    }

    const cd = player.projCooldown;
    const maxCd = PROJ_COOLDOWN * (player.cdMult || 1);
    const cdRatio = Math.max(0, Math.min(1, 1 - cd / maxCd));
    const cdW = `${(cdRatio * 100).toFixed(1)}%`;
    const cdLabel = cd > 0 ? `${cd.toFixed(1)}s` : 'SIAP';

    if (this.projFillEl && this.lastProjWidth !== cdW) {
      this.lastProjWidth = cdW;
      this.projFillEl.style.width = cdW;
    }
    if (this.projTextEl && this.lastProjText !== cdLabel) {
      this.lastProjText = cdLabel;
      this.projTextEl.textContent = cdLabel;
      if (this.vbtnProjEl) this.vbtnProjEl.classList.toggle('cooling', cd > 0);
      if (this.vbtnProjCdEl) this.vbtnProjCdEl.textContent = cdLabel;
    }

    // Survival Coins/Warung button
    const isSurvival = state.mode === 'survival';
    if (this.coinsEl && this.lastIsSurvival !== isSurvival) {
      this.lastIsSurvival = isSurvival;
      this.coinsEl.classList.toggle('hidden', !isSurvival);
      if (this.warungHudBtn) this.warungHudBtn.classList.toggle('hidden', !isSurvival);
    }
    if (isSurvival && this.coinsEl) {
      const coinsTxt = `Rp ${player.coins}`;
      if (this.lastCoinsText !== coinsTxt) {
        this.lastCoinsText = coinsTxt;
        this.coinsEl.textContent = coinsTxt;
      }
    }

    // Active Slash Element Pill
    const elem = player.slashElement || 'none';
    const elemLv = player.slashElementLevel || 1;
    const elemInfoMap: Record<string, { icon: string; name: string }> = {
      none: { icon: '⚪', name: 'NORMAL' },
      petir: { icon: '⚡', name: `PETIR Lv.${elemLv}` },
      api: { icon: '🔥', name: `API Lv.${elemLv}` },
      badai: { icon: '🌀', name: `BADAI Lv.${elemLv}` },
      suci: { icon: '✨', name: `SUCI Lv.${elemLv}` },
    };
    const currentElemInfo = elemInfoMap[elem] || elemInfoMap.none;
    const elemTxt = `${currentElemInfo.icon} ${currentElemInfo.name}`;
    if (this.lastElementText !== elemTxt) {
      this.lastElementText = elemTxt;
      if (this.elementIconEl) this.elementIconEl.textContent = currentElemInfo.icon;
      if (this.elementNameEl) this.elementNameEl.textContent = currentElemInfo.name;
      if (this.elementPillEl) {
        this.elementPillEl.className = `element-pill elem-${elem}`;
      }
    }
  }
}
