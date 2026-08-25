import { Module, forwardRef } from '@nestjs/common';
import { GameCoreModule } from './game-core.module';
import { TurnPoliciesService } from '../../application/services/turn-policies.service';

@Module({
  imports: [forwardRef(() => GameCoreModule)],
  providers: [TurnPoliciesService],
  exports: [TurnPoliciesService],
})
export class TurnPoliciesModule {}

