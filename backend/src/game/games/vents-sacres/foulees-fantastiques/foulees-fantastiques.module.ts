import { Module } from '@nestjs/common';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
import { BoardGameCoreKitModule } from '../../../composition/board-game-kits.module';
import { FouleesFantastiquesService } from './application/services/foulees-fantastiques.service';
import { FouleesFantastiquesSetupService } from './application/services/foulees-fantastiques-setup.service';
import { FouleesFantastiquesActionService } from './application/services/foulees-fantastiques-action.service';
import { FouleesFantastiquesPhaseService } from './application/services/foulees-fantastiques-phase.service';
import { FouleesFantastiquesPresenterService } from './application/services/foulees-fantastiques-presenter.service';
import { FouleesFantastiquesBotService } from './application/services/foulees-fantastiques-bot.service';

@Module({
  imports: [
    GameCoreModule,
    EngineServicesModule,
    BoardGameCoreKitModule,
    SetupFlowModule,
  ],
  providers: [
    RandomService,
    {
      provide: FouleesFantastiquesSetupService,
      inject: [GameCoreService, GameContentLoaderService, SetupFlowService],
      useFactory: (
        core: GameCoreService,
        contentLoader: GameContentLoaderService,
        setupFlow: SetupFlowService,
      ) => new FouleesFantastiquesSetupService(core, contentLoader, setupFlow),
    },
    {
      provide: FouleesFantastiquesActionService,
      inject: [
        RandomService,
        TurnFlowService,
        GameCoreService,
        FouleesFantastiquesSetupService,
        SetupFlowService,
      ],
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
        setup: FouleesFantastiquesSetupService,
        setupFlow: SetupFlowService,
      ) =>
        new FouleesFantastiquesActionService(
          random,
          turns,
          core,
          setup,
          setupFlow,
        ),
    },
    {
      provide: FouleesFantastiquesPhaseService,
      useFactory: () => new FouleesFantastiquesPhaseService(),
    },
    {
      provide: FouleesFantastiquesPresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new FouleesFantastiquesPresenterService(boardPayload),
    },
    {
      provide: FouleesFantastiquesBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new FouleesFantastiquesBotService(botRunner),
    },
    {
      provide: FouleesFantastiquesService,
      inject: [
        FouleesFantastiquesSetupService,
        FouleesFantastiquesActionService,
        FouleesFantastiquesPhaseService,
        FouleesFantastiquesPresenterService,
        FouleesFantastiquesBotService,
      ],
      useFactory: (
        setup: FouleesFantastiquesSetupService,
        actions: FouleesFantastiquesActionService,
        phases: FouleesFantastiquesPhaseService,
        presenter: FouleesFantastiquesPresenterService,
        bots: FouleesFantastiquesBotService,
      ) =>
        new FouleesFantastiquesService(
          setup,
          actions,
          phases,
          presenter,
          bots,
        ),
    },
  ],
  exports: [FouleesFantastiquesService],
})
export class FouleesFantastiquesModule {}





