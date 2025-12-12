import { Module } from '@nestjs/common';
import { CardsService } from './services/cards.service';
import { DeckManagerService } from './services/deck-manager.service';
import { DeckPoolService } from './services/deck-pool.service';

@Module({
  providers: [CardsService, DeckManagerService, DeckPoolService],
  exports: [CardsService, DeckManagerService, DeckPoolService],
})
export class CardsModule {}
