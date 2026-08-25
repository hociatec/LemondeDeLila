import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ROOM_EVENTS_PORT,
  type RoomEventsPort,
} from '../../../../room/public-api';
import { GameWsRealtimeStateService } from './game-ws-realtime-state.service';

@Injectable()
export class GameRoomLifecycleResetBinder implements OnModuleInit {
  constructor(
    @Inject(ROOM_EVENTS_PORT)
    private readonly roomEvents: RoomEventsPort,
    private readonly realtime: GameWsRealtimeStateService,
  ) {}

  onModuleInit(): void {
    this.roomEvents.onLobbyChanged((roomId, reason) => {
      if (reason !== 'reset') return;
      return this.realtime.clearRoom(roomId);
    });
    this.roomEvents.onRoomDeleted((roomId) => this.realtime.clearRoom(roomId));
  }
}
