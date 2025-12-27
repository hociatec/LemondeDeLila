import { Module } from '@nestjs/common';
import { ExchangeService } from './services/exchange.service';
import { GenericExchangeService } from './services/generic-exchange.service';
import { InteractiveExchangeService } from './services/interactive-exchange.service';
import { RandomModule } from '../random/random.module';

@Module({
  imports: [RandomModule],
  providers: [
    ExchangeService,
    GenericExchangeService,
    InteractiveExchangeService,
  ],
  exports: [
    ExchangeService,
    GenericExchangeService,
    InteractiveExchangeService,
  ],
})
export class ExchangeModule {}
