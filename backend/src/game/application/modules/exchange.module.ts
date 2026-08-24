import { Module } from '@nestjs/common';
import { ExchangeService } from '../features/exchange/services/exchange.service';
import { GenericExchangeService } from '../features/exchange/services/generic-exchange.service';
import { InteractiveExchangeService } from '../features/exchange/services/interactive-exchange.service';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';
import { RandomModule } from './random.module';

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




