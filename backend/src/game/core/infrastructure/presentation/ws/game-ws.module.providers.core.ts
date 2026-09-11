import { GameCommandExecutorService } from '../../../application/services/game-command-executor.service';
import { GameExecutionScopeService } from '../../../application/services/game-execution-scope.service';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRealtimeAutomationService } from '../../../application/services/game-realtime-automation.service';
import { GameTaskDispatchService } from '../../../application/services/game-task-dispatch.service';
import { GameAutomationPlannerService } from '../../../application/services/game-automation-planner.service';
import { GameRoomCommandQueueService } from '../../../application/services/game-room-command-queue.service';
import { GameVisibilityService } from '../../../application/services/game-visibility.service';
import { GameRoomStateFactory } from '../../../application/services/game-room-state.factory';
import { GameDevToolsService } from '../../../application/services/game-dev-tools.service';
import { GAME_ROOM_LOCK } from '../../../application/ports/game-room-lock.port';
import { GAME_ROOM_COMMAND_SCOPE } from '../../../application/ports/game-room-command-scope.port';
import { AsyncGameRoomCommandScope } from '../../scheduling/async-game-room-command-scope';
import { MysqlGameRoomLockService } from '../../persistence/typeorm/mysql-game-room-lock.service';
import { GAME_TASK_SCHEDULER } from '../../../application/ports/game-task-scheduler.port';
import { BullmqGameTaskSchedulerService } from '../../scheduling/bullmq-game-task-scheduler.service';
import { GameAutomationRecoveryService } from '../../scheduling/game-automation-recovery.service';

export const GAME_WS_CORE_PROVIDERS = [
  { provide: GAME_ROOM_COMMAND_SCOPE, useClass: AsyncGameRoomCommandScope },
  GameModuleOverviewRegistryService,
  GameRealtimeAutomationService,
  GameAutomationRecoveryService,
  GameTaskDispatchService,
  GameAutomationPlannerService,
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
