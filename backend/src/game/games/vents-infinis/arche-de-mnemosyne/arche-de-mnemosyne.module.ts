import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { ArcheDeMnemosyneService } from './arche-de-mnemosyne.service';
import { MnemoQuizStoreService } from './store/mnemo-quiz-store.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule, TurnModule],
  providers: [ArcheDeMnemosyneService, MnemoQuizStoreService],
  exports: [ArcheDeMnemosyneService],
})
export class ArcheDeMnemosyneModule {}

