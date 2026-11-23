import { io, type Socket } from 'socket.io-client';
import { Peer, type DataConnection } from 'peerjs';
import type {
  CompactGameSnapshot,
  LobbyPlayerInfo,
  MabarGameMode,
  MabarRole,
  NetMessage,
  StickPersonalSnapshot,
} from './protocol';
import type { HeroId, PlayerInput } from '../core/types';

export interface LocalPeerCallbacks {
  onStatus: (msg: string, isError?: boolean) => void;
  onLobbyUpdate: (
    roomCode: string,
    players: LobbyPlayerInfo[],
    localId: string,
    isHost: boolean,
    mode?: MabarGameMode
  ) => void;
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
  // Socket.IO LAN Transport
  private socket: Socket | null = null;

  // PeerJS WebRTC Fallback Transport
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private hostConnection: DataConnection | null = null;

  public transport: 'socket.io' | 'peerjs' | 'none' = 'none';
  public isHost = false;
  public roomCode = '';
  public localPlayerId = 'p1';
  public localRole: MabarRole = 'coop';
  public gameMode: MabarGameMode = 'survival';
  public selectedHeroId: HeroId = 'bima';
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

  /**
   * Create a new Mabar room.
   * Tries LAN Socket.IO first (<2ms latency, no internet needed).
   * Falls back to PeerJS WebRTC if no local Node.js server is detected.
   */
  public createRoom(
    role: 'coop' | 'monitor',
    playerName: string,
    paletteIndex: number,
    heroId: HeroId = 'bima'
  ): string {
    this.disconnect();
    this.isHost = true;
    this.localRole = role;
    this.selectedHeroId = heroId;
    this.localPlayerId = role === 'monitor' ? 'monitor' : 'p1';
    this.roomCode = generateRoomCode();

    this.callbacks.onStatus(`Membuat room local [${this.roomCode}]...`);

    // Detect if we can connect to local Node.js + Socket.IO server
    const isHttp = window.location.protocol.startsWith('http');
    const isLocalServer =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.port === '3000' ||
      /^192\.168\./.test(window.location.hostname) ||
      /^10\./.test(window.location.hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);

    if (isHttp && isLocalServer) {
      this.initSocketIoHost(role, playerName, paletteIndex, heroId);
    } else {
      // Fallback or direct PeerJS
      this.initPeerHost(role, playerName, paletteIndex, heroId);
    }

    return this.roomCode;
  }

  /**
   * Join an existing Mabar room.
   */
  public joinRoom(
    roomCode: string,
    role: 'coop' | 'stick',
    playerName: string,
    paletteIndex: number,
    heroId: HeroId = 'bima'
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
    this.selectedHeroId = heroId;
    this.callbacks.onStatus(`Menghubungkan ke room [${this.roomCode}] via Wi-Fi/Hotspot...`);

    const isHttp = window.location.protocol.startsWith('http');
    const isLocalServer =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.port === '3000' ||
      /^192\.168\./.test(window.location.hostname) ||
      /^10\./.test(window.location.hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);

    if (isHttp && isLocalServer) {
      this.initSocketIoClient(cleanedCode, role, playerName, paletteIndex, heroId);
    } else {
      this.initPeerClient(cleanedCode, role, playerName, paletteIndex, heroId);
    }
  }

  // =========================================================================
  // SOCKET.IO LAN TRANSPORT
  // =========================================================================

  private initSocketIoHost(
    role: 'coop' | 'monitor',
    playerName: string,
    paletteIndex: number,
    heroId: HeroId
  ): void {
    try {
      this.socket = io(window.location.origin, {
        reconnection: false,
        timeout: 2000,
        transports: ['websocket', 'polling'],
      });

      let connectedOnce = false;

      this.socket.on('connect', () => {
        connectedOnce = true;
        this.transport = 'socket.io';
        this.connected = true;

        this.socket!.emit('create_room', {
          roomCode: this.roomCode,
          role,
          playerName,
          paletteIndex,
          heroId,
          mode: this.gameMode,
        });

        this.startSocketPingLoop();
      });

      this.socket.on('welcome', (data: { playerId: string; hostRole: MabarRole; roomCode: string }) => {
        this.localPlayerId = data.playerId;
        this.roomCode = data.roomCode;
        this.callbacks.onStatus(`Room aktif via LAN Socket.IO! Bagikan kode [${this.roomCode}].`);
      });

      this.socket.on('lobby_update', (data: { roomCode: string; players: LobbyPlayerInfo[]; mode?: MabarGameMode }) => {
        this.lobbyPlayers = data.players;
        if (data.mode) this.gameMode = data.mode;
        this.callbacks.onLobbyUpdate(data.roomCode, data.players, this.localPlayerId, true, this.gameMode);
      });

      this.socket.on('client_input', (data: { playerId: string; seq: number; input: PlayerInput }) => {
        if (data.playerId && data.input) {
          this.clientInputs.set(data.playerId, data.input);
        }
      });

      this.socket.on('client_pick_skill', (data: { playerId: string; kind: 'buff' | 'ult'; choice: string }) => {
        this.callbacks.onSkillPrompt(data.kind, [data.choice]);
      });

      this.socket.on('player_left', (data: { playerId: string }) => {
        this.clientInputs.delete(data.playerId);
      });

      this.socket.on('pong_check', (data: { timestamp: number }) => {
        this.pingMs = Math.max(1, Math.round(performance.now() - data.timestamp));
      });

      this.socket.on('connect_error', () => {
        if (!connectedOnce) {
          console.log('[Net] Socket.IO LAN server not responding, falling back to WebRTC PeerJS...');
          this.socket?.disconnect();
          this.socket = null;
          this.initPeerHost(role, playerName, paletteIndex, heroId);
        }
      });
    } catch {
      this.initPeerHost(role, playerName, paletteIndex, heroId);
    }
  }

  private initSocketIoClient(
    roomCode: string,
    role: 'coop' | 'stick',
    playerName: string,
    paletteIndex: number,
    heroId: HeroId
  ): void {
    try {
      this.socket = io(window.location.origin, {
        reconnection: false,
        timeout: 2000,
        transports: ['websocket', 'polling'],
      });

      let connectedOnce = false;

      this.socket.on('connect', () => {
        connectedOnce = true;
        this.transport = 'socket.io';
        this.connected = true;

        this.socket!.emit('join_room', {
          roomCode,
          role,
          playerName,
          paletteIndex,
          heroId,
        });

        this.startSocketPingLoop();
      });

      this.socket.on('welcome', (data: { playerId: string; hostRole: MabarRole; roomCode: string }) => {
        this.localPlayerId = data.playerId;
        this.callbacks.onStatus(`Tersambung via LAN Socket.IO sebagai ${this.localPlayerId.toUpperCase()}!`);
      });

      this.socket.on('status_error', (data: { message: string }) => {
        this.callbacks.onStatus(data.message, true);
      });

      this.socket.on('lobby_update', (data: { roomCode: string; players: LobbyPlayerInfo[]; mode?: MabarGameMode }) => {
        this.lobbyPlayers = data.players;
        if (data.mode) this.gameMode = data.mode;
        this.callbacks.onLobbyUpdate(data.roomCode, data.players, this.localPlayerId, false, this.gameMode);
      });

      this.socket.on('start_game', () => {
        this.callbacks.onGameStart();
      });

      this.socket.on('snap', (snap: CompactGameSnapshot) => {
        this.callbacks.onSnapshot(snap);
      });

      this.socket.on('stick_snap', (snap: StickPersonalSnapshot) => {
        this.callbacks.onStickSnapshot(snap);
      });

      this.socket.on('prompt_skill', (data: { kind: 'buff' | 'ult'; choices: string[] }) => {
        this.callbacks.onSkillPrompt(data.kind, data.choices);
      });

      this.socket.on('room_closed', (data: { reason: string }) => {
        this.disconnect();
        this.callbacks.onDisconnect(data.reason || 'Host meninggalkan room.');
      });

      this.socket.on('pong_check', (data: { timestamp: number }) => {
        this.pingMs = Math.max(1, Math.round(performance.now() - data.timestamp));
      });

      this.socket.on('connect_error', () => {
        if (!connectedOnce) {
          console.log('[Net] Socket.IO LAN server not responding, falling back to WebRTC PeerJS...');
          this.socket?.disconnect();
          this.socket = null;
          this.initPeerClient(roomCode, role, playerName, paletteIndex, heroId);
        }
      });
    } catch {
      this.initPeerClient(roomCode, role, playerName, paletteIndex, heroId);
    }
  }

  // =========================================================================
  // PEERJS WEBRTC FALLBACK TRANSPORT
  // =========================================================================

  private initPeerHost(
    role: 'coop' | 'monitor',
    playerName: string,
    paletteIndex: number,
    heroId: HeroId
  ): void {
    this.transport = 'peerjs';
    const peerId = PEER_PREFIX + this.roomCode;
    this.peer = new Peer(peerId, { debug: 1 });

    this.peer.on('open', () => {
      this.connected = true;
      this.lobbyPlayers = [
        {
          id: this.localPlayerId,
          name: role === 'monitor' ? 'LAYAR MONITOR' : playerName,
          paletteIndex,
          heroId,
          role,
          isHost: true,
          pingMs: 0,
        },
      ];
      this.callbacks.onStatus(`Room aktif via P2P! Bagikan kode [${this.roomCode}] ke teman.`);
      this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, this.localPlayerId, true, this.gameMode);
    });

    this.peer.on('connection', (conn) => {
      this.handleIncomingPeerClient(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('[Peer Host Error]', err);
      if (err.type === 'unavailable-id') {
        this.roomCode = generateRoomCode();
        this.initPeerHost(role, playerName, paletteIndex, heroId);
      } else {
        this.callbacks.onStatus(`Koneksi error: ${err.message}`, true);
      }
    });
  }

  private initPeerClient(
    roomCode: string,
    role: 'coop' | 'stick',
    playerName: string,
    paletteIndex: number,
    heroId: HeroId
  ): void {
    this.transport = 'peerjs';
    const targetPeerId = PEER_PREFIX + roomCode;
    this.peer = new Peer({ debug: 1 });

    this.peer.on('open', () => {
      const conn = this.peer!.connect(targetPeerId);
      this.hostConnection = conn;

      conn.on('open', () => {
        this.connected = true;
        this.callbacks.onStatus('Terhubung ke Host! Mengirim data profil...');
        conn.send({
          t: 'join',
          name: playerName,
          pal: paletteIndex,
          role,
          heroId,
        } as NetMessage);

        this.startPeerPingLoop();
      });

      conn.on('data', (data) => {
        this.handlePeerMessageFromHost(data as NetMessage);
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
        this.callbacks.onStatus(`Room [${roomCode}] tidak ditemukan! Pastikan kode benar & 1 Wi-Fi.`, true);
      } else {
        this.callbacks.onStatus(`Gagal terhubung: ${err.message}`, true);
      }
    });
  }

  private handleIncomingPeerClient(conn: DataConnection): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      const msg = data as NetMessage;
      if (msg.t === 'join') {
        const usedIds = new Set(this.lobbyPlayers.map((p) => p.id));
        let nextId = 'p2';
        for (let i = 2; i <= 6; i++) {
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
          heroId: msg.heroId || 'bima',
          role: msg.role,
          isHost: false,
          pingMs: 0,
        };

        this.lobbyPlayers.push(newPlayer);
        (conn as any)._playerId = nextId;

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
      } else if (msg.t === 'pick_hero') {
        const playerId = (conn as any)._playerId;
        const pl = this.lobbyPlayers.find((p) => p.id === playerId);
        if (pl) {
          pl.heroId = msg.heroId;
          this.broadcastLobbyUpdate();
        }
      } else if (msg.t === 'set_mode') {
        this.gameMode = msg.mode;
        this.broadcastLobbyUpdate();
      } else if (msg.t === 'ping') {
        conn.send({ t: 'pong', timestamp: msg.timestamp } as NetMessage);
      } else if (msg.t === 'pick_skill') {
        const playerId = (conn as any)._playerId;
        if (playerId) {
          this.callbacks.onSkillPrompt(msg.kind, [msg.choice]);
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

  private handlePeerMessageFromHost(msg: NetMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.localPlayerId = msg.playerId;
        this.callbacks.onStatus(`Tersambung sebagai ${this.localPlayerId.toUpperCase()}!`);
        break;
      case 'lobby_update':
        this.lobbyPlayers = msg.players;
        if (msg.mode) this.gameMode = msg.mode;
        this.callbacks.onLobbyUpdate(msg.roomCode, msg.players, this.localPlayerId, false, this.gameMode);
        break;
      case 'start_game':
        this.callbacks.onGameStart();
        break;
      case 'snap':
        this.callbacks.onSnapshot(msg.snap);
        break;
      case 'stick_snap': {
        const payload = (msg as any).snap || msg;
        this.callbacks.onStickSnapshot(payload);
        break;
      }
      case 'prompt_skill':
        this.callbacks.onSkillPrompt(msg.kind, msg.choices);
        break;
      case 'pong':
        this.pingMs = Math.max(1, Math.round(performance.now() - msg.timestamp));
        break;
    }
  }

  // =========================================================================
  // UNIFIED PUBLIC ACTIONS
  // =========================================================================

  public broadcastLobbyUpdate(): void {
    if (!this.isHost) return;
    if (this.transport === 'socket.io') {
      // Server automatically emits lobby_update
    } else {
      const msg: NetMessage = {
        t: 'lobby_update',
        roomCode: this.roomCode,
        players: this.lobbyPlayers,
        mode: this.gameMode,
      };
      this.broadcastPeerMessage(msg);
      this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, this.localPlayerId, true, this.gameMode);
    }
  }

  public sendStartGame(): void {
    if (!this.isHost) return;
    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('start_game');
    } else {
      this.broadcastPeerMessage({ t: 'start_game' });
    }
    this.callbacks.onGameStart();
  }

  public sendPickHero(heroId: HeroId): void {
    this.selectedHeroId = heroId;
    const me = this.lobbyPlayers.find((p) => p.id === this.localPlayerId);
    if (me) me.heroId = heroId;

    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('pick_hero', { heroId });
    } else {
      if (this.isHost) {
        this.broadcastLobbyUpdate();
      } else if (this.hostConnection) {
        this.hostConnection.send({ t: 'pick_hero', heroId } as NetMessage);
      }
    }
  }

  public sendSetGameMode(mode: MabarGameMode): void {
    this.gameMode = mode;
    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('set_mode', { mode });
    } else {
      if (this.isHost) {
        this.broadcastLobbyUpdate();
      } else if (this.hostConnection) {
        this.hostConnection.send({ t: 'set_mode', mode } as NetMessage);
      }
    }
  }

  public addBot(heroId?: HeroId): void {
    if (!this.isHost) return;
    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('add_bot', { heroId });
      return;
    }

    // PeerJS fallback bot management
    const usedIds = new Set(this.lobbyPlayers.map((p) => p.id));
    let nextId = '';
    let slotNum = 2;
    for (let i = 2; i <= 6; i++) {
      const candidate = `p${i}`;
      if (!usedIds.has(candidate)) {
        nextId = candidate;
        slotNum = i;
        break;
      }
    }
    if (!nextId) return;

    const usedPals = new Set(this.lobbyPlayers.map((p) => p.paletteIndex));
    let botPal = 1;
    for (let i = 0; i < 6; i++) {
      if (!usedPals.has(i)) {
        botPal = i;
        break;
      }
    }

    const heroKeys: HeroId[] = ['bima', 'mat_clurit', 'bambang', 'gus_dimas', 'pak_rt', 'mbak_sri'];
    const chosenHero = heroId || heroKeys[(slotNum - 1) % heroKeys.length];

    this.lobbyPlayers.push({
      id: nextId,
      name: `BOT ${slotNum} (${chosenHero.toUpperCase()})`,
      paletteIndex: botPal,
      heroId: chosenHero,
      role: 'coop',
      isHost: false,
      isBot: true,
      pingMs: 0,
    });

    this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, this.localPlayerId, true, this.gameMode);
    this.broadcastLobbyUpdate();
  }

  public removeBot(): void {
    if (!this.isHost) return;
    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('remove_bot');
      return;
    }

    // PeerJS fallback
    let botIdx = -1;
    for (let i = this.lobbyPlayers.length - 1; i >= 0; i--) {
      if (this.lobbyPlayers[i].isBot) {
        botIdx = i;
        break;
      }
    }
    if (botIdx !== -1) {
      this.lobbyPlayers.splice(botIdx, 1);
      this.callbacks.onLobbyUpdate(this.roomCode, this.lobbyPlayers, this.localPlayerId, true, this.gameMode);
      this.broadcastLobbyUpdate();
    }
  }

  public sendInput(input: PlayerInput): void {
    if (!this.connected || this.isHost) return;
    this.seqCounter++;

    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('input', { seq: this.seqCounter, input });
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        t: 'input',
        seq: this.seqCounter,
        input,
      } as NetMessage);
    }
  }

  public sendPickSkill(kind: 'buff' | 'ult', choice: string): void {
    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('pick_skill', { kind, choice });
    } else if (this.hostConnection) {
      this.hostConnection.send({
        t: 'pick_skill',
        kind,
        choice,
      } as NetMessage);
    }
  }

  public broadcastSnapshot(snap: CompactGameSnapshot): void {
    if (!this.isHost) return;

    if (this.transport === 'socket.io' && this.socket) {
      // 1. Emit full snapshot to coop clients
      this.socket.emit('snap', { snap });

      // 2. Emit lightweight stick personal snapshots directly to each phone controller
      for (const pl of this.lobbyPlayers) {
        if (pl.role === 'stick' && !pl.isHost && !pl.isBot) {
          const pState = snap.players.find((p) => p.id === pl.id);
          if (pState) {
            const stickSnap: StickPersonalSnapshot = {
              t: 'stick_snap',
              seq: snap.seq,
              hp: pState.hp,
              maxHp: pState.maxHp,
              ult: pState.ult,
              maxUlt: pState.maxUlt,
              coins: pState.coins,
              stocks: pState.brawlStocks,
              kos: pState.brawlKos,
              gameMode: snap.gameMode,
              wave: snap.wave,
              phase: snap.phase,
              intermissionTimer: snap.intermissionTimer,
              canShop: snap.phase === 'intermission',
              soundCue: snap.sounds[0],
            };
            this.socket.emit('stick_snap', { playerId: pl.id, snap: stickSnap });
          }
        }
      }
    } else {
      // PeerJS fallback
      for (const [_, conn] of this.connections) {
        const pId = (conn as any)._playerId;
        const targetPl = this.lobbyPlayers.find((p) => p.id === pId);

        if (targetPl && targetPl.role === 'stick') {
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
              stocks: pState.brawlStocks,
              kos: pState.brawlKos,
              gameMode: snap.gameMode,
              wave: snap.wave,
              phase: snap.phase,
              intermissionTimer: snap.intermissionTimer,
              canShop: snap.phase === 'intermission',
              soundCue: snap.sounds[0],
            };
            conn.send({ t: 'stick_snap', snap: stickSnap } as NetMessage);
          }
        } else {
          conn.send({ t: 'snap', snap } as NetMessage);
        }
      }
    }
  }

  public promptClientSkill(playerId: string, kind: 'buff' | 'ult', choices: string[]): void {
    if (!this.isHost) return;

    if (this.transport === 'socket.io' && this.socket) {
      this.socket.emit('prompt_skill', { playerId, kind, choices });
    } else {
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
  }

  private broadcastPeerMessage(msg: NetMessage): void {
    for (const [_, conn] of this.connections) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  private startSocketPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping_check', { timestamp: performance.now() });
      }
    }, 2000);
  }

  private startPeerPingLoop(): void {
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
    this.transport = 'none';

    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {}
      this.socket = null;
    }

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
