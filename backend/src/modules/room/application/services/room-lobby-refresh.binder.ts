import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ROOM_EVENTS_PORT,
  type RoomEventsPort,
} from '../ports/room-events.port';
import { RoomLobbyRefreshService } from './room-lobby-refresh.service';

@Injectable()
export class RoomLobbyRefreshBinder implements OnModuleInit {
  constructor(
    private readonly lobbyRefresh: RoomLobbyRefreshService,
    @Inject(ROOM_EVENTS_PORT)
    private readonly roomEvents: RoomEventsPort,
  ) {}

  onModuleInit() {
    this.roomEvents.onLobbyChanged((roomId, reason) =>
      this.lobbyRefresh.notifyRefresh(roomId, reason),
    );
  }
}
