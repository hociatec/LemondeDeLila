import { Module } from '@nestjs/common';
import { BUSINESS_CLOCK } from '../../shared/interfaces/public-api';
import { SystemBusinessClock } from './system-business-clock';

@Module({
  providers: [{ provide: BUSINESS_CLOCK, useClass: SystemBusinessClock }],
  exports: [BUSINESS_CLOCK],
})
export class BusinessClockModule {}
