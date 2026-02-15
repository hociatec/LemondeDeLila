import { Module } from '@nestjs/common';
import { ExchangeService } from './services/exchange.service';
import { GenericExchangeService } from './services/generic-exchange.service';
import { InteractiveExchangeService } from './services/interactive-exchange.service';
import { RandomModule } from '../random/random.module';
import { GAME_MODULE_OVERVIEW } from '../game-module-overview.constants';

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
