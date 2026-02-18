import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { GridGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { MorpionPresenter } from './morpion.presenter';
import { MorpionService } from './morpion.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule, GridGameCoreKitModule],
  providers: [MorpionService, MorpionPresenter],
  exports: [MorpionService],
})
export class MorpionModule {}

