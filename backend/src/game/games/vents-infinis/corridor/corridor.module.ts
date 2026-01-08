import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { CorridorService } from './corridor.service';
import { CorridorSetupService } from './setup/corridor-setup.service';
import { CorridorActionService } from './actions/corridor-action.service';
import { CorridorPresenterService } from './presenter/corridor-presenter.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule],
  providers: [
    CorridorService,
    CorridorSetupService,
    CorridorActionService,
    CorridorPresenterService,
  ],
  exports: [CorridorService],
})
export class CorridorModule {}

