import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireUser } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { WsApiHubService } from '../../../../common/ws/public-api';
import { GameCoreService } from '../../../application/services/game-core.service';
import { GameEngineService } from '../../../application/services/game-engine.service';
import { GameRegistryService } from '../../../application/services/game-registry.service';
import type { GameRulesAdapter } from '../../../application/contracts/game-rules-adapter.interface';
import { GameContentService } from '../../../engine/public-api';
import type { GameSingleActionDto } from '../../../application/models/game-action.model';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { Room } from '../../../../room/infrastructure/persistence/typeorm/entities/room.entity';
import type { RoomPayload } from '../../../../room/application/models/room-payload.model';
import { GameRulesDto } from './dto/game-rules.ws.dto';

type VersionedGameState = GameStateEntity & {
  version?: number;
  roomId?: number;
  gameType?: string;
};

@Injectable()
export class GameWsHandler {
  constructor(
    private readonly content: GameContentService,
    private readonly core: GameCoreService,
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
    private readonly overviewRegistry: GameModuleOverviewRegistryService,
    private readonly validator: PayloadValidationService,
    private readonly hub: WsApiHubService,
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
  ) {}

  async rules(session: WsSession, payload: unknown) {
    requireUser(session);
    const dto = this.validator.validate(GameRulesDto, payload);
    const gameType = dto.gameType;
    const rules = await this.content.getRules(gameType);
    return { type: 'game.rules', payload: { rules, gameType } };
  }

  async modules(session: WsSession) {
    requireUser(session);
    const modules = this.overviewRegistry.getModules();
    return { type: 'game.modules', payload: { modules } };
  }

  async ping(session: WsSession, payload: unknown) {
    requireUser(session);
    const record = this.asRecord(payload);
    return {
      type: 'game.pong',
      payload: {
        clientSentAtMs: record.clientSentAtMs ?? null,
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
    const roomId = this.resolveRoomId(payload);
    const { gameType, state } = await this.resolveState(roomId);
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = (state.players ?? []).find(
      (player) => player.id === currentPlayerId,
    );

    return {
      type: 'game.turn',
      payload: {
        roomId,
        gameType,
        turnIndex: state.turnIndex,
        currentPlayerId,
        currentPlayerUsername: currentPlayer?.username ?? null,
        status: state.status,
        phase: state.phase,
      },
    };
  }

  async state(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.resolveRoomId(payload);
    await this.ensureRoomReadable(roomId, user.id);
    const { gameType, state, handler } = await this.resolveState(roomId);
    this.bindGameConnection(session, roomId, gameType);
    const version = this.ensureStateVersion(state);
    const exposed = handler.exposeStateForUser
      ? handler.exposeStateForUser(state, user.id)
      : handler.exposeState
        ? handler.exposeState(state)
        : state;

    return {
      type: 'game.state',
      payload: this.buildStatePayload(
        exposed,
        roomId,
        gameType,
        version,
        user.id,
      ),
    };
  }

  async action(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const roomId = this.resolveRoomId(payload);
    const { gameType, state, handler } = await this.resolveState(roomId);
    this.bindGameConnection(session, roomId, gameType);
    const actions = this.resolveActions(payload)
      .map((action) => this.withActor(action, user.id))
      .map((action) => this.validateGameAction(handler, state, action, user.id));

    if (actions.length === 0) {
      return {
        type: 'game.state',
        payload: this.buildStatePayload(
          state,
          roomId,
          gameType,
          this.ensureStateVersion(state),
          user.id,
        ),
      };
    }

    const next = handler.applyActions(state, actions);
    const version = this.bumpStateVersion(next, state);
    await this.engine.restoreInternalState(roomId, gameType, next);

    this.broadcastState(roomId, gameType, next, handler, version);

    return {
      type: 'game.ack',
      payload: {
        action: 'game.actions',
        ok: true,
        roomId,
        gameType,
      },
    };
  }

  async key(session: WsSession, payload: unknown) {
    requireUser(session);
    const roomId = this.resolveRoomId(payload);
    const record = this.asRecord(payload);
    const key = String(record.key ?? '').trim().toUpperCase();
    const gameTypeFromPayload = String(record.gameType ?? '').trim();

    if (key !== 'X' && key !== 'ENTER') {
      return this.action(session, payload);
    }

    const room = await this.rooms.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    const gameType = gameTypeFromPayload || String(room.gameType ?? '').trim();
    if (!gameType) {
      throw new NotFoundException('Jeu introuvable');
    }

    if (key === 'X') {
      room.status = 'setup';
      room.startedAt = null;
      await this.rooms.save(room);
      await this.engine.clearInternalState(roomId, gameType);
      return {
        type: 'game.ack',
        payload: {
          action: 'game.key',
          ok: true,
          key,
          roomId,
          gameType,
          roomOp: 'reset',
        },
      };
    }

    room.status = 'started';
    room.runId = Math.max(0, Number(room.runId ?? 0)) + 1;
    room.startedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.rooms.save(room);
    await this.engine.clearInternalState(roomId, gameType);
    return {
      type: 'game.ack',
      payload: {
        action: 'game.key',
        ok: true,
        key,
        roomId,
        gameType,
        roomOp: 'start',
      },
    };
  }

  private async resolveState(roomId: number): Promise<{
    gameType: string;
    state: GameStateEntity;
    handler: NonNullable<ReturnType<GameRegistryService['getHandler']>>;
  }> {
    const room = await this.buildRoomPayload(roomId);
    const gameType = String(room.room.gameType ?? '').trim();
    const handler = this.registry.getHandler(gameType);
    if (!handler) {
      throw new NotFoundException(`Jeu introuvable: ${gameType}`);
    }

    const existing = await this.engine.exportInternalState(roomId, gameType);
    if (existing) {
      this.ensureStateVersion(existing);
      return { gameType, state: existing, handler };
    }

    const base = this.core.buildBaseState(room, gameType);
    const state = handler.hydrateInitialState(base);
    this.ensureStateVersion(state);
    await this.engine.restoreInternalState(roomId, gameType, state);
    return { gameType, state, handler };
  }

  private buildStatePayload(
    state: unknown,
    roomId: number,
    gameType: string,
    version: number,
    viewerPlayerId?: number | null,
  ): Record<string, unknown> {
    const record = this.asRecord(state);
    const extras = this.withViewerPlayerId(record.extras, viewerPlayerId);
    const pending = this.withLegacyPendingChoices(record.pending, record.actions);
    const metadata = this.withViewerLifecycle(
      record.metadata,
      pending,
      record.actions,
      viewerPlayerId,
    );
    const compatExtras = this.withPendingChoicesExtras(extras, pending);
    const payload = {
      ...record,
      pending,
      metadata,
      extras: compatExtras,
      roomId: record.roomId ?? roomId,
      gameType: record.gameType ?? gameType,
      version: record.version ?? version,
    };
    const nestedState =
      record.state && typeof record.state === 'object'
        ? {
            ...this.asRecord(record.state),
            pending,
            metadata,
            extras: this.withViewerPlayerId(
              this.withPendingChoicesExtras(
                this.asRecord(record.state).extras ?? compatExtras,
                pending,
              ),
              viewerPlayerId,
            ),
            version:
              this.asRecord(record.state).version ?? payload.version ?? version,
          }
        : { ...payload };
    return {
      ...payload,
      // Backward compatibility: some clients read the state directly from
      // `payload`, others read `payload.state.version`.
      state: nestedState,
    };
  }

  private withLegacyPendingChoices(
    pending: unknown,
    actions: unknown,
  ): unknown {
    const record = this.asRecord(pending);
    if (!record.type) return pending;
    const rawChoices = Array.isArray(record.choices) ? record.choices : [];
    const choices = rawChoices
      .map((choice) => String(choice ?? '').trim())
      .filter((choice) => choice.length > 0);
    if (choices.length === 0) return pending;

    const data = this.asRecord(record.data);
    const actionList = Array.isArray(actions) ? actions : [];
    const choiceActionsByIndex = actionList
      .filter((action) => action && typeof action === 'object')
      .slice(0, choices.length)
      .map((action) => {
        const actionRecord = this.asRecord(action);
        return {
          type: actionRecord.type,
          payload: this.asRecord(actionRecord.payload),
        };
      });

    return {
      ...record,
      choices,
      data: {
        ...data,
        choices: Array.isArray(data.choices) ? data.choices : choices,
        options: Array.isArray(data.options) ? data.options : choices,
        choiceActionsByIndex:
          Array.isArray(data.choiceActionsByIndex) &&
          data.choiceActionsByIndex.length > 0
            ? data.choiceActionsByIndex
            : choiceActionsByIndex,
      },
    };
  }

  private withPendingChoicesExtras(
    extras: unknown,
    pending: unknown,
  ): Record<string, unknown> {
    const record = this.asRecord(extras);
    const pendingRecord = this.asRecord(pending);
    const choices = Array.isArray(pendingRecord.choices)
      ? pendingRecord.choices
      : [];
    if (choices.length === 0) return record;
    return {
      ...record,
      pendingChoices: choices,
    };
  }

  private withViewerLifecycle(
    metadata: unknown,
    pending: unknown,
    actions: unknown,
    viewerPlayerId?: number | null,
  ): Record<string, unknown> {
    const record = this.asRecord(metadata);
    const pendingRecord = this.asRecord(pending);
    const pendingPlayerId = Number(pendingRecord.playerId);
    const viewerId = Number(viewerPlayerId);
    const actionList = Array.isArray(actions) ? actions : [];
    const hasActions = actionList.length > 0;
    const isViewerPending =
      Number.isFinite(pendingPlayerId) &&
      Number.isFinite(viewerId) &&
      pendingPlayerId === viewerId;
    const pendingType = String(pendingRecord.type ?? '').trim();
    const isPawnPending =
      pendingType === 'choose_pawn' || pendingType === 'pick_pawn';
    const lifecycle = this.asRecord(record.lifecycle);
    return {
      ...record,
      lifecycle: {
        ...lifecycle,
        viewerTurnActionable:
          lifecycle.viewerTurnActionable ?? (isViewerPending && hasActions),
        viewerMustChoosePawn:
          lifecycle.viewerMustChoosePawn ??
          (isViewerPending && isPawnPending && hasActions),
      },
    };
  }

  private withViewerPlayerId(
    extras: unknown,
    viewerPlayerId?: number | null,
  ): Record<string, unknown> {
    const record = this.asRecord(extras);
    if (
      viewerPlayerId == null ||
      !Number.isFinite(Number(viewerPlayerId)) ||
      Number(viewerPlayerId) <= 0
    ) {
      return record;
    }
    return {
      ...record,
      viewerPlayerId: Number(viewerPlayerId),
    };
  }

  private ensureStateVersion(state: GameStateEntity): number {
    const versioned = state as VersionedGameState;
    const current = Number(versioned.version);
    if (Number.isFinite(current) && current > 0) {
      return current;
    }
    versioned.version = 1;
    return 1;
  }

  private bumpStateVersion(
    next: GameStateEntity,
    previous: GameStateEntity,
  ): number {
    const previousVersion = this.ensureStateVersion(previous);
    const versioned = next as VersionedGameState;
    const nextVersion = previousVersion + 1;
    versioned.version = nextVersion;
    return nextVersion;
  }

  private broadcastState(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    handler: GameRulesAdapter,
    version: number,
  ): void {
    for (const connection of this.hub.listConnections()) {
      const meta = connection.meta;
      if (
        meta.scope !== 'game' ||
        Number(meta.roomId) !== roomId ||
        (meta.gameType && meta.gameType !== gameType)
      ) {
        continue;
      }
      const userId = Number(meta.userId ?? 0);
      const exposed =
        handler.exposeStateForUser && Number.isFinite(userId) && userId > 0
          ? handler.exposeStateForUser(state, userId)
          : handler.exposeState
            ? handler.exposeState(state)
            : state;
      this.hub.send(connection.connectionId, {
        type: 'game.state',
        payload: this.buildStatePayload(
          exposed,
          roomId,
          gameType,
          version,
          userId,
        ),
      });
    }
  }

  private bindGameConnection(
    session: WsSession,
    roomId: number,
    gameType: string,
  ): void {
    this.hub.updateMeta(session.connectionId, {
      scope: 'game',
      roomId,
      gameType,
      userId: session.user?.id ?? null,
    });
  }

  private async ensureRoomReadable(roomId: number, userId: number) {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: { participants: { user: true }, owner: true },
    });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    if (!room.isPrivate) {
      return;
    }
    const isOwner = room.owner?.id === userId;
    const isParticipant = (room.participants ?? []).some(
      (participant) =>
        !participant.leftAt &&
        participant.user &&
        participant.user.id === userId,
    );
    if (!isOwner && !isParticipant) {
      throw new ForbiddenException('Accès non autorisé');
    }
  }

  private async buildRoomPayload(roomId: number): Promise<RoomPayload> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: { participants: { user: true }, bots: true, owner: true },
    });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    const players = (room.participants ?? [])
      .filter((participant) => !participant.leftAt)
      .map((participant) => ({
        id: participant.user.id,
        username: participant.user.username,
      }));
    const bots = (room.bots ?? []).map((bot) => ({
      id: bot.id,
      name: bot.name,
    }));

    return {
      manifest: null,
      room: {
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        maxPlayers: room.maxPlayers,
        status: room.status,
        gameType: room.gameType,
        startedAt: room.startedAt ? room.startedAt.toISOString() : null,
        runId: room.runId,
        tableAmbienceSoundId: room.tableAmbienceSoundId,
        counts: { players: players.length, spectators: 0 },
        owner: room.owner
          ? { id: room.owner.id, username: room.owner.username }
          : null,
        players,
        spectators: [],
        bots,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private resolveRoomId(payload: unknown): number {
    const record = this.asRecord(payload);
    const roomId = Number(record.roomId ?? record.id);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new NotFoundException('roomId invalide');
    }
    return roomId;
  }

  private resolveActions(payload: unknown): GameSingleActionDto[] {
    const record = this.asRecord(payload);
    if (Array.isArray(record.actions)) {
      return record.actions
        .map((entry) => this.normalizeAction(entry))
        .filter((entry): entry is GameSingleActionDto => entry != null);
    }
    const actionSource =
      record.action && typeof record.action === 'object'
        ? record.action
        : this.hasActionShape(record)
          ? record
          : null;
    const action = this.normalizeAction(actionSource);
    return action ? [action] : [];
  }

  private normalizeAction(value: unknown): GameSingleActionDto | null {
    const record = this.asRecord(value);
    const type =
      typeof record.type === 'string'
        ? record.type.trim()
        : typeof record.actionType === 'string'
          ? record.actionType.trim()
          : typeof record.actionId === 'string'
            ? record.actionId.trim()
            : typeof record.intentId === 'string'
              ? record.intentId.trim()
              : typeof record.key === 'string'
                ? record.key.trim()
        : typeof record.action === 'string'
          ? record.action.trim()
          : '';
    if (!type) {
      return null;
    }
    const payload = this.resolveActionPayload(record);
    const meta = this.asRecord(record.meta);
    return { type, payload, meta };
  }

  private hasActionShape(record: Record<string, unknown>): boolean {
    return (
      typeof record.type === 'string' ||
      typeof record.actionType === 'string' ||
      typeof record.actionId === 'string' ||
      typeof record.intentId === 'string' ||
      typeof record.key === 'string' ||
      typeof record.action === 'string'
    );
  }

  private resolveActionPayload(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    if (record.payload && typeof record.payload === 'object') {
      return this.asRecord(record.payload);
    }
    if (record.data && typeof record.data === 'object') {
      return this.asRecord(record.data);
    }

    const controlKeys = new Set([
      'roomId',
      'id',
      'type',
      'action',
      'actionType',
      'actionId',
      'intentId',
      'key',
      'meta',
      '_trace',
    ]);
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!controlKeys.has(key)) {
        payload[key] = value;
      }
    }
    return payload;
  }

  private withActor(
    action: GameSingleActionDto,
    userId: number,
  ): GameSingleActionDto {
    return {
      ...action,
      payload: action.payload ?? {},
      meta: {
        ...(action.meta ?? {}),
        actorId: action.meta?.actorId ?? userId,
      },
    };
  }

  private validateGameAction(
    handler: GameRulesAdapter,
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number,
  ): GameSingleActionDto {
    if (!handler.validateAction) {
      return action;
    }
    return handler.validateAction(state, action, actorId);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
