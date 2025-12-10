import { Module } from '@nestjs/common';
import { EngineModule } from './engine/engine.module';

@Module({
  imports: [EngineModule],
})
export class GameModule {}
