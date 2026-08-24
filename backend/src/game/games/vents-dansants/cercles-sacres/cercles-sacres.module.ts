import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { GameCoreService } from '../../../application/services/game-core.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { RandomService } from '../../../application/services/random.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { CerclesSacresService } from './application/services/cercles-sacres.service';
import { CerclesSacresSetupService } from './application/services/cercles-sacres-setup.service';
import { CerclesSacresActionService } from './application/services/cercles-sacres-action.service';
import { CerclesSacresPresenterService } from './application/services/cercles-sacres-presenter.service';
import { CerclesSacresBotService } from './application/services/cercles-sacres-bot.service';

@Module({
  imports: [GameCoreModule, BoardGameDeckKitModule],
  providers: [
    DeckPoliciesService,
    RandomService,
    {
      provide: CerclesSacresSetupService,
      useFactory: (random: RandomService) =>
        new CerclesSacresSetupService(random),
      inject: [RandomService],
    },
    {
      provide: CerclesSacresActionService,
      useFactory: (
        core: GameCoreService,
        turns: TurnFlowService,
        deckPolicies: DeckPoliciesService,
      ) => new CerclesSacresActionService(core, turns, deckPolicies),
      inject: [GameCoreService, TurnFlowService, DeckPoliciesService],
    },
    {
      provide: CerclesSacresPresenterService,
      useFactory: () => new CerclesSacresPresenterService(),
    },
    {
      provide: CerclesSacresBotService,
      useFactory: (botRunner: BotRunnerService, random: RandomService) =>
        new CerclesSacresBotService(botRunner, random),
      inject: [BotRunnerService, RandomService],
    },
    {
      provide: CerclesSacresService,
      useFactory: (
        setup: CerclesSacresSetupService,
        actions: CerclesSacresActionService,
        presenter: CerclesSacresPresenterService,
        bots: CerclesSacresBotService,
      ) => new CerclesSacresService(setup, actions, presenter, bots),
      inject: [
        CerclesSacresSetupService,
        CerclesSacresActionService,
        CerclesSacresPresenterService,
        CerclesSacresBotService,
      ],
    },
  ],
  exports: [CerclesSacresService],
})
export class CerclesSacresModule {}




