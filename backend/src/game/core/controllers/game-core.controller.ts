import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../common/guards/http-jwt.guard';
import type { CoreModulesResponse } from '../dto/core-modules.dto';
import { BoardService } from '../../modules/board/services/board.service';
import { CardsService } from '../../modules/cards/services/cards.service';
import { MovementService } from '../../modules/movement/services/movement.service';
import { InventoryService } from '../../modules/inventory/services/inventory.service';
import { ExchangeService } from '../../modules/exchange/services/exchange.service';
import { TurnService } from '../../modules/turn/services/turn.service';
import { EffectsService } from '../../modules/effects/services/effects.service';
import { QuizService } from '../../modules/quiz/services/quiz.service';
import { VictoryService } from '../../modules/victory/services/victory.service';

@Controller('api/games/core')
@UseGuards(HttpJwtGuard)
export class GameCoreController {
  constructor(
    private readonly board: BoardService,
    private readonly cards: CardsService,
    private readonly movement: MovementService,
    private readonly inventory: InventoryService,
    private readonly exchange: ExchangeService,
    private readonly turn: TurnService,
    private readonly effects: EffectsService,
    private readonly quiz: QuizService,
    private readonly victory: VictoryService,
  ) {}

  @Get('modules')
  listModules(): CoreModulesResponse {
    return {
      modules: [
        this.board.getOverview(),
        this.cards.getOverview(),
        this.movement.getOverview(),
        this.inventory.getOverview(),
        this.exchange.getOverview(),
        this.turn.getOverview(),
        this.effects.getOverview(),
        this.quiz.getOverview(),
        this.victory.getOverview(),
      ],
    };
  }
}
