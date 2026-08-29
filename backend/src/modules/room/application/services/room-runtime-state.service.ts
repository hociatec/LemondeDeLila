import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomRuntimeStateService {
  private readonly roomBans = new Map<number, Set<number>>();

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
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;
  }
}
