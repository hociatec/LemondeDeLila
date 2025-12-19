import { Injectable } from '@nestjs/common';
import { requireUser } from '../../../common/ws/ws-auth';
import type { WsSession } from '../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../common/validation/payload-validation.service';
import { GameContentService } from '../../engine/services/game-content.service';
import { BoardService } from '../../modules/board/services/board.service';
import { CardsService } from '../../modules/cards/services/cards.service';
import { MovementService } from '../../modules/movement/services/movement.service';
import { InventoryService } from '../../modules/inventory/services/inventory.service';
import { ExchangeService } from '../../modules/exchange/services/exchange.service';
import { TurnService } from '../../modules/turn/services/turn.service';
import { EffectsService } from '../../modules/effects/services/effects.service';
import { QuizService } from '../../modules/quiz/services/quiz.service';
import { VictoryService } from '../../modules/victory/services/victory.service';
import { GameRulesDto } from '../dto/game-rules.dto';

@Injectable()
export class GameWsHandler {
  constructor(
    private readonly content: GameContentService,
    private readonly board: BoardService,
    private readonly cards: CardsService,
    private readonly movement: MovementService,
    private readonly inventory: InventoryService,
    private readonly exchange: ExchangeService,
    private readonly turn: TurnService,
    private readonly effects: EffectsService,
    private readonly quiz: QuizService,
    private readonly victory: VictoryService,
    private readonly validator: PayloadValidationService,
  ) {}

  async rules(session: WsSession, payload: any) {
    requireUser(session);
    const dto = this.validator.validate(GameRulesDto, payload);
    const gameType = dto.gameType;
    const rules = await this.content.getRules(gameType);
    return { type: 'game.rules', payload: { rules, gameType } };
  }

  async modules(session: WsSession) {
    requireUser(session);
    const modules = [
      this.board.getOverview(),
      this.cards.getOverview(),
      this.movement.getOverview(),
      this.inventory.getOverview(),
      this.exchange.getOverview(),
      this.turn.getOverview(),
      this.effects.getOverview(),
      this.quiz.getOverview(),
      this.victory.getOverview(),
    ];
    return { type: 'game.modules', payload: { modules } };
  }
}
