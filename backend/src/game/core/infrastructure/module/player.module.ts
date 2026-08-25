import { Module } from '@nestjs/common';
import { PlayerStateService } from '../../application/services/player-state.service';

@Module({
  providers: [PlayerStateService],
  exports: [PlayerStateService],
})
export class PlayerModule {}
