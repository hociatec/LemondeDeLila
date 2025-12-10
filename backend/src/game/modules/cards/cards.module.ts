import { Module } from '@nestjs/common';
import { CardsService } from './services/cards.service';
import { DeckManagerService } from './services/deck-manager.service';

@Module({
  providers: [CardsService, DeckManagerService],
  exports: [CardsService, DeckManagerService],
})
export class CardsModule {}
