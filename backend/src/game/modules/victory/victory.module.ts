import { Module } from '@nestjs/common';
import { VictoryService } from './services/victory.service';

@Module({
  providers: [VictoryService],
  exports: [VictoryService],
})
export class VictoryModule {}
