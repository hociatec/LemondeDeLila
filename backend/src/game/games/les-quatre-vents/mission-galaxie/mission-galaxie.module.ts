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
import { MissionGalaxieService } from './application/services/mission-galaxie.service';
import { MissionGalaxieSetupService } from './application/services/mission-galaxie-setup.service';
import { MissionGalaxieActionService } from './application/services/mission-galaxie-action.service';
import { MissionGalaxiePresenterService } from './application/services/mission-galaxie-presenter.service';
import { MissionGalaxieBotService } from './application/services/mission-galaxie-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    EngineServicesModule,
  ],
  providers: [
    DeckPoliciesService,
    {
      provide: MissionGalaxieSetupService,
      inject: [GameContentLoaderService, RandomService],
      useFactory: (
        contentLoader: GameContentLoaderService,
        random: RandomService,
      ) => new MissionGalaxieSetupService(contentLoader, random),
    },
    {
      provide: MissionGalaxieActionService,
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
      ) => new MissionGalaxieActionService(random, turns, core, deckPolicies),
    },
    {
      provide: MissionGalaxiePresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new MissionGalaxiePresenterService(boardPayload),
    },
    {
      provide: MissionGalaxieBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new MissionGalaxieBotService(botRunner),
    },
    {
      provide: MissionGalaxieService,
      inject: [
        MissionGalaxieSetupService,
        MissionGalaxieActionService,
        MissionGalaxiePresenterService,
        MissionGalaxieBotService,
      ],
      useFactory: (
        setup: MissionGalaxieSetupService,
        actions: MissionGalaxieActionService,
        presenter: MissionGalaxiePresenterService,
        bots: MissionGalaxieBotService,
      ) => new MissionGalaxieService(setup, actions, presenter, bots),
    },
  ],
  exports: [MissionGalaxieService],
})
export class MissionGalaxieModule {}





