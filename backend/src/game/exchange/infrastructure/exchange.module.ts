import { Module } from '@nestjs/common';
import { ExchangeService } from '../application/services/exchange.service';
import { GenericExchangeService } from '../application/services/generic-exchange.service';
import { InteractiveExchangeService } from '../application/services/interactive-exchange.service';
import { GAME_MODULE_OVERVIEW } from '../../core/application/contracts/game-module-overview.contract';
import { RandomModule } from '../../core/infrastructure/module/random.module';

const exchangeOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: ExchangeService,
};

@Module({
  imports: [RandomModule],
  providers: [
    ExchangeService,
    GenericExchangeService,
    InteractiveExchangeService,
    exchangeOverviewProvider,
  ],
  exports: [
    ExchangeService,
    GenericExchangeService,
    InteractiveExchangeService,
    exchangeOverviewProvider,
  ],
})
export class ExchangeModule {}




