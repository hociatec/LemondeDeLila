import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../core/core.module';
import { TurnPoliciesService } from './services/turn-policies.service';

@Module({
  imports: [GameCoreModule],
  providers: [TurnPoliciesService],
  exports: [TurnPoliciesService],
})
export class TurnPoliciesModule {}
