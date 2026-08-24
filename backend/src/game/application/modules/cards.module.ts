import { Module } from '@nestjs/common';
import { CardsService } from '../services/cards.service';
import { DeckManagerService } from '../services/deck-manager.service';
import { DeckPoolService } from '../services/deck-pool.service';
import { RandomModule } from './random.module';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';

const cardsOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: CardsService,
};

@Module({
  imports: [RandomModule],
  providers: [
    CardsService,
    DeckManagerService,
    DeckPoolService,
    cardsOverviewProvider,
  ],
  exports: [
    CardsService,
    DeckManagerService,
    DeckPoolService,
    cardsOverviewProvider,
  ],
})
export class CardsModule {}
