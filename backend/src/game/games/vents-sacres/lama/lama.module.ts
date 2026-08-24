import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RandomService } from '../../../application/services/random.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { RandomGameCoreKitModule } from '../../../module/board-game-kits.module';
import { LamaPresenter } from './application/services/lama.presenter';
import { LamaService } from './application/services/lama.service';
import { LamaSharedService } from './application/services/lama-shared.service';
import { LamaRoundService } from './application/services/lama-round.service';
import { LamaSetupService } from './application/services/lama-setup.service';
import { LamaActionService } from './application/services/lama-action.service';
import { LamaDrawService } from './application/services/lama-draw.service';
import { LamaPassService } from './application/services/lama-pass.service';
import { LamaPlayService } from './application/services/lama-play.service';
import { LamaQuitService } from './application/services/lama-quit.service';
import { LamaReturnService } from './application/services/lama-return.service';
import { LamaInfoService } from './application/services/lama-info.service';
import { LamaBotService } from './application/services/lama-bot.service';
import { LamaShortcutsService } from './application/services/lama-shortcuts.service';
import { LamaLogService } from './application/services/lama-log.service';

@Module({
  imports: [
    ConfigModule,
    GameCoreModule,
    RandomGameCoreKitModule,
  ],
  providers: [
    RandomService,
    {
      provide: LamaSharedService,
      useFactory: () => new LamaSharedService(),
    },
    {
      provide: LamaPresenter,
      useFactory: () => new LamaPresenter(),
    },
    {
      provide: LamaLogService,
      useFactory: () => new LamaLogService(),
    },
    {
      provide: LamaRoundService,
      inject: [RandomService, LamaLogService, LamaSharedService],
      useFactory: (
        random: RandomService,
        logger: LamaLogService,
        shared: LamaSharedService,
      ) => new LamaRoundService(random, logger, shared),
    },
    {
      provide: LamaSetupService,
      inject: [LamaSharedService, LamaRoundService, LamaLogService],
      useFactory: (
        shared: LamaSharedService,
        round: LamaRoundService,
        logger: LamaLogService,
      ) => new LamaSetupService(shared, round, logger),
    },
    {
      provide: LamaDrawService,
      inject: [LamaSharedService, LamaRoundService, LamaLogService],
      useFactory: (
        shared: LamaSharedService,
        round: LamaRoundService,
        logger: LamaLogService,
      ) => new LamaDrawService(shared, round, logger),
    },
    {
      provide: LamaPassService,
      inject: [LamaSharedService, LamaRoundService, LamaLogService],
      useFactory: (
        shared: LamaSharedService,
        round: LamaRoundService,
        logger: LamaLogService,
      ) => new LamaPassService(shared, round, logger),
    },
    {
      provide: LamaPlayService,
      inject: [LamaSharedService, LamaRoundService, LamaLogService],
      useFactory: (
        shared: LamaSharedService,
        round: LamaRoundService,
        logger: LamaLogService,
      ) => new LamaPlayService(shared, round, logger),
    },
    {
      provide: LamaQuitService,
      inject: [LamaSharedService, LamaRoundService, LamaLogService],
      useFactory: (
        shared: LamaSharedService,
        round: LamaRoundService,
        logger: LamaLogService,
      ) => new LamaQuitService(shared, round, logger),
    },
    {
      provide: LamaReturnService,
      inject: [LamaSharedService, LamaRoundService, LamaLogService],
      useFactory: (
        shared: LamaSharedService,
        round: LamaRoundService,
        logger: LamaLogService,
      ) => new LamaReturnService(shared, round, logger),
    },
    {
      provide: LamaInfoService,
      inject: [LamaSharedService, LamaLogService],
      useFactory: (shared: LamaSharedService, logger: LamaLogService) =>
        new LamaInfoService(shared, logger),
    },
    {
      provide: LamaActionService,
      inject: [
        LamaSharedService,
        LamaDrawService,
        LamaPassService,
        LamaPlayService,
        LamaQuitService,
        LamaReturnService,
        LamaInfoService,
        LamaSetupService,
        LamaLogService,
      ],
      useFactory: (
        shared: LamaSharedService,
        draw: LamaDrawService,
        pass: LamaPassService,
        play: LamaPlayService,
        quit: LamaQuitService,
        ret: LamaReturnService,
        info: LamaInfoService,
        setup: LamaSetupService,
        logger: LamaLogService,
      ) =>
        new LamaActionService(
          shared,
          draw,
          pass,
          play,
          quit,
          ret,
          info,
          setup,
          logger,
        ),
    },
    {
      provide: LamaBotService,
      inject: [LamaSharedService],
      useFactory: (shared: LamaSharedService) => new LamaBotService(shared),
    },
    {
      provide: LamaShortcutsService,
      inject: [LamaSharedService],
      useFactory: (shared: LamaSharedService) =>
        new LamaShortcutsService(shared),
    },
    {
      provide: LamaService,
      inject: [
        LamaPresenter,
        LamaActionService,
        LamaSetupService,
        LamaBotService,
        LamaShortcutsService,
      ],
      useFactory: (
        presenter: LamaPresenter,
        actions: LamaActionService,
        setup: LamaSetupService,
        bots: LamaBotService,
        shortcuts: LamaShortcutsService,
      ) => new LamaService(presenter, actions, setup, bots, shortcuts),
    },
  ],
  exports: [LamaService],
})
export class LamaModule {}





