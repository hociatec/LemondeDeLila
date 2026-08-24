import { Module } from '@nestjs/common';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { BoardGameCoreKitModule } from '../../../module/board-game-kits.module';
import { GameCoreModule } from '../../../module/game-core.module';
import { LaParadeSucreeService } from './application/services/la-parade-sucree.service';
import { LaParadeSucreeSetupService } from './application/services/la-parade-sucree-setup.service';
import { LaParadeSucreeActionService } from './application/services/la-parade-sucree-action.service';
import { LaParadeSucreePresenterService } from './application/services/la-parade-sucree-presenter.service';
import { LaParadeSucreeBotService } from './application/services/la-parade-sucree-bot.service';

@Module({
  imports: [BoardGameCoreKitModule, GameCoreModule],
  providers: [
    {
      provide: LaParadeSucreeSetupService,
      inject: [RandomService],
      useFactory: (random: RandomService) =>
        new LaParadeSucreeSetupService(random),
    },
    {
      provide: LaParadeSucreeActionService,
      inject: [GameCoreService, TurnFlowService],
      useFactory: (core: GameCoreService, turns: TurnFlowService) =>
        new LaParadeSucreeActionService(core, turns),
    },
    {
      provide: LaParadeSucreePresenterService,
      useFactory: () => new LaParadeSucreePresenterService(),
    },
    {
      provide: LaParadeSucreeBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new LaParadeSucreeBotService(botRunner),
    },
    {
      provide: LaParadeSucreeService,
      inject: [
        LaParadeSucreeSetupService,
        LaParadeSucreeActionService,
        LaParadeSucreePresenterService,
        LaParadeSucreeBotService,
      ],
      useFactory: (
        setup: LaParadeSucreeSetupService,
        actions: LaParadeSucreeActionService,
        presenter: LaParadeSucreePresenterService,
        bots: LaParadeSucreeBotService,
      ) => new LaParadeSucreeService(setup, actions, presenter, bots),
    },
  ],
  exports: [LaParadeSucreeService],
})
export class LaParadeSucreeModule {}





