import { DurableObject } from 'cloudflare:workers';
import { PLAYER_PALETTES } from '../src/core/constants';

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
}

export interface LobbyPlayer {
  id: string;
  paletteIndex: number;
  name: string;
  customName: string;
  isHost: boolean;
}

interface ClientSession {
  ws: WebSocket;
  id: string;
  paletteIndex: number;
  customName: string;
  name: string;
  isHost: boolean;
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
  isHost: boolean
): string {
  const pal = PLAYER_PALETTES[paletteIndex % PLAYER_PALETTES.length];
  const clean = customName.trim().slice(0, 14) || pal.name.split(' ')[1];
  return `${slotId.toUpperCase()} • ${clean}${isHost ? ' (HOST)' : ''}`;
}

export class GameRoom extends DurableObject<Env> {
  private roomCode = '';
  private sessions = new Map<WebSocket, ClientSession>();
  private inMatch = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || 'ROOM').toUpperCase().slice(0, 4);
    const preferredPalette = Number(url.searchParams.get('palette') || '0') || 0;
    const rawName = (url.searchParams.get('name') || '').trim().slice(0, 14);
    this.roomCode = code;

    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({
        roomCode: this.roomCode,
        players: this.sessions.size,
        inGame: this.inMatch,
      });
    }

    const pair = new WebSocketPair();
    const [clientWs, serverWs] = Object.values(pair);
    serverWs.accept();

    if (this.sessions.size >= 5) {
      this.safeSend(serverWs, { type: 'room_full' });
      serverWs.close(1008, 'Room full');
      return new Response(null, { status: 101, webSocket: clientWs });
    }

    const usedIds = new Set([...this.sessions.values()].map((s) => s.id));
    let slotNum = 1;
    while (usedIds.has(`p${slotNum}`) && slotNum <= 5) slotNum++;
    const playerId = `p${slotNum}`;
    const isHost = this.sessions.size === 0;
    const paletteIndex = preferredPalette % PLAYER_PALETTES.length;
    const pal = PLAYER_PALETTES[paletteIndex];
    const customName = rawName || pal.name.split(' ')[1];

    const session: ClientSession = {
      ws: serverWs,
      id: playerId,
      paletteIndex,
      customName,
      name: formatLobbyDisplayName(playerId, customName, paletteIndex, isHost),
      isHost,
    };
    this.sessions.set(serverWs, session);

    serverWs.addEventListener('message', (evt) => {
      this.handleMessage(session, evt.data);
    });

    serverWs.addEventListener('close', () => {
      this.handleDisconnect(session);
    });

    serverWs.addEventListener('error', () => {
      this.handleDisconnect(session);
    });

    this.broadcastLobby();
    return new Response(null, { status: 101, webSocket: clientWs });
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
      const palIdx =
        typeof msg.paletteIndex === 'number'
          ? Math.abs(Math.floor(msg.paletteIndex)) % PLAYER_PALETTES.length
          : session.paletteIndex;
      session.customName = cleanName;
      session.paletteIndex = palIdx;
      session.name = formatLobbyDisplayName(session.id, cleanName, palIdx, session.isHost);
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

  private handleDisconnect(session: ClientSession): void {
    if (!this.sessions.has(session.ws)) return;
    this.sessions.delete(session.ws);

    if (this.sessions.size === 0) {
      this.inMatch = false;
      return;
    }

    if (session.isHost) {
      const nextHost = this.sessions.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
        nextHost.name = formatLobbyDisplayName(
          nextHost.id,
          nextHost.customName,
          nextHost.paletteIndex,
          true
        );
      }
    }

    // Notify remaining peers that this player left
    const leftMsg = JSON.stringify({ type: 'peer_left', id: session.id });
    for (const s of this.sessions.values()) {
      try {
        s.ws.send(leftMsg);
      } catch {
        // Ignore
      }
    }

    this.broadcastLobby();
  }

  private broadcastLobby(): void {
    const players: LobbyPlayer[] = [...this.sessions.values()].map((s) => ({
      id: s.id,
      paletteIndex: s.paletteIndex,
      name: s.name,
      customName: s.customName,
      isHost: s.isHost,
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
          version: '1.3.0',
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
