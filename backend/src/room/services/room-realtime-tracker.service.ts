import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomRealtimeTrackerService {
  private readonly activePlayerSocketsByRoomId = new Map<number, number>();

  registerPlayer(roomId: number) {
    if (!Number.isFinite(roomId) || roomId <= 0) return;
    const current = this.activePlayerSocketsByRoomId.get(roomId) ?? 0;
    this.activePlayerSocketsByRoomId.set(roomId, current + 1);
  }

  unregisterPlayer(roomId: number) {
    if (!Number.isFinite(roomId) || roomId <= 0) return;
    const current = this.activePlayerSocketsByRoomId.get(roomId) ?? 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      this.activePlayerSocketsByRoomId.delete(roomId);
    } else {
      this.activePlayerSocketsByRoomId.set(roomId, next);
    }
  }

  getActivePlayerRoomIds(): number[] {
    return Array.from(this.activePlayerSocketsByRoomId.keys());
  }

  hasActivePlayers(roomId: number): boolean {
    return (this.activePlayerSocketsByRoomId.get(roomId) ?? 0) > 0;
  }
}

