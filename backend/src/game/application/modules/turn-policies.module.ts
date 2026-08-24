import { Module, forwardRef } from '@nestjs/common';
import { GameCoreModule } from '../../module/game-core.module';
import { TurnPoliciesService } from '../services/turn-policies.service';

@Module({
  imports: [forwardRef(() => GameCoreModule)],
  providers: [TurnPoliciesService],
  exports: [TurnPoliciesService],
})
export class TurnPoliciesModule {}

