import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { GameCoreModule } from '../../../core/core.module';
import { LaParadeSucreeService } from './la-parade-sucree.service';
import { LaParadeSucreeSetupService } from './setup/la-parade-sucree-setup.service';
import { LaParadeSucreeActionService } from './actions/la-parade-sucree-action.service';
import { LaParadeSucreePresenterService } from './presenter/la-parade-sucree-presenter.service';
import { LaParadeSucreeBotService } from './bots/la-parade-sucree-bot.service';

@Module({
  imports: [
    BoardGameCoreKitModule,
    GameCoreModule,
    GameRegistryModule,
    ],
  providers: [
    LaParadeSucreeService,
    LaParadeSucreeSetupService,
    LaParadeSucreeActionService,
    LaParadeSucreePresenterService,
    LaParadeSucreeBotService,
  ],
  exports: [LaParadeSucreeService],
})
export class LaParadeSucreeModule {}
