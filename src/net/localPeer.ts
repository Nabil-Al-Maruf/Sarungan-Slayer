import { Peer, type DataConnection } from 'peerjs';
import type {
  CompactGameSnapshot,
  LobbyPlayerInfo,
  MabarRole,
  NetMessage,
  StickPersonalSnapshot,
} from './protocol';
import type { PlayerInput } from '../core/types';

export interface LocalPeerCallbacks {
  onStatus: (msg: string, isError?: boolean) => void;
  onLobbyUpdate: (roomCode: string, players: LobbyPlayerInfo[], localId: string, isHost: boolean) => void;
  onGameStart: () => void;
  onSnapshot: (snap: CompactGameSnapshot) => void;
  onStickSnapshot: (snap: StickPersonalSnapshot) => void;
  onSkillPrompt: (kind: 'buff' | 'ult', choices: string[]) => void;
  onDisconnect: (reason: string) => void;
}

const PEER_PREFIX = 'arek-mabar-v2-';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 4; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

export class LocalPeerManager {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private hostConnection: DataConnection | null = null;

  public isHost = false;
  public roomCode = '';
  public localPlayerId = 'p1';
  public localRole: MabarRole = 'coop';
  public connected = false;
  public pingMs = 0;

  public lobbyPlayers: LobbyPlayerInfo[] = [];
  public clientInputs = new Map<string, PlayerInput>();

  private callbacks: LocalPeerCallbacks;
  private pingInterval: number | null = null;
  private seqCounter = 0;

  constructor(callbacks: LocalPeerCallbacks) {
    this.callbacks = callbacks;
  }

  public createRoom(
    role: 'coop' | 'monitor',
    playerName: string,
    paletteIndex: number
  ): string {
    this.disconnect();
    this.isHost = true;
    this.localRole = role;
    this.localPlayerId = role === 'monitor' ? 'monitor' : 'p1';
    this.roomCode = generateRoomCode();
    const peerId = PEER_PREFIX + this.roomCode;

    this.callbacks.onStatus(`Membuat room local [${this.roomCode}]...`);

    this.peer = new Peer(peerId, {
      debug: 1,
    });

    this.peer.on('open', () => {
      this.connected = true;
      this.lobbyPlayers = [
        {
          id: this.localPlayerId,
          name: role === 'monitor' ? 'LAYAR MONITOR' : playerName,
          paletteIndex,
          role,
          isHost: true,
          pingMs: 0,
        },
      ];
      this.callbacks.onStatus(`Room aktif! Bagikan kode [${this.roomCode}] ke teman.`);
      this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, this.localPlayerId, true);
    });

    this.peer.on('connection', (conn) => {
      this.handleIncomingClient(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('[Peer Host Error]', err);
      if (err.type === 'unavailable-id') {
        // Room code collision: try once more with new code
        this.createRoom(role, playerName, paletteIndex);
      } else {
        this.callbacks.onStatus(`Koneksi error: ${err.message}`, true);
      }
    });

    return this.roomCode;
  }

  public joinRoom(
    roomCode: string,
    role: 'coop' | 'stick',
    playerName: string,
    paletteIndex: number
  ): void {
    this.disconnect();
    const cleanedCode = roomCode.trim().toUpperCase().slice(0, 4);
    if (!cleanedCode) {
      this.callbacks.onStatus('Masukkan 4 digit kode room!', true);
      return;
    }

    this.isHost = false;
    this.roomCode = cleanedCode;
    this.localRole = role;
    this.callbacks.onStatus(`Menghubungkan ke room [${this.roomCode}] via Wi-Fi/Hotspot...`);

    const targetPeerId = PEER_PREFIX + this.roomCode;
    this.peer = new Peer({
      debug: 1,
    });

    this.peer.on('open', () => {
      const conn = this.peer!.connect(targetPeerId, {
        reliable: false, // Low-latency UDP data channel for real-time game inputs!
      });
      this.hostConnection = conn;

      conn.on('open', () => {
        this.connected = true;
        this.callbacks.onStatus('Terhubung ke Host! Mengirim data profil...');
        conn.send({
          t: 'join',
          name: playerName,
          pal: paletteIndex,
          role,
        } as NetMessage);

        this.startPingLoop();
      });

      conn.on('data', (data) => {
        this.handleMessageFromHost(data as NetMessage);
      });

      conn.on('close', () => {
        this.disconnect();
        this.callbacks.onDisconnect('Terputus dari Host room.');
      });

      conn.on('error', (err) => {
        console.warn('[Peer Client Conn Error]', err);
        this.callbacks.onStatus(`Koneksi terganggu: ${err.message}`, true);
      });
    });

    this.peer.on('error', (err) => {
      console.warn('[Peer Client Error]', err);
      if (err.type === 'peer-unavailable') {
        this.callbacks.onStatus(`Room [${cleanedCode}] tidak ditemukan! Pastikan kode benar & 1 Wi-Fi.`, true);
      } else {
        this.callbacks.onStatus(`Gagal terhubung: ${err.message}`, true);
      }
    });
  }

  private handleIncomingClient(conn: DataConnection): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      const msg = data as NetMessage;
      if (msg.t === 'join') {
        // Assign next available player slot
        const usedIds = new Set(this.lobbyPlayers.map((p) => p.id));
        let nextId = 'p2';
        for (let i = 2; i <= 5; i++) {
          const candidate = `p${i}`;
          if (!usedIds.has(candidate)) {
            nextId = candidate;
            break;
          }
        }

        const newPlayer: LobbyPlayerInfo = {
          id: nextId,
          name: msg.name || `Arek ${nextId.toUpperCase()}`,
          paletteIndex: msg.pal,
          role: msg.role,
          isHost: false,
          pingMs: 0,
        };

        this.lobbyPlayers.push(newPlayer);

        // Map peer connection to player ID
        (conn as any)._playerId = nextId;

        // Welcome player
        conn.send({
          t: 'welcome',
          playerId: nextId,
          isHost: false,
          hostRole: this.localRole,
        } as NetMessage);

        this.broadcastLobbyUpdate();
      } else if (msg.t === 'input') {
        const playerId = (conn as any)._playerId;
        if (playerId) {
          this.clientInputs.set(playerId, msg.input);
        }
      } else if (msg.t === 'ping') {
        conn.send({ t: 'pong', timestamp: msg.timestamp } as NetMessage);
      } else if (msg.t === 'pick_skill') {
        const playerId = (conn as any)._playerId;
        if (playerId) {
          this.callbacks.onSkillPrompt(msg.kind, [msg.choice]); // Host handles skill selection
        }
      }
    });

    conn.on('close', () => {
      const playerId = (conn as any)._playerId;
      this.connections.delete(conn.peer);
      if (playerId) {
        this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.id !== playerId);
        this.clientInputs.delete(playerId);
        this.broadcastLobbyUpdate();
      }
    });
  }

  private handleMessageFromHost(msg: NetMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.localPlayerId = msg.playerId;
        this.callbacks.onStatus(`Tersambung sebagai ${this.localPlayerId.toUpperCase()}!`);
        break;
      case 'lobby_update':
        this.lobbyPlayers = msg.players;
        this.callbacks.onLobbyUpdate(msg.roomCode, msg.players, this.localPlayerId, false);
        break;
      case 'start_game':
        this.callbacks.onGameStart();
        break;
      case 'snap':
        this.callbacks.onSnapshot(msg.snap);
        break;
      case 'stick_snap':
        this.callbacks.onStickSnapshot(msg.snap);
        break;
      case 'prompt_skill':
        this.callbacks.onSkillPrompt(msg.kind, msg.choices);
        break;
      case 'pong':
        this.pingMs = Math.max(1, Math.round(performance.now() - msg.timestamp));
        break;
    }
  }

  public broadcastLobbyUpdate(): void {
    if (!this.isHost) return;
    const msg: NetMessage = {
      t: 'lobby_update',
      roomCode: this.roomCode,
      players: this.lobbyPlayers,
    };
    this.broadcastMessage(msg);
    this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, this.localPlayerId, true);
  }

  public sendStartGame(): void {
    if (!this.isHost) return;
    this.broadcastMessage({ t: 'start_game' });
    this.callbacks.onGameStart();
  }

  public sendInput(input: PlayerInput): void {
    if (!this.connected || this.isHost || !this.hostConnection) return;
    this.seqCounter++;
    this.hostConnection.send({
      t: 'input',
      seq: this.seqCounter,
      input,
    } as NetMessage);
  }

  public sendPickSkill(kind: 'buff' | 'ult', choice: string): void {
    if (this.hostConnection) {
      this.hostConnection.send({
        t: 'pick_skill',
        kind,
        choice,
      } as NetMessage);
    }
  }

  public broadcastSnapshot(snap: CompactGameSnapshot): void {
    if (!this.isHost) return;
    for (const [_, conn] of this.connections) {
      const pId = (conn as any)._playerId;
      const targetPl = this.lobbyPlayers.find((p) => p.id === pId);

      if (targetPl && targetPl.role === 'stick') {
        // Send lightweight stick-only snapshot to save bandwidth and maximize response speed!
        const pState = snap.players.find((p) => p.id === pId);
        if (pState) {
          const stickSnap: StickPersonalSnapshot = {
            t: 'stick_snap',
            seq: snap.seq,
            hp: pState.hp,
            maxHp: pState.maxHp,
            ult: pState.ult,
            maxUlt: pState.maxUlt,
            coins: pState.coins,
            wave: snap.wave,
            phase: snap.phase,
            intermissionTimer: snap.intermissionTimer,
            canShop: snap.phase === 'intermission',
            soundCue: snap.sounds[0],
          };
          conn.send(stickSnap);
        }
      } else {
        // Full snapshot for coop screen players
        conn.send({ t: 'snap', snap } as NetMessage);
      }
    }
  }

  public promptClientSkill(playerId: string, kind: 'buff' | 'ult', choices: string[]): void {
    if (!this.isHost) return;
    for (const [_, conn] of this.connections) {
      if ((conn as any)._playerId === playerId) {
        conn.send({
          t: 'prompt_skill',
          kind,
          choices,
        } as NetMessage);
        break;
      }
    }
  }

  private broadcastMessage(msg: NetMessage): void {
    for (const [_, conn] of this.connections) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({
          t: 'ping',
          timestamp: performance.now(),
        } as NetMessage);
      }
    }, 2000);
  }

  private stopPingLoop(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    this.stopPingLoop();
    this.connected = false;
    this.isHost = false;
    this.roomCode = '';
    this.lobbyPlayers = [];
    this.clientInputs.clear();

    for (const [_, conn] of this.connections) {
      try {
        conn.close();
      } catch {}
    }
    this.connections.clear();

    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch {}
      this.hostConnection = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
  }
}
