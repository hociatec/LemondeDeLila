import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  GAME_ROOM_EVENTS_PORT,
  type GameRoomEventsPort,
} from '../../../application/ports/game-room.port';
import { GameAutomationRecoveryService } from '../../scheduling/game-automation-recovery.service';
import { GameRoomCommandQueueService } from '../../../application/services/game-room-command-queue.service';
import { GameWsRealtimeStateService } from './state/game-ws-realtime-state.service';

@Injectable()
export class GameRoomLifecycleResetBinder implements OnModuleInit {
  constructor(
    @Inject(GAME_ROOM_EVENTS_PORT)
    private readonly roomEvents: GameRoomEventsPort,
    @Inject(GameAutomationRecoveryService)
    private readonly recovery: Pick<GameAutomationRecoveryService, 'recover'>,
    private readonly queue: GameRoomCommandQueueService,
    private readonly realtime: GameWsRealtimeStateService,
  ) {}

  onModuleInit(): void {
    this.roomEvents.onLobbyChanged((roomId, reason) => {
      if (reason === 'left')
        return this.queue.run(roomId, async () => {
          const resolved = await this.realtime.resolve(roomId);
          this.realtime.schedule(roomId, resolved);
        });
      if (reason !== 'reset') return;
      return this.recovery.recover();
    });
    this.roomEvents.onRoomDeleted(() => this.recovery.recover());
  }
}
