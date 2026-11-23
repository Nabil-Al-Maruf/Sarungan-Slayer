import {
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SPEED,
  DOUBLE_JUMP_VZ,
  JUMP_VZ,
  MELEE_COOLDOWN,
  MELEE_DURATION,
  MOVE_SPEED,
  PLAYER_PALETTES,
  PROJ_COOLDOWN,
  PROJ_DAMAGE,
  PROJ_LIFETIME,
  PROJ_MAX_PIERCE,
  PROJ_RADIUS,
  PROJ_SPEED,
  ULT_DURATION,
} from '../core/constants';
import { stepTopDownPhysics } from '../core/physics';
import type { BuffId, GameState, PlayerInput, SoundEvent } from '../core/types';
import type { ShopItemId } from '../modes/survival';
import {
  mergeCompactSnapshot,
  packCompactSnapshot,
  packStickSnapshot,
  type CompactSnapshot,
} from './compactSnapshot';

export type LobbyRole = 'player' | 'monitor' | 'stick';

export interface LobbyPlayer {
  id: string;
  paletteIndex: number;
  name: string;
  customName?: string;
  isHost: boolean;
  role?: LobbyRole;
}

export type ConnectionMode = 'online' | 'hotspot';
export type LocalPlayStyle = 'normal' | 'monitor';

type ServerToClientMsg =
  | {
      type: 'lobby_update';
      roomCode: string;
      players: LobbyPlayer[];
      yourPlayerId: string;
      isHost: boolean;
    }
  | { type: 'start_game' }
  | { type: 'in_match' }
  | { type: 'rtc_signal'; from: string; data: RtcSignalData }
  | { type: 'relay'; from: string; payload: GameNetPayload }
  | { type: 'peer_left'; id: string }
  | { type: 'monitor_closed'; reason?: string }
  | { type: 'monitor_lost'; reason?: string }
  | { type: 'monitor_resumed'; reason?: string }
  | { type: 'pong'; ts: number }
  | { type: 'room_full' };

type RtcSignalData =
  | { kind: 'offer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; candidate: RTCIceCandidateInit };

type GameNetPayload =
  | { t: 'in'; i: PlayerInput }
  | { t: 'snap'; s: CompactSnapshot }
  | { t: 'buy'; item: ShopItemId }
  | { t: 'shop_res'; ok: boolean; msg: string }
  | { t: 'buff'; id: BuffId }
  | { t: 'skip' }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number };

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEFAULT_WS_BASE_URL = 'wss://sarungan-slayer.pages.dev';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export interface WsCallbacks {
  onStatus: (text: string, isError?: boolean) => void;
  onLobbyUpdate: (
    roomCode: string,
    players: LobbyPlayer[],
    localPlayerId: string,
    isHost: boolean
  ) => void;
  onGameStart: () => void;
  onMatchResume?: () => void;
  onCompactSnapshot: (snap: CompactSnapshot) => void;
  onRemoteBuy: (playerId: string, itemId: ShopItemId) => { ok: boolean; message: string };
  onRemoteBuff: (playerId: string, buffId: BuffId) => void;
  onRemoteSkip: () => void;
  onShopResult: (ok: boolean, message: string) => void;
  onPeerLeft?: (id: string) => void;
  onDisconnect: (reason: string) => void;
}

export class WsManager {
  public connected = false;
  public isHost = false;
  public roomCode = '';
  public localPlayerId = 'p1';
  public lobbyPlayers: LobbyPlayer[] = [];
  public connectionMode: ConnectionMode = 'online';
  public localPlayStyle: LocalPlayStyle = 'normal';
  public customHotspotHost = '';
  public lowBandwidthMode = false;
  public pingMs = 0;
  public transportMode: 'UDP' | 'WSS' = 'WSS';

  public get isMonitor(): boolean {
    return (
      this.isHost &&
      this.lobbyPlayers.some((p) => p.id === this.localPlayerId && p.role === 'monitor')
    );
  }

  public get isStickClient(): boolean {
    return (
      !this.isHost &&
      this.lobbyPlayers.some((p) => p.id === this.localPlayerId && p.role === 'stick')
    );
  }

  private ws: WebSocket | null = null;
  private connectTimeout: number | null = null;
  private pingTimer: number | null = null;
  private wsKeepaliveTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private intentionalDisconnect = false;
  private lastConnectParams: {
    code: string;
    paletteIndex: number;
    playerName: string;
    role: 'player' | 'monitor';
  } | null = null;
  private lastSentHeld = '';
  private lastMoveSendTs = 0;
  private lastWsPingTs = 0;
  private callbacks: WsCallbacks;

  // WebRTC UDP DataChannels (Host maintains 1 per client; Client maintains 1 to Host)
  private pcs = new Map<string, RTCPeerConnection>();
  private dcs = new Map<string, RTCDataChannel>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private remoteInputs = new Map<string, PlayerInput>();

  // Authoritative target positions (never mutated by render state)
  private serverPlayerTargets = new Map<string, { x: number; y: number; z: number }>();
  private serverEnemyTargets = new Map<number, { x: number; y: number; z: number }>();

  constructor(callbacks: WsCallbacks) {
    this.callbacks = callbacks;
  }

  private getWsBaseUrl(): string {
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
    let code = this.connectionMode === 'hotspot' ? 'H' : '';
    while (code.length < 4) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  private clearTimers(): void {
    if (this.connectTimeout !== null) {
      window.clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.wsKeepaliveTimer !== null) {
      window.clearInterval(this.wsKeepaliveTimer);
      this.wsKeepaliveTimer = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeAllRtc(): void {
    for (const dc of this.dcs.values()) {
      try {
        dc.close();
      } catch {
        // Ignore
      }
    }
    this.dcs.clear();
    for (const pc of this.pcs.values()) {
      try {
        pc.close();
      } catch {
        // Ignore
      }
    }
    this.pcs.clear();
    this.pendingIce.clear();
    this.transportMode = 'WSS';
  }

  public disconnect(silent = true): void {
    this.intentionalDisconnect = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'leave' }));
      } catch {
        // Ignore
      }
    }
    this.reconnectAttempts = 0;
    this.lastConnectParams = null;
    this.clearTimers();
    this.closeAllRtc();
    const prevWs = this.ws;
    this.ws = null;
    this.connected = false;
    this.isHost = false;
    this.roomCode = '';
    this.localPlayerId = 'p1';
    this.lobbyPlayers = [];
    this.lastSentHeld = '';
    this.pingMs = 0;
    this.remoteInputs.clear();
    this.serverPlayerTargets.clear();
    this.serverEnemyTargets.clear();

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
    const roleParam =
      this.connectionMode === 'hotspot' && this.localPlayStyle === 'monitor' ? 'monitor' : 'player';
    this.connectToRoom(code, hostPaletteIndex, playerName, roleParam);
  }

  public joinRoom(rawCode: string, paletteIndex = 0, playerName = 'Arek SBY'): void {
    const code = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (code.length !== 4) {
      this.callbacks.onStatus('Kode Room harus tepat 4 huruf/angka!', true);
      return;
    }
    if (this.connectionMode === 'hotspot' && !code.startsWith('H')) {
      this.callbacks.onStatus(
        'Kode Room Local selalu diawali huruf H (contoh: H7K2). Pastikan semua berada di 1 jaringan yang sama!',
        true
      );
      return;
    }
    this.connectToRoom(code, paletteIndex, playerName);
  }

  private connectToRoom(
    code: string,
    paletteIndex: number,
    playerName: string,
    role: 'player' | 'monitor' = 'player',
    isReconnect = false
  ): void {
    if (!isReconnect) {
      this.disconnect(true);
      this.reconnectAttempts = 0;
    } else {
      if (this.connectTimeout !== null) {
        window.clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      if (this.wsKeepaliveTimer !== null) {
        window.clearInterval(this.wsKeepaliveTimer);
        this.wsKeepaliveTimer = null;
      }
      if (this.ws) {
        try {
          this.ws.close();
        } catch {
          // Ignore
        }
        this.ws = null;
      }
    }

    this.intentionalDisconnect = false;
    this.lastConnectParams = { code, paletteIndex, playerName, role };
    this.roomCode = code;
    const baseUrl = this.getWsBaseUrl();
    const encodedName = encodeURIComponent(playerName.trim().slice(0, 14) || 'Arek');
    const roleQuery = role === 'monitor' ? '&role=monitor' : '';
    const slotQuery = isReconnect && this.localPlayerId ? `&slot=${encodeURIComponent(this.localPlayerId)}` : '';
    const wsUrl = `${baseUrl}/room/${code}?palette=${paletteIndex}&name=${encodedName}${roleQuery}${slotQuery}`;

    if (!isReconnect) {
      const modeLabel =
        this.connectionMode === 'hotspot' ? 'Local Room' : 'Cloudflare Server Room';
      this.callbacks.onStatus(`Menghubungkan ke ${modeLabel} (${code})...`);
    }

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    this.connectTimeout = window.setTimeout(() => {
      if (this.ws === ws && ws.readyState !== WebSocket.OPEN) {
        if (this.hasOpenUdp()) {
          // Keep playing over live WebRTC UDP even if signaling WS timed out
          this.scheduleReconnect();
          return;
        }
        if (isReconnect && this.reconnectAttempts < 15) {
          this.scheduleReconnect();
          return;
        }
        this.callbacks.onStatus(
          this.connectionMode === 'hotspot'
            ? `Gagal terhubung ke Local Room ${code}. Pastikan berada di 1 jaringan yang sama & cek koneksi!`
            : `Gagal terhubung ke Room ${code}. Cek koneksi internetmu!`,
          true
        );
        this.disconnect(true);
        if (isReconnect) {
          this.callbacks.onDisconnect('Koneksi ke room terputus.');
        }
      }
    }, 10000);

    ws.onopen = () => {
      if (this.connectTimeout !== null) {
        window.clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      this.reconnectAttempts = 0;
      this.connected = true;
      if (!isReconnect) {
        this.callbacks.onStatus(`Terhubung ke Room ${code}!`);
      }
      if (this.pingTimer === null) {
        this.pingTimer = window.setInterval(() => this.measurePing(), 2000);
      }
      // Aggressive WS keepalive every 8s so Cloudflare & 4G/WiFi NAT routers never drop idle WS!
      if (this.wsKeepaliveTimer !== null) {
        window.clearInterval(this.wsKeepaliveTimer);
      }
      this.wsKeepaliveTimer = window.setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendWs({ type: 'ping', ts: performance.now() });
        }
      }, 8000);
      this.measurePing();
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
      } else if (msg.type === 'pong') {
        this.pingMs = Math.max(1, Math.round(performance.now() - msg.ts));
      } else if (msg.type === 'lobby_update') {
        this.roomCode = msg.roomCode;
        this.lobbyPlayers = msg.players;
        this.localPlayerId = msg.yourPlayerId;
        this.isHost = msg.isHost;

        if (this.isHost) {
          this.ensureHostRtcConnections(msg.players);
        }

        const prefix = this.connectionMode === 'hotspot' ? '[HOTSPOT] ' : '';
        this.callbacks.onStatus(
          msg.isHost
            ? `${prefix}Room ${msg.roomCode} siap! Jalur: ${this.transportMode} (${this.pingMs}ms)`
            : `${prefix}Bergabung di Room ${msg.roomCode}! Menunggu Host mulai...`
        );
        this.callbacks.onLobbyUpdate(msg.roomCode, msg.players, msg.yourPlayerId, msg.isHost);
      } else if (msg.type === 'rtc_signal') {
        this.handleRtcSignal(msg.from, msg.data);
      } else if (msg.type === 'relay') {
        this.handleGamePayload(msg.from, msg.payload);
      } else if (msg.type === 'peer_left') {
        this.cleanupPeer(msg.id);
        this.callbacks.onPeerLeft?.(msg.id);
      } else if (msg.type === 'monitor_lost') {
        const reason = msg.reason || 'Sinyal Monitor goyang, menunggu tersambung kembali...';
        this.callbacks.onStatus(`⚠️ ${reason}`, false);
      } else if (msg.type === 'monitor_resumed') {
        this.callbacks.onStatus('✅ Monitor tersambung kembali!', false);
        this.refreshTransportMode();
        this.measurePing();
      } else if (msg.type === 'monitor_closed') {
        const reason = msg.reason || 'Monitor keluar! Semua Stick HP otomatis terputus.';
        this.disconnect(true);
        this.callbacks.onDisconnect(reason);
      } else if (msg.type === 'start_game') {
        this.lastSentHeld = '';
        this.serverPlayerTargets.clear();
        this.serverEnemyTargets.clear();
        this.callbacks.onGameStart();
      } else if (msg.type === 'in_match') {
        this.lastSentHeld = '';
        this.callbacks.onMatchResume?.();
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.wsKeepaliveTimer !== null) {
        window.clearInterval(this.wsKeepaliveTimer);
        this.wsKeepaliveTimer = null;
      }
      if (this.intentionalDisconnect || !this.connected) return;

      // Never kick player out if WebRTC UDP is still alive — silently reconnect signaling WS!
      if (this.hasOpenUdp()) {
        this.scheduleReconnect();
        return;
      }

      // Up to 15 automatic reconnect attempts (covers ~35s of temporary Wi-Fi / Hotspot drop)
      if (this.reconnectAttempts < 15 && this.lastConnectParams) {
        this.callbacks.onStatus(
          `Sinyal goyang, menyambung ulang (${this.reconnectAttempts + 1}/15)...`,
          false
        );
        this.scheduleReconnect();
        return;
      }

      this.disconnect(true);
      this.callbacks.onDisconnect('Koneksi ke room terputus setelah 15x percobaan.');
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      if (!this.hasOpenUdp() && !this.connected) {
        this.callbacks.onStatus('Gagal terhubung ke Room Server.', true);
      }
    };
  }

  private hasOpenUdp(): boolean {
    return [...this.dcs.values()].some((dc) => dc.readyState === 'open');
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect || !this.lastConnectParams) return;
    if (this.reconnectTimer !== null) return;
    this.reconnectAttempts++;
    const delayMs = Math.min(3000, 800 + 200 * this.reconnectAttempts);
    const params = this.lastConnectParams;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.intentionalDisconnect || !this.lastConnectParams) return;
      this.connectToRoom(params.code, params.paletteIndex, params.playerName, params.role, true);
    }, delayMs);
  }

  private cleanupPeer(peerId: string): void {
    this.remoteInputs.delete(peerId);
    this.pendingIce.delete(peerId);
    const dc = this.dcs.get(peerId);
    if (dc) {
      try {
        dc.close();
      } catch {
        // Ignore
      }
      this.dcs.delete(peerId);
    }
    const pc = this.pcs.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // Ignore
      }
      this.pcs.delete(peerId);
    }
    this.refreshTransportMode();
  }

  private refreshTransportMode(): void {
    const anyUdpOpen = [...this.dcs.values()].some((dc) => dc.readyState === 'open');
    this.transportMode = anyUdpOpen ? 'UDP' : 'WSS';
  }

  private ensureHostRtcConnections(players: LobbyPlayer[]): void {
    if (typeof RTCPeerConnection === 'undefined') return;
    for (const p of players) {
      if (p.id === this.localPlayerId || this.pcs.has(p.id)) continue;
      this.startRtcOffer(p.id);
    }
  }

  private async startRtcOffer(targetId: string): Promise<void> {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.pcs.set(targetId, pc);

      // Unordered, zero-retransmit UDP DataChannel = true realtime gaming!
      const dc = pc.createDataChannel('game', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.bindDataChannel(targetId, dc);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendWs({
            type: 'rtc_signal',
            to: targetId,
            data: { kind: 'ice', candidate: e.candidate.toJSON() },
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        this.refreshTransportMode();
        if (pc.iceConnectionState === 'failed') {
          try {
            if ('restartIce' in pc && typeof pc.restartIce === 'function') {
              pc.restartIce();
            }
          } catch {}
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendWs({
        type: 'rtc_signal',
        to: targetId,
        data: { kind: 'offer', sdp: offer },
      });
    } catch {
      // Silently stay on WSS relay fallback
    }
  }

  private async handleRtcSignal(fromId: string, data: RtcSignalData): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') return;
    try {
      if (data.kind === 'offer') {
        this.cleanupPeer(fromId);
        const pc = new RTCPeerConnection(RTC_CONFIG);
        this.pcs.set(fromId, pc);

        pc.ondatachannel = (evt) => {
          this.bindDataChannel(fromId, evt.channel);
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            this.sendWs({
              type: 'rtc_signal',
              to: fromId,
              data: { kind: 'ice', candidate: e.candidate.toJSON() },
            });
          }
        };

        pc.oniceconnectionstatechange = () => {
          this.refreshTransportMode();
          if (pc.iceConnectionState === 'failed') {
            try {
              if ('restartIce' in pc && typeof pc.restartIce === 'function') {
                pc.restartIce();
              }
            } catch {}
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await this.flushPendingIce(fromId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendWs({
          type: 'rtc_signal',
          to: fromId,
          data: { kind: 'answer', sdp: answer },
        });
      } else if (data.kind === 'answer') {
        const pc = this.pcs.get(fromId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await this.flushPendingIce(fromId, pc);
        }
      } else if (data.kind === 'ice') {
        const pc = this.pcs.get(fromId);
        if (data.candidate) {
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            // Queue ICE candidate until remoteDescription is set (fixes UDP failing on fast LAN/Hotspot!)
            const queue = this.pendingIce.get(fromId) ?? [];
            queue.push(data.candidate);
            this.pendingIce.set(fromId, queue);
          }
        }
      }
    } catch {
      // Silently stay on WSS relay fallback
    }
  }

  private async flushPendingIce(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const queue = this.pendingIce.get(peerId);
    if (!queue || queue.length === 0) return;
    this.pendingIce.delete(peerId);
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // Ignore stale candidate
      }
    }
  }

  private bindDataChannel(peerId: string, dc: RTCDataChannel): void {
    this.dcs.set(peerId, dc);
    dc.onopen = () => {
      this.refreshTransportMode();
      this.measurePing();
    };
    dc.onclose = () => {
      this.refreshTransportMode();
    };
    dc.onmessage = (evt) => {
      if (typeof evt.data !== 'string') return;
      try {
        const payload = JSON.parse(evt.data) as GameNetPayload;
        this.handleGamePayload(peerId, payload);
      } catch {
        // Ignore malformed packet
      }
    };
  }

  private measurePing(): void {
    if (!this.connected) return;
    const now = performance.now();
    if (!this.isHost) {
      const hostId = this.lobbyPlayers.find((p) => p.isHost)?.id;
      const hostDc = hostId ? this.dcs.get(hostId) : undefined;
      if (hostDc && hostDc.readyState === 'open') {
        hostDc.send(JSON.stringify({ t: 'ping', ts: now } satisfies GameNetPayload));
        return;
      }
    }
    this.sendWs({ type: 'ping', ts: now });
  }

  private sendPayloadToHost(payload: GameNetPayload): void {
    const hostId = this.lobbyPlayers.find((p) => p.isHost)?.id;
    if (hostId) {
      const dc = this.dcs.get(hostId);
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(payload));
          return;
        } catch {
          // Fall back to WSS
        }
      }
    }
    this.sendWs({ type: 'relay', to: hostId, payload });
  }

  private sendPayloadToPeer(peerId: string, payload: GameNetPayload): void {
    const dc = this.dcs.get(peerId);
    if (dc && dc.readyState === 'open') {
      if (payload.t === 'snap' && dc.bufferedAmount > 8192) return;
      try {
        dc.send(JSON.stringify(payload));
        return;
      } catch {
        // Fall back to WSS
      }
    }
    if (payload.t === 'snap' && this.ws && this.ws.bufferedAmount > 4096) {
      return;
    }
    this.sendWs({ type: 'relay', to: peerId, payload });
  }

  private handleGamePayload(fromId: string, payload: GameNetPayload): void {
    if (payload.t === 'ping') {
      this.sendPayloadToPeer(fromId, { t: 'pong', ts: payload.ts });
      return;
    }
    if (payload.t === 'pong') {
      this.pingMs = Math.max(1, Math.round(performance.now() - payload.ts));
      this.refreshTransportMode();
      return;
    }
    if (payload.t === 'in' && this.isHost) {
      const prev = this.remoteInputs.get(fromId);
      const next = payload.i;
      this.remoteInputs.set(fromId, {
        up: Boolean(next.up),
        down: Boolean(next.down),
        left: Boolean(next.left),
        right: Boolean(next.right),
        moveX: next.moveX,
        moveY: next.moveY,
        jumpPressed: Boolean(prev?.jumpPressed) || Boolean(next.jumpPressed),
        dashPressed: Boolean(prev?.dashPressed) || Boolean(next.dashPressed),
        meleePressed: Boolean(prev?.meleePressed) || Boolean(next.meleePressed),
        projPressed: Boolean(prev?.projPressed) || Boolean(next.projPressed),
        ultPressed: Boolean(prev?.ultPressed) || Boolean(next.ultPressed),
        shopPressed: false,
      });
      return;
    }
    if (payload.t === 'snap' && !this.isHost) {
      this.callbacks.onCompactSnapshot(payload.s);
      return;
    }
    if (payload.t === 'buy' && this.isHost) {
      const res = this.callbacks.onRemoteBuy(fromId, payload.item);
      this.sendPayloadToPeer(fromId, { t: 'shop_res', ok: res.ok, msg: res.message });
      return;
    }
    if (payload.t === 'shop_res' && !this.isHost) {
      this.callbacks.onShopResult(payload.ok, payload.msg);
      return;
    }
    if (payload.t === 'buff' && this.isHost) {
      this.callbacks.onRemoteBuff(fromId, payload.id);
      return;
    }
    if (payload.t === 'skip' && this.isHost) {
      this.callbacks.onRemoteSkip();
    }
  }

  public sendSetProfile(name: string, paletteIndex: number): void {
    this.sendWs({
      type: 'set_profile',
      name: name.trim().slice(0, 14) || 'Arek',
      paletteIndex,
    });
  }

  public sendPickBuff(buffId: BuffId): void {
    this.sendPayloadToHost({ t: 'buff', id: buffId });
  }

  public sendStartGame(): void {
    if (!this.isHost) return;
    this.sendWs({ type: 'start' });
  }

  public broadcastCompactSnapshot(state: GameState, sounds: SoundEvent[]): void {
    if (!this.isHost || !this.connected) return;
    let fullSnap: CompactSnapshot | null = null;
    let fullJson = '';

    for (const p of this.lobbyPlayers) {
      if (p.id === this.localPlayerId) continue;

      if (p.role === 'stick') {
        // Ultra-mini (~120B) snapshot for Stick HP controllers (< 1 KB/s, smooth on 1 Mbps!)
        const stickSnap = packStickSnapshot(state, p.id);
        this.sendPayloadToPeer(p.id, { t: 'snap', s: stickSnap });
        continue;
      }

      if (!fullSnap) {
        fullSnap = packCompactSnapshot(state, sounds);
        fullJson = JSON.stringify({ t: 'snap', s: fullSnap } satisfies GameNetPayload);
      }
      const dc = this.dcs.get(p.id);
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(fullJson);
          continue;
        } catch {
          // Fallback to WSS below
        }
      }
      // Anti-bufferbloat guard on WSS TCP: drop non-critical snapshot if socket buffer is backed up
      if (this.ws && this.ws.bufferedAmount > 4096 && sounds.length === 0) {
        continue;
      }
      this.sendWs({
        type: 'relay',
        to: p.id,
        payload: { t: 'snap', s: fullSnap } satisfies GameNetPayload,
      });
    }
  }

  public getRemoteInput(playerId: string): PlayerInput | undefined {
    const inp = this.remoteInputs.get(playerId);
    if (!inp) return undefined;
    const copy: PlayerInput = { ...inp };
    inp.jumpPressed = false;
    inp.dashPressed = false;
    inp.meleePressed = false;
    inp.projPressed = false;
    inp.ultPressed = false;
    inp.shopPressed = false;
    return copy;
  }

  public sendDeltaInput(input: PlayerInput): void {
    if (!this.connected || this.isHost) return;

    const now = performance.now();
    // Guarantee active WS keepalive even if browser throttles background setInterval
    if (now - this.lastWsPingTs > 8000) {
      this.lastWsPingTs = now;
      this.sendWs({ type: 'ping', ts: now });
    }

    // High-precision analog movement:
    // When on Local/Hotspot mode or good ping (< 100ms): 40Hz (25ms interval) with 0.05 step precision!
    // When low-bandwidth or laggy: 20Hz (50ms interval) with 0.1 step precision.
    const isFastLink = this.connectionMode === 'hotspot' || (!this.lowBandwidthMode && this.pingMs < 100);
    const stepMult = isFastLink ? 20 : 10;
    const minIntervalMs = isFastLink ? 25 : 50;

    const qx = typeof input.moveX === 'number' ? Math.round(input.moveX * stepMult) / stepMult : 0;
    const qy = typeof input.moveY === 'number' ? Math.round(input.moveY * stepMult) / stepMult : 0;
    const heldSig = `${input.up ? 1 : 0}${input.down ? 1 : 0}${input.left ? 1 : 0}${input.right ? 1 : 0}:${qx},${qy}`;
    const hasAction =
      input.jumpPressed ||
      input.dashPressed ||
      input.meleePressed ||
      input.projPressed ||
      input.ultPressed;

    if (heldSig === this.lastSentHeld && !hasAction) {
      return;
    }

    const isStopping = qx === 0 && qy === 0 && !input.up && !input.down && !input.left && !input.right;
    if (!hasAction && !isStopping && now - this.lastMoveSendTs < minIntervalMs) {
      return;
    }

    this.lastSentHeld = heldSig;
    this.lastMoveSendTs = now;
    this.sendPayloadToHost({
      t: 'in',
      i: {
        ...input,
        moveX: qx,
        moveY: qy,
      },
    });
  }

  public sendBuy(itemId: ShopItemId): void {
    this.sendPayloadToHost({ t: 'buy', item: itemId });
  }

  public sendSkipIntermission(): void {
    this.sendPayloadToHost({ t: 'skip' });
  }

  public mergeSnapshot(renderState: GameState, snap: CompactSnapshot): void {
    mergeCompactSnapshot(
      renderState,
      snap,
      this.localPlayerId,
      this.serverPlayerTargets,
      this.serverEnemyTargets,
      this.isStickClient
    );
  }

  /**
   * 0ms Client-Side Action & Movement Prediction + 60 FPS Entity Interpolation.
   * Pressing Kibas, Pecut, Dash, or Jump on Client triggers visuals & sound at 0ms!
   */
  public applyPredictionAndLerp(
    renderState: GameState,
    localInput: PlayerInput,
    dt: number,
    playLocalSfx: (ev: SoundEvent) => void
  ): void {
    if (renderState.status !== 'playing') return;

    const lerpAlpha = Math.min(1, dt * 16);

    for (const rp of renderState.players) {
      const tp = this.serverPlayerTargets.get(rp.id);

      if (rp.id === this.localPlayerId && !rp.knockedDown) {
        const pal = PLAYER_PALETTES[rp.paletteIndex % PLAYER_PALETTES.length];
        if (rp.dashCooldown > 0) rp.dashCooldown = Math.max(0, rp.dashCooldown - dt);
        if (rp.meleeTimer > 0) rp.meleeTimer = Math.max(0, rp.meleeTimer - dt);
        if (rp.meleeCooldown > 0) rp.meleeCooldown = Math.max(0, rp.meleeCooldown - dt);
        if (rp.projCooldown > 0) rp.projCooldown = Math.max(0, rp.projCooldown - dt);
        if (rp.z === 0) rp.jumpsRemaining = 2;

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
          if (rp.dashTimer <= 0) {
            rp.dirX = ix / cl;
            rp.dirY = iy / cl;
          }
        }

        // Instant 0ms Local Action Prediction
        if (localInput.dashPressed && rp.dashCooldown <= 0 && rp.dashTimer <= 0) {
          rp.dashDirX = rp.dirX;
          rp.dashDirY = rp.dirY;
          rp.dashTimer = DASH_DURATION;
          rp.dashCooldown = DASH_COOLDOWN * (rp.cdMult || 1);
          playLocalSfx('dash');
        }
        if (localInput.jumpPressed && rp.jumpsRemaining > 0) {
          const first = rp.z === 0;
          rp.vz = first ? JUMP_VZ : DOUBLE_JUMP_VZ;
          rp.jumpsRemaining = first ? 1 : rp.jumpsRemaining - 1;
          playLocalSfx(first ? 'jump' : 'double_jump');
        }
        if (localInput.meleePressed && rp.meleeCooldown <= 0 && rp.ultActiveTimer <= 0) {
          rp.meleeTimer = MELEE_DURATION;
          rp.meleeCooldown = MELEE_COOLDOWN * (rp.cdMult || 1);
          rp.meleeComboStep = (rp.meleeComboStep + 1) % 2;
          rp.meleeAngle = Math.atan2(rp.dirY, rp.dirX);
          playLocalSfx('kibas');
          renderState.slashes.push({
            x: rp.x + rp.dirX * 26,
            y: rp.y - rp.z - 18 + rp.dirY * 22,
            angle: rp.meleeAngle,
            color: pal.sarung,
            stripeColor: pal.sarungStripe,
            life: 0.16,
            maxLife: 0.16,
            comboStep: rp.meleeComboStep,
          });
        }
        if (localInput.projPressed && rp.projCooldown <= 0 && rp.ultActiveTimer <= 0) {
          rp.projCooldown = PROJ_COOLDOWN * (rp.cdMult || 1);
          playLocalSfx('pecut');
          renderState.projectiles.push({
            id: -Math.floor(Math.random() * 100000),
            ownerId: rp.id,
            x: rp.x + rp.dirX * 22,
            y: rp.y + rp.dirY * 18,
            vx: rp.dirX * PROJ_SPEED,
            vy: rp.dirY * PROJ_SPEED,
            angle: Math.atan2(rp.dirY, rp.dirX),
            radius: PROJ_RADIUS,
            damage: PROJ_DAMAGE,
            pierceLeft: PROJ_MAX_PIERCE,
            hitIds: [],
            life: PROJ_LIFETIME,
            maxLife: PROJ_LIFETIME,
            color: pal.sarungStripe,
          });
        }
        if (localInput.ultPressed && rp.ult >= rp.maxUlt && rp.ultActiveTimer <= 0) {
          rp.ultActiveTimer = ULT_DURATION;
          playLocalSfx('ult_start');
        }

        if (rp.dashTimer > 0) {
          rp.dashTimer = Math.max(0, rp.dashTimer - dt);
          rp.vx = rp.dashDirX * DASH_SPEED;
          rp.vy = rp.dashDirY * DASH_SPEED;
        } else {
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

        // Smooth reconciliation toward server position
        if (tp) {
          const drift = Math.hypot(tp.x - rp.x, tp.y - rp.y);
          if (drift > 90) {
            rp.x = tp.x;
            rp.y = tp.y;
            rp.z = tp.z;
          } else {
            const recon = Math.min(1, dt * 8);
            rp.x += (tp.x - rp.x) * recon;
            rp.y += (tp.y - rp.y) * recon;
            rp.z += (tp.z - rp.z) * recon;
          }
        }
      } else if (tp) {
        rp.x += (tp.x - rp.x) * lerpAlpha;
        rp.y += (tp.y - rp.y) * lerpAlpha;
        rp.z += (tp.z - rp.z) * lerpAlpha;
      }

      rp.animTime += dt * (Math.hypot(rp.vx, rp.vy) > 20 ? 12 : 3);
    }

    for (const re of renderState.enemies) {
      const te = this.serverEnemyTargets.get(re.id);
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
    for (let i = renderState.slashes.length - 1; i >= 0; i--) {
      renderState.slashes[i].life -= dt;
      if (renderState.slashes[i].life <= 0) renderState.slashes.splice(i, 1);
    }
  }

  private sendWs(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(data));
    } catch {
      // Ignore transient send error
    }
  }
}
