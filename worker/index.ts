import { DurableObject } from 'cloudflare:workers';
import { FIXED_DT, PLAYER_PALETTES } from '../src/core/constants';
import type { BuffId, GameState, PlayerInput, SoundEvent } from '../src/core/types';
import {
  applyPlayerBuff,
  buyShopItem,
  createSurvivalState,
  skipIntermission,
  stepSurvival,
  type ShopItemId,
} from '../src/modes/survival';

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
  input: PlayerInput;
}

type ClientMsg =
  | { type: 'input'; input: PlayerInput }
  | { type: 'set_profile'; name: string; paletteIndex: number }
  | { type: 'pick_buff'; buffId: BuffId }
  | { type: 'start' }
  | { type: 'buy'; itemId: ShopItemId }
  | { type: 'skip_intermission' };

function makeIdleInput(): PlayerInput {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    jumpPressed: false,
    dashPressed: false,
    meleePressed: false,
    projPressed: false,
    ultPressed: false,
    shopPressed: false,
  };
}

function formatLobbyDisplayName(
  slotId: string,
  customName: string,
  paletteIndex: number,
  isHost: boolean
): string {
  const pal = PLAYER_PALETTES[paletteIndex % PLAYER_PALETTES.length];
  const clean = customName.trim().slice(0, 14) || pal.name.split(' ')[1];
  const slotLabel = slotId.toUpperCase();
  return `${slotLabel} • ${clean}${isHost ? ' (HOST)' : ''}`;
}

function buildSlimSnapshot(state: GameState, pendingSounds: SoundEvent[]): GameState {
  return {
    ...state,
    time: Math.round(state.time * 100) / 100,
    cameraX: Math.round(state.cameraX),
    shakeTimer: state.status === 'playing' ? Math.round(state.shakeTimer * 100) / 100 : 0,
    shakeIntensity: state.status === 'playing' ? state.shakeIntensity : 0,
    hitstopTimer: 0,
    particles: [],
    soundQueue: pendingSounds,
    players: state.players.map((p) => ({
      ...p,
      x: Math.round(p.x),
      y: Math.round(p.y),
      z: Math.round(p.z),
      vx: Math.round(p.vx),
      vy: Math.round(p.vy),
      vz: Math.round(p.vz),
      hp: Math.ceil(p.hp),
      ult: Math.floor(p.ult),
      projCooldown: Math.round(p.projCooldown * 10) / 10,
      ultActiveTimer: Math.round(p.ultActiveTimer * 100) / 100,
      meleeTimer: Math.round(p.meleeTimer * 100) / 100,
      scaleX: Math.round(p.scaleX * 100) / 100,
      scaleY: Math.round(p.scaleY * 100) / 100,
      animTime: Math.round(p.animTime * 10) / 10,
      afterimages: [],
    })),
    enemies: state.enemies.map((e) => ({
      ...e,
      x: Math.round(e.x),
      y: Math.round(e.y),
      z: Math.round(e.z),
      vx: Math.round(e.vx),
      vy: Math.round(e.vy),
      vz: Math.round(e.vz),
      hp: Math.ceil(e.hp),
      scaleX: Math.round(e.scaleX * 100) / 100,
      scaleY: Math.round(e.scaleY * 100) / 100,
      animTime: Math.round(e.animTime * 10) / 10,
    })),
    projectiles: state.projectiles.map((pr) => ({
      ...pr,
      x: Math.round(pr.x),
      y: Math.round(pr.y),
      vx: Math.round(pr.vx),
      vy: Math.round(pr.vy),
      angle: Math.round(pr.angle * 100) / 100,
    })),
    enemyProjectiles: state.enemyProjectiles.map((ep) => ({
      ...ep,
      x: Math.round(ep.x),
      y: Math.round(ep.y),
      vx: Math.round(ep.vx),
      vy: Math.round(ep.vy),
      angle: Math.round(ep.angle * 100) / 100,
    })),
    crates: state.crates.map((c) => ({
      ...c,
      x: Math.round(c.x),
      y: Math.round(c.y),
      z: Math.round(c.z),
    })),
    pickups: state.pickups.map((pk) => ({
      ...pk,
      x: Math.round(pk.x),
      y: Math.round(pk.y),
      z: Math.round(pk.z),
      bobPhase: Math.round(pk.bobPhase * 10) / 10,
    })),
    slashes: state.slashes.map((sl) => ({
      ...sl,
      x: Math.round(sl.x),
      y: Math.round(sl.y),
      angle: Math.round(sl.angle * 100) / 100,
    })),
    floatingTexts: state.floatingTexts.map((ft) => ({
      ...ft,
      x: Math.round(ft.x),
      y: Math.round(ft.y),
    })),
  };
}

export class GameRoom extends DurableObject<Env> {
  private roomCode = '';
  private sessions = new Map<WebSocket, ClientSession>();
  private state: GameState | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private tickCounter = 0;
  private pendingSounds: SoundEvent[] = [];

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
        inGame: this.state !== null && this.state.status === 'playing',
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
      input: makeIdleInput(),
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

    if (this.state && this.state.status === 'playing') {
      this.safeSend(serverWs, { type: 'start_game' });
      this.safeSend(serverWs, {
        type: 'snapshot',
        state: buildSlimSnapshot(this.state, []),
      });
    }

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

      if (this.state) {
        const p = this.state.players.find((pl) => pl.id === session.id);
        if (p) {
          p.name = cleanName;
          p.paletteIndex = palIdx;
        }
      }
      this.broadcastLobby();
      return;
    }

    if (msg.type === 'input' && msg.input) {
      const prev = session.input;
      const next = msg.input;
      session.input = {
        up: Boolean(next.up),
        down: Boolean(next.down),
        left: Boolean(next.left),
        right: Boolean(next.right),
        moveX: typeof next.moveX === 'number' ? Math.max(-1, Math.min(1, next.moveX)) : undefined,
        moveY: typeof next.moveY === 'number' ? Math.max(-1, Math.min(1, next.moveY)) : undefined,
        jumpPressed: prev.jumpPressed || Boolean(next.jumpPressed),
        dashPressed: prev.dashPressed || Boolean(next.dashPressed),
        meleePressed: prev.meleePressed || Boolean(next.meleePressed),
        projPressed: prev.projPressed || Boolean(next.projPressed),
        ultPressed: prev.ultPressed || Boolean(next.ultPressed),
        shopPressed: false,
      };
      return;
    }

    if (msg.type === 'pick_buff' && this.state && this.state.status === 'playing') {
      const player = this.state.players.find((p) => p.id === session.id);
      if (!player) return;
      applyPlayerBuff(this.state, player, msg.buffId);
      if (this.state.soundQueue.length > 0) {
        this.pendingSounds.push(...this.state.soundQueue);
        this.state.soundQueue.length = 0;
      }
      this.broadcastSnapshotNow();
      return;
    }

    if (msg.type === 'start') {
      if (!session.isHost) return;
      this.startMatch();
      return;
    }

    if (msg.type === 'buy' && this.state && this.state.status === 'playing') {
      const player = this.state.players.find((p) => p.id === session.id);
      if (!player) return;
      const res = buyShopItem(this.state, player, msg.itemId);
      if (this.state.soundQueue.length > 0) {
        this.pendingSounds.push(...this.state.soundQueue);
        this.state.soundQueue.length = 0;
      }
      this.safeSend(session.ws, {
        type: 'shop_result',
        ok: res.ok,
        message: res.message,
      });
      this.broadcastSnapshotNow();
      return;
    }

    if (msg.type === 'skip_intermission' && this.state && this.state.status === 'playing') {
      skipIntermission(this.state);
      this.broadcastSnapshotNow();
    }
  }

  private handleDisconnect(session: ClientSession): void {
    if (!this.sessions.has(session.ws)) return;
    this.sessions.delete(session.ws);

    if (this.state) {
      this.state.players = this.state.players.filter((p) => p.id !== session.id);
      if (this.state.players.length === 0) {
        this.stopLoop();
        this.state = null;
      }
    }

    if (this.sessions.size === 0) {
      this.stopLoop();
      this.state = null;
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

    this.broadcastLobby();
  }

  private startMatch(): void {
    this.stopLoop();
    const roster = [...this.sessions.values()].map((s) => ({
      id: s.id,
      paletteIndex: s.paletteIndex,
      name: s.customName,
    }));

    this.state = createSurvivalState(roster[0]?.paletteIndex ?? 0, roster);
    this.pendingSounds = [];
    this.tickCounter = 0;

    for (const s of this.sessions.values()) {
      s.input = makeIdleInput();
      this.safeSend(s.ws, { type: 'start_game' });
    }

    this.broadcastSnapshotNow();

    this.tickInterval = setInterval(() => {
      if (!this.state || this.state.status !== 'playing' || this.sessions.size === 0) {
        this.stopLoop();
        return;
      }

      const inputsMap: Record<string, PlayerInput> = {};
      for (const s of this.sessions.values()) {
        inputsMap[s.id] = { ...s.input };
        s.input.jumpPressed = false;
        s.input.dashPressed = false;
        s.input.meleePressed = false;
        s.input.projPressed = false;
        s.input.ultPressed = false;
        s.input.shopPressed = false;
      }

      stepSurvival(this.state, inputsMap, FIXED_DT);

      if (this.state.soundQueue.length > 0) {
        this.pendingSounds.push(...this.state.soundQueue);
      }

      const endedNow = this.state.status !== 'playing';
      if (endedNow) {
        this.state.shakeTimer = 0;
        this.state.shakeIntensity = 0;
        this.state.hitstopTimer = 0;
        this.broadcastSnapshotNow();
        this.stopLoop();
        return;
      }

      this.tickCounter++;
      if (this.tickCounter % 3 === 0) {
        this.broadcastSnapshotNow();
      }
    }, 16);
  }

  private stopLoop(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
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

  private broadcastSnapshotNow(): void {
    if (!this.state) return;
    const slim = buildSlimSnapshot(this.state, this.pendingSounds);
    this.pendingSounds = [];
    const payload = JSON.stringify({ type: 'snapshot', state: slim });
    for (const s of this.sessions.values()) {
      try {
        s.ws.send(payload);
      } catch {
        // Ignore closed socket
      }
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
          version: '1.2.0',
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
