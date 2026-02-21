import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EntreRitesActionService } from './actions/entre-rites-action.service';
import { EntreRitesPresenterService } from './presenter/entre-rites-presenter.service';
import { EntreRitesSetupService } from './setup/entre-rites-setup.service';
import { EntreRitesService } from './entre-rites.service';
import { EntreRitesBotService } from './bots/entre-rites-bot.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule, GameRegistryModule],
  providers: [
    EntreRitesService,
    EntreRitesSetupService,
    EntreRitesActionService,
    EntreRitesPresenterService,
    EntreRitesBotService,
  ],
  exports: [EntreRitesService],
})
export class EntreRitesModule {}
