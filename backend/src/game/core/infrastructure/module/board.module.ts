import { Module } from '@nestjs/common';
import { BoardService } from '../../application/services/board.service';
import { BoardMovementService } from '../../application/services/board-movement.service';
import { BoardPayloadService } from '../../application/services/board-payload.service';
import { GAME_MODULE_OVERVIEW } from '../../application/contracts/game-module-overview.contract';

const boardOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: BoardService,
};

@Module({
  providers: [
    BoardService,
    BoardMovementService,
    BoardPayloadService,
    boardOverviewProvider,
  ],
  exports: [
    BoardService,
    BoardMovementService,
    BoardPayloadService,
    boardOverviewProvider,
  ],
})
export class BoardModule {}
