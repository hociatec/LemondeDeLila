import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRealtimeAutomationService } from '../../../application/services/game-realtime-automation.service';

export const GAME_WS_CORE_PROVIDERS = [
  GameModuleOverviewRegistryService,
  GameRealtimeAutomationService,
];
