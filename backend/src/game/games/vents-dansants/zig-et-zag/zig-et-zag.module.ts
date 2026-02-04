import { Module } from '@nestjs/common';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { ZigEtZagActionService } from './actions/zig-et-zag-action.service';
import { ZigEtZagBotService } from './bots/zig-et-zag-bot.service';
import { ZigEtZagPresenterService } from './presenter/zig-et-zag-presenter.service';
import { ZigEtZagSetupService } from './setup/zig-et-zag-setup.service';
import { ZigEtZagService } from './zig-et-zag.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    ZigEtZagService,
    ZigEtZagSetupService,
    ZigEtZagActionService,
    ZigEtZagPresenterService,
    ZigEtZagBotService,
  ],
  exports: [ZigEtZagService],
})
export class ZigEtZagModule {}
