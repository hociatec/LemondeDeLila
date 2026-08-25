import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
import { TurnPoliciesModule } from '../../../core/infrastructure/module/turn-policies.module';
import { PromptsModule } from '../../../prompts/public-api';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { GameContentLoaderService } from '../../../engine/public-api';
import { RandomService } from '../../../core/application/services/random.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { PromptPoliciesService } from '../../../prompts/public-api';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
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
    PromptsModule,
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





