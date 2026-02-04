import { Module } from '@nestjs/common';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { EntreRitesActionService } from './actions/entre-rites-action.service';
import { EntreRitesPresenterService } from './presenter/entre-rites-presenter.service';
import { EntreRitesSetupService } from './setup/entre-rites-setup.service';
import { EntreRitesService } from './entre-rites.service';
import { EntreRitesBotService } from './bots/entre-rites-bot.service';

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
    EntreRitesService,
    EntreRitesSetupService,
    EntreRitesActionService,
    EntreRitesPresenterService,
    EntreRitesBotService,
  ],
  exports: [EntreRitesService],
})
export class EntreRitesModule {}
