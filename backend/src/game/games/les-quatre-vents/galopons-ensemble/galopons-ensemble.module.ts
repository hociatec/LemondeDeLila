import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { GameContentLoaderService } from '../../../engine/public-api';
import { RandomService } from '../../../core/application/services/random.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { GaloponsEnsembleService } from './application/services/galopons-ensemble.service';
import { GaloponsSetupService } from './application/services/galopons-setup.service';
import { GaloponsActionService } from './application/services/galopons-action.service';
import { GaloponsPresenterService } from './application/services/galopons-presenter.service';
import { GaloponsBotService } from './application/services/galopons-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    EngineServicesModule,
    SetupFlowModule,
  ],
  providers: [
    DeckPoliciesService,
    {
      provide: GaloponsSetupService,
      useFactory: (
        core: GameCoreService,
        contentLoader: GameContentLoaderService,
        random: RandomService,
        setupFlow: SetupFlowService,
      ) => new GaloponsSetupService(core, contentLoader, random, setupFlow),
      inject: [
        GameCoreService,
        GameContentLoaderService,
        RandomService,
        SetupFlowService,
      ],
    },
    {
      provide: GaloponsActionService,
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
        deckPolicies: DeckPoliciesService,
        setupFlow: SetupFlowService,
      ) =>
        new GaloponsActionService(
          random,
          turns,
          core,
          deckPolicies,
          setupFlow,
        ),
      inject: [
        RandomService,
        TurnFlowService,
        GameCoreService,
        DeckPoliciesService,
        SetupFlowService,
      ],
    },
    {
      provide: GaloponsPresenterService,
      useFactory: (boardPayload: BoardPayloadService) =>
        new GaloponsPresenterService(boardPayload),
      inject: [BoardPayloadService],
    },
    {
      provide: GaloponsBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new GaloponsBotService(botRunner),
      inject: [BotRunnerService],
    },
    {
      provide: GaloponsEnsembleService,
      useFactory: (
        setup: GaloponsSetupService,
        actions: GaloponsActionService,
        presenter: GaloponsPresenterService,
        bots: GaloponsBotService,
      ) => new GaloponsEnsembleService(setup, actions, presenter, bots),
      inject: [
        GaloponsSetupService,
        GaloponsActionService,
        GaloponsPresenterService,
        GaloponsBotService,
      ],
    },
  ],
  exports: [GaloponsEnsembleService],
})
export class GaloponsEnsembleModule {}





