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
import { TurnLabelService } from '../../modules/turn/services/turn-label.service';
import { BotRunnerService } from '../../modules/bot/services/bot-runner.service';
import { BotSchedulerService } from '../../modules/bot/services/bot-scheduler.service';
import { GameEngineStateStore } from './game-engine-state.store';
import {
  validateActions as validateActionDtos,
  sanitizeAction,
} from '../dto/validated-action.dto';
import {
  PayloadValidationError,
  GameValidationError,
  GameError,
} from '../../../common/errors/game-errors';
import { GameLoggerService } from '../../../common/services/game-logger.service';

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
    private readonly gameLogger: GameLoggerService,
  ) {}

  /**
   * Configure la fonction de broadcast pour notifier les clients des changements d'état.
   *
   * @param fn - Fonction appelée lors des changements d'état
   * @internal
   */
  setBroadcaster(
    fn: (gameType: string, roomId: number, state: GameStateEntity) => void,
  ): void {
    this.broadcaster = fn;
  }

  /**
   * Récupère l'état complet du jeu pour une room donnée.
   *
   * Retourne l'état enrichi avec les actions disponibles et les informations
   * visibles par tous les joueurs. Utilise le cache pour optimiser les performances.
   *
   * @param roomId - ID de la room
   * @param gameType - Type de jeu
   * @returns État du jeu enrichi avec les actions disponibles
   *
   * @throws {GameStateError} Si l'état est introuvable ou invalide
   *
   * @example
   * ```typescript
   * const state = await gameEngine.getState(123, 'dame-nature');
   * console.log(state.status); // 'started'
   * console.log(state.availableActions); // Liste des actions disponibles
   * ```
   */
  async getState(
    roomId: number,
    gameType: string,
  ): Promise<GameStateWithActions> {
    const internal = await this.enqueueMutation(
      this.buildKey(roomId, gameType),
      () => this.getInternalState(roomId, gameType),
    );
    return this.exposeState(internal, gameType);
  }

  /**
   * Récupère l'état du jeu personnalisé pour un utilisateur spécifique.
   *
   * Retourne l'état avec les informations visibles uniquement par cet utilisateur
   * (masquage de la main des adversaires, cartes cachées, etc.).
   *
   * @param roomId - ID de la room
   * @param gameType - Type de jeu
   * @param userId - ID de l'utilisateur
   * @returns État personnalisé pour cet utilisateur
   *
   * @throws {GameStateError} Si l'état est introuvable ou invalide
   *
   * @example
   * ```typescript
   * const state = await gameEngine.getStateForUser(123, 'dame-nature', 456);
   * // state.players[0].hand contient les cartes si userId === players[0].id
   * // state.players[1].hand est vide si userId !== players[1].id
   * ```
   */
  async getStateForUser(
    roomId: number,
    gameType: string,
    userId: number,
  ): Promise<GameStateWithActions> {
    const internal = await this.enqueueMutation(
      this.buildKey(roomId, gameType),
      () => this.getInternalState(roomId, gameType),
    );
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
    const withLabel = this.attachTurnLabel(exposed, label);
    return this.attachCurrentPlayerView(withLabel);
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
    const actualGameType = String(payload?.room?.gameType ?? '').trim();
    if (actualGameType && actualGameType !== gameType) {
      // Empêche la création d'un état "fantôme" quand le client passe le mauvais gameType
      // (ex: "generic" alors que la room est en "loup-garou").
      this.cleanupRoom(roomId, gameType);
      throw new BadRequestException('Type de jeu invalide pour cette table');
    }
    const existing = await this.store.get(roomId, gameType);
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
        this.gameLogger.info('Game state reset detected', {
          roomId,
          gameType,
          previousStatus,
          roomStatus,
        });
        this.cleanupRoom(roomId, gameType);
        const rebuilt = await this.buildInitialState(payload, gameType);
        const marked = await this.normalizeBotThinking(
          roomId,
          gameType,
          await this.markBotThinking(roomId, gameType, rebuilt),
        );
        await this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }

      const synced = this.store.syncRoomStatus(existing, payload);
      const nextStatus = String(synced.status ?? '').toLowerCase();
      const currentPlayers = existing.players?.length ?? 0;
      const incomingPlayers =
        (payload.room.players?.length ?? 0) + (payload.room.bots?.length ?? 0);
      const gameStarted = (existing.status || '').toLowerCase() === 'started';
      this.gameLogger.debug('Retrieved game state', {
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
        const marked = await this.normalizeBotThinking(
          roomId,
          gameType,
          await this.markBotThinking(roomId, gameType, rebuilt),
        );
        await this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }
      if (!gameStarted && incomingPlayers !== currentPlayers) {
        const rebuilt = await this.buildInitialState(payload, gameType);
        const marked = await this.normalizeBotThinking(
          roomId,
          gameType,
          await this.markBotThinking(roomId, gameType, rebuilt),
        );
        await this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }
      const normalized = await this.normalizeBotThinking(
        roomId,
        gameType,
        synced,
      );
      await this.scheduleBotTurn(roomId, gameType, normalized);
      return normalized;
    }

    const state = await this.buildInitialState(payload, gameType);
    const marked = await this.normalizeBotThinking(
      roomId,
      gameType,
      await this.markBotThinking(roomId, gameType, state),
    );
    await this.scheduleBotTurn(roomId, gameType, marked);
    return marked;
  }

  /**
   * Applique une liste d'actions au jeu et retourne le nouvel état.
   *
   * Cette méthode est le point d'entrée principal pour toutes les actions de jeu.
   * Elle gère :
   * - La validation des actions
   * - La vérification des permissions
   * - L'application via l'adaptateur de jeu
   * - Le déclenchement des tours de bot
   * - La sauvegarde de l'état
   * - Le broadcast aux clients
   *
   * @param roomId - ID de la room
   * @param gameType - Type de jeu
   * @param actions - Liste des actions à appliquer
   * @param actorId - ID du joueur effectuant l'action (null pour les actions système)
   * @param allowBotTurn - Si true, déclenche automatiquement les tours de bot après l'action
   * @returns Réponse contenant le nouvel état et des métadonnées
   *
   * @throws {GameValidationError} Si les actions sont invalides
   * @throws {PlayerActionError} Si l'acteur n'a pas les permissions
   * @throws {GameStateError} Si l'état devient invalide
   *
   * @example
   * ```typescript
   * const response = await gameEngine.applyActions(
   *   123,                    // roomId
   *   'dame-nature',          // gameType
   *   [{ type: 'draw', payload: {} }],  // actions
   *   456,                    // actorId
   *   true                    // allowBotTurn
   * );
   * console.log(response.state.turnIndex); // Nouveau numéro de tour
   * ```
   */
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
    const current = await this.normalizeBotThinking(
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
    const validatedActions = await this.validateActions(
      current,
      handler,
      actions,
      allowBotTurn ? currentPlayerId : actorId,
    );
    const sanitizedActions = validatedActions.map((action) => ({
      ...action,
      meta: {
        ...(action?.meta ?? {}),
        actor: actorLabel,
        actorId: allowBotTurn ? currentPlayerId : actorId,
      },
    }));

    this.gameLogger.logPlayerAction(
      {
        type: 'apply_actions',
        payload: {
          actions: sanitizedActions.map((a) => ({
            type: a.type,
            hasPayload: Boolean(a.payload),
          })),
          allowBotTurn,
        },
      },
      {
        roomId,
        gameType,
        playerId: actorId ?? currentPlayerId ?? undefined,
        turnIndex: current.turnIndex,
        action: {
          status: current.status,
          currentPlayerId,
        },
      },
    );

    if (!handler) {
      const next = this.core.appendLog(
        current,
        `Type de jeu non spécialisé: ${gameType}`,
      );
      const marked = await this.markBotThinking(roomId, gameType, next);
      await this.scheduleBotTurn(roomId, gameType, marked);
      this.broadcaster?.(gameType, roomId, marked);
      return this.exposeState(marked, gameType);
    }

    const next = await handler.applyActions(current, sanitizedActions);
    const botTurn = this.isBotTurn(next);
    const marked = await this.markBotThinking(roomId, gameType, next, botTurn);
    await this.scheduleBotTurn(roomId, gameType, marked);
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
        const cleared = await this.markBotThinking(
          roomId,
          gameType,
          rebuilt,
          false,
        );
        this.botScheduler.clear(this.buildKey(roomId, gameType));
        this.broadcaster?.(gameType, roomId, cleared);
      } catch (err) {
        this.gameLogger.error(
          'Auto-reset after game finished failed',
          err instanceof Error ? err : undefined,
          {
            roomId,
            gameType,
          },
        );
      }
    }

    this.gameLogger.debug('Actions applied successfully', {
      roomId,
      gameType,
      playerId: actorId ?? undefined,
      turnIndex: marked.turnIndex,
      action: {
        status: marked.status,
        currentPlayerId: marked.turn?.currentPlayerId ?? null,
        isBotTurn: botTurn,
        botThinking: marked.botThinking ?? false,
      },
    });

    return this.exposeState(marked, gameType);
  }

  /**
   * Déclenche le tour d'un bot dans la partie.
   *
   * Cette méthode :
   * - Vérifie que le joueur actuel est un bot
   * - Récupère les actions suggérées par la stratégie du bot
   * - Applique automatiquement ces actions
   * - Peut déclencher récursivement d'autres tours de bot
   *
   * @param roomId - ID de la room
   * @param gameType - Type de jeu
   * @returns État mis à jour après le tour du bot
   *
   * @throws {GameStateError} Si aucun bot n'est actif
   *
   * @example
   * ```typescript
   * // Déclencher manuellement un tour de bot
   * const state = await gameEngine.playBotTurn(123, 'dame-nature');
   * console.log(state.turn.currentPlayerId); // Nouveau joueur actif
   * ```
   */
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
    this.gameLogger.debug('Bot turn tick', { roomId, gameType });
    const state = await this.normalizeBotThinking(
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
      this.gameLogger.warn('Bot has no available actions', {
        roomId,
        gameType,
        playerId: currentPlayerId ?? undefined,
        action: {
          status: state.status,
        },
      });
      const marked = await this.markBotThinking(roomId, gameType, state, false);
      this.broadcaster?.(gameType, roomId, marked);
      return this.exposeState(marked, gameType);
    }

    this.gameLogger.logPlayerAction(
      {
        type: 'bot_play',
        payload: {
          actions: botActions.map((a) => a.type),
        },
      },
      {
        roomId,
        gameType,
        playerId: currentPlayerId ?? undefined,
        action: {
          isBot: currentPlayer.isBot,
          status: state.status,
        },
      },
    );

    await this.applyActionsInternal(roomId, gameType, botActions, null, true);
    const updated = (await this.store.get(roomId, gameType)) ?? state;
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

  private async scheduleBotTurn(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
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
    const thinking = await this.markBotThinking(roomId, gameType, state, true);
    this.broadcaster?.(gameType, roomId, thinking);
    this.gameLogger.debug('Bot turn scheduled', {
      roomId,
      gameType,
      turnIndex: thinking.turnIndex,
      playerId: thinking.turn?.currentPlayerId ?? undefined,
      action: {
        status: thinking.status,
        delayMs,
      },
    });
    const expectedTurnIndex = thinking.turnIndex ?? null;
    const expectedPlayerId = thinking.turn?.currentPlayerId ?? null;

    this.botScheduler.schedule({
      key,
      delayMs,
      roomId,
      gameType,
      run: async () => {
        const latest = (await this.store.get(roomId, gameType)) ?? null;
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
          this.gameLogger.debug('Bot turn skipped (stale)', {
            roomId,
            gameType,
            action: {
              expectedTurnIndex,
              latestTurnIndex,
              expectedPlayerId,
              latestPlayerId,
            },
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

  private async markBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    botTurn?: boolean,
  ): Promise<GameStateEntity> {
    const isBot = botTurn !== undefined ? botTurn : this.isBotTurn(state);
    const now = GameEngineService.nowMs();
    const marked = {
      ...(this.store.markBotThinking(state, isBot) as any),
      botThinkingSince: isBot ? now : null,
    } as GameStateEntity;
    await this.store.set(roomId, gameType, marked);
    return marked;
  }

  private async normalizeBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<GameStateEntity> {
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
      await this.store.set(roomId, gameType, patched);
      return patched;
    }
    const age = GameEngineService.nowMs() - since;
    if (age <= GameEngineService.BOT_THINKING_TTL_MS) {
      return state;
    }
    this.gameLogger.warn('Bot thinking state expired', {
      roomId,
      gameType,
      turnIndex: state.turnIndex,
      action: {
        ageMs: age,
      },
    });
    const cleared = {
      ...(state as any),
      botThinking: false,
      botThinkingSince: null,
    } as GameStateEntity;
    await this.store.set(roomId, gameType, cleared);
    return cleared;
  }

  private async validateActions(
    state: GameStateEntity,
    handler: GameRulesAdapter | undefined,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): Promise<GameSingleActionDto[]> {
    const ctx = (state?.metadata ?? {}) as any;
    const ctxGameType = ctx?.gameType ?? null;
    const ctxRoomId = ctx?.roomId ?? null;
    const list = Array.isArray(actions) ? actions : [];
    if (list.length === 0) {
      return [];
    }
    if (list.length > GameEngineService.MAX_ACTIONS_PER_MESSAGE) {
      throw new BadRequestException("Trop d'actions dans un seul message");
    }

    // Step 1: Validate DTOs with class-validator
    let validatedDtos;
    try {
      validatedDtos = await validateActionDtos(list, {
        gameType: ctxGameType,
        roomId: ctxRoomId,
        actorId,
      });
    } catch (error) {
      if (error instanceof PayloadValidationError) {
        this.gameLogger.logValidationFailure(
          error.message,
          error.validationErrors,
          {
            gameType: ctxGameType ?? undefined,
            roomId: ctxRoomId ?? undefined,
            playerId: actorId ?? undefined,
          },
        );
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Step 2: Sanitize actions
    const sanitized = validatedDtos.map((dto) => sanitizeAction(dto));

    // Step 3: Check available actions
    let allowedTypes: Set<string> | null = null;
    if (handler?.getAvailableActions && actorId != null) {
      try {
        const available = handler.getAvailableActions(state, actorId) ?? [];
        allowedTypes = new Set(
          (Array.isArray(available) ? available : []).map((a: any) =>
            String(a?.type ?? '').toLowerCase(),
          ),
        );
      } catch (err) {
        this.gameLogger.error(
          'Error getting available actions',
          err instanceof Error ? err : undefined,
          {
            gameType: ctxGameType ?? undefined,
            roomId: ctxRoomId ?? undefined,
            playerId: actorId ?? undefined,
          },
        );
        allowedTypes = null;
      }
    }

    // Step 4: Validate size limits and available actions
    let totalBytes = 0;
    const out: GameSingleActionDto[] = [];
    for (const action of sanitized) {
      const type = action.type.toLowerCase();

      if (type.length > GameEngineService.MAX_ACTION_TYPE_LENGTH) {
        throw new BadRequestException('Action invalide : type trop long');
      }

      if (allowedTypes && !allowedTypes.has(type)) {
        throw new BadRequestException(
          `Action inconnue ou indisponible: ${type}`,
        );
      }

      let payloadBytes = 0;
      const payload = action.payload ?? null;
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

      // Step 5: Game-specific validation
      let normalized: GameSingleActionDto = { ...action, type };
      if (handler?.validateAction) {
        try {
          normalized = handler.validateAction(
            state,
            normalized,
            actorId ?? null,
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err ?? '');
          this.gameLogger.logValidationFailure(
            `Game-specific validation failed for action: ${type}`,
            [{ actionType: type, error: message }],
            {
              gameType: ctxGameType ?? undefined,
              roomId: ctxRoomId ?? undefined,
              playerId: actorId ?? undefined,
              action: { type },
            },
          );
          throw new BadRequestException(message || `Action invalide: ${type}`);
        }
      }
      out.push(normalized);
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
    const withLabel = this.attachTurnLabel(exposed, label);
    return this.attachCurrentPlayerView(withLabel);
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

  private attachCurrentPlayerView(
    state: GameStateWithActions,
  ): GameStateWithActions {
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (currentPlayerId === null) return state;

    const extras = state.extras && typeof state.extras === 'object'
      ? (state.extras as Record<string, unknown>)
      : {};

    // Si le jeu a déjà défini currentPlayerView, on ne l'écrase pas
    if (extras.currentPlayerView !== undefined) return state;

    const players = Array.isArray(state.players) ? state.players : [];
    const currentPlayer = players.find((p) => p?.id === currentPlayerId);
    if (!currentPlayer) return state;

    const currentPlayerView = {
      id: currentPlayer.id,
      username: currentPlayer.username ?? `Joueur ${currentPlayer.id}`,
    };

    return {
      ...state,
      extras: {
        ...extras,
        currentPlayerView,
      },
    };
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
    void this.store.delete(roomId, gameType);
    this.mutationQueue.delete(key);
  }
}
