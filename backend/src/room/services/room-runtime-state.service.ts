import { Injectable } from '@nestjs/common';

type RoomDeletedNotifier = (roomId: number) => Promise<void> | void;
type RealtimeNotifier = (roomId: number) => Promise<void> | void;
type LobbyNotifier = (
  roomId: number,
  reason: string,
) => Promise<void> | void;

@Injectable()
export class RoomRuntimeStateService {
  private realtimeNotifier?: RealtimeNotifier;
  private lobbyNotifier?: LobbyNotifier;
  private readonly roomDeletedNotifiers: RoomDeletedNotifier[] = [];
  private readonly roomBans = new Map<number, Set<number>>();

  setRealtimeNotifier(fn: RealtimeNotifier): void {
    this.realtimeNotifier = fn;
  }

  setLobbyNotifier(fn: LobbyNotifier): void {
    this.lobbyNotifier = fn;
  }

  addRoomDeletedNotifier(fn: RoomDeletedNotifier): void {
    if (typeof fn !== 'function') {
      return;
    }
    this.roomDeletedNotifiers.push(fn);
  }

  async notifyRoomStateUpdated(roomId: number): Promise<void> {
    try {
      await this.realtimeNotifier?.(roomId);
    } catch {
      // best effort
    }
  }

  notifyLobbyChanged(roomId: number, reason: string): void {
    try {
      void this.lobbyNotifier?.(roomId, reason);
    } catch {
      // best effort
    }
  }

  getRoomDeletedNotifiers(): RoomDeletedNotifier[] {
    return this.roomDeletedNotifiers;
  }

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
