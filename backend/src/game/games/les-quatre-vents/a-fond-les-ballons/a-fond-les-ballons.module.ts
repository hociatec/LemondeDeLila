import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { AFondLesBallonsService } from './a-fond-les-ballons.service';
import { AFondLesBallonsSetupService } from './setup/a-fond-les-ballons-setup.service';
import { AFondLesBallonsActionService } from './actions/a-fond-les-ballons-action.service';
import { AFondLesBallonsPresenterService } from './presenter/a-fond-les-ballons-presenter.service';
import { AFondLesBallonsBotService } from './bots/a-fond-les-ballons-bot.service';

@Module({
  imports: [GameCoreModule, GameRegistryModule, RandomModule, TurnModule, BotModule],
  providers: [
    AFondLesBallonsService,
    AFondLesBallonsSetupService,
    AFondLesBallonsActionService,
    AFondLesBallonsPresenterService,
    AFondLesBallonsBotService,
  ],
  exports: [AFondLesBallonsService],
})
export class AFondLesBallonsModule {}

