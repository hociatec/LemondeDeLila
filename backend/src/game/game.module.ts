import { Module } from '@nestjs/common';
import { EngineModule } from './engine/engine.module';
import { GamePluginsModule } from './engine/game-plugins.module';

@Module({
  imports: [EngineModule, GamePluginsModule.forRoot()],
  exports: [EngineModule],
})
export class GameModule {}
