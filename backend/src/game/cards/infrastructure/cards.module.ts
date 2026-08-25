import { Module } from '@nestjs/common';
import { CardsService } from '../application/cards.service';
import { DeckManagerService } from '../application/deck-manager.service';
import { DeckPoolService } from '../application/deck-pool.service';
import { RandomModule } from '../../core/infrastructure/module/random.module';
import { GAME_MODULE_OVERVIEW } from '../../core/application/contracts/game-module-overview.contract';

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
