import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { RandomTurnGameKitModule } from '../../../module/board-game-kits.module';
import { MNEMO_QUIZ_STORE } from './application/ports/mnemo-quiz-store.port';
import { ArcheDeMnemosyneService } from './application/services/arche-de-mnemosyne.service';
import { ArcheMnemoStateService } from './application/services/arche-mnemo-state.service';
import { MnemoQuizStoreService } from './infrastructure/storage/mnemo-quiz-store.service';

@Module({
  imports: [
    ConfigModule,
    GameCoreModule,
    RandomTurnGameKitModule,
  ],
  providers: [
    {
      provide: MNEMO_QUIZ_STORE,
      useFactory: () => {
        const store = new MnemoQuizStoreService();
        store.onModuleInit();
        return store;
      },
    },
    {
      provide: ArcheMnemoStateService,
      useFactory: () => new ArcheMnemoStateService(),
    },
    {
      provide: ArcheDeMnemosyneService,
      inject: [
        GameCoreService,
        TurnFlowService,
        MNEMO_QUIZ_STORE,
        RandomService,
        ArcheMnemoStateService,
      ],
      useFactory: (
        core: ConstructorParameters<typeof ArcheDeMnemosyneService>[0],
        turns: ConstructorParameters<typeof ArcheDeMnemosyneService>[1],
        store: ConstructorParameters<typeof ArcheDeMnemosyneService>[2],
        random: ConstructorParameters<typeof ArcheDeMnemosyneService>[3],
        stateSvc: ConstructorParameters<typeof ArcheDeMnemosyneService>[4],
      ) => new ArcheDeMnemosyneService(core, turns, store, random, stateSvc),
    },
  ],
  exports: [ArcheDeMnemosyneService, MNEMO_QUIZ_STORE, ArcheMnemoStateService],
})
export class ArcheDeMnemosyneModule {}




