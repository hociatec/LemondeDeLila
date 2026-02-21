import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomTurnGameKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { ArcheDeMnemosyneService } from './arche-de-mnemosyne.service';
import { MnemoQuizStoreService } from './store/mnemo-quiz-store.service';

@Module({
  imports: [
    ConfigModule,
    GameCoreModule,
    GameRegistryModule,
    RandomTurnGameKitModule,
  ],
  providers: [ArcheDeMnemosyneService, MnemoQuizStoreService],
  exports: [ArcheDeMnemosyneService, MnemoQuizStoreService],
})
export class ArcheDeMnemosyneModule {}
