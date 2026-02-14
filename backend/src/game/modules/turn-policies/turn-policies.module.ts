import { Module } from '@nestjs/common';
import { TurnPoliciesService } from './services/turn-policies.service';

@Module({
  providers: [TurnPoliciesService],
  exports: [TurnPoliciesService],
})
export class TurnPoliciesModule {}
