import { Module } from '@nestjs/common';
import { BoardModule } from '../board/board.module';
import { BotModule } from '../bot/module/bot.module';
import { DeckPoliciesModule } from '../deck-policies/deck-policies.module';
import { GridModule } from '../grid/grid.module';
import { RandomModule } from '../random/random.module';
import { TurnModule } from '../turn/turn.module';

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
