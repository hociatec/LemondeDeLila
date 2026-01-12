import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { LamaPresenter } from './lama.presenter';
import { LamaService } from './lama.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule, RandomModule],
  providers: [LamaService, LamaPresenter],
  exports: [LamaService],
})
export class LamaModule {}

