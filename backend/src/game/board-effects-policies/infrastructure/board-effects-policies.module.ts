import { Module } from '@nestjs/common';
import { BoardEffectsPoliciesService } from '../application/services/board-effects-policies.service';

@Module({
  providers: [BoardEffectsPoliciesService],
  exports: [BoardEffectsPoliciesService],
})
export class BoardEffectsPoliciesModule {}



