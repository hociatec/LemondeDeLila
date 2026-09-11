import { Injectable } from '@nestjs/common';
import type { WebSocket } from 'ws';
import { prometheusMetrics } from '../../../../../platform/observability/public-api';

@Injectable()
export class RoomRealtimeTrackerService {
  private readonly activePlayerSocketsByRoomId = new Map<number, number>();
  private readonly participantRoomBySocket = new WeakMap<WebSocket, number>();

  /**
   * Tracks "active players" as currently-connected sockets that are in
   * participant mode for a given room. This is used to prevent admin/auto cleanup
   * from deleting a room with an active player.
   */
  setSocketParticipantRoom(socket: WebSocket, roomId: number | null): void {
    const nextRoomId =
      typeof roomId === 'number' && Number.isSafeInteger(roomId) && roomId > 0
        ? roomId
        : 0;
    const prevRoomId = this.participantRoomBySocket.get(socket) ?? 0;
    if (prevRoomId === nextRoomId) {
      return;
    }

    if (prevRoomId > 0) {
      this.decrement(prevRoomId);
    }
    if (nextRoomId > 0) {
      this.increment(nextRoomId);
    }
    this.participantRoomBySocket.set(socket, nextRoomId);
    prometheusMetrics.setActiveRooms(this.activePlayerSocketsByRoomId.size);
  }

  clearSocket(socket: WebSocket): void {
    this.setSocketParticipantRoom(socket, null);
  }

  private increment(roomId: number) {
    const current = this.activePlayerSocketsByRoomId.get(roomId) ?? 0;
    if (current < 64) this.activePlayerSocketsByRoomId.set(roomId, current + 1);
  }

  private decrement(roomId: number) {
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

  countActivePlayers(roomId: number): number {
    return this.activePlayerSocketsByRoomId.get(roomId) ?? 0;
  }
}
/** Room application capability boundary. */
