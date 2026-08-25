import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import { AFondLesBallonsService } from './application/services/a-fond-les-ballons.service';
import { AFondLesBallonsSetupService } from './application/services/a-fond-les-ballons-setup.service';
import { AFondLesBallonsActionService } from './application/services/a-fond-les-ballons-action.service';
import { AFondLesBallonsPresenterService } from './application/services/a-fond-les-ballons-presenter.service';
import { AFondLesBallonsBotService } from './application/services/a-fond-les-ballons-bot.service';

@Module({
  imports: [
    GameCoreModule,
    EngineServicesModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
  ],
  providers: [
    DeckPoliciesService,
    {
      provide: AFondLesBallonsSetupService,
      inject: [
        GameCoreService,
        RandomService,
        GameContentLoaderService,
        SetupFlowService,
      ],
      useFactory: (
        core: GameCoreService,
        random: RandomService,
        contentLoader: GameContentLoaderService,
        setupFlow: SetupFlowService,
      ) =>
        new AFondLesBallonsSetupService(
          core,
          random,
          contentLoader,
          setupFlow,
        ),
    },
    {
      provide: AFondLesBallonsActionService,
      inject: [
        GameCoreService,
        RandomService,
        TurnFlowService,
        DeckPoliciesService,
        SetupFlowService,
      ],
      useFactory: (
        core: GameCoreService,
        random: RandomService,
        turns: TurnFlowService,
        deckPolicies: DeckPoliciesService,
        setupFlow: SetupFlowService,
      ) =>
        new AFondLesBallonsActionService(
          core,
          random,
          turns,
          deckPolicies,
          setupFlow,
        ),
    },
    {
      provide: AFondLesBallonsPresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new AFondLesBallonsPresenterService(boardPayload),
    },
    {
      provide: AFondLesBallonsBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new AFondLesBallonsBotService(botRunner),
    },
    {
      provide: AFondLesBallonsService,
      inject: [
        AFondLesBallonsSetupService,
        AFondLesBallonsActionService,
        AFondLesBallonsPresenterService,
        AFondLesBallonsBotService,
      ],
      useFactory: (
        setup: AFondLesBallonsSetupService,
        actions: AFondLesBallonsActionService,
        presenter: AFondLesBallonsPresenterService,
        bots: AFondLesBallonsBotService,
      ) => new AFondLesBallonsService(setup, actions, presenter, bots),
    },
  ],
  exports: [AFondLesBallonsService],
})
export class AFondLesBallonsModule {}
