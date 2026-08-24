import { Module } from '@nestjs/common';
import { VoteService } from '../services/vote.service';

@Module({
  providers: [VoteService],
  exports: [VoteService],
})
export class VoteModule {}
