import { Module } from '@nestjs/common';
import { BoardEffectsPoliciesService } from '../../../board-effects-policies/application/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
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
import { BoardEffectsPoliciesModule } from '../../../board-effects-policies/infrastructure/board-effects-policies.module';
import { TurnPoliciesModule } from '../../../core/infrastructure/module/turn-policies.module';
import { PromptsModule } from '../../../prompts/public-api';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
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
    PromptsModule,
  ],
  providers: [
    DeckPoliciesService,
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





