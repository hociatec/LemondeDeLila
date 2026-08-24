import { Module } from '@nestjs/common';
import { BotModule } from '../infrastructure/module/bot.module';
import { BoardModule } from '../application/modules/board.module';
import { DeckPoliciesModule } from '../application/modules/deck-policies.module';
import { GridModule } from '../application/modules/grid.module';
import { RandomModule } from '../application/modules/random.module';
import { TurnModule } from '../application/modules/turn.module';

@Module({
  imports: [RandomModule, TurnModule, BoardModule, BotModule],
  exports: [RandomModule, TurnModule, BoardModule, BotModule],
})
export class BoardGameCoreKitModule {}

@Module({
  imports: [BoardGameCoreKitModule, DeckPoliciesModule],
  exports: [BoardGameCoreKitModule, DeckPoliciesModule],
})
export class BoardGameDeckKitModule {}

@Module({
  imports: [GridModule],
  exports: [GridModule],
})
export class GridGameCoreKitModule {}

@Module({
  imports: [GridGameCoreKitModule, BotModule],
  exports: [GridGameCoreKitModule, BotModule],
})
export class GridGameBotKitModule {}

@Module({
  imports: [RandomModule],
  exports: [RandomModule],
})
export class RandomGameCoreKitModule {}

@Module({
  imports: [RandomGameCoreKitModule, TurnModule],
  exports: [RandomGameCoreKitModule, TurnModule],
})
export class RandomTurnGameKitModule {}


