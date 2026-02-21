import { Module } from '@nestjs/common';
import { RandomModule } from '../random/random.module';
import { DeckPoliciesService } from './services/deck-policies.service';

@Module({
  imports: [RandomModule],
  providers: [DeckPoliciesService],
  exports: [DeckPoliciesService],
})
export class DeckPoliciesModule {}
