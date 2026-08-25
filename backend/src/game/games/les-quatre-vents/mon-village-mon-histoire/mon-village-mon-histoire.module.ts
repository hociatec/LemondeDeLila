import { Module } from '@nestjs/common';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { MonVillageService } from './application/services/mon-village-mon-histoire.service';
import { MonVillageSetupService } from './application/services/mon-village-setup.service';
import { MonVillageActionService } from './application/services/mon-village-action.service';
import { MonVillagePresenterService } from './application/services/mon-village-presenter.service';
import { MonVillageBotService } from './application/services/mon-village-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    EngineServicesModule,
  ],
  providers: [
    DeckPoliciesService,
    {
      provide: MonVillageSetupService,
      inject: [GameContentLoaderService, RandomService],
      useFactory: (
        contentLoader: GameContentLoaderService,
        random: RandomService,
      ) => new MonVillageSetupService(contentLoader, random),
    },
    {
      provide: MonVillageActionService,
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
      ) => new MonVillageActionService(random, turns, core, deckPolicies),
    },
    {
      provide: MonVillagePresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new MonVillagePresenterService(boardPayload),
    },
    {
      provide: MonVillageBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new MonVillageBotService(botRunner),
    },
    {
      provide: MonVillageService,
      inject: [
        MonVillageSetupService,
        MonVillageActionService,
        MonVillagePresenterService,
        MonVillageBotService,
      ],
      useFactory: (
        setup: MonVillageSetupService,
        actions: MonVillageActionService,
        presenter: MonVillagePresenterService,
        bots: MonVillageBotService,
      ) => new MonVillageService(setup, actions, presenter, bots),
    },
  ],
  exports: [MonVillageService],
})
export class MonVillageModule {}





