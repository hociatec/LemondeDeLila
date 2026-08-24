import { Module } from '@nestjs/common';
import { BoardGameCoreKitModule } from '../../../module/board-game-kits.module';
import { GameCoreModule } from '../../../module/game-core.module';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { OlympiaService } from './application/services/olympia.service';
import { OlympiaSetupService } from './application/services/olympia-setup.service';
import { OlympiaActionService } from './application/services/olympia-action.service';
import { OlympiaPresenterService } from './application/services/olympia-presenter.service';
import { OlympiaBotService } from './application/services/olympia-bot.service';

@Module({
  imports: [GameCoreModule, BoardGameCoreKitModule],
  providers: [
    RandomService,
    {
      provide: OlympiaSetupService,
      useFactory: (random: RandomService) => new OlympiaSetupService(random),
      inject: [RandomService],
    },
    {
      provide: OlympiaActionService,
      useFactory: (core: GameCoreService, turns: TurnFlowService) =>
        new OlympiaActionService(core, turns),
      inject: [GameCoreService, TurnFlowService],
    },
    {
      provide: OlympiaPresenterService,
      useFactory: () => new OlympiaPresenterService(),
    },
    {
      provide: OlympiaBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new OlympiaBotService(botRunner),
      inject: [BotRunnerService],
    },
    {
      provide: OlympiaService,
      useFactory: (
        setup: OlympiaSetupService,
        actions: OlympiaActionService,
        presenter: OlympiaPresenterService,
        bots: OlympiaBotService,
      ) => new OlympiaService(setup, actions, presenter, bots),
      inject: [
        OlympiaSetupService,
        OlympiaActionService,
        OlympiaPresenterService,
        OlympiaBotService,
      ],
    },
  ],
  exports: [OlympiaService],
})
export class OlympiaModule {}





