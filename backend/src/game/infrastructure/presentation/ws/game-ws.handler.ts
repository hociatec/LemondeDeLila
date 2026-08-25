import { Injectable } from '@nestjs/common';
import { requireUser } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { GameContentService } from '../../../engine/public-api';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRulesDto } from './dto/game-rules.ws.dto';
import { GameWsCommandMapper } from './game-ws-command.mapper';
import { GameWsRealtimeStateService } from './game-ws-realtime-state.service';
import { GameWsRoomContextService } from './game-ws-room-context.service';

@Injectable()
export class GameWsHandler {
  constructor(
    private readonly content: GameContentService,
    private readonly overviewRegistry: GameModuleOverviewRegistryService,
    private readonly validator: PayloadValidationService,
    private readonly commands: GameWsCommandMapper,
    private readonly realtime: GameWsRealtimeStateService,
    private readonly rooms: GameWsRoomContextService,
  ) {}

  async rules(session: WsSession, payload: unknown) {
    requireUser(session);
    const dto = this.validator.validate(GameRulesDto, payload);
    const rules = await this.content.getRules(dto.gameType);
    return {
      type: 'game.rules',
      payload: { rules, gameType: dto.gameType },
    };
  }

  async modules(session: WsSession) {
    requireUser(session);
    return {
      type: 'game.modules',
      payload: { modules: this.overviewRegistry.getModules() },
    };
  }

  async ping(session: WsSession, payload: unknown) {
    requireUser(session);
    return {
      type: 'game.pong',
      payload: {
        clientSentAtMs: this.commands.resolveClientSentAt(payload),
        serverSentAtMs: Date.now(),
      },
    };
  }

  async join(session: WsSession, payload: unknown) {
    requireUser(session);
    return this.state(session, payload);
  }

  async turn(session: WsSession, payload: unknown) {
    requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    const resolved = await this.realtime.resolve(roomId);
    const currentPlayerId = resolved.state.turn?.currentPlayerId ?? null;
    const currentPlayer = (resolved.state.players ?? []).find(
      (player) => player.id === currentPlayerId,
    );
    return {
      type: 'game.turn',
      payload: {
        roomId,
        gameType: resolved.gameType,
        turnIndex: resolved.state.turnIndex,
        currentPlayerId,
        currentPlayerUsername: currentPlayer?.username ?? null,
        status: resolved.state.status,
        phase: resolved.state.phase,
      },
    };
  }

  async state(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    await this.rooms.ensureReadable(roomId, user.id);
    const resolved = await this.realtime.resolve(roomId);
    this.realtime.bind(session, roomId, resolved.gameType);
    this.realtime.schedule(roomId, resolved);
    return {
      type: 'game.state',
      payload: this.realtime.present(resolved, roomId, user.id),
    };
  }

  async action(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    const resolved = await this.realtime.resolve(roomId);
    this.realtime.bind(session, roomId, resolved.gameType);
    const actions = this.commands.resolveActions(
      payload,
      user.id,
      resolved.handler,
      resolved.state,
    );
    if (actions.length === 0) {
      return {
        type: 'game.state',
        payload: this.realtime.present(resolved, roomId, user.id),
      };
    }

    const next = resolved.handler.applyActions(resolved.state, actions);
    await this.realtime.commit(roomId, resolved, resolved.state, next);
    return {
      type: 'game.ack',
      payload: {
        action: 'game.actions',
        ok: true,
        roomId,
        gameType: resolved.gameType,
      },
    };
  }

  async key(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    const command = this.commands.resolveKey(payload);
    if (command.key !== 'X' && command.key !== 'ENTER') {
      return this.action(session, payload);
    }

    const operation = command.key === 'X' ? 'reset' : 'start';
    const gameType = await this.rooms.transition(
      roomId,
      operation,
      user.id,
      command.gameType,
    );
    return {
      type: 'game.ack',
      payload: {
        action: 'game.key',
        ok: true,
        key: command.key,
        roomId,
        gameType,
        roomOp: operation,
      },
    };
  }
}
