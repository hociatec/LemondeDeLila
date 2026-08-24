import { Module } from '@nestjs/common';
import { DeckPoliciesService } from '../features/deck-policies/services/deck-policies.service';
import { RandomModule } from './random.module';

@Module({
  imports: [RandomModule],
  providers: [DeckPoliciesService],
  exports: [DeckPoliciesService],
})
export class DeckPoliciesModule {}




