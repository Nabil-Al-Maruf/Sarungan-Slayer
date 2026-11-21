import type { BuffId, GameState, PlayerInput } from '../core/types';
import { stepTopDownPhysics } from '../core/physics';
import { MOVE_SPEED } from '../core/constants';
import type { ShopItemId } from '../modes/survival';

export interface LobbyPlayer {
  id: string;
  paletteIndex: number;
  name: string;
  customName?: string;
  isHost: boolean;
}

export type ConnectionMode = 'online' | 'hotspot';

type ServerToClientMsg =
  | {
      type: 'lobby_update';
      roomCode: string;
      players: LobbyPlayer[];
      yourPlayerId: string;
      isHost: boolean;
    }
  | { type: 'start_game' }
  | { type: 'snapshot'; state: GameState }
  | { type: 'shop_result'; ok: boolean; message: string }
  | { type: 'room_full' };

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Default Cloudflare Edge WebSocket endpoint via pages.dev (unblocked on Indonesian ISPs!)
export const DEFAULT_WS_BASE_URL = 'wss://sarungan-slayer.pages.dev';

export interface WsCallbacks {
  onStatus: (text: string, isError?: boolean) => void;
  onLobbyUpdate: (
    roomCode: string,
    players: LobbyPlayer[],
    localPlayerId: string,
    isHost: boolean
  ) => void;
  onGameStart: () => void;
  onSnapshot: (state: GameState) => void;
  onShopResult: (ok: boolean, message: string) => void;
  onDisconnect: (reason: string) => void;
}

export class WsManager {
  public connected = false;
  public isHost = false;
  public roomCode = '';
  public localPlayerId = 'p1';
  public lobbyPlayers: LobbyPlayer[] = [];
  public connectionMode: ConnectionMode = 'online';
  public customHotspotHost = '';

  private ws: WebSocket | null = null;
  private connectTimeout: number | null = null;
  private lastSentHeld = '';
  private callbacks: WsCallbacks;
  private latestServerState: GameState | null = null;

  constructor(callbacks: WsCallbacks) {
    this.callbacks = callbacks;
  }

  private getWsBaseUrl(): string {
    // If user entered a custom Local Hotspot IP (e.g. 192.168.43.1:8787) in Hotspot mode
    if (this.connectionMode === 'hotspot' && this.customHotspotHost.trim()) {
      const raw = this.customHotspotHost.trim().replace(/\/+$/, '');
      if (raw.startsWith('ws://') || raw.startsWith('wss://')) return raw;
      return `ws://${raw}`;
    }

    const params = new URLSearchParams(window.location.search);
    const override = params.get('ws');
    if (override && (override.startsWith('ws://') || override.startsWith('wss://'))) {
      return override.replace(/\/+$/, '');
    }
    return DEFAULT_WS_BASE_URL;
  }

  private generateRoomCode(): string {
    // Hotspot rooms start with 'H' (e.g. H7K2) so players clearly see it's a Hotspot/Tethering Room!
    let code = this.connectionMode === 'hotspot' ? 'H' : '';
    while (code.length < 4) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeout !== null) {
      window.clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  public disconnect(silent = true): void {
    this.clearConnectTimeout();
    const prevWs = this.ws;
    this.ws = null;
    this.connected = false;
    this.isHost = false;
    this.roomCode = '';
    this.localPlayerId = 'p1';
    this.lobbyPlayers = [];
    this.lastSentHeld = '';
    this.latestServerState = null;

    if (prevWs) {
      prevWs.onopen = null;
      prevWs.onmessage = null;
      prevWs.onclose = null;
      prevWs.onerror = null;
      if (prevWs.readyState === WebSocket.OPEN || prevWs.readyState === WebSocket.CONNECTING) {
        prevWs.close();
      }
    }

    if (!silent) {
      this.callbacks.onDisconnect('Keluar dari room.');
    }
  }

  public createRoom(hostPaletteIndex = 0, playerName = 'Cak Bima'): void {
    const code = this.generateRoomCode();
    this.connectToRoom(code, hostPaletteIndex, playerName);
  }

  public joinRoom(rawCode: string, paletteIndex = 0, playerName = 'Arek SBY'): void {
    const code = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (code.length !== 4) {
      this.callbacks.onStatus('Kode Room harus tepat 4 huruf/angka!', true);
      return;
    }
    if (this.connectionMode === 'hotspot' && !code.startsWith('H')) {
      this.callbacks.onStatus(
        'Kode Room Hotspot selalu diawali huruf H (contoh: H7K2). Pastikan temanmu sudah konek ke Hotspot/Tethering Host!',
        true
      );
      return;
    }
    this.connectToRoom(code, paletteIndex, playerName);
  }

  private connectToRoom(code: string, paletteIndex: number, playerName: string): void {
    this.disconnect(true);
    this.roomCode = code;
    const baseUrl = this.getWsBaseUrl();
    const encodedName = encodeURIComponent(playerName.trim().slice(0, 14) || 'Arek');
    const wsUrl = `${baseUrl}/room/${code}?palette=${paletteIndex}&name=${encodedName}`;

    const modeLabel =
      this.connectionMode === 'hotspot' ? 'Hotspot / Tethering Room' : 'Cloudflare Server Room';
    this.callbacks.onStatus(`Menghubungkan ke ${modeLabel} (${code})...`);

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    this.connectTimeout = window.setTimeout(() => {
      if (this.ws === ws && ws.readyState !== WebSocket.OPEN) {
        this.callbacks.onStatus(
          this.connectionMode === 'hotspot'
            ? `Gagal terhubung ke Hotspot Room ${code}. Pastikan semua HP sudah tersambung ke Hotspot Wi-Fi / Bluetooth Tethering Host!`
            : `Gagal terhubung ke Room ${code}. Cek koneksi internetmu!`,
          true
        );
        this.disconnect(true);
      }
    }, 10000);

    ws.onopen = () => {
      this.clearConnectTimeout();
      this.connected = true;
      this.callbacks.onStatus(`Terhubung ke Room ${code}!`);
    };

    ws.onmessage = (evt) => {
      if (typeof evt.data !== 'string') return;
      let msg: ServerToClientMsg;
      try {
        msg = JSON.parse(evt.data) as ServerToClientMsg;
      } catch {
        return;
      }

      if (msg.type === 'room_full') {
        this.callbacks.onStatus('Room penuh (maksimal 5 pemain)!', true);
        this.disconnect(true);
      } else if (msg.type === 'lobby_update') {
        this.roomCode = msg.roomCode;
        this.lobbyPlayers = msg.players;
        this.localPlayerId = msg.yourPlayerId;
        this.isHost = msg.isHost;
        const prefix = this.connectionMode === 'hotspot' ? '[HOTSPOT] ' : '';
        this.callbacks.onStatus(
          msg.isHost
            ? `${prefix}Room ${msg.roomCode} siap! Pastikan teman terhubung ke Hotspotmu & masukkan kode.`
            : `${prefix}Bergabung di Room ${msg.roomCode}! Menunggu Host mulai...`
        );
        this.callbacks.onLobbyUpdate(msg.roomCode, msg.players, msg.yourPlayerId, msg.isHost);
      } else if (msg.type === 'start_game') {
        this.lastSentHeld = '';
        this.latestServerState = null;
        this.callbacks.onGameStart();
      } else if (msg.type === 'snapshot') {
        if (msg.state.status !== 'playing') {
          msg.state.shakeTimer = 0;
          msg.state.shakeIntensity = 0;
          msg.state.hitstopTimer = 0;
        }
        this.latestServerState = msg.state;
        this.callbacks.onSnapshot(msg.state);
      } else if (msg.type === 'shop_result') {
        this.callbacks.onShopResult(msg.ok, msg.message);
      }
    };

    ws.onclose = () => {
      this.clearConnectTimeout();
      if (this.ws !== ws) return;
      const wasConnected = this.connected;
      this.disconnect(true);
      if (wasConnected) {
        this.callbacks.onDisconnect('Koneksi ke room terputus.');
      }
    };

    ws.onerror = () => {
      this.clearConnectTimeout();
      if (this.ws !== ws) return;
      this.callbacks.onStatus('Gagal terhubung ke Room Server.', true);
    };
  }

  public sendSetProfile(name: string, paletteIndex: number): void {
    this.send({
      type: 'set_profile',
      name: name.trim().slice(0, 14) || 'Arek',
      paletteIndex,
    });
  }

  public sendPickBuff(buffId: BuffId): void {
    this.send({ type: 'pick_buff', buffId });
  }

  public sendStartGame(): void {
    if (!this.isHost) return;
    this.send({ type: 'start' });
  }

  public sendDeltaInput(input: PlayerInput): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const mx = typeof input.moveX === 'number' ? Math.round(input.moveX * 10) : 0;
    const my = typeof input.moveY === 'number' ? Math.round(input.moveY * 10) : 0;
    const heldSig = `${input.up ? 1 : 0}${input.down ? 1 : 0}${input.left ? 1 : 0}${input.right ? 1 : 0}:${mx},${my}`;
    const hasAction =
      input.jumpPressed ||
      input.dashPressed ||
      input.meleePressed ||
      input.projPressed ||
      input.ultPressed;

    if (heldSig === this.lastSentHeld && !hasAction) {
      return;
    }

    this.lastSentHeld = heldSig;
    this.send({ type: 'input', input });
  }

  public sendBuy(itemId: ShopItemId): void {
    this.send({ type: 'buy', itemId });
  }

  public sendSkipIntermission(): void {
    this.send({ type: 'skip_intermission' });
  }

  public applyPredictionAndLerp(
    renderState: GameState,
    localInput: PlayerInput,
    dt: number
  ): void {
    const target = this.latestServerState;
    if (!target || renderState.status !== 'playing') return;

    const lerpAlpha = Math.min(1, dt * 16);

    for (const rp of renderState.players) {
      const tp = target.players.find((p) => p.id === rp.id);
      if (!tp) continue;

      if (rp.id === this.localPlayerId && !rp.knockedDown) {
        let ix =
          typeof localInput.moveX === 'number' && Math.abs(localInput.moveX) > 0.05
            ? localInput.moveX
            : (localInput.right ? 1 : 0) - (localInput.left ? 1 : 0);
        let iy =
          typeof localInput.moveY === 'number' && Math.abs(localInput.moveY) > 0.05
            ? localInput.moveY
            : (localInput.down ? 1 : 0) - (localInput.up ? 1 : 0);
        const len = Math.hypot(ix, iy);
        if (len > 0) {
          const cl = Math.min(1, len);
          ix = (ix / len) * cl;
          iy = (iy / len) * cl;
          rp.dirX = ix / cl;
          rp.dirY = iy / cl;
        }
        if (rp.dashTimer <= 0) {
          const mult = (rp.ultActiveTimer > 0 ? 1.15 : 1) * (rp.speedMult || 1);
          rp.vx = ix * MOVE_SPEED * mult;
          rp.vy = iy * MOVE_SPEED * mult;
        }
        stepTopDownPhysics(
          rp,
          dt,
          renderState.obstacles,
          renderState.activeMinX,
          renderState.activeMaxX
        );

        const drift = Math.hypot(tp.x - rp.x, tp.y - rp.y);
        if (drift > 95) {
          rp.x = tp.x;
          rp.y = tp.y;
          rp.z = tp.z;
        } else {
          const recon = Math.min(1, dt * 10);
          rp.x += (tp.x - rp.x) * recon;
          rp.y += (tp.y - rp.y) * recon;
          rp.z += (tp.z - rp.z) * recon;
        }
      } else {
        rp.x += (tp.x - rp.x) * lerpAlpha;
        rp.y += (tp.y - rp.y) * lerpAlpha;
        rp.z += (tp.z - rp.z) * lerpAlpha;
      }

      rp.animTime += dt * (Math.hypot(rp.vx, rp.vy) > 20 ? 12 : 3);
    }

    for (const re of renderState.enemies) {
      const te = target.enemies.find((e) => e.id === re.id);
      if (!te) continue;
      re.x += (te.x - re.x) * lerpAlpha;
      re.y += (te.y - re.y) * lerpAlpha;
      re.z += (te.z - re.z) * lerpAlpha;
      re.animTime += dt * 10;
    }

    for (const pr of renderState.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
    }
    for (const ep of renderState.enemyProjectiles) {
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;
      ep.angle += ep.spin * dt;
    }
  }

  private send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(data));
    } catch {
      // Ignore transient send error
    }
  }
}
