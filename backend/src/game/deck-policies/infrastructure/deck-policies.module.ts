import { Module } from '@nestjs/common';
import { DeckPoliciesService } from '../application/services/deck-policies.service';
import { RandomModule } from '../../core/infrastructure/module/random.module';

@Module({
  imports: [RandomModule],
  providers: [DeckPoliciesService],
  exports: [DeckPoliciesService],
})
export class DeckPoliciesModule {}




