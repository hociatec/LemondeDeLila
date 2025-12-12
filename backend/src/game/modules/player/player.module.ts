import { Module } from '@nestjs/common';
import { PlayerStateService } from './services/player-state.service';

@Module({
  providers: [PlayerStateService],
  exports: [PlayerStateService],
})
export class PlayerModule {}
