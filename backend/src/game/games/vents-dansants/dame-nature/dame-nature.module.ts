import { Module } from '@nestjs/common';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { DameNatureService } from './application/services/dame-nature.service';
import { DameNatureSetupService } from './application/services/dame-nature-setup.service';
import { DameNatureActionService } from './application/services/dame-nature-action.service';
import { DameNaturePresenterService } from './application/services/dame-nature-presenter.service';
import { DameNatureBotService } from './application/services/dame-nature-bot.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule],
  providers: [
    DeckPoliciesService,
    RandomService,
    {
      provide: DameNatureSetupService,
      inject: [RandomService],
      useFactory: (random: RandomService) => new DameNatureSetupService(random),
    },
    {
      provide: DameNatureActionService,
      inject: [GameCoreService, TurnFlowService, DeckPoliciesService],
      useFactory: (
        core: GameCoreService,
        turns: TurnFlowService,
        deckPolicies: DeckPoliciesService,
      ) => new DameNatureActionService(core, turns, deckPolicies),
    },
    {
      provide: DameNaturePresenterService,
      useFactory: () => new DameNaturePresenterService(),
    },
    {
      provide: DameNatureBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new DameNatureBotService(botRunner),
    },
    {
      provide: DameNatureService,
      inject: [
        DameNatureSetupService,
        DameNatureActionService,
        DameNaturePresenterService,
        DameNatureBotService,
      ],
      useFactory: (
        setup: DameNatureSetupService,
        actions: DameNatureActionService,
        presenter: DameNaturePresenterService,
        bots: DameNatureBotService,
      ) => new DameNatureService(setup, actions, presenter, bots),
    },
  ],
  exports: [DameNatureService],
})
export class DameNatureModule {}





