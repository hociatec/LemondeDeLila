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
import { ToutPresDeMamanService } from './application/services/tout-pres-de-maman.service';
import { ToutPresDeMamanSetupService } from './application/services/tout-pres-de-maman-setup.service';
import { ToutPresDeMamanActionService } from './application/services/tout-pres-de-maman-action.service';
import { ToutPresDeMamanPresenterService } from './application/services/tout-pres-de-maman-presenter.service';
import { ToutPresDeMamanBotService } from './application/services/tout-pres-de-maman-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    EngineServicesModule,
  ],
  providers: [
    DeckPoliciesService,
    {
      provide: ToutPresDeMamanSetupService,
      inject: [GameContentLoaderService, RandomService],
      useFactory: (
        contentLoader: GameContentLoaderService,
        random: RandomService,
      ) => new ToutPresDeMamanSetupService(contentLoader, random),
    },
    {
      provide: ToutPresDeMamanActionService,
      inject: [GameCoreService, RandomService, TurnFlowService, DeckPoliciesService],
      useFactory: (
        core: GameCoreService,
        random: RandomService,
        turns: TurnFlowService,
        deckPolicies: DeckPoliciesService,
      ) => new ToutPresDeMamanActionService(core, random, turns, deckPolicies),
    },
    {
      provide: ToutPresDeMamanPresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new ToutPresDeMamanPresenterService(boardPayload),
    },
    {
      provide: ToutPresDeMamanBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new ToutPresDeMamanBotService(botRunner),
    },
    {
      provide: ToutPresDeMamanService,
      inject: [
        ToutPresDeMamanSetupService,
        ToutPresDeMamanActionService,
        ToutPresDeMamanPresenterService,
        ToutPresDeMamanBotService,
      ],
      useFactory: (
        setup: ToutPresDeMamanSetupService,
        actions: ToutPresDeMamanActionService,
        presenter: ToutPresDeMamanPresenterService,
        bots: ToutPresDeMamanBotService,
      ) => new ToutPresDeMamanService(setup, actions, presenter, bots),
    },
  ],
  exports: [ToutPresDeMamanService],
})
export class ToutPresDeMamanModule {}





