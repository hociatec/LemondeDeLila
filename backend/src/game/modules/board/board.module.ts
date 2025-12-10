import { Module } from '@nestjs/common';
import { BoardService } from './services/board.service';
import { BoardMovementService } from './services/board-movement.service';

@Module({
  providers: [BoardService, BoardMovementService],
  exports: [BoardService, BoardMovementService],
})
export class BoardModule {}
