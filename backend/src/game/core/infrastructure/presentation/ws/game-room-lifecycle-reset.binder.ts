import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  GAME_ROOM_EVENTS_PORT,
  type GameRoomEventsPort,
} from '../../../application/ports/game-room.port';
import { GameWsRealtimeStateService } from './game-ws-realtime-state.service';

@Injectable()
export class GameRoomLifecycleResetBinder implements OnModuleInit {
  constructor(
    @Inject(GAME_ROOM_EVENTS_PORT)
    private readonly roomEvents: GameRoomEventsPort,
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
