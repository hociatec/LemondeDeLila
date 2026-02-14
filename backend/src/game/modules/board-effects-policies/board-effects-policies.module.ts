import { Module } from '@nestjs/common';
import { BoardEffectsPoliciesService } from './services/board-effects-policies.service';

@Module({
  providers: [BoardEffectsPoliciesService],
  exports: [BoardEffectsPoliciesService],
})
export class BoardEffectsPoliciesModule {}

