import { Module } from '@nestjs/common';
import { ExchangeService } from './services/exchange.service';
import { GenericExchangeService } from './services/generic-exchange.service';

@Module({
  providers: [ExchangeService, GenericExchangeService],
  exports: [ExchangeService, GenericExchangeService],
})
export class ExchangeModule {}
