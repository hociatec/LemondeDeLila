import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  GAME_ROOM_EVENTS_PORT,
  type GameRoomEventsPort,
} from '../../../application/ports/game-room.port';
import { GameAutomationRecoveryService } from '../../scheduling/game-automation-recovery.service';

@Injectable()
export class GameRoomLifecycleResetBinder implements OnModuleInit {
  constructor(
    @Inject(GAME_ROOM_EVENTS_PORT)
    private readonly roomEvents: GameRoomEventsPort,
    @Inject(GameAutomationRecoveryService)
    private readonly recovery: Pick<GameAutomationRecoveryService, 'recover'>,
  ) {}

  onModuleInit(): void {
    this.roomEvents.onLobbyChanged((_roomId, reason) => {
      if (reason !== 'reset') return;
      return this.recovery.recover();
    });
    this.roomEvents.onRoomDeleted(() => this.recovery.recover());
  }
}
