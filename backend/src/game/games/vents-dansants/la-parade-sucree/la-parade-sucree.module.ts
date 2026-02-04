import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { GameCoreModule } from '../../../core/core.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { LaParadeSucreeService } from './la-parade-sucree.service';
import { LaParadeSucreeSetupService } from './setup/la-parade-sucree-setup.service';
import { LaParadeSucreeActionService } from './actions/la-parade-sucree-action.service';
import { LaParadeSucreePresenterService } from './presenter/la-parade-sucree-presenter.service';
import { LaParadeSucreeBotService } from './bots/la-parade-sucree-bot.service';

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
    LaParadeSucreeService,
    LaParadeSucreeSetupService,
    LaParadeSucreeActionService,
    LaParadeSucreePresenterService,
    LaParadeSucreeBotService,
  ],
  exports: [LaParadeSucreeService],
})
export class LaParadeSucreeModule {}
