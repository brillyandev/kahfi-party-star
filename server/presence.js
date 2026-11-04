/**
 * Pelacak siapa saja yang sedang ada di tiap room (in-memory).
 * roomCode -> Map<socketId, { userId, name, avatar, muted, role, seat }>
 */
const rooms = new Map();

export const MAX_SEATS = 8;

export const presence = {
  count(code) {
    return rooms.get(code)?.size ?? 0;
  },
  list(code) {
    return [...(rooms.get(code)?.entries() ?? [])].map(([id, p]) => ({ id, ...p }));
  },
  get(code, socketId) {
    return rooms.get(code)?.get(socketId);
  },
  add(code, socketId, info) {
    if (!rooms.has(code)) rooms.set(code, new Map());
    rooms.get(code).set(socketId, info);
  },
  remove(code, socketId) {
    const room = rooms.get(code);
    if (!room) return false;
    const had = room.delete(socketId);
    if (room.size === 0) rooms.delete(code);
    return had;
  },
  has(code, userId) {
    return this.list(code).some((p) => p.userId === userId);
  },
  firstFreeSeat(code) {
    const used = new Set(this.list(code).map((p) => p.seat).filter((s) => s != null));
    for (let i = 0; i < MAX_SEATS; i += 1) if (!used.has(i)) return i;
    return null;
  },
};
