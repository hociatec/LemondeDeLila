import { Module } from '@nestjs/common';
import { RandomService } from '../services/random.service';

@Module({
  providers: [RandomService],
  exports: [RandomService],
})
export class RandomModule {}
