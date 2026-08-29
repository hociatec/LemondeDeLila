import { Injectable } from '@nestjs/common';
import { requireUser } from '../../../../../platform/realtime/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import { GameContentService } from '../../../../engine/public-api';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import type { GameSingleActionDto } from '../../../application/models/game-action.model';
import { GameRulesDto } from './dto/game-rules.ws.dto';
import { GameWsCommandMapper } from './game-ws-command.mapper';
import {
  GameWsRealtimeStateService,
  type ResolvedGameState,
} from './state/game-ws-realtime-state.service';
import { GameWsRoomContextService } from './game-ws-room-context.service';
import {
  normalizeGameKey,
  resolveGameLifecycleOperation,
  resolvePresentedGameKey,
} from './game-ws-key-command.helper';
import { GameCommandExecutorService } from '../../../application/services/game-command-executor.service';
import { GameRoomCommandQueueService } from '../../../application/services/game-room-command-queue.service';
import { gameNowMs } from '../../../application/services/game-execution-scope.service';
import { GameRegistryService } from '../../../application/services/game-registry.service';
import { GAMEPLAY_MECHANICS_CATALOG } from '../../../application/runtime/definitions/mechanics-catalog';

@Injectable()
export class GameWsHandler {
  constructor(
    private readonly content: GameContentService,
    private readonly overviewRegistry: GameModuleOverviewRegistryService,
    private readonly validator: PayloadValidationService,
    private readonly commands: GameWsCommandMapper,
    private readonly realtime: GameWsRealtimeStateService,
    private readonly rooms: GameWsRoomContextService,
    private readonly executor: GameCommandExecutorService,
    private readonly queue: GameRoomCommandQueueService,
    private readonly registry: GameRegistryService,
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
      payload: {
        modules: this.overviewRegistry.getModules(),
        games: this.registry.listDescriptors(),
        sdk: GAMEPLAY_MECHANICS_CATALOG,
      },
    };
  }

  async ping(session: WsSession, payload: unknown) {
    requireUser(session);
    return {
      type: 'game.pong',
      payload: {
        clientSentAtMs: this.commands.resolveClientSentAt(payload),
        serverSentAtMs: gameNowMs(),
      },
    };
  }

  async join(session: WsSession, payload: unknown) {
    requireUser(session);
    return this.state(session, payload);
  }

  async turn(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    await this.rooms.ensureReadable(roomId, user.id);
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
        turnIndex: resolved.state.turn?.turnNumber ?? 1,
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

  async candidates(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    const query = this.commands.resolveCandidateQuery(payload);
    await this.rooms.ensureReadable(roomId, user.id);
    const resolved = await this.realtime.resolve(roomId);
    this.realtime.bind(session, roomId, resolved.gameType);
    return {
      type: 'game.action.candidates',
      payload: {
        roomId,
        gameType: resolved.gameType,
        ...resolved.handler.getActionCandidates(
          resolved.state,
          user.id,
          query.actionType,
          query,
        ),
      },
    };
  }

  async action(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    await this.rooms.ensureWritable(roomId, user.id);
    return this.queue.run(roomId, async () => {
      const resolved = await this.realtime.resolve(roomId);
      this.realtime.bind(session, roomId, resolved.gameType);
      const actions = this.commands.resolveActions(payload, user.id);
      if (actions.length === 0) {
        return {
          type: 'game.state',
          payload: this.realtime.present(resolved, roomId, user.id),
        };
      }

      await this.commitActions(roomId, resolved, actions, user.id);
      return {
        type: 'game.ack',
        payload: {
          action: 'game.actions',
          ok: true,
          roomId,
          gameType: resolved.gameType,
        },
      };
    });
  }

  async key(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.commands.resolveRoomId(payload);
    const command = this.commands.resolveKey(payload);
    const key = normalizeGameKey(command.key);
    await this.rooms.ensureReadable(roomId, user.id);
    return this.queue.run(roomId, async () => {
      const resolved = await this.realtime.resolve(roomId);
      this.realtime.bind(session, roomId, resolved.gameType);
      const keyCommand = resolvePresentedGameKey(
        this.realtime.present(resolved, roomId, user.id),
        key,
      );
      if (keyCommand.kind === 'action') {
        await this.rooms.ensureWritable(roomId, user.id);
        const actions = this.commands.resolveActions(
          { actions: [keyCommand.action] },
          user.id,
        );
        if (actions.length > 0) {
          await this.commitActions(roomId, resolved, actions, user.id);
          return this.keyAcknowledgement(roomId, resolved.gameType, key);
        }
      }
      if (keyCommand.kind === 'interface') {
        return this.keyAcknowledgement(roomId, resolved.gameType, key, {
          panelId: keyCommand.panelId,
          message: keyCommand.message,
        });
      }

      const operation = resolveGameLifecycleOperation(
        key,
        resolved.state.status,
      );
      if (!operation) {
        return this.keyAcknowledgement(roomId, resolved.gameType, key, {
          ok: false,
          message: 'Aucune action disponible pour ce raccourci.',
        });
      }
      const gameType = await this.rooms.transition(
        roomId,
        operation,
        user.id,
        command.gameType,
      );
      return this.keyAcknowledgement(roomId, gameType, key, {
        roomOp: operation,
      });
    });
  }

  private async commitActions(
    roomId: number,
    resolved: ResolvedGameState,
    actions: GameSingleActionDto[],
    actorId: number,
  ): Promise<void> {
    const next = this.executor.execute({
      handler: resolved.handler,
      state: resolved.state,
      actions,
      actorId,
      roomId,
    });
    await this.realtime.commit(roomId, resolved, resolved.state, next);
  }

  private keyAcknowledgement(
    roomId: number,
    gameType: string,
    key: string,
    details: Record<string, unknown> = {},
  ) {
    return {
      type: 'game.ack',
      payload: {
        action: 'game.key',
        ok: true,
        key,
        roomId,
        gameType,
        ...details,
      },
    };
  }
}
