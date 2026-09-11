import { Injectable } from '@nestjs/common';
import type {
  LobbyChangedListener,
  RoomDeletedListener,
  RoomEventsPort,
  RoomStateUpdatedListener,
} from '../../application/ports/room-events.port';

@Injectable()
export class RoomEventsBusService implements RoomEventsPort {
  private static readonly MAX_LISTENERS = 128;
  private readonly roomStateUpdatedListeners = new Set<RoomStateUpdatedListener>();
  private readonly roomDeletedListeners = new Set<RoomDeletedListener>();
  private readonly lobbyChangedListeners = new Set<LobbyChangedListener>();

  onRoomStateUpdated(listener: RoomStateUpdatedListener): void {
    if (this.roomStateUpdatedListeners.size < RoomEventsBusService.MAX_LISTENERS) {
      this.roomStateUpdatedListeners.add(listener);
    }
  }

  onRoomDeleted(listener: RoomDeletedListener): void {
    if (this.roomDeletedListeners.size < RoomEventsBusService.MAX_LISTENERS) {
      this.roomDeletedListeners.add(listener);
    }
  }

  onLobbyChanged(listener: LobbyChangedListener): void {
    if (this.lobbyChangedListeners.size < RoomEventsBusService.MAX_LISTENERS) {
      this.lobbyChangedListeners.add(listener);
    }
  }

  async publishRoomStateUpdated(roomId: number): Promise<void> {
    for (const listener of this.roomStateUpdatedListeners) {
      try {
        await listener(roomId);
      } catch {
        // best effort
      }
    }
  }

  async publishRoomDeleted(roomId: number): Promise<void> {
    for (const listener of this.roomDeletedListeners) {
      try {
        await listener(roomId);
      } catch {
        // best effort
      }
    }
  }

  async publishLobbyChanged(roomId: number, reason: string): Promise<void> {
    for (const listener of this.lobbyChangedListeners) {
      try {
        await listener(roomId, reason);
      } catch {
        // best effort
      }
    }
  }
}
