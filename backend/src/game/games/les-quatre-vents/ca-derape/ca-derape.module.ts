import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { GameCoreService } from '../../../application/services/game-core.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { CaDerapeService } from './application/services/ca-derape.service';
import { CaSetupService } from './setup/ca.setup';
import { CaActionService } from './application/services/ca-actions.service';
import { CaPresenterService } from './application/services/ca-presenter.service';
import { CaBotService } from './application/services/ca-bot.service';

@Module({
  imports: [GameCoreModule, BoardGameDeckKitModule],
  providers: [
    RandomService,
    {
      provide: CaSetupService,
      useFactory: () => new CaSetupService(),
    },
    {
      provide: CaActionService,
      inject: [RandomService, TurnFlowService, GameCoreService, DeckPoliciesService],
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
        deckPolicies: DeckPoliciesService,
      ) => new CaActionService(random, turns, core, deckPolicies),
    },
    {
      provide: CaPresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new CaPresenterService(boardPayload),
    },
    {
      provide: CaBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) => new CaBotService(botRunner),
    },
    {
      provide: CaDerapeService,
      inject: [CaSetupService, CaActionService, CaPresenterService, CaBotService],
      useFactory: (
        setup: CaSetupService,
        actions: CaActionService,
        presenter: CaPresenterService,
        bots: CaBotService,
      ) => new CaDerapeService(setup, actions, presenter, bots),
    },
  ],
  exports: [CaDerapeService],
})
export class CaDerapeModule {}



