import { GameRegistryModule } from '../../../../engine/infrastructure/module/game-registry.module';
import { EngineServicesModule } from '../../module/engine-services.module';
import { BotModule } from '../../module/bot.module';

export const GAME_WS_MODULE_IMPORTS = [
  GameRegistryModule,
  EngineServicesModule,
  BotModule,
];
