import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RoomService } from '../../../room/services/room.service';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameCoreService } from '../../core/services/game-core.service';
import {
  GameSingleActionDto,
  GameStateResponse,
  GameStateWithActions,
} from '../dto/game-action.dto';
import { GameRegistryService } from './game-registry.service';
import { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { playingLog } from '../../../common/utils/playing-logger';
import { TurnLabelService } from '../../modules/turn/services/turn-label.service';
import { BotRunnerService } from '../../modules/bot/services/bot-runner.service';
import { BotSchedulerService } from '../../modules/bot/services/bot-scheduler.service';
import { GameEngineStateStore } from './game-engine-state.store';

@Injectable()
export class GameEngineService {
  private broadcaster?: (
    gameType: string,
    roomId: number,
    state: GameStateEntity,
  ) => void;
  private readonly mutationQueue = new Map<string, Promise<unknown>>();

  private static readonly MAX_ACTIONS_PER_MESSAGE = 12;
  private static readonly MAX_ACTION_TYPE_LENGTH = 64;
  private static readonly MAX_ACTION_PAYLOAD_BYTES = 16 * 1024;
  private static readonly MAX_MESSAGE_PAYLOAD_BYTES = 64 * 1024;
  private static readonly BOT_THINKING_TTL_MS = 25_000;

  private static nowMs(): number {
    return Date.now();
  }

  constructor(
    private readonly rooms: RoomService,
    private readonly core: GameCoreService,
    private readonly registry: GameRegistryService,
    private readonly turnLabel: TurnLabelService,
    private readonly botRunner: BotRunnerService,
    private readonly botScheduler: BotSchedulerService,
    private readonly store: GameEngineStateStore,
  ) {}

  setBroadcaster(
    fn: (gameType: string, roomId: number, state: GameStateEntity) => void,
  ): void {
    this.broadcaster = fn;
  }

  async getState(
    roomId: number,
    gameType: string,
  ): Promise<GameStateWithActions> {
    const internal = await this.getInternalState(roomId, gameType);
    return this.exposeState(internal, gameType);
  }

  async getStateForUser(
    roomId: number,
    gameType: string,
    userId: number,
  ): Promise<GameStateWithActions> {
    const internal = await this.getInternalState(roomId, gameType);
    return this.exposeStateForUser(internal, gameType, userId);
  }

  exposeStateForUser(
    state: GameStateEntity,
    gameType: string,
    userId: number,
  ): GameStateWithActions {
    const label = this.turnLabel.compute(state, gameType);
    const handler = this.registry.getHandler(gameType);
    const exposed = handler?.exposeStateForUser
      ? handler.exposeStateForUser(state, userId)
      : handler?.exposeState
        ? handler.exposeState(state)
        : (state as GameStateWithActions);
    return this.attachTurnLabel(exposed, label);
  }

  private async getInternalState(
    roomId: number,
    gameType: string,
  ): Promise<GameStateEntity> {
    let payload: RoomPayload;
    try {
      payload = await this.rooms.getRoomPayload(roomId);
    } catch (err) {
      this.cleanupRoom(roomId, gameType);
      if (this.isRoomNotFound(err)) {
        throw new NotFoundException('Table introuvable');
      }
      throw err;
    }
    const existing = this.store.get(roomId, gameType);
    if (existing) {
      const previousStatus = String(existing.status ?? '').toLowerCase();
      const roomStatus = String(payload?.room?.status ?? '').toLowerCase();

      // Réinitialisation explicite (room repasse en "setup/open/...") :
      // on repart d'un état neuf pour permettre d'ajouter/retirer des joueurs et relancer une partie.
      if (
        (previousStatus === 'started' || previousStatus === 'finished') &&
        roomStatus &&
        roomStatus !== 'started' &&
        roomStatus !== 'finished'
      ) {
        playingLog('engine.reset.detected', {
          roomId,
          gameType,
          previousStatus,
          roomStatus,
        });
        this.cleanupRoom(roomId, gameType);
        const rebuilt = await this.buildInitialState(payload, gameType);
        const marked = this.normalizeBotThinking(
          roomId,
          gameType,
          this.markBotThinking(roomId, gameType, rebuilt),
        );
        this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }

      const synced = this.store.syncRoomStatus(existing, payload);
      const nextStatus = String(synced.status ?? '').toLowerCase();
      const currentPlayers = existing.players?.length ?? 0;
      const incomingPlayers =
        (payload.room.players?.length ?? 0) + (payload.room.bots?.length ?? 0);
      const gameStarted = (existing.status || '').toLowerCase() === 'started';
      playingLog('engine.getState', {
        roomId,
        gameType,
        status: synced.status,
        turnIndex: synced.turnIndex,
        currentPlayerId: synced.turn?.currentPlayerId ?? null,
        players:
          synced.players?.map((p) => ({ id: p.id, isBot: (p as any).isBot })) ??
          [],
        incomingPlayers,
        gameStarted,
      });
      // Démarrage : à la transition vers "started", reconstruire l'état initial à partir de la room
      // (permet d'avoir un premier joueur aléatoire via le GameCoreService).
      if (previousStatus !== 'started' && nextStatus === 'started') {
        const rebuilt = await this.buildInitialState(payload, gameType);
        const marked = this.normalizeBotThinking(
          roomId,
          gameType,
          this.markBotThinking(roomId, gameType, rebuilt),
        );
        this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }
      if (!gameStarted && incomingPlayers !== currentPlayers) {
        const rebuilt = await this.buildInitialState(payload, gameType);
        const marked = this.normalizeBotThinking(
          roomId,
          gameType,
          this.markBotThinking(roomId, gameType, rebuilt),
        );
        this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }
      const marked = this.normalizeBotThinking(
        roomId,
        gameType,
        this.markBotThinking(roomId, gameType, synced),
      );
      this.scheduleBotTurn(roomId, gameType, marked);
      return marked;
    }

    const state = await this.buildInitialState(payload, gameType);
    const marked = this.normalizeBotThinking(
      roomId,
      gameType,
      this.markBotThinking(roomId, gameType, state),
    );
    this.scheduleBotTurn(roomId, gameType, marked);
    return marked;
  }

  async applyActions(
    roomId: number,
    gameType: string,
    actions: GameSingleActionDto[],
    actorId: number | null,
    allowBotTurn = false,
  ): Promise<GameStateResponse> {
    return this.enqueueMutation(this.buildKey(roomId, gameType), () =>
      this.applyActionsInternal(
        roomId,
        gameType,
        actions,
        actorId,
        allowBotTurn,
      ),
    );
  }

  private async applyActionsInternal(
    roomId: number,
    gameType: string,
    actions: GameSingleActionDto[],
    actorId: number | null,
    allowBotTurn = false,
  ): Promise<GameStateResponse> {
    const current = this.normalizeBotThinking(
      roomId,
      gameType,
      await this.getInternalState(roomId, gameType),
    );
    // `getInternalState()` peut programmer un timer bot pour l'état courant.
    // Quand on exécute une action bot immédiatement, ce timer devient obsolète et empêche
    // la programmation du tour suivant (même clé). On le supprime donc ici.
    if (allowBotTurn) {
      this.botScheduler.clear(this.buildKey(roomId, gameType));
    }
    if ((current.status || '').toLowerCase() === 'finished') {
      return this.exposeState(current, gameType);
    }
    const handler = this.registry.getHandler(gameType);
    if (!allowBotTurn && (!actorId || Number.isNaN(actorId))) {
      throw new UnauthorizedException('Authentification requise pour jouer.');
    }
    if (!allowBotTurn && current.botThinking) {
      throw new UnauthorizedException(
        'Un bot joue actuellement, merci de patienter.',
      );
    }
    const currentPlayerId = current.turn?.currentPlayerId ?? null;
    const currentPlayer = current.players?.find(
      (p) => p.id === currentPlayerId,
    );
    const actorOverride =
      handler?.validateActor?.(current, actions, actorId ?? null) === true;
    if (!allowBotTurn && !actorOverride) {
      if (currentPlayer?.isBot) {
        throw new UnauthorizedException(
          'Tour en cours : action réservée au bot.',
        );
      }
      if (currentPlayerId !== actorId) {
        throw new UnauthorizedException("Ce n'est pas votre tour.");
      }
    }

    const actorLabel = allowBotTurn ? 'bot' : 'human';
    const validatedActions = this.validateActions(
      current,
      handler,
      actions,
      allowBotTurn ? currentPlayerId : actorId,
    );
    const sanitizedActions = validatedActions.map((action) => ({
      ...action,
      meta: { ...(action?.meta ?? {}), actor: actorLabel },
    }));

    playingLog('engine.applyActions.before', {
      roomId,
      gameType,
      actorId,
      allowBotTurn,
      status: current.status,
      turnIndex: current.turnIndex,
      currentPlayerId,
      actions: sanitizedActions.map((a) => ({
        type: a.type,
        hasPayload: Boolean(a.payload),
      })),
    });

    if (!handler) {
      const next = this.core.appendLog(
        current,
        `Type de jeu non spécialisé: ${gameType}`,
      );
      const marked = this.markBotThinking(roomId, gameType, next);
      this.scheduleBotTurn(roomId, gameType, marked);
      this.broadcaster?.(gameType, roomId, marked);
      return this.exposeState(marked, gameType);
    }

    const next = await handler.applyActions(current, sanitizedActions);
    const botTurn = this.isBotTurn(next);
    const marked = this.markBotThinking(roomId, gameType, next, botTurn);
    this.scheduleBotTurn(roomId, gameType, marked);
    this.broadcaster?.(gameType, roomId, marked);

    // Fin de partie : remettre la room en "setup" (comme le raccourci X) et rÇ¸initialiser l'Ç¸tat du jeu
    // pour permettre de relancer immÇ¸diatement.
    if ((marked.status || '').toLowerCase() === 'finished') {
      try {
        await this.rooms.resetRoomSystem(roomId);
        await this.rooms.notifyRoomStateUpdated(roomId);

        // Rebuild sans toucher à la mutationQueue (on est déjà dans la file).
        const payload = await this.rooms.getRoomPayload(roomId);
        const rebuilt = await this.buildInitialState(payload, gameType);
        const cleared = this.markBotThinking(roomId, gameType, rebuilt, false);
        this.botScheduler.clear(this.buildKey(roomId, gameType));
        this.broadcaster?.(gameType, roomId, cleared);
      } catch (err) {
        playingLog('engine.autoReset.failed', {
          roomId,
          gameType,
          message: err instanceof Error ? err.message : String(err ?? ''),
        });
      }
    }

    playingLog('engine.applyActions.after', {
      roomId,
      gameType,
      actorId,
      status: marked.status,
      turnIndex: marked.turnIndex,
      currentPlayerId: marked.turn?.currentPlayerId ?? null,
      isBotTurn: botTurn,
      botThinking: marked.botThinking ?? false,
    });

    return this.exposeState(marked, gameType);
  }

  async playBotTurn(
    roomId: number,
    gameType: string,
  ): Promise<GameStateWithActions> {
    return this.enqueueMutation(this.buildKey(roomId, gameType), () =>
      this.playBotTurnInternal(roomId, gameType),
    );
  }

  private async playBotTurnInternal(
    roomId: number,
    gameType: string,
  ): Promise<GameStateWithActions> {
    playingLog('engine.bot.tick', { roomId, gameType });
    const state = this.normalizeBotThinking(
      roomId,
      gameType,
      await this.getInternalState(roomId, gameType),
    );
    const key = this.buildKey(roomId, gameType);
    this.botScheduler.clear(key);

    const handler = this.registry.getHandler(gameType);
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentPlayerId);

    if (!currentPlayer || !currentPlayer.isBot) {
      return this.exposeState(state, gameType);
    }

    let botActions =
      currentPlayerId != null
        ? this.botRunner.suggestForHandler(handler, state, currentPlayerId)
        : null;
    if (!botActions || botActions.length === 0) {
      const fallback =
        handler?.getAvailableActions && currentPlayerId != null
          ? handler.getAvailableActions(state, currentPlayerId)
          : [];
      if (
        Array.isArray(fallback) &&
        fallback.length > 0 &&
        currentPlayerId != null
      ) {
        botActions = this.botRunner.choose(fallback, {
          state,
          playerId: currentPlayerId,
        });
      }
    }
    if (!botActions || botActions.length === 0) {
      playingLog('engine.bot.noaction', {
        roomId,
        gameType,
        currentPlayerId,
        status: state.status,
      });
      const marked = this.markBotThinking(roomId, gameType, state, false);
      this.broadcaster?.(gameType, roomId, marked);
      return this.exposeState(marked, gameType);
    }

    playingLog('engine.bot.play', {
      roomId,
      gameType,
      currentPlayerId,
      isBot: currentPlayer.isBot,
      actions: botActions.map((a) => a.type),
      status: state.status,
    });

    await this.applyActionsInternal(roomId, gameType, botActions, null, true);
    const updated = this.store.get(roomId, gameType) ?? state;
    return this.exposeState(updated, gameType);
  }

  private enqueueMutation<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueue.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.mutationQueue.set(key, next);
    next.finally(() => {
      if (this.mutationQueue.get(key) === next) {
        this.mutationQueue.delete(key);
      }
    });
    return next;
  }

  private isBotTurn(state: GameStateEntity): boolean {
    if (state.status === 'finished') return false;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentId);
    return Boolean(currentPlayer?.isBot);
  }

  private scheduleBotTurn(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): void {
    const key = this.buildKey(roomId, gameType);
    const status = (state.status || '').toLowerCase();
    if (
      status === 'finished' ||
      status === 'setup' ||
      status === 'open' ||
      status === 'pending' ||
      status === 'preparing'
    ) {
      this.botScheduler.clear(key);
      return;
    }
    const blockingPending = (state as any).pending?.blocking === true;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentId);
    if (blockingPending && !currentPlayer?.isBot) {
      this.botScheduler.clear(key);
      return;
    }
    if (!currentPlayer || !currentPlayer.isBot) {
      this.botScheduler.clear(key);
      return;
    }
    if (this.botScheduler.has(key)) return;

    const delayMs = 4000;
    const thinking = this.markBotThinking(roomId, gameType, state, true);
    this.broadcaster?.(gameType, roomId, thinking);
    playingLog('engine.bot.schedule', {
      roomId,
      gameType,
      status: thinking.status,
      turnIndex: thinking.turnIndex,
      currentPlayerId: thinking.turn?.currentPlayerId ?? null,
      delayMs,
    });
    const expectedTurnIndex = thinking.turnIndex ?? null;
    const expectedPlayerId = thinking.turn?.currentPlayerId ?? null;

    this.botScheduler.schedule({
      key,
      delayMs,
      roomId,
      gameType,
      run: async () => {
        const latest = this.store.get(roomId, gameType) ?? null;
        if (!latest) {
          return;
        }
        if ((latest.status || '').toLowerCase() === 'finished') {
          return;
        }
        const latestPlayerId = latest.turn?.currentPlayerId ?? null;
        const latestTurnIndex = latest.turnIndex ?? null;
        if (
          latestTurnIndex !== expectedTurnIndex ||
          latestPlayerId !== expectedPlayerId
        ) {
          playingLog('engine.bot.stale.skip', {
            roomId,
            gameType,
            expectedTurnIndex,
            latestTurnIndex,
            expectedPlayerId,
            latestPlayerId,
          });
          return;
        }
        await this.playBotTurn(roomId, gameType);
      },
      onStale: () => this.cleanupRoom(roomId, gameType),
    });
  }

  async checkAccess(
    roomId: number,
    userId: number,
    ownerOnly = false,
  ): Promise<void> {
    let payload: RoomPayload;
    try {
      payload = await this.rooms.getRoomPayload(roomId);
    } catch (err) {
      if (this.isRoomNotFound(err)) {
        throw new NotFoundException('Table introuvable');
      }
      throw err;
    }
    const players = Array.isArray(payload?.room?.players)
      ? payload.room.players
      : [];
    const isParticipant = players.some((p) => p?.id === userId);
    const isOwner = payload?.room?.owner?.id === userId;
    if (ownerOnly && !isOwner) {
      throw new UnauthorizedException(
        'Seul le propriétaire peut effectuer cette action',
      );
    }
    if (!ownerOnly && !isParticipant && !isOwner) {
      throw new UnauthorizedException('Accès non autorisé à cette table');
    }
  }

  async checkReadAccess(roomId: number, userId: number): Promise<void> {
    let payload: RoomPayload;
    try {
      payload = await this.rooms.getRoomPayload(roomId);
    } catch (err) {
      if (this.isRoomNotFound(err)) {
        throw new NotFoundException('Table introuvable');
      }
      throw err;
    }
    const players = Array.isArray(payload?.room?.players)
      ? payload.room.players
      : [];
    const isParticipant = players.some((p) => p?.id === userId);
    const isOwner = payload?.room?.owner?.id === userId;
    if (payload?.room?.isPrivate && !isParticipant && !isOwner) {
      throw new UnauthorizedException('Accès non autorisé à cette table');
    }
  }

  private async buildInitialState(
    payload: RoomPayload,
    gameType: string,
  ): Promise<GameStateEntity> {
    const baseState = this.core.buildBaseState(payload, gameType);
    const handler = this.registry.getHandler(gameType);
    if (handler) {
      return handler.hydrateInitialState(baseState);
    }
    return this.core.appendLog(
      baseState,
      `Type de jeu non spécialisé: ${gameType}`,
    );
  }

  private buildKey(roomId: number, gameType: string): string {
    return this.store.buildKey(roomId, gameType);
  }

  private markBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    botTurn?: boolean,
  ): GameStateEntity {
    const isBot = botTurn !== undefined ? botTurn : this.isBotTurn(state);
    const now = GameEngineService.nowMs();
    const marked = {
      ...(this.store.markBotThinking(state, isBot) as any),
      botThinkingSince: isBot ? now : null,
    } as GameStateEntity;
    this.store.set(roomId, gameType, marked);
    return marked;
  }

  private normalizeBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): GameStateEntity {
    const s: any = state as any;
    const since =
      typeof s.botThinkingSince === 'number'
        ? (s.botThinkingSince as number)
        : null;
    if (!state.botThinking) {
      return state;
    }
    if (since == null) {
      const patched = {
        ...(state as any),
        botThinkingSince: GameEngineService.nowMs(),
      } as GameStateEntity;
      this.store.set(roomId, gameType, patched);
      return patched;
    }
    const age = GameEngineService.nowMs() - since;
    if (age <= GameEngineService.BOT_THINKING_TTL_MS) {
      return state;
    }
    playingLog('engine.botThinking.expired', {
      roomId,
      gameType,
      ageMs: age,
      turnIndex: state.turnIndex ?? null,
    });
    const cleared = {
      ...(state as any),
      botThinking: false,
      botThinkingSince: null,
    } as GameStateEntity;
    this.store.set(roomId, gameType, cleared);
    return cleared;
  }

  private validateActions(
    state: GameStateEntity,
    handler: GameRulesAdapter | undefined,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): GameSingleActionDto[] {
    const list = Array.isArray(actions) ? actions : [];
    if (list.length === 0) {
      return [];
    }
    if (list.length > GameEngineService.MAX_ACTIONS_PER_MESSAGE) {
      throw new BadRequestException('Trop d’actions dans un seul message');
    }

    let allowedTypes: Set<string> | null = null;
    if (handler?.getAvailableActions && actorId != null) {
      try {
        const available = handler.getAvailableActions(state, actorId) ?? [];
        allowedTypes = new Set(
          (Array.isArray(available) ? available : []).map((a: any) =>
            String(a?.type ?? ''),
          ),
        );
      } catch {
        allowedTypes = null;
      }
    }

    let totalBytes = 0;
    const out: GameSingleActionDto[] = [];
    for (const action of list) {
      const rawType =
        typeof (action as any)?.type === 'string'
          ? String((action as any).type)
          : '';
      const type = rawType.trim();
      if (!type) {
        throw new BadRequestException('Action invalide : type manquant');
      }
      if (type.length > GameEngineService.MAX_ACTION_TYPE_LENGTH) {
        throw new BadRequestException('Action invalide : type trop long');
      }
      if (!/^[a-z0-9_\\-]+$/i.test(type)) {
        throw new BadRequestException('Action invalide : type non autorisé');
      }
      if (allowedTypes && !allowedTypes.has(type)) {
        throw new BadRequestException(
          `Action inconnue ou indisponible: ${type}`,
        );
      }

      let payloadBytes = 0;
      const payload = (action as any)?.payload ?? null;
      if (payload != null) {
        try {
          payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
        } catch {
          throw new BadRequestException(
            'Action invalide : payload non sérialisable',
          );
        }
      }
      if (payloadBytes > GameEngineService.MAX_ACTION_PAYLOAD_BYTES) {
        throw new BadRequestException(
          'Action invalide : payload trop volumineux',
        );
      }
      totalBytes += payloadBytes;
      if (totalBytes > GameEngineService.MAX_MESSAGE_PAYLOAD_BYTES) {
        throw new BadRequestException(
          'Message invalide : payload total trop volumineux',
        );
      }
      out.push({ ...(action as any), type });
    }

    return out;
  }

  private exposeState(
    state: GameStateEntity,
    gameType: string,
  ): GameStateWithActions {
    // Le label de tour doit rester aligné avec l'état interne (source de vérité),
    // même si exposeState() d'un jeu masque/transforme la liste des joueurs.
    const label = this.turnLabel.compute(state, gameType);
    const handler = this.registry.getHandler(gameType);
    const exposed = handler?.exposeState
      ? handler.exposeState(state)
      : (state as GameStateWithActions);
    return this.attachTurnLabel(exposed, label);
  }

  private attachTurnLabel(
    state: GameStateWithActions,
    label: string | null,
  ): GameStateWithActions {
    if (!label) return state;
    const current = state.turn ?? null;
    if (!current) {
      return { ...state, turn: { currentPlayerId: null, direction: 1, label } };
    }
    return { ...state, turn: { ...current, label } };
  }

  private isRoomNotFound(err: unknown): boolean {
    if (err instanceof NotFoundException) return true;
    const message = err instanceof Error ? err.message : String(err ?? '');
    return (
      message.includes('Room introuvable') ||
      message.includes('Table introuvable')
    );
  }

  private cleanupRoom(roomId: number, gameType: string): void {
    const key = this.buildKey(roomId, gameType);
    try {
      this.botScheduler.clear(key);
    } catch {
      // best effort
    }
    this.store.delete(roomId, gameType);
    this.mutationQueue.delete(key);
  }
}
