import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import { userFromToken } from './auth.js';
import { presence, MAX_SEATS } from './presence.js';
import { uploadDir } from './upload.js';
import { seedIfEmpty } from './seed.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import shopRoutes from './routes/shop.js';
import socialRoutes from './routes/social.js';
import roomRoutes from './routes/rooms.js';
import staffRoutes from './routes/staff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

seedIfEmpty();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e6,
});
app.set('io', io);
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
/* CORS untuk /api: dipakai aplikasi Android/WebView yang origin-nya berbeda. */
app.use('/api', (req, res, next) => {
  const origin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '200kb' }));

/* Aset unggahan. SVG disajikan dengan CSP ketat supaya script tidak bisa jalan. */
app.use(
  '/uploads',
  express.static(uploadDir, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
      if (filePath.endsWith('.svga')) res.setHeader('Content-Type', 'application/octet-stream');
    },
  }),
);

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Kahfi Party Star' }));

app.get('/api/ice', (_req, res) => {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const urls = String(process.env.TURN_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (urls.length && process.env.TURN_USERNAME) {
    list.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  res.json({ iceServers: list });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/staff', staffRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir, { maxAge: '1h' }));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(distDir, 'index.html'), (err) => err && next());
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
});

/* ---------------- Socket.IO: voice room ---------------- */

io.use((socket, next) => {
  const user = userFromToken(socket.handshake.auth?.token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.user = user;
  next();
});

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  socket.data.roomCode = null;
  socket.leave(`room:${code}`);
  if (presence.remove(code, socket.id)) {
    socket.to(`room:${code}`).emit('peer-left', { id: socket.id });
  }
}

io.on('connection', (socket) => {
  const me = socket.data.user;
  socket.join(`user:${me.id}`);

  socket.on('join', (payload = {}, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const code = String(payload.code || '').toLowerCase();
    const room = db.prepare('SELECT * FROM rooms WHERE code=? AND closed=0').get(code);
    if (!room) return reply({ error: 'Room tidak ditemukan atau sudah ditutup.' });

    if (socket.data.roomCode) leaveRoom(socket);

    // Satu akun, satu sesi per room: tendang sesi lama
    for (const p of presence.list(code)) {
      if (p.userId === me.id) {
        io.to(p.id).emit('kicked', { reason: 'Akun kamu masuk dari perangkat lain.' });
        presence.remove(code, p.id);
        io.to(`room:${code}`).emit('peer-left', { id: p.id });
      }
    }

    if (presence.count(code) >= 50) return reply({ error: 'Room penuh.' });

    const fresh = db.prepare('SELECT * FROM users WHERE id=?').get(me.id);
    const frame = fresh.frame_id ? db.prepare('SELECT file, file_kind FROM items WHERE id=?').get(fresh.frame_id) : null;
    const seat = presence.firstFreeSeat(code);

    const info = {
      userId: me.id,
      uid: me.uid,
      name: me.display_name,
      avatar: me.avatar,
      role: me.role,
      vip: fresh.vip_level,
      svip: fresh.svip_level,
      frame,
      muted: seat == null,
      seat,
      isOwner: room.owner_id === me.id,
    };

    socket.data.roomCode = code;
    socket.join(`room:${code}`);
    const existing = presence.list(code);
    presence.add(code, socket.id, info);

    socket.to(`room:${code}`).emit('peer-joined', { id: socket.id, ...info });
    reply({ selfId: socket.id, self: info, peers: existing, maxSeats: MAX_SEATS, room: { code, title: room.title, ownerId: room.owner_id } });
  });

  socket.on('signal', ({ to, data } = {}) => {
    const code = socket.data.roomCode;
    if (!code || !to || !data) return;
    if (!presence.get(code, to)) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('mute', ({ muted } = {}) => {
    const code = socket.data.roomCode;
    const p = code && presence.get(code, socket.id);
    if (!p) return;
    p.muted = !!muted;
    socket.to(`room:${code}`).emit('peer-muted', { id: socket.id, muted: p.muted });
  });

  socket.on('take-seat', ({ seat } = {}, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const code = socket.data.roomCode;
    const p = code && presence.get(code, socket.id);
    if (!p) return reply({ error: 'Kamu belum di room.' });
    const n = Number(seat);
    if (!Number.isInteger(n) || n < 0 || n >= MAX_SEATS) return reply({ error: 'Kursi tidak valid.' });
    if (presence.list(code).some((x) => x.seat === n && x.id !== socket.id)) return reply({ error: 'Kursi sudah terisi.' });
    p.seat = n;
    p.muted = false;
    io.to(`room:${code}`).emit('seat-changed', { id: socket.id, seat: n, muted: false });
    reply({ ok: true });
  });

  socket.on('leave-seat', () => {
    const code = socket.data.roomCode;
    const p = code && presence.get(code, socket.id);
    if (!p) return;
    p.seat = null;
    p.muted = true;
    io.to(`room:${code}`).emit('seat-changed', { id: socket.id, seat: null, muted: true });
  });

  socket.on('chat', ({ text } = {}) => {
    const code = socket.data.roomCode;
    const p = code && presence.get(code, socket.id);
    const body = String(text || '').trim().slice(0, 200);
    if (!p || !body) return;
    io.to(`room:${code}`).emit('chat', {
      from: { id: me.id, name: me.display_name, vip: p.vip, svip: p.svip, role: p.role },
      text: body,
      at: Date.now(),
    });
  });

  /** Pemilik room atau staf bisa menendang peserta. */
  socket.on('kick', ({ id } = {}) => {
    const code = socket.data.roomCode;
    const actor = code && presence.get(code, socket.id);
    const target = code && presence.get(code, id);
    if (!actor || !target) return;
    const staff = ['admin', 'super_admin', 'developer'].includes(actor.role);
    if (!actor.isOwner && !staff) return;
    if (target.isOwner || target.role === 'developer' || target.svip > 0) return;
    io.to(id).emit('kicked', { reason: 'Kamu dikeluarkan dari room.' });
    presence.remove(code, id);
    io.to(`room:${code}`).emit('peer-left', { id });
  });

  socket.on('leave', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
});

httpServer.listen(PORT, () => console.log(`Kahfi Party Star berjalan di http://localhost:${PORT}`));
