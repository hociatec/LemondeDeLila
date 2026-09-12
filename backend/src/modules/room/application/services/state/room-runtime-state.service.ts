import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomRuntimeStateService {
  private readonly roomBans = new Map<number, Set<number>>();
  private static readonly MAX_BANS_PER_ROOM = 10_000;
  private static readonly MAX_BANNED_ROOMS = 10_000;

  clearRoomBans(roomId: number): void {
    const id = this.normalizePositiveInt(roomId);
    if (id <= 0) return;
    this.roomBans.delete(id);
  }

  isBanned(roomId: number, userId: number): boolean {
    const id = this.normalizePositiveInt(roomId);
    const uid = this.normalizePositiveInt(userId);
    if (id <= 0 || uid <= 0) return false;
    return this.roomBans.get(id)?.has(uid) ?? false;
  }

  ban(roomId: number, userId: number): void {
    const id = this.normalizePositiveInt(roomId);
    const uid = this.normalizePositiveInt(userId);
    if (id <= 0 || uid <= 0) return;
    const set = this.roomBans.get(id) ?? new Set<number>();
    if (
      !set.has(uid) &&
      set.size >= RoomRuntimeStateService.MAX_BANS_PER_ROOM
    ) {
      return;
    }
    if (
      !this.roomBans.has(id) &&
      this.roomBans.size >= RoomRuntimeStateService.MAX_BANNED_ROOMS
    ) {
      const oldest = this.roomBans.keys().next().value;
      if (typeof oldest === 'number') this.roomBans.delete(oldest);
    }
    set.add(uid);
    this.roomBans.set(id, set);
  }

  unban(roomId: number, userId: number): void {
    const id = this.normalizePositiveInt(roomId);
    const uid = this.normalizePositiveInt(userId);
    if (id <= 0 || uid <= 0) return;
    const set = this.roomBans.get(id);
    if (!set) return;
    set.delete(uid);
    if (set.size === 0) {
      this.roomBans.delete(id);
    }
  }

  private normalizePositiveInt(value: number): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      ? value
      : 0;
  }
}
/** Room application capability boundary. */
