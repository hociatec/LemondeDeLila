import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { GridModule } from '../../../modules/grid/grid.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TriominoPresenter } from './triomino.presenter';
import { TriominoService } from './triomino.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule, GridModule, RandomModule],
  providers: [TriominoService, TriominoPresenter],
  exports: [TriominoService],
})
export class TriominoModule {}

