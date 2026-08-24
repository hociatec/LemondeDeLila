import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { RandomService } from '../../../application/services/random.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GerardPresidentActionService } from './application/services/gerard-president-action.service';
import { GerardPresidentBotService } from './application/services/gerard-president-bot.service';
import { GerardPresidentPresenterService } from './application/services/gerard-president-presenter.service';
import { GerardPresidentSetupService } from './application/services/gerard-president-setup.service';
import { GerardPresidentService } from './application/services/gerard-president.service';

@Module({
  imports: [GameCoreModule, BoardGameDeckKitModule],
  providers: [
    DeckPoliciesService,
    RandomService,
    {
      provide: GerardPresidentSetupService,
      useFactory: (random: RandomService) =>
        new GerardPresidentSetupService(random),
      inject: [RandomService],
    },
    {
      provide: GerardPresidentActionService,
      useFactory: (random: RandomService, deckPolicies: DeckPoliciesService) =>
        new GerardPresidentActionService(random, deckPolicies),
      inject: [RandomService, DeckPoliciesService],
    },
    {
      provide: GerardPresidentPresenterService,
      useFactory: () => new GerardPresidentPresenterService(),
    },
    {
      provide: GerardPresidentBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new GerardPresidentBotService(botRunner),
      inject: [BotRunnerService],
    },
    {
      provide: GerardPresidentService,
      useFactory: (
        setup: GerardPresidentSetupService,
        actions: GerardPresidentActionService,
        presenter: GerardPresidentPresenterService,
        bots: GerardPresidentBotService,
      ) => new GerardPresidentService(setup, actions, presenter, bots),
      inject: [
        GerardPresidentSetupService,
        GerardPresidentActionService,
        GerardPresidentPresenterService,
        GerardPresidentBotService,
      ],
    },
  ],
  exports: [GerardPresidentService],
})
export class GerardPresidentModule {}





