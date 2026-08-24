import { Module } from '@nestjs/common';
import { BoardService } from '../services/board.service';
import { BoardMovementService } from '../services/board-movement.service';
import { BoardPayloadService } from '../services/board-payload.service';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';

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
