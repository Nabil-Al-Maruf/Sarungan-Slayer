import { DurableObject } from 'cloudflare:workers';
import { PLAYER_PALETTES } from '../src/core/constants';

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
}

export type LobbyRole = 'player' | 'monitor' | 'stick';

export interface LobbyPlayer {
  id: string;
  paletteIndex: number;
  name: string;
  customName: string;
  isHost: boolean;
  role: LobbyRole;
}

interface ClientSession {
  ws: WebSocket;
  id: string;
  paletteIndex: number;
  customName: string;
  name: string;
  isHost: boolean;
  role: LobbyRole;
  disconnectedAt?: number;
}

type ClientMsg =
  | { type: 'set_profile'; name: string; paletteIndex: number }
  | { type: 'start' }
  | { type: 'rtc_signal'; to: string; data: unknown }
  | { type: 'relay'; to?: string; payload: unknown }
  | { type: 'ping'; ts: number };

function formatLobbyDisplayName(
  slotId: string,
  customName: string,
  paletteIndex: number,
  isHost: boolean,
  role: LobbyRole = 'player'
): string {
  const clean =
    customName.trim().slice(0, 14) ||
    (paletteIndex >= 0 ? PLAYER_PALETTES[paletteIndex % PLAYER_PALETTES.length].name.split(' ')[1] : 'Layar');
  if (role === 'monitor') {
    return `📺 MONITOR • ${clean}`;
  }
  if (role === 'stick') {
    return `🎮 ${slotId.toUpperCase()} • ${clean} (STICK)`;
  }
  return `${slotId.toUpperCase()} • ${clean}${isHost ? ' (HOST)' : ''}`;
}

export class GameRoom extends DurableObject<Env> {
  private roomCode = '';
  private sessions = new Map<WebSocket, ClientSession>();
  private sessionsById = new Map<string, ClientSession>();
  private inMatch = false;
  private monitorGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || 'ROOM').toUpperCase().slice(0, 4);
    const preferredPalette = Math.abs(Number(url.searchParams.get('palette') || '0') || 0) % PLAYER_PALETTES.length;
    const rawName = (url.searchParams.get('name') || '').trim().slice(0, 14);
    const reqRole = url.searchParams.get('role') === 'monitor' ? 'monitor' : 'player';
    const reqSlot = (url.searchParams.get('slot') || '').trim();
    this.roomCode = code;

    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({
        roomCode: this.roomCode,
        players: this.sessionsById.size,
        inGame: this.inMatch,
      });
    }

    const pair = new WebSocketPair();
    const [clientWs, serverWs] = Object.values(pair);
    serverWs.accept();

    // 1. RECLAIM MONITOR SESSION (Grace period or temporary disconnect)
    if (reqRole === 'monitor') {
      const existingMonitor = this.sessionsById.get('monitor');
      if (existingMonitor) {
        if (this.monitorGraceTimer !== null) {
          clearTimeout(this.monitorGraceTimer);
          this.monitorGraceTimer = null;
        }
        const oldWs = existingMonitor.ws;
        this.sessions.delete(oldWs);
        existingMonitor.ws = serverWs;
        existingMonitor.disconnectedAt = undefined;
        this.sessions.set(serverWs, existingMonitor);
        this.bindSocket(serverWs, existingMonitor);

        try {
          oldWs.close(1000, 'Replaced by reconnect');
        } catch {}

        // Notify all stick controllers that Monitor is back!
        const resumeMsg = JSON.stringify({
          type: 'monitor_resumed',
          reason: 'Monitor tersambung kembali!',
        });
        for (const s of this.sessions.values()) {
          if (s.id !== 'monitor') {
            try {
              s.ws.send(resumeMsg);
            } catch {}
          }
        }

        this.broadcastLobby();
        // NEVER send start_game to monitor on reconnect! Monitor is the host running the match.
        if (this.inMatch) {
          this.safeSend(serverWs, { type: 'in_match' });
        }
        return new Response(null, { status: 101, webSocket: clientWs });
      }
    }

    // 2. RECLAIM STICK / PLAYER SLOT (Mobile screen lock/unlock or signal flicker)
    if (reqSlot && this.sessionsById.has(reqSlot)) {
      const existing = this.sessionsById.get(reqSlot)!;
      const graceTimer = this.disconnectGraceTimers.get(reqSlot);
      if (graceTimer) {
        clearTimeout(graceTimer);
        this.disconnectGraceTimers.delete(reqSlot);
      }
      const oldWs = existing.ws;
      this.sessions.delete(oldWs);
      existing.ws = serverWs;
      existing.disconnectedAt = undefined;
      this.sessions.set(serverWs, existing);
      this.bindSocket(serverWs, existing);

      try {
        oldWs.close(1000, 'Replaced by reconnect');
      } catch {}

      this.broadcastLobby();
      // Send in_match, NEVER start_game (which wipes active game and resets to Wave 1)!
      if (this.inMatch) {
        this.safeSend(serverWs, { type: 'in_match' });
      }
      return new Response(null, { status: 101, webSocket: clientWs });
    }

    // 3. NEW PLAYER / MONITOR REGISTRATION
    const activeFighters = [...this.sessionsById.values()].filter((s) => s.role !== 'monitor');
    if (activeFighters.length >= 5) {
      this.safeSend(serverWs, { type: 'room_full' });
      serverWs.close(1008, 'Room full');
      return new Response(null, { status: 101, webSocket: clientWs });
    }

    const hasMonitor = [...this.sessionsById.values()].some((s) => s.role === 'monitor');
    const isHost = this.sessionsById.size === 0;
    const role: LobbyRole = isHost && reqRole === 'monitor' ? 'monitor' : hasMonitor ? 'stick' : 'player';

    let playerId = 'monitor';
    let paletteIndex = -1;
    let customName = rawName || 'Monitor';

    if (role !== 'monitor') {
      const usedIds = new Set([...this.sessionsById.values()].map((s) => s.id));
      let slotNum = 1;
      while (usedIds.has(`p${slotNum}`) && slotNum <= 5) slotNum++;
      playerId = `p${slotNum}`;
      paletteIndex = this.pickUniquePalette(preferredPalette);
      const pal = PLAYER_PALETTES[paletteIndex];
      customName = rawName || pal.name.split(' ')[1];
    }

    const session: ClientSession = {
      ws: serverWs,
      id: playerId,
      paletteIndex,
      customName,
      name: formatLobbyDisplayName(playerId, customName, paletteIndex, isHost, role),
      isHost,
      role,
    };
    this.sessions.set(serverWs, session);
    this.sessionsById.set(playerId, session);
    this.bindSocket(serverWs, session);

    this.broadcastLobby();
    if (this.inMatch) {
      this.safeSend(serverWs, { type: 'in_match' });
    }
    return new Response(null, { status: 101, webSocket: clientWs });
  }

  private bindSocket(serverWs: WebSocket, session: ClientSession): void {
    serverWs.addEventListener('message', (evt) => {
      this.handleMessage(session, evt.data);
    });

    serverWs.addEventListener('close', () => {
      this.handleDisconnect(session, serverWs);
    });

    serverWs.addEventListener('error', () => {
      this.handleDisconnect(session, serverWs);
    });
  }

  private handleMessage(session: ClientSession, raw: unknown): void {
    if (typeof raw !== 'string') return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }

    if (msg.type === 'ping') {
      this.safeSend(session.ws, { type: 'pong', ts: msg.ts });
      return;
    }

    if (msg.type === 'set_profile') {
      const cleanName =
        (typeof msg.name === 'string' ? msg.name.trim().slice(0, 14) : '') || session.customName;
      session.customName = cleanName;
      if (session.role !== 'monitor' && typeof msg.paletteIndex === 'number') {
        const palIdx = Math.abs(Math.floor(msg.paletteIndex)) % PLAYER_PALETTES.length;
        if (!this.isPaletteTaken(palIdx, session)) {
          session.paletteIndex = palIdx;
        }
      }
      session.name = formatLobbyDisplayName(
        session.id,
        cleanName,
        session.paletteIndex,
        session.isHost,
        session.role
      );
      this.broadcastLobby();
      return;
    }

    if (msg.type === 'rtc_signal') {
      // Forward WebRTC SDP/ICE directly to target peer
      for (const target of this.sessions.values()) {
        if (target.id === msg.to) {
          this.safeSend(target.ws, {
            type: 'rtc_signal',
            from: session.id,
            data: msg.data,
          });
          break;
        }
      }
      return;
    }

    if (msg.type === 'relay') {
      // WSS Fallback Relay (used only if WebRTC UDP DataChannel is blocked by strict NAT)
      if (msg.to) {
        for (const target of this.sessions.values()) {
          if (target.id === msg.to) {
            this.safeSend(target.ws, {
              type: 'relay',
              from: session.id,
              payload: msg.payload,
            });
            break;
          }
        }
      } else {
        const out = JSON.stringify({
          type: 'relay',
          from: session.id,
          payload: msg.payload,
        });
        for (const target of this.sessions.values()) {
          if (target.id !== session.id && target.ws.readyState === WebSocket.OPEN) {
            try {
              target.ws.send(out);
            } catch {
              // Ignore closed socket
            }
          }
        }
      }
      return;
    }

    if (msg.type === 'start' && session.isHost) {
      this.inMatch = true;
      const out = JSON.stringify({ type: 'start_game' });
      for (const s of this.sessions.values()) {
        try {
          s.ws.send(out);
        } catch {
          // Ignore
        }
      }
    }
  }

  private handleDisconnect(session: ClientSession, closedWs: WebSocket): void {
    // If session already reconnected with a newer socket, ignore this old socket closing!
    if (session.ws !== closedWs) return;
    if (!this.sessions.has(closedWs)) return;
    this.sessions.delete(closedWs);
    session.disconnectedAt = Date.now();

    // 1. MONITOR TEMPORARY DISCONNECT (Network jitter / Wi-Fi sleep)
    // Never kick all sticks immediately! Provide a 25s grace period for monitor to reconnect.
    if (session.role === 'monitor') {
      const lostMsg = JSON.stringify({
        type: 'monitor_lost',
        reason: 'Sinyal Monitor goyang, menunggu tersambung kembali...',
      });
      for (const s of this.sessions.values()) {
        try {
          s.ws.send(lostMsg);
        } catch {}
      }

      if (this.monitorGraceTimer !== null) {
        clearTimeout(this.monitorGraceTimer);
      }
      this.monitorGraceTimer = setTimeout(() => {
        this.monitorGraceTimer = null;
        const mon = this.sessionsById.get('monitor');
        if (mon && mon.disconnectedAt) {
          // Monitor did not return within 25 seconds: officially close room
          const closeMsg = JSON.stringify({
            type: 'monitor_closed',
            reason: 'Monitor tidak tersambung kembali setelah 25 detik. Permainan berakhir.',
          });
          for (const s of this.sessions.values()) {
            try {
              s.ws.send(closeMsg);
              s.ws.close(1000, 'Monitor timeout');
            } catch {}
          }
          this.sessions.clear();
          this.sessionsById.clear();
          this.inMatch = false;
        }
      }, 25000);
      return;
    }

    // 2. STICK HP / PLAYER TEMPORARY DISCONNECT (Screen lock/unlock or Wi-Fi glitch)
    // Keep their slot reserved for 25s so they can reclaim it smoothly
    const stickTimer = setTimeout(() => {
      this.disconnectGraceTimers.delete(session.id);
      const s = this.sessionsById.get(session.id);
      if (s && s.disconnectedAt) {
        // Player did not return within 25s: officially remove them
        this.sessionsById.delete(session.id);
        const leftMsg = JSON.stringify({ type: 'peer_left', id: session.id });
        for (const rem of this.sessions.values()) {
          try {
            rem.ws.send(leftMsg);
          } catch {}
        }
        this.broadcastLobby();
      }
    }, 25000);
    this.disconnectGraceTimers.set(session.id, stickTimer);
  }

  private isPaletteTaken(paletteIndex: number, exclude?: ClientSession): boolean {
    for (const s of this.sessionsById.values()) {
      if (s !== exclude && s.role !== 'monitor' && s.paletteIndex === paletteIndex) {
        return true;
      }
    }
    return false;
  }

  private pickUniquePalette(preferred: number, exclude?: ClientSession): number {
    if (!this.isPaletteTaken(preferred, exclude)) return preferred;
    for (let i = 0; i < PLAYER_PALETTES.length; i++) {
      if (!this.isPaletteTaken(i, exclude)) return i;
    }
    return preferred;
  }

  private broadcastLobby(): void {
    const players: LobbyPlayer[] = [...this.sessionsById.values()].map((s) => ({
      id: s.id,
      paletteIndex: s.paletteIndex,
      name: s.name,
      customName: s.customName,
      isHost: s.isHost,
      role: s.role,
    }));

    for (const s of this.sessions.values()) {
      this.safeSend(s.ws, {
        type: 'lobby_update',
        roomCode: this.roomCode,
        players,
        yourPlayerId: s.id,
        isHost: s.isHost,
      });
    }
  }

  private safeSend(ws: WebSocket, data: unknown): void {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // Ignore closed socket
    }
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/') {
      return Response.json(
        {
          ok: true,
          service: 'arek-sarungan-slayer-mp',
          version: '1.7.0',
          transport: 'webrtc-udp+wss-fallback',
        },
        { headers: CORS_HEADERS }
      );
    }

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
    if (match) {
      const code = match[1].toUpperCase();
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('code', code);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  },
};
