import { Module } from '@nestjs/common';
import { BoardService } from './services/board.service';
import { BoardMovementService } from './services/board-movement.service';
import { BoardPayloadService } from './services/board-payload.service';

@Module({
  providers: [BoardService, BoardMovementService, BoardPayloadService],
  exports: [BoardService, BoardMovementService, BoardPayloadService],
})
export class BoardModule {}
