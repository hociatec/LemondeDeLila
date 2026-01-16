import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { GridModule } from '../../../modules/grid/grid.module';
import { MorpionPresenter } from './morpion.presenter';
import { MorpionService } from './morpion.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule, GridModule],
  providers: [MorpionService, MorpionPresenter],
  exports: [MorpionService],
})
export class MorpionModule {}

