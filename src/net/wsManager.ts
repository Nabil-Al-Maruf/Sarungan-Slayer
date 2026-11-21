import type { GameState, PlayerInput } from '../core/types';
import { stepTopDownPhysics } from '../core/physics';
import { MOVE_SPEED } from '../core/constants';
import type { ShopItemId } from '../modes/survival';

export interface LobbyPlayer {
  id: string;
  paletteIndex: number;
  name: string;
  isHost: boolean;
}

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

function getWsBaseUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('ws');
  if (override && (override.startsWith('ws://') || override.startsWith('wss://'))) {
    return override.replace(/\/+$/, '');
  }
  return DEFAULT_WS_BASE_URL;
}

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

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

  private ws: WebSocket | null = null;
  private connectTimeout: number | null = null;
  private lastSentHeld = '';
  private callbacks: WsCallbacks;

  // Authoritative latest snapshot for 60 FPS Lerp Interpolation & Local Prediction
  private latestServerState: GameState | null = null;

  constructor(callbacks: WsCallbacks) {
    this.callbacks = callbacks;
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

  public createRoom(hostPaletteIndex = 0): void {
    const code = generateRoomCode();
    this.connectToRoom(code, hostPaletteIndex);
  }

  public joinRoom(rawCode: string, paletteIndex = 0): void {
    const code = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (code.length !== 4) {
      this.callbacks.onStatus('Kode Room harus tepat 4 huruf/angka!', true);
      return;
    }
    this.connectToRoom(code, paletteIndex);
  }

  private connectToRoom(code: string, paletteIndex: number): void {
    this.disconnect(true);
    this.roomCode = code;
    const baseUrl = getWsBaseUrl();
    const wsUrl = `${baseUrl}/room/${code}?palette=${paletteIndex}`;

    this.callbacks.onStatus(`Menghubungkan ke Cloudflare Server (Room ${code})...`);

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    this.connectTimeout = window.setTimeout(() => {
      if (this.ws === ws && ws.readyState !== WebSocket.OPEN) {
        this.callbacks.onStatus(
          `Gagal terhubung ke server untuk Room ${code}. Cek koneksi internetmu!`,
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
        this.callbacks.onStatus(
          msg.isHost
            ? `Room ${msg.roomCode} siap! Bagikan kode atau link ke teman.`
            : `Bergabung di Room ${msg.roomCode}! Menunggu Host mulai...`
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
        this.callbacks.onDisconnect('Koneksi ke server terputus.');
      }
    };

    ws.onerror = () => {
      this.clearConnectTimeout();
      if (this.ws !== ws) return;
      this.callbacks.onStatus('Gagal terhubung ke Cloudflare WebSocket Server.', true);
    };
  }

  public sendStartGame(): void {
    if (!this.isHost) return;
    this.send({ type: 'start' });
  }

  /**
   * Delta Input Optimization:
   * Only transmits an input packet when held movement directions change
   * OR when an edge-triggered action (jump, dash, melee, proj, ult) fires.
   */
  public sendDeltaInput(input: PlayerInput): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const heldSig = `${input.up ? 1 : 0}${input.down ? 1 : 0}${input.left ? 1 : 0}${input.right ? 1 : 0}`;
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

  /**
   * Client-Side Prediction (Local Player) + 60 FPS Entity Interpolation (Remote Entities):
   * Smooths 20 Hz server snapshots into silky 60 FPS motion.
   */
  public applyPredictionAndLerp(
    renderState: GameState,
    localInput: PlayerInput,
    dt: number
  ): void {
    const target = this.latestServerState;
    if (!target || renderState.status !== 'playing') return;

    const lerpAlpha = Math.min(1, dt * 16);

    // 1. Players: Client-Side Prediction for local player, Lerp for remote players
    for (const rp of renderState.players) {
      const tp = target.players.find((p) => p.id === rp.id);
      if (!tp) continue;

      if (rp.id === this.localPlayerId && !rp.knockedDown) {
        // Predict local movement immediately for zero-delay responsiveness
        let ix = (localInput.right ? 1 : 0) - (localInput.left ? 1 : 0);
        let iy = (localInput.down ? 1 : 0) - (localInput.up ? 1 : 0);
        const len = Math.hypot(ix, iy);
        if (len > 0) {
          ix /= len;
          iy /= len;
          rp.dirX = ix;
          rp.dirY = iy;
        }
        if (rp.dashTimer <= 0) {
          const mult = rp.ultActiveTimer > 0 ? 1.15 : 1;
          rp.vx = ix * MOVE_SPEED * mult;
          rp.vy = iy * MOVE_SPEED * mult;
        }
        stepTopDownPhysics(rp, dt, renderState.obstacles, renderState.activeMinX, renderState.activeMaxX);

        // Soft reconciliation toward authoritative server position (snap if huge drift)
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
        // Remote player smooth interpolation
        rp.x += (tp.x - rp.x) * lerpAlpha;
        rp.y += (tp.y - rp.y) * lerpAlpha;
        rp.z += (tp.z - rp.z) * lerpAlpha;
      }

      rp.animTime += dt * (Math.hypot(rp.vx, rp.vy) > 20 ? 12 : 3);
    }

    // 2. Enemies smooth interpolation
    for (const re of renderState.enemies) {
      const te = target.enemies.find((e) => e.id === re.id);
      if (!te) continue;
      re.x += (te.x - re.x) * lerpAlpha;
      re.y += (te.y - re.y) * lerpAlpha;
      re.z += (te.z - re.z) * lerpAlpha;
      re.animTime += dt * 10;
    }

    // 3. Projectiles linear extrapolation between 20 Hz snapshots
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
