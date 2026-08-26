import { GameCommandExecutorService } from '../../../application/services/game-command-executor.service';
import { GameExecutionScopeService } from '../../../application/services/game-execution-scope.service';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRealtimeAutomationService } from '../../../application/services/game-realtime-automation.service';
import { GameRoomCommandQueueService } from '../../../application/services/game-room-command-queue.service';
import { GameVisibilityService } from '../../../application/services/game-visibility.service';
import { GameRoomStateFactory } from '../../../application/services/game-room-state.factory';

export const GAME_WS_CORE_PROVIDERS = [
  GameModuleOverviewRegistryService,
  GameRealtimeAutomationService,
  GameExecutionScopeService,
  GameCommandExecutorService,
  GameRoomCommandQueueService,
  GameVisibilityService,
  GameRoomStateFactory,
];
