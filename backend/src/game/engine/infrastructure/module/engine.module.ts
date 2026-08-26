import { Module } from '@nestjs/common';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { GameRegistryModule } from './game-registry.module';

@Module({
  imports: [EngineServicesModule, GameRegistryModule],
  exports: [EngineServicesModule, GameRegistryModule],
})
export class EngineModule {}
