import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e6, // 1 MB
});

const PORT = process.env.PORT || 3000;

// Serve static frontend assets
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/socket.io/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.use((req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Arek Sarungan Slayer - Server</title>
        <style>
          body { font-family: sans-serif; background: #0c0f1d; color: #fff; text-align: center; padding: 50px; }
          h1 { color: #f59e0b; }
          code { background: #1e293b; padding: 4px 8px; border-radius: 4px; color: #38bdf8; }
        </style>
      </head>
      <body>
        <h1>🎮 Arek Sarungan Slayer Local Server</h1>
        <p>Folder <code>dist/</code> belum ditemukan. Silakan build frontend terlebih dahulu:</p>
        <p><code>npm run build</code></p>
      </body>
      </html>
    `);
  });
}

// Room Management
// rooms: Map<roomCode, { code, hostSocketId, hostRole, mode, players: Map<playerId, player> }>
const rooms = new Map();
// socketToRoom: Map<socketId, { roomCode, playerId }>
const socketToRoom = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 4; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

function getLobbyPlayersList(room) {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    paletteIndex: p.paletteIndex,
    heroId: p.heroId,
    role: p.role,
    isHost: p.isHost,
    isBot: !!p.isBot,
    pingMs: p.pingMs || 0,
  }));
}

io.on('connection', (socket) => {
  // 1. Create Room (Host)
  socket.on('create_room', (data) => {
    const {
      roomCode: preferredCode,
      role = 'coop',
      playerName = 'Cak Host',
      paletteIndex = 0,
      heroId = 'bima',
      mode = 'survival',
    } = data || {};

    let roomCode = (preferredCode || '').trim().toUpperCase().slice(0, 4);
    if (!roomCode || rooms.has(roomCode)) {
      roomCode = generateRoomCode();
      while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
      }
    }

    const hostPlayerId = role === 'monitor' ? 'monitor' : 'p1';
    const room = {
      code: roomCode,
      hostSocketId: socket.id,
      hostRole: role,
      mode: mode || 'survival',
      players: new Map(),
    };

    const hostPlayer = {
      id: hostPlayerId,
      name: role === 'monitor' ? 'LAYAR MONITOR' : playerName,
      paletteIndex,
      heroId,
      role,
      isHost: true,
      socketId: socket.id,
      pingMs: 0,
    };

    room.players.set(hostPlayerId, hostPlayer);
    rooms.set(roomCode, room);
    socketToRoom.set(socket.id, { roomCode, playerId: hostPlayerId });

    socket.join(roomCode);

    socket.emit('welcome', {
      playerId: hostPlayerId,
      isHost: true,
      hostRole: role,
      roomCode,
    });

    io.to(roomCode).emit('lobby_update', {
      roomCode,
      players: getLobbyPlayersList(room),
      mode: room.mode,
    });
  });

  // 2. Join Room (Client)
  socket.on('join_room', (data) => {
    const { roomCode: rawCode, role = 'coop', playerName = 'Arek Mabar', paletteIndex = 1, heroId = 'bima' } = data || {};
    const roomCode = (rawCode || '').trim().toUpperCase().slice(0, 4);
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('status_error', {
        message: `Room [${roomCode}] tidak ditemukan! Pastikan kode benar & 1 Wi-Fi.`,
      });
      return;
    }

    // Up to 6 players allowed!
    const usedIds = new Set(Array.from(room.players.values()).map((p) => p.id));
    let nextId = '';
    for (let i = 2; i <= 6; i++) {
      const candidate = `p${i}`;
      if (!usedIds.has(candidate)) {
        nextId = candidate;
        break;
      }
    }

    if (!nextId) {
      socket.emit('status_error', {
        message: 'Room sudah penuh! Maksimal 6 pemain.',
      });
      return;
    }

    const newPlayer = {
      id: nextId,
      name: playerName || `Arek ${nextId.toUpperCase()}`,
      paletteIndex,
      heroId,
      role,
      isHost: false,
      socketId: socket.id,
      pingMs: 0,
    };

    room.players.set(nextId, newPlayer);
    socketToRoom.set(socket.id, { roomCode, playerId: nextId });
    socket.join(roomCode);

    socket.emit('welcome', {
      playerId: nextId,
      isHost: false,
      hostRole: room.hostRole,
      roomCode,
    });

    io.to(roomCode).emit('lobby_update', {
      roomCode,
      players: getLobbyPlayersList(room),
      mode: room.mode,
    });
  });

  // 3. Hero Picking
  socket.on('pick_hero', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;
    const player = room.players.get(mapping.playerId);
    if (!player) return;

    player.heroId = data.heroId;
    io.to(room.code).emit('lobby_update', {
      roomCode: room.code,
      players: getLobbyPlayersList(room),
      mode: room.mode,
    });
  });

  // 4. Set Mode (Host only)
  socket.on('set_mode', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    room.mode = data.mode;
    io.to(room.code).emit('lobby_update', {
      roomCode: room.code,
      players: getLobbyPlayersList(room),
      mode: room.mode,
    });
  });

  // 5. Add Bot (Host only, up to 6 players)
  socket.on('add_bot', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    const usedIds = new Set(Array.from(room.players.values()).map((p) => p.id));
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

    const usedPals = new Set(Array.from(room.players.values()).map((p) => p.paletteIndex));
    let botPal = 1;
    for (let i = 0; i < 6; i++) {
      if (!usedPals.has(i)) {
        botPal = i;
        break;
      }
    }

    const heroKeys = ['bima', 'mat_clurit', 'bambang', 'gus_dimas', 'pak_rt', 'mbak_sri'];
    const chosenHero = data?.heroId || heroKeys[(slotNum - 1) % heroKeys.length];

    room.players.set(nextId, {
      id: nextId,
      name: `BOT ${slotNum} (${chosenHero.toUpperCase()})`,
      paletteIndex: botPal,
      heroId: chosenHero,
      role: 'coop',
      isHost: false,
      isBot: true,
      pingMs: 0,
    });

    io.to(room.code).emit('lobby_update', {
      roomCode: room.code,
      players: getLobbyPlayersList(room),
      mode: room.mode,
    });
  });

  // 6. Remove Bot (Host only)
  socket.on('remove_bot', () => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    let botKey = null;
    for (const [key, p] of room.players) {
      if (p.isBot) botKey = key;
    }
    if (botKey) {
      room.players.delete(botKey);
      io.to(room.code).emit('lobby_update', {
        roomCode: room.code,
        players: getLobbyPlayersList(room),
        mode: room.mode,
      });
    }
  });

  // 7. Start Game (Host only)
  socket.on('start_game', () => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    io.to(room.code).emit('start_game');
  });

  // 8. Input Streaming (Client -> Host)
  socket.on('input', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    io.to(room.hostSocketId).emit('client_input', {
      playerId: mapping.playerId,
      seq: data.seq,
      input: data.input,
    });
  });

  // 9. Full Snapshot Streaming (Host -> non-stick clients)
  socket.on('snap', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    for (const p of room.players.values()) {
      if (p.socketId && p.socketId !== socket.id && p.role !== 'stick') {
        io.to(p.socketId).emit('snap', data.snap);
      }
    }
  });

  // 10. Stick Personal Snapshot (Host -> specific stick phone)
  socket.on('stick_snap', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    const targetPlayer = room.players.get(data.playerId);
    if (targetPlayer && targetPlayer.socketId) {
      io.to(targetPlayer.socketId).emit('stick_snap', data.snap);
    }
  });

  // 11. Skill Prompts (Host -> Client)
  socket.on('prompt_skill', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    const targetPlayer = room.players.get(data.playerId);
    if (targetPlayer && targetPlayer.socketId) {
      io.to(targetPlayer.socketId).emit('prompt_skill', {
        kind: data.kind,
        choices: data.choices,
      });
    }
  });

  // 12. Skill Selection (Client -> Host)
  socket.on('pick_skill', (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    io.to(room.hostSocketId).emit('client_pick_skill', {
      playerId: mapping.playerId,
      kind: data.kind,
      choice: data.choice,
    });
  });

  // 13. Ping / Pong latency check
  socket.on('ping_check', (data) => {
    socket.emit('pong_check', { timestamp: data?.timestamp || Date.now() });
  });

  // 14. Disconnect Handling
  socket.on('disconnect', () => {
    const mapping = socketToRoom.get(socket.id);
    socketToRoom.delete(socket.id);
    if (!mapping) return;

    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    if (room.hostSocketId === socket.id) {
      // Host disconnected: close room
      io.to(room.code).emit('room_closed', {
        reason: 'Host telah meninggalkan permainan.',
      });
      rooms.delete(mapping.roomCode);
    } else {
      // Client disconnected: remove and notify host
      room.players.delete(mapping.playerId);
      io.to(room.hostSocketId).emit('player_left', {
        playerId: mapping.playerId,
      });
      io.to(room.code).emit('lobby_update', {
        roomCode: room.code,
        players: getLobbyPlayersList(room),
        mode: room.mode,
      });
    }
  });
});

// Helper: collect non-internal IPv4 addresses
function getLocalIps() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIps();
  console.log('\n' + '='.repeat(64));
  console.log(' 🔥 AREK SARUNGAN SLAYER — LOCAL MULTIPLAYER SERVER (v1.8.0)');
  console.log(' ⚡ Node.js + Socket.IO (Bebas Kuota, Anti-Cloudflare, 100% Free!)');
  console.log('='.repeat(64));
  console.log(` 🖥️  Local:    http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(' 📱  Wi-Fi / LAN IP (Buka di HP / Laptop teman dalam 1 Wi-Fi):');
    for (const ip of ips) {
      console.log(`     👉  http://${ip}:${PORT}`);
    }
  } else {
    console.log(' ⚠️  Tidak terdeteksi adaptor Wi-Fi/LAN aktif. Hubungkan ke Wi-Fi atau Hotspot.');
  }
  console.log('='.repeat(64));
  console.log(' Tekan Ctrl+C untuk menghentikan server.\n');
});
