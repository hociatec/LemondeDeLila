import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameCoreKitModule } from '../../../module/board-game-kits.module';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { ZigEtZagActionService } from './application/services/zig-et-zag-action.service';
import { ZigEtZagBotService } from './application/services/zig-et-zag-bot.service';
import { ZigEtZagPresenterService } from './application/services/zig-et-zag-presenter.service';
import { ZigEtZagSetupService } from './application/services/zig-et-zag-setup.service';
import { ZigEtZagService } from './application/services/zig-et-zag.service';

@Module({
  imports: [GameCoreModule, BoardGameCoreKitModule],
  providers: [
    RandomService,
    {
      provide: ZigEtZagSetupService,
      inject: [RandomService],
      useFactory: (random: RandomService) => new ZigEtZagSetupService(random),
    },
    {
      provide: ZigEtZagActionService,
      inject: [GameCoreService, TurnFlowService, RandomService],
      useFactory: (
        core: GameCoreService,
        turns: TurnFlowService,
        random: RandomService,
      ) => new ZigEtZagActionService(core, turns, random),
    },
    {
      provide: ZigEtZagPresenterService,
      useFactory: () => new ZigEtZagPresenterService(),
    },
    {
      provide: ZigEtZagBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) =>
        new ZigEtZagBotService(botRunner),
    },
    {
      provide: ZigEtZagService,
      inject: [
        ZigEtZagSetupService,
        ZigEtZagActionService,
        ZigEtZagPresenterService,
        ZigEtZagBotService,
      ],
      useFactory: (
        setup: ZigEtZagSetupService,
        actions: ZigEtZagActionService,
        presenter: ZigEtZagPresenterService,
        bots: ZigEtZagBotService,
      ) => new ZigEtZagService(setup, actions, presenter, bots),
    },
  ],
  exports: [ZigEtZagService],
})
export class ZigEtZagModule {}





