import { UnauthorizedException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { GameEngineService } from '../../game/engine/services/game-engine.service';
import { GameContentService } from '../services/game-content.service';
import { BoardService } from '../../game/modules/board/services/board.service';
import { CardsService } from '../../game/modules/cards/services/cards.service';
import { MovementService } from '../../game/modules/movement/services/movement.service';
import { InventoryService } from '../../game/modules/inventory/services/inventory.service';
import { ExchangeService } from '../../game/modules/exchange/services/exchange.service';
import { TurnService } from '../../game/modules/turn/services/turn.service';
import { EffectsService } from '../../game/modules/effects/services/effects.service';
import { QuizService } from '../../game/modules/quiz/services/quiz.service';
import { VictoryService } from '../../game/modules/victory/services/victory.service';
import { GameSingleActionDto } from '../../game/engine/dto/game-action.dto';
import { PayloadValidationService } from '../services/payload-validation.service';
import { GameActionsDto, GameBaseDto } from '../dto/game-base.dto';
import { GameApplyDto } from '../dto/game-apply.dto';

type ClientSession = { user: WsAuthPayload | null };

@Injectable()
export class GameMessageHandler {
  constructor(
    private readonly engine: GameEngineService,
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

  async rules(session: ClientSession, payload: any) {
    this.requireUser(session);
    const dto = this.validator.validate(GameBaseDto, payload);
    const gameType = dto.gameType;
    const rules = await this.content.getRules(gameType);
    return { type: 'game.rules', payload: { rules, gameType } };
  }

  async modules(session: ClientSession) {
    this.requireUser(session);
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

  async state(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const dto = this.validator.validate(GameBaseDto, payload);
    await this.engine.checkAccess(dto.roomId, user.id);
    const state = await this.engine.getState(dto.roomId, dto.gameType);
    return { type: 'game.state', payload: state };
  }

  async availableActions(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const dto = this.validator.validate(GameActionsDto, payload);
    await this.engine.checkAccess(dto.roomId, user.id);
    const playerId = dto.playerId ?? user.id;
    const actions = await this.engine.getAvailableActions(dto.roomId, dto.gameType, playerId);
    return { type: 'game.actions.available', payload: { actions, roomId: dto.roomId, gameType: dto.gameType, playerId } };
  }

  async applyActions(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const dto = this.validator.validate(GameApplyDto, payload);
    await this.engine.checkAccess(dto.roomId, user.id);
    const nextState = await this.engine.applyActions(
      dto.roomId,
      dto.gameType,
      dto.actions as GameSingleActionDto[],
      user.id,
    );
    return { type: 'game.state', payload: nextState };
  }

  async botPlay(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const dto = this.validator.validate(GameBaseDto, payload);
    await this.engine.checkAccess(dto.roomId, user.id, true);
    const state = await this.engine.playBotTurn(dto.roomId, dto.gameType);
    return { type: 'game.state', payload: state };
  }

  private requireUser(session: ClientSession): WsAuthPayload {
    if (!session.user?.id) {
      throw new UnauthorizedException('Authentification requise');
    }
    return session.user;
  }
}
