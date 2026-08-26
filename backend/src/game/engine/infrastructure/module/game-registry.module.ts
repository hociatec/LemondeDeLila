import { Module } from '@nestjs/common';
import { GameRegistryService } from '../../../core/application/services/game-registry.service';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';

@Module({
  imports: [EngineServicesModule],
  providers: [GameRegistryService],
  exports: [GameRegistryService],
})
export class GameRegistryModule {}
