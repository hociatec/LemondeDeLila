import { Injectable } from '@nestjs/common';
import type {
  LobbyChangedListener,
  RoomDeletedListener,
  RoomEventsPort,
  RoomStateUpdatedListener,
} from '../../application/ports/room-events.port';

@Injectable()
export class RoomEventsBusService implements RoomEventsPort {
  private readonly roomStateUpdatedListeners: RoomStateUpdatedListener[] = [];
  private readonly roomDeletedListeners: RoomDeletedListener[] = [];
  private readonly lobbyChangedListeners: LobbyChangedListener[] = [];

  onRoomStateUpdated(listener: RoomStateUpdatedListener): void {
    this.roomStateUpdatedListeners.push(listener);
  }

  onRoomDeleted(listener: RoomDeletedListener): void {
    this.roomDeletedListeners.push(listener);
  }

  onLobbyChanged(listener: LobbyChangedListener): void {
    this.lobbyChangedListeners.push(listener);
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
