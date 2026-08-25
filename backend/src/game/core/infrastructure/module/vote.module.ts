import { Module } from '@nestjs/common';
import { VoteService } from '../../application/services/vote.service';

@Module({
  providers: [VoteService],
  exports: [VoteService],
})
export class VoteModule {}
