import { DynamicModule, Module, type Provider } from '@nestjs/common';
import { DeclarativeGameRuntime } from '../core/application/runtime/declarative-game.runtime';
import { GameRegistryService } from '../core/application/services/game-registry.service';
import { GameRegistryModule } from '../engine/infrastructure/module/game-registry.module';
import { discoverGameDefinitions } from './game-module-discovery';

const GAME_RUNTIME_CATALOG = Symbol('GAME_RUNTIME_CATALOG');

@Module({})
export class GamePluginsModule {
  static forRoot(): DynamicModule {
    const runtimes = discoverGameDefinitions().map(
      (definition) => new DeclarativeGameRuntime(definition),
    );
    const runtimeCatalogProvider: Provider = {
      provide: GAME_RUNTIME_CATALOG,
      inject: [GameRegistryService],
      useFactory: (registry: GameRegistryService) => {
        for (const runtime of runtimes) registry.register(runtime);
        return Object.freeze([...runtimes]);
      },
    };
    return {
      module: GamePluginsModule,
      imports: [GameRegistryModule],
      providers: [runtimeCatalogProvider],
    };
  }
}
