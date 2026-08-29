import { GameCommandExecutorService } from '../../../application/services/game-command-executor.service';
import { GameExecutionScopeService } from '../../../application/services/game-execution-scope.service';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRealtimeAutomationService } from '../../../application/services/game-realtime-automation.service';
import { GameRoomCommandQueueService } from '../../../application/services/game-room-command-queue.service';
import { GameVisibilityService } from '../../../application/services/game-visibility.service';
import { GameRoomStateFactory } from '../../../application/services/game-room-state.factory';
import { GameDevToolsService } from '../../../application/services/game-dev-tools.service';
import { GAME_ROOM_LOCK } from '../../../application/ports/game-room-lock.port';
import { MysqlGameRoomLockService } from '../../persistence/typeorm/mysql-game-room-lock.service';
import { GAME_TASK_SCHEDULER } from '../../../application/ports/game-task-scheduler.port';
import { BullmqGameTaskSchedulerService } from '../../scheduling/bullmq-game-task-scheduler.service';

export const GAME_WS_CORE_PROVIDERS = [
  GameModuleOverviewRegistryService,
  GameRealtimeAutomationService,
  GameExecutionScopeService,
  GameCommandExecutorService,
  BullmqGameTaskSchedulerService,
  {
    provide: GAME_TASK_SCHEDULER,
    useExisting: BullmqGameTaskSchedulerService,
  },
  MysqlGameRoomLockService,
  {
    provide: GAME_ROOM_LOCK,
    useExisting: MysqlGameRoomLockService,
  },
  GameRoomCommandQueueService,
  GameVisibilityService,
  GameRoomStateFactory,
  GameDevToolsService,
];
