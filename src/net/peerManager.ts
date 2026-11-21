import Peer, { type DataConnection } from 'peerjs';
import { PLAYER_PALETTES } from '../core/constants';
import type { GameState, PlayerInput } from '../core/types';
import type { ShopItemId } from '../modes/survival';

export interface LobbyPlayer {
  id: string; // 'p1'..'p5'
  peerId: string;
  paletteIndex: number;
  name: string;
  isHost: boolean;
}

export type NetRole = 'none' | 'host' | 'client';

type HostToClientMsg =
  | { type: 'lobby_update'; roomCode: string; players: LobbyPlayer[]; yourPlayerId: string }
  | { type: 'start_game' }
  | { type: 'snapshot'; state: GameState }
  | { type: 'shop_result'; ok: boolean; message: string }
  | { type: 'room_full' };

type ClientToHostMsg =
  | { type: 'input'; input: PlayerInput }
  | { type: 'buy'; itemId: ShopItemId }
  | { type: 'skip_intermission' };

const ROOM_PREFIX = 'arek-sarungan-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export interface PeerCallbacks {
  onStatus: (text: string, isError?: boolean) => void;
  onLobbyUpdate: (roomCode: string, players: LobbyPlayer[], localPlayerId: string) => void;
  onGameStart: () => void;
  onSnapshot: (state: GameState) => void;
  onClientBuy: (playerId: string, itemId: ShopItemId) => { ok: boolean; message: string };
  onClientSkipIntermission: () => void;
  onShopResult: (ok: boolean, message: string) => void;
}

export class PeerManager {
  public role: NetRole = 'none';
  public roomCode = '';
  public localPlayerId = 'p1';
  public lobbyPlayers: LobbyPlayer[] = [];

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private clientConns = new Map<string, { conn: DataConnection; playerId: string }>();
  private remoteInputs = new Map<string, PlayerInput>();
  private callbacks: PeerCallbacks;

  constructor(callbacks: PeerCallbacks) {
    this.callbacks = callbacks;
  }

  public disconnect(): void {
    this.clientConns.forEach((c) => c.conn.close());
    this.clientConns.clear();
    this.remoteInputs.clear();
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.role = 'none';
    this.roomCode = '';
    this.localPlayerId = 'p1';
    this.lobbyPlayers = [];
  }

  public createRoom(hostPaletteIndex = 0): void {
    this.disconnect();
    this.role = 'host';
    this.roomCode = generateRoomCode();
    this.localPlayerId = 'p1';

    const hostPeerId = `${ROOM_PREFIX}${this.roomCode}`;
    this.callbacks.onStatus(`Membuat Room ${this.roomCode}...`);

    const peer = new Peer(hostPeerId, PEER_CONFIG);
    this.peer = peer;

    peer.on('open', (id) => {
      const pal = PLAYER_PALETTES[hostPaletteIndex % PLAYER_PALETTES.length];
      this.lobbyPlayers = [
        {
          id: 'p1',
          peerId: id,
          paletteIndex: hostPaletteIndex % PLAYER_PALETTES.length,
          name: `${pal.label} • ${pal.name.split(' ')[1]} (HOST)`,
          isHost: true,
        },
      ];
      this.callbacks.onStatus(`Room ${this.roomCode} siap! Bagikan kode atau link ke teman.`);
      this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, 'p1');
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (this.lobbyPlayers.length >= 5) {
          conn.send({ type: 'room_full' } satisfies HostToClientMsg);
          setTimeout(() => conn.close(), 200);
          return;
        }

        // Assign first unused slot p2..p5
        const usedIds = new Set(this.lobbyPlayers.map((p) => p.id));
        let slotNum = 2;
        while (usedIds.has(`p${slotNum}`) && slotNum <= 5) slotNum++;
        const playerId = `p${slotNum}`;
        const paletteIndex = (slotNum - 1) % PLAYER_PALETTES.length;
        const pal = PLAYER_PALETTES[paletteIndex];

        this.clientConns.set(conn.peer, { conn, playerId });
        this.lobbyPlayers.push({
          id: playerId,
          peerId: conn.peer,
          paletteIndex,
          name: `${pal.label} • ${pal.name.split(' ')[1]}`,
          isHost: false,
        });

        this.broadcastLobby();
        this.callbacks.onStatus(`${pal.label} bergabung ke Room ${this.roomCode}!`);
      });

      conn.on('data', (raw) => {
        const entry = this.clientConns.get(conn.peer);
        if (!entry || !raw || typeof raw !== 'object') return;
        const msg = raw as ClientToHostMsg;

        if (msg.type === 'input') {
          this.remoteInputs.set(entry.playerId, msg.input);
        } else if (msg.type === 'buy') {
          const res = this.callbacks.onClientBuy(entry.playerId, msg.itemId);
          conn.send({ type: 'shop_result', ok: res.ok, message: res.message } satisfies HostToClientMsg);
        } else if (msg.type === 'skip_intermission') {
          this.callbacks.onClientSkipIntermission();
        }
      });

      conn.on('close', () => {
        const entry = this.clientConns.get(conn.peer);
        if (entry) {
          this.clientConns.delete(conn.peer);
          this.remoteInputs.delete(entry.playerId);
          this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.id !== entry.playerId);
          this.broadcastLobby();
          this.callbacks.onStatus(`${entry.playerId.toUpperCase()} keluar dari room.`);
        }
      });
    });

    peer.on('error', (err) => {
      this.callbacks.onStatus(`PeerJS Error: ${err.type || err.message}`, true);
    });
  }

  public joinRoom(rawCode: string): void {
    const code = rawCode.trim().toUpperCase();
    if (code.length !== 4) {
      this.callbacks.onStatus('Kode Room harus 4 karakter!', true);
      return;
    }

    this.disconnect();
    this.role = 'client';
    this.roomCode = code;
    this.callbacks.onStatus(`Menghubungkan ke Room ${code}...`);

    const peer = new Peer(PEER_CONFIG);
    this.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(`${ROOM_PREFIX}${code}`, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        this.callbacks.onStatus(`Terhubung ke Room ${code}! Menunggu Host mulai...`);
      });

      conn.on('data', (raw) => {
        if (!raw || typeof raw !== 'object') return;
        const msg = raw as HostToClientMsg;

        if (msg.type === 'room_full') {
          this.callbacks.onStatus('Room penuh (maksimal 5 pemain)!', true);
          this.disconnect();
        } else if (msg.type === 'lobby_update') {
          this.roomCode = msg.roomCode;
          this.lobbyPlayers = msg.players;
          this.localPlayerId = msg.yourPlayerId;
          this.callbacks.onLobbyUpdate(msg.roomCode, msg.players, msg.yourPlayerId);
        } else if (msg.type === 'start_game') {
          this.callbacks.onGameStart();
        } else if (msg.type === 'snapshot') {
          this.callbacks.onSnapshot(msg.state);
        } else if (msg.type === 'shop_result') {
          this.callbacks.onShopResult(msg.ok, msg.message);
        }
      });

      conn.on('close', () => {
        this.callbacks.onStatus('Koneksi ke Host terputus.', true);
      });

      conn.on('error', (err) => {
        this.callbacks.onStatus(`Gagal koneksi: ${err.message}`, true);
      });
    });

    peer.on('error', (err) => {
      this.callbacks.onStatus(`Room ${code} tidak ditemukan (${err.type}).`, true);
    });
  }

  private broadcastLobby(): void {
    this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, this.localPlayerId);
    for (const { conn, playerId } of this.clientConns.values()) {
      if (conn.open) {
        conn.send({
          type: 'lobby_update',
          roomCode: this.roomCode,
          players: this.lobbyPlayers,
          yourPlayerId: playerId,
        } satisfies HostToClientMsg);
      }
    }
  }

  public broadcastStartGame(): void {
    if (this.role !== 'host') return;
    for (const { conn } of this.clientConns.values()) {
      if (conn.open) {
        conn.send({ type: 'start_game' } satisfies HostToClientMsg);
      }
    }
  }

  public broadcastSnapshot(state: GameState): void {
    if (this.role !== 'host') return;
    for (const { conn } of this.clientConns.values()) {
      if (conn.open) {
        conn.send({ type: 'snapshot', state } satisfies HostToClientMsg);
      }
    }
  }

  public sendClientInput(input: PlayerInput): void {
    if (this.role !== 'client' || !this.hostConn?.open) return;
    this.hostConn.send({ type: 'input', input } satisfies ClientToHostMsg);
  }

  public sendClientBuy(itemId: ShopItemId): void {
    if (this.role !== 'client' || !this.hostConn?.open) return;
    this.hostConn.send({ type: 'buy', itemId } satisfies ClientToHostMsg);
  }

  public sendClientSkipIntermission(): void {
    if (this.role !== 'client' || !this.hostConn?.open) return;
    this.hostConn.send({ type: 'skip_intermission' } satisfies ClientToHostMsg);
  }

  public getRemoteInput(playerId: string): PlayerInput | undefined {
    const inp = this.remoteInputs.get(playerId);
    if (!inp) return undefined;
    // Consume edge triggers after Host reads them once so presses don't repeat forever
    const copy: PlayerInput = { ...inp };
    inp.jumpPressed = false;
    inp.dashPressed = false;
    inp.meleePressed = false;
    inp.projPressed = false;
    inp.ultPressed = false;
    inp.shopPressed = false;
    return copy;
  }
}
