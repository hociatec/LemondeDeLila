import { Module } from '@nestjs/common';
import { BotModule } from '../core/infrastructure/module/bot.module';
import { BoardModule } from '../core/infrastructure/module/board.module';
import { DeckPoliciesModule } from '../deck-policies/infrastructure/deck-policies.module';
import { GridModule } from '../grid/infrastructure/grid.module';
import { RandomModule } from '../core/infrastructure/module/random.module';
import { TurnModule } from '../core/infrastructure/module/turn.module';

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


