import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { ZigEtZagActionService } from './actions/zig-et-zag-action.service';
import { ZigEtZagBotService } from './bots/zig-et-zag-bot.service';
import { ZigEtZagPresenterService } from './presenter/zig-et-zag-presenter.service';
import { ZigEtZagSetupService } from './setup/zig-et-zag-setup.service';
import { ZigEtZagService } from './zig-et-zag.service';

@Module({
  imports: [BoardGameCoreKitModule, GameCoreModule, GameRegistryModule],
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
