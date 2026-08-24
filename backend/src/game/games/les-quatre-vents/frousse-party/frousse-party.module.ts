import { Module } from '@nestjs/common';
import { BoardEffectsPoliciesService } from '../../../application/features/board-effects-policies/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
import { BoardEffectsPoliciesModule } from '../../../application/modules/board-effects-policies.module';
import { TurnPoliciesModule } from '../../../application/modules/turn-policies.module';
import { PromptPoliciesModule } from '../../../application/modules/prompt-policies.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { FroussePartyService } from './application/services/frousse-party.service';
import { FrousseSetupService } from './application/services/frousse-setup.service';
import { FrousseActionService } from './application/services/frousse-action.service';
import { FroussePresenterService } from './application/services/frousse-presenter.service';
import { FrousseBotService } from './application/services/frousse-bot.service';

@Module({
  imports: [
    GameCoreModule,
    EngineServicesModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
    BoardEffectsPoliciesModule,
    TurnPoliciesModule,
    PromptPoliciesModule,
  ],
  providers: [
    {
      provide: FrousseSetupService,
      inject: [
        GameCoreService,
        GameContentLoaderService,
        RandomService,
        SetupFlowService,
      ],
      useFactory: (
        core: GameCoreService,
        contentLoader: GameContentLoaderService,
        random: RandomService,
        setupFlow: SetupFlowService,
      ) => new FrousseSetupService(core, contentLoader, random, setupFlow),
    },
    {
      provide: FrousseActionService,
      inject: [
        RandomService,
        TurnFlowService,
        GameCoreService,
        SetupFlowService,
        BoardEffectsPoliciesService,
        DeckPoliciesService,
      ],
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
        setupFlow: SetupFlowService,
        boardEffects: BoardEffectsPoliciesService,
        deckPolicies: DeckPoliciesService,
      ) =>
        new FrousseActionService(
          random,
          turns,
          core,
          setupFlow,
          boardEffects,
          deckPolicies,
        ),
    },
    {
      provide: FroussePresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new FroussePresenterService(boardPayload),
    },
    {
      provide: FrousseBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) => new FrousseBotService(botRunner),
    },
    {
      provide: FroussePartyService,
      inject: [
        FrousseSetupService,
        FrousseActionService,
        FroussePresenterService,
        FrousseBotService,
      ],
      useFactory: (
        setup: FrousseSetupService,
        actions: FrousseActionService,
        presenter: FroussePresenterService,
        bots: FrousseBotService,
      ) => new FroussePartyService(setup, actions, presenter, bots),
    },
  ],
  exports: [FroussePartyService],
})
export class FroussePartyModule {}





