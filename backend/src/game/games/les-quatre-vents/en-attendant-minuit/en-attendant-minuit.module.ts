import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
import { TurnPoliciesModule } from '../../../application/modules/turn-policies.module';
import { PromptPoliciesModule } from '../../../application/modules/prompt-policies.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { GameCoreService } from '../../../application/services/game-core.service';
import { GameContentLoaderService } from '../../../engine/public-api';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { PromptPoliciesService } from '../../../application/services/prompt-policies.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { EnAttendantMinuitService } from './application/services/en-attendant-minuit.service';
import { MinuitSetupService } from './application/services/minuit-setup.service';
import { MinuitActionService } from './application/services/minuit-action.service';
import { MinuitPresenterService } from './application/services/minuit-presenter.service';
import { MinuitBotService } from './application/services/minuit-bot.service';

@Module({
  imports: [
    GameCoreModule,
    EngineServicesModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
    TurnPoliciesModule,
    PromptPoliciesModule,
  ],
  providers: [
    DeckPoliciesService,
    {
      provide: MinuitSetupService,
      useFactory: (
        core: GameCoreService,
        contentLoader: GameContentLoaderService,
        random: RandomService,
        setupFlow: SetupFlowService,
      ) => new MinuitSetupService(core, contentLoader, random, setupFlow),
      inject: [
        GameCoreService,
        GameContentLoaderService,
        RandomService,
        SetupFlowService,
      ],
    },
    {
      provide: MinuitActionService,
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
        setupFlow: SetupFlowService,
        deckPolicies: DeckPoliciesService,
        turnPolicies: TurnPoliciesService,
        promptPolicies: PromptPoliciesService,
      ) =>
        new MinuitActionService(
          random,
          turns,
          core,
          setupFlow,
          deckPolicies,
          turnPolicies,
          promptPolicies,
        ),
      inject: [
        RandomService,
        TurnFlowService,
        GameCoreService,
        SetupFlowService,
        DeckPoliciesService,
        TurnPoliciesService,
        PromptPoliciesService,
      ],
    },
    {
      provide: MinuitPresenterService,
      useFactory: (boardPayload: BoardPayloadService) =>
        new MinuitPresenterService(boardPayload),
      inject: [BoardPayloadService],
    },
    {
      provide: MinuitBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new MinuitBotService(botRunner),
      inject: [BotRunnerService],
    },
    {
      provide: EnAttendantMinuitService,
      useFactory: (
        setup: MinuitSetupService,
        actions: MinuitActionService,
        presenter: MinuitPresenterService,
        bots: MinuitBotService,
      ) => new EnAttendantMinuitService(setup, actions, presenter, bots),
      inject: [
        MinuitSetupService,
        MinuitActionService,
        MinuitPresenterService,
        MinuitBotService,
      ],
    },
  ],
  exports: [EnAttendantMinuitService],
})
export class EnAttendantMinuitModule {}





