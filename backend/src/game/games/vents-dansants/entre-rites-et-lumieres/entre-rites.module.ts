import { Module } from '@nestjs/common';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { EntreRitesActionService } from './application/services/entre-rites-action.service';
import { EntreRitesPresenterService } from './application/services/entre-rites-presenter.service';
import { EntreRitesSetupService } from './application/services/entre-rites-setup.service';
import { EntreRitesService } from './application/services/entre-rites.service';
import { EntreRitesBotService } from './application/services/entre-rites-bot.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule],
  providers: [
    DeckPoliciesService,
    RandomService,
    {
      provide: EntreRitesSetupService,
      inject: [RandomService],
      useFactory: (random: RandomService) => new EntreRitesSetupService(random),
    },
    {
      provide: EntreRitesActionService,
      inject: [GameCoreService, TurnFlowService, DeckPoliciesService],
      useFactory: (
        core: GameCoreService,
        turns: TurnFlowService,
        deckPolicies: DeckPoliciesService,
      ) => new EntreRitesActionService(core, turns, deckPolicies),
    },
    {
      provide: EntreRitesPresenterService,
      useFactory: () => new EntreRitesPresenterService(),
    },
    {
      provide: EntreRitesBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new EntreRitesBotService(botRunner),
    },
    {
      provide: EntreRitesService,
      inject: [
        EntreRitesSetupService,
        EntreRitesActionService,
        EntreRitesPresenterService,
        EntreRitesBotService,
      ],
      useFactory: (
        setup: EntreRitesSetupService,
        actions: EntreRitesActionService,
        presenter: EntreRitesPresenterService,
        bots: EntreRitesBotService,
      ) => new EntreRitesService(setup, actions, presenter, bots),
    },
  ],
  exports: [EntreRitesService],
})
export class EntreRitesModule {}





