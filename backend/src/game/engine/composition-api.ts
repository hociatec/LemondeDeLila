/** Nest composition entry; application consumers use public-api. */
export { EngineModule } from './infrastructure/module/engine.module';
export { EngineServicesModule } from '../core/infrastructure/module/engine-services.module';
export { GameRegistryModule } from './infrastructure/module/game-registry.module';
export { GamePluginsModule } from '../composition/game-plugins.module';
