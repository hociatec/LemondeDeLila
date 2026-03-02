import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomLobbyRefreshService } from './room-lobby-refresh.service';

@Injectable()
export class RoomLobbyRefreshBinder implements OnModuleInit {
  constructor(
    private readonly rooms: RoomService,
    private readonly lobbyRefresh: RoomLobbyRefreshService,
  ) {}

  onModuleInit() {
    this.rooms.setLobbyNotifier((roomId, reason) =>
      this.lobbyRefresh.notifyRefresh(roomId, reason),
    );
  }
}
