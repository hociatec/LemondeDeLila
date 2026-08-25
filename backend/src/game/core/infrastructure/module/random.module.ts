import { Module } from '@nestjs/common';
import { RandomService } from '../../application/services/random.service';

@Module({
  providers: [RandomService],
  exports: [RandomService],
})
export class RandomModule {}
