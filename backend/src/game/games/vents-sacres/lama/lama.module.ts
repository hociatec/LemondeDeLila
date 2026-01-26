import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { LamaPresenter } from './lama.presenter';
import { LamaService } from './lama.service';
import { LamaSharedService } from './shared/lama-shared.service';
import { LamaRoundService } from './round/lama-round.service';
import { LamaSetupService } from './setup/lama-setup.service';
import { LamaActionService } from './actions/lama-action.service';
import { LamaDrawService } from './actions/lama-draw.service';
import { LamaPassService } from './actions/lama-pass.service';
import { LamaPlayService } from './actions/lama-play.service';
import { LamaQuitService } from './actions/lama-quit.service';
import { LamaReturnService } from './actions/lama-return.service';
import { LamaInfoService } from './actions/lama-info.service';
import { LamaBotService } from './bots/lama-bot.service';
import { LamaShortcutsService } from './shortcuts/lama-shortcuts.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule, RandomModule],
  providers: [
    LamaService,
    LamaPresenter,
    LamaSharedService,
    LamaRoundService,
    LamaSetupService,
    LamaActionService,
    LamaDrawService,
    LamaPassService,
    LamaPlayService,
    LamaQuitService,
    LamaReturnService,
    LamaInfoService,
    LamaBotService,
    LamaShortcutsService,
  ],
  exports: [LamaService],
})
export class LamaModule {}
