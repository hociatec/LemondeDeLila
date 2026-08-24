import { GameContentService } from '../../../engine/public-api';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';

export const GAME_WS_CORE_PROVIDERS = [
  GameContentService,
  GameModuleOverviewRegistryService,
];


