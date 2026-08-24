import { Module } from '@nestjs/common';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { VoyageService } from './application/services/voyage.service';
import { VoyageSetupService } from './application/services/voyage-setup.service';
import { VoyageActionService } from './application/services/voyage-action.service';
import { VoyagePresenterService } from './application/services/voyage-presenter.service';
import { VoyageBotService } from './application/services/voyage-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    EngineServicesModule,
  ],
  providers: [
    DeckPoliciesService,
    {
      provide: VoyageSetupService,
      inject: [GameContentLoaderService, RandomService],
      useFactory: (
        contentLoader: GameContentLoaderService,
        random: RandomService,
      ) => new VoyageSetupService(contentLoader, random),
    },
    {
      provide: VoyageActionService,
      inject: [
        RandomService,
        TurnFlowService,
        GameCoreService,
        DeckPoliciesService,
      ],
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
        deckPolicies: DeckPoliciesService,
      ) => new VoyageActionService(random, turns, core, deckPolicies),
    },
    {
      provide: VoyagePresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new VoyagePresenterService(boardPayload),
    },
    {
      provide: VoyageBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) => new VoyageBotService(botRunner),
    },
    {
      provide: VoyageService,
      inject: [
        VoyageSetupService,
        VoyageActionService,
        VoyagePresenterService,
        VoyageBotService,
      ],
      useFactory: (
        setup: VoyageSetupService,
        actions: VoyageActionService,
        presenter: VoyagePresenterService,
        bots: VoyageBotService,
      ) => new VoyageService(setup, actions, presenter, bots),
    },
  ],
  exports: [VoyageService],
})
export class VoyageModule {}





