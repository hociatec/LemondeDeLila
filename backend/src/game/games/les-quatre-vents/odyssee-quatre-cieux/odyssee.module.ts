import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameCoreKitModule } from '../../../module/board-game-kits.module';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { OdysseeQuatreCieuxService } from './application/services/odyssee.service';
import { OdysseeSetupService } from './application/services/odyssee-setup.service';
import { OdysseeActionService } from './application/services/odyssee-action.service';
import { OdysseePresenterService } from './application/services/odyssee-presenter.service';
import { OdysseeBotService } from './application/services/odyssee-bot.service';

@Module({
  imports: [GameCoreModule, BoardGameCoreKitModule],
  providers: [
    RandomService,
    {
      provide: OdysseeSetupService,
      useFactory: () => new OdysseeSetupService(),
    },
    {
      provide: OdysseeActionService,
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
      ) => new OdysseeActionService(random, turns, core),
      inject: [RandomService, TurnFlowService, GameCoreService],
    },
    {
      provide: OdysseePresenterService,
      useFactory: (boardPayload: BoardPayloadService) =>
        new OdysseePresenterService(boardPayload),
      inject: [BoardPayloadService],
    },
    {
      provide: OdysseeBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new OdysseeBotService(botRunner),
      inject: [BotRunnerService],
    },
    {
      provide: OdysseeQuatreCieuxService,
      useFactory: (
        setup: OdysseeSetupService,
        actions: OdysseeActionService,
        presenter: OdysseePresenterService,
        bots: OdysseeBotService,
      ) => new OdysseeQuatreCieuxService(setup, actions, presenter, bots),
      inject: [
        OdysseeSetupService,
        OdysseeActionService,
        OdysseePresenterService,
        OdysseeBotService,
      ],
    },
  ],
  exports: [OdysseeQuatreCieuxService],
})
export class OdysseeQuatreCieuxModule {}



