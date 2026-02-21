import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { GameCoreModule } from '../../../core/core.module';
import { DameNatureService } from './dame-nature.service';
import { DameNatureSetupService } from './setup/dame-nature-setup.service';
import { DameNatureActionService } from './actions/dame-nature-action.service';
import { DameNaturePresenterService } from './presenter/dame-nature-presenter.service';
import { DameNatureBotService } from './bots/dame-nature-bot.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule, GameRegistryModule],
  providers: [
    DameNatureService,
    DameNatureSetupService,
    DameNatureActionService,
    DameNaturePresenterService,
    DameNatureBotService,
  ],
  exports: [DameNatureService],
})
export class DameNatureModule {}
