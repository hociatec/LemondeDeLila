import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
import { BoardEffectsPoliciesModule } from '../../../application/modules/board-effects-policies.module';
import { TurnPoliciesModule } from '../../../application/modules/turn-policies.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { BoardEffectsPoliciesService } from '../../../application/features/board-effects-policies/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { AventureSauvageService } from './application/services/aventure-sauvage.service';
import { AventureSauvageSetupService } from './application/services/aventure-sauvage-setup.service';
import { AventureSauvageActionService } from './application/services/aventure-sauvage-action.service';
import { AventureSauvagePresenterService } from './application/services/aventure-sauvage-presenter.service';
import { AventureSauvageBotService } from './application/services/aventure-sauvage-bot.service';

@Module({
  imports: [
    GameCoreModule,
    EngineServicesModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
    BoardEffectsPoliciesModule,
    TurnPoliciesModule,
  ],
  providers: [
    {
      provide: AventureSauvageSetupService,
      useFactory: (
        core: GameCoreService,
        random: RandomService,
        contentLoader: GameContentLoaderService,
        setupFlow: SetupFlowService,
      ) =>
        new AventureSauvageSetupService(
          core,
          random,
          contentLoader,
          setupFlow,
        ),
      inject: [
        GameCoreService,
        RandomService,
        GameContentLoaderService,
        SetupFlowService,
      ],
    },
    {
      provide: AventureSauvageActionService,
      useFactory: (
        core: GameCoreService,
        random: RandomService,
        setupFlow: SetupFlowService,
        boardEffects: BoardEffectsPoliciesService,
        deckPolicies: DeckPoliciesService,
        turnPolicies: TurnPoliciesService,
      ) =>
        new AventureSauvageActionService(
          core,
          random,
          setupFlow,
          boardEffects,
          deckPolicies,
          turnPolicies,
        ),
      inject: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        BoardEffectsPoliciesService,
        DeckPoliciesService,
        TurnPoliciesService,
      ],
    },
    {
      provide: AventureSauvagePresenterService,
      useFactory: (boardPayload: BoardPayloadService) =>
        new AventureSauvagePresenterService(boardPayload),
      inject: [BoardPayloadService],
    },
    {
      provide: AventureSauvageBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new AventureSauvageBotService(botRunner),
      inject: [BotRunnerService],
    },
    {
      provide: AventureSauvageService,
      useFactory: (
        setup: AventureSauvageSetupService,
        actions: AventureSauvageActionService,
        presenter: AventureSauvagePresenterService,
        bots: AventureSauvageBotService,
      ) => new AventureSauvageService(setup, actions, presenter, bots),
      inject: [
        AventureSauvageSetupService,
        AventureSauvageActionService,
        AventureSauvagePresenterService,
        AventureSauvageBotService,
      ],
    },
  ],
  exports: [AventureSauvageService],
})
export class AventureSauvageModule {}





