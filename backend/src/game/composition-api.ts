/** Nest composition entry; application consumers use public-api. */
export { GameModule } from './composition/game.module';
export { EngineServicesModule } from './core/infrastructure/module/engine-services.module';
export { BotModule } from './core/infrastructure/module/bot.module';
export { GameRegistryModule } from './engine/infrastructure/module/game-registry.module';
export { GameLoggerModule } from './core/infrastructure/logging/game-logger.module';
