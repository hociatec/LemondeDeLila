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
import { BotSettingsService } from '../../modules/bot/services/bot-settings.service';
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
import { GameStatsService } from '../../../stats/services/game-stats.service';
import { GridRenderService } from '../../modules/grid/services/grid-render.service';
import type { GameShortcutHint } from '../shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../shortcuts/shortcut-utils';

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
    private readonly botSettings: BotSettingsService,
    private readonly gridRender: GridRenderService,
    private readonly store: GameEngineStateStore,
    private readonly gameLogger: GameLoggerService,
    private readonly stats: GameStatsService,
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
    const withDescriptors = this.attachUiDescriptors(
      this.gridRender.attachGridRenderDescriptors(
        this.attachCurrentPlayerView(withLabel),
      ),
    );
    return this.attachShortcuts(withDescriptors, handler, userId);
  }

  async handleKeyPress(
    roomId: number,
    gameType: string,
    userId: number,
    key: string,
  ): Promise<
    | { kind: 'action'; actions: GameSingleActionDto[] }
    | { kind: 'panel'; panelId: string; message: string }
    | null
  > {
    const normalized = String(key ?? '').trim().toUpperCase();
    if (!normalized) return null;

    const state = await this.getStateForUser(roomId, gameType, userId);
    const handler = this.registry.getHandler(gameType);

    const declared: GameShortcutHint[] = handler?.getShortcuts
      ? handler.getShortcuts({
          metadata: state?.metadata ?? {},
          currentPlayerId: state?.turn?.currentPlayerId ?? null,
          started: String(state?.status ?? '').toLowerCase() === 'started',
        })
      : [];

    const shortcuts = this.mergeCommonShortcuts(state, declared);

    const match = shortcuts.find((s) => {
      const rawKey = typeof s?.key === 'string' ? s.key : '';
      const prefix = 'pressed ';
      const k = rawKey.toLowerCase().startsWith(prefix)
        ? rawKey.substring(prefix.length).trim().toUpperCase()
        : rawKey.trim().toUpperCase();
      return k === normalized;
    });

    if (!match || typeof match !== 'object') return null;

    if (match.type === 'action') {
      const actionType = String(match.actionType ?? '').trim();
      if (!actionType) return null;
      return { kind: 'action', actions: [{ type: actionType, payload: {} }] };
    }

    if (match.type === 'interface') {
      const panelId = String(match.id ?? '').trim();
      if (!panelId) return null;

      const extras =
        state?.extras && typeof state.extras === 'object' ? state.extras : {};
      const ui = (extras as any).ui;
      const panels = ui && typeof ui === 'object' ? (ui as any).panels : null;
      const panel =
        panels && typeof panels === 'object' ? (panels as any)[panelId] : null;
      const message =
        panel && typeof panel === 'object' && typeof panel.message === 'string'
          ? String(panel.message).trim()
          : '';

      return message ? { kind: 'panel', panelId, message } : null;
    }

    return null;
  }

  private attachShortcuts(
    state: GameStateWithActions,
    handler: GameRulesAdapter | undefined,
    userId: number,
  ): GameStateWithActions {
    const extras =
      state.extras && typeof state.extras === 'object' ? state.extras : {};

    const declared: GameShortcutHint[] = handler?.getShortcuts
      ? handler.getShortcuts({
          metadata: state.metadata ?? {},
          currentPlayerId: state.turn?.currentPlayerId ?? null,
          started: String(state.status ?? '').toLowerCase() === 'started',
        })
      : [];

    const shortcuts = this.mergeCommonShortcuts(state, declared);

    return {
      ...state,
      extras: {
        ...extras,
        shortcuts,
      },
    };
  }

  private mergeCommonShortcuts(
    state: GameStateWithActions | null | undefined,
    declared: GameShortcutHint[],
  ): GameShortcutHint[] {
    const common: GameShortcutHint[] = [];

    // Always available: request/announce turn information.
    common.push(interfaceShortcut('T', 'turn'));

    // Action shortcuts: emit only when action exists in the exposed state.
    const actionsRaw = (state as any)?.actions;
    const actions: Array<any> = Array.isArray(actionsRaw) ? actionsRaw : [];
    const types = new Set(
      actions
        .map((a) =>
          typeof a?.type === 'string' ? a.type.trim().toLowerCase() : '',
        )
        .filter((t) => t),
    );

    if (types.has('roll')) {
      common.push(actionShortcut('R', 'roll'));
      common.push(actionShortcut('ENTER', 'roll'));
    }
    if (types.has('draw')) {
      common.push(actionShortcut('SPACE', 'draw'));
    }

    const out: GameShortcutHint[] = [];
    const seen = new Set<string>();
    for (const s of [...(Array.isArray(declared) ? declared : []), ...common]) {
      const keyStr = typeof (s as any)?.key === 'string' ? (s as any).key : '';
      const typeStr =
        typeof (s as any)?.type === 'string' ? (s as any).type : '';
      const idStr = typeStr === 'interface' ? String((s as any).id ?? '') : '';
      const actionTypeStr =
        typeStr === 'action' ? String((s as any).actionType ?? '') : '';
      const sig = `${keyStr}|${typeStr}|${idStr}|${actionTypeStr}`;
      if (!keyStr || !typeStr) continue;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(s);
    }

    return out;
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
      const storedStartedAt = String(
        (existing.metadata as any)?.roomStartedAt ?? '',
      ).trim();
      const roomStartedAt = String(payload?.room?.startedAt ?? '').trim();

      const storedRunIdRaw = (existing.metadata as any)?.roomRunId;
      const roomRunIdRaw = (payload?.room as any)?.runId;
      const storedRunId =
        typeof storedRunIdRaw === 'number'
          ? storedRunIdRaw
          : Number(storedRunIdRaw);
      const roomRunId =
        typeof roomRunIdRaw === 'number' ? roomRunIdRaw : Number(roomRunIdRaw);
      const hasRunId =
        Number.isFinite(storedRunId) &&
        Number.isFinite(roomRunId) &&
        roomRunId >= 0 &&
        storedRunId >= 0;
      const hasRunIdChanged = hasRunId && storedRunId !== roomRunId;

      const hasMeaningfulStartedAtChange = (() => {
        if (!storedStartedAt || !roomStartedAt) return false;
        const a = Date.parse(storedStartedAt);
        const b = Date.parse(roomStartedAt);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          // Certains stockages/serializations tronquent les millisecondes (".000Z").
          // On ne reconstruit l'état que si la différence est significative (ex: vraie relance de la table).
          return Math.abs(a - b) > 2000;
        }
        return storedStartedAt !== roomStartedAt;
      })();

      // Réinitialisation explicite (room repasse en "setup/open/...") :
      // on repart d'un état neuf pour permettre d'ajouter/retirer des joueurs et relancer une partie.
      if (
        previousStatus === 'started' &&
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

      // Cas spécial : la room a été reset (startedAt remis à null) puis relancée,
      // mais le moteur n'a pas "vu" la transition setup->started (ex: aucun WS game connecté).
      // On force la reconstruction si runId a changé (prioritaire) ou si startedAt a changé de manière significative.
      if (
        previousStatus === 'started' &&
        nextStatus === 'started' &&
        roomStartedAt &&
        storedStartedAt &&
        (hasRunIdChanged || hasMeaningfulStartedAtChange)
      ) {
        this.gameLogger.info('Game state rebuild (startedAt changed)', {
          roomId,
          gameType,
          storedStartedAt,
          roomStartedAt,
          storedRunId: Number.isFinite(storedRunId) ? storedRunId : null,
          roomRunId: Number.isFinite(roomRunId) ? roomRunId : null,
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
    botActorIdOverride: number | null = null,
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
    const currentPlayerId = current.turn?.currentPlayerId ?? null;
    const currentPlayer = current.players?.find(
      (p) => p.id === currentPlayerId,
    );

    const allowOutOfTurnActions = (() => {
      if (allowBotTurn) return false;
      if (!handler?.getAvailableActions) return false;
      if (actorId == null || Number.isNaN(actorId)) return false;
      if (currentPlayerId == null || actorId === currentPlayerId) return false;

      const available = handler.getAvailableActions(current, actorId) ?? [];
      if (!Array.isArray(available) || available.length === 0) return false;

      const allowedTypes = new Set(
        available
          .map((a) =>
            String((a as any)?.type ?? '')
              .toLowerCase()
              .trim(),
          )
          .filter((t) => t.length > 0),
      );
      if (allowedTypes.size === 0) return false;

      const requestedTypes = (Array.isArray(actions) ? actions : [])
        .map((a) =>
          String((a as any)?.type ?? '')
            .toLowerCase()
            .trim(),
        )
        .filter((t) => t.length > 0);
      if (requestedTypes.length === 0) return false;

      // Autorise uniquement si toutes les actions demandées sont explicitement disponibles
      // pour l'acteur (ex: confirm exchange pendant le tour d'un bot).
      return requestedTypes.every((t) => allowedTypes.has(t));
    })();

    // Un bot peut être en "thinking" (timer) pendant qu'un humain doit confirmer un pending
    // (ex: échange). On n'interdit pas ces actions explicitement autorisées.
    if (!allowBotTurn && current.botThinking && !allowOutOfTurnActions) {
      throw new UnauthorizedException(
        'Un bot joue actuellement, merci de patienter.',
      );
    }

    const actorOverride =
      allowOutOfTurnActions ||
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

    const botActorId = allowBotTurn
      ? (botActorIdOverride ?? currentPlayerId)
      : null;
    if (allowBotTurn && botActorId == null) {
      throw new BadRequestException(
        'Action bot invalide : acteur introuvable.',
      );
    }
    if (allowBotTurn && typeof botActorId === 'number') {
      const bot = current.players?.find((p) => p.id === botActorId) ?? null;
      if (!bot?.isBot) {
        throw new BadRequestException('Action bot invalide.');
      }
    }

    const actorLabel = allowBotTurn ? 'bot' : 'human';
    const validatedActions = await this.validateActions(
      current,
      handler,
      actions,
      allowBotTurn ? botActorId : actorId,
    );
    const sanitizedActions = validatedActions.map((action) => ({
      ...action,
      meta: {
        ...(action?.meta ?? {}),
        actor: actorLabel,
        actorId: allowBotTurn ? botActorId : actorId,
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
        playerId: allowBotTurn
          ? (botActorId ?? undefined)
          : (actorId ?? undefined),
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
    let marked = await this.markBotThinking(roomId, gameType, next, botTurn);

    // Log générique: le serveur annonce le joueur suivant au moment où le tour change.
    // Le client reste "bête": il ne décide pas quand annoncer, il lit l'historique.
    const previousPlayerId = current.turn?.currentPlayerId ?? null;
    const nextPlayerId = marked.turn?.currentPlayerId ?? null;
    if (
      previousPlayerId != null &&
      nextPlayerId != null &&
      previousPlayerId !== nextPlayerId &&
      String(marked.status ?? '').toLowerCase() === 'started'
    ) {
      const nextPlayer =
        marked.players?.find((p) => p.id === nextPlayerId) ?? null;
      const name = String(nextPlayer?.username ?? '').trim();
      const who = name ? name : `joueur ${nextPlayerId}`;
      marked = this.core.appendLog(marked, `C'est au tour de ${who}.`);
    }
    await this.scheduleBotTurn(roomId, gameType, marked);
    this.broadcaster?.(gameType, roomId, marked);

    // Fin de partie : remettre la room en "setup" (comme le raccourci X) et réinitialiser l'état du jeu
    // pour permettre de relancer immédiatement.
    if ((marked.status || '').toLowerCase() === 'finished') {
      // Best-effort: les stats ne doivent pas empêcher le reset de table.
      try {
        await this.stats.finalizeFinished(roomId, marked);
      } catch (err) {
        this.gameLogger.error(
          'Finalize finished game failed',
          err instanceof Error ? err : undefined,
          { roomId, gameType },
        );
      }

      try {
        await this.rooms.resetRoomSystem(roomId);
      } catch (err) {
        this.gameLogger.error(
          'Auto-reset room after game finished failed',
          err instanceof Error ? err : undefined,
          { roomId, gameType },
        );
      }

      try {
        await this.rooms.notifyRoomStateUpdated(roomId);
      } catch {
        // best effort
      }

      // Attente : pas de rebuild tant que la table n'est pas redémarrée.
      this.botScheduler.clear(this.buildKey(roomId, gameType));
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
    const botActorId = this.getBotActorIdForState(state, handler);
    const botPlayer =
      botActorId != null
        ? state.players?.find((p) => p.id === botActorId)
        : null;

    if (!botPlayer || !botPlayer.isBot || botActorId == null) {
      return this.exposeState(state, gameType);
    }

    let botActions = this.botRunner.suggestForHandler(
      handler,
      state,
      botActorId,
    );
    if (!botActions || botActions.length === 0) {
      const fallback = handler?.getAvailableActions
        ? handler.getAvailableActions(state, botActorId)
        : [];
      if (
        Array.isArray(fallback) &&
        fallback.length > 0 &&
        botActorId != null
      ) {
        botActions = this.botRunner.choose(fallback, {
          state,
          playerId: botActorId,
        });
      }
    }
    if (!botActions || botActions.length === 0) {
      this.gameLogger.warn('Bot has no available actions', {
        roomId,
        gameType,
        playerId: botActorId ?? undefined,
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
        playerId: botActorId ?? undefined,
        action: {
          isBot: botPlayer.isBot,
          status: state.status,
        },
      },
    );

    await this.applyActionsInternal(
      roomId,
      gameType,
      botActions,
      null,
      true,
      botActorId,
    );
    const updated = (await this.store.get(roomId, gameType)) ?? state;
    return this.exposeState(updated, gameType);
  }

  private enqueueMutation<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueue.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.mutationQueue.set(key, next);
    next
      .finally(() => {
        if (this.mutationQueue.get(key) === next) {
          this.mutationQueue.delete(key);
        }
      })
      .catch(() => {});
    return next;
  }

  private isBotTurn(state: GameStateEntity): boolean {
    if (state.status === 'finished') return false;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentId);
    return Boolean(currentPlayer?.isBot);
  }

  private getBotActorIdForState(
    state: GameStateEntity,
    handler: GameRulesAdapter | undefined,
  ): number | null {
    if ((state.status || '').toLowerCase() === 'finished') return null;

    // Priorité: si une action "pending" est attendue d'un bot (même si ce n'est pas son tour),
    // déclencher ce bot d'abord. Certains jeux utilisent `pending` pour des choix bloquants
    // (pick/exchange/quiz) et peuvent laisser `turn.currentPlayerId` inchangé.
    const pending = state.pending as any;
    const pendingPlayerId =
      pending && typeof pending.playerId === 'number' ? pending.playerId : null;
    if (typeof pendingPlayerId === 'number') {
      const pendingPlayer =
        state.players?.find((p) => p.id === pendingPlayerId) ?? null;
      if (pendingPlayer?.isBot) {
        const available =
          handler?.getAvailableActions?.(state, pendingPlayerId) ?? [];
        if (Array.isArray(available) && available.length > 0) {
          return pendingPlayerId;
        }
      }
    }

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer =
      state.players?.find((p) => p.id === currentId) ?? null;
    if (currentPlayer?.isBot && typeof currentId === 'number') {
      return currentId;
    }

    return null;
  }

  private pendingSignature(pending: unknown): string | null {
    if (!pending || typeof pending !== 'object') return null;
    const p = pending as any;
    return JSON.stringify({
      type: typeof p.type === 'string' ? p.type : null,
      step: typeof p.step === 'string' ? p.step : null,
      playerId: typeof p.playerId === 'number' ? p.playerId : null,
      initiatorPlayerId:
        typeof p.initiatorPlayerId === 'number' ? p.initiatorPlayerId : null,
      targetPlayerId:
        typeof p.targetPlayerId === 'number' ? p.targetPlayerId : null,
    });
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

    const handler = this.registry.getHandler(gameType);
    const botActorId = this.getBotActorIdForState(state, handler);
    const botPlayer =
      botActorId != null
        ? (state.players?.find((p) => p.id === botActorId) ?? null)
        : null;
    if (!botPlayer?.isBot) {
      this.botScheduler.clear(key);
      return;
    }
    if (this.botScheduler.has(key)) return;

    const delayMs = this.botSettings.getBotTurnDelayMs();
    const thinking = await this.markBotThinking(roomId, gameType, state, true);
    this.broadcaster?.(gameType, roomId, thinking);
    this.gameLogger.debug('Bot turn scheduled', {
      roomId,
      gameType,
      turnIndex: thinking.turnIndex,
      playerId: botActorId ?? undefined,
      action: {
        status: thinking.status,
        delayMs,
      },
    });
    const expectedTurnIndex = thinking.turnIndex ?? null;
    const expectedCurrentPlayerId = thinking.turn?.currentPlayerId ?? null;
    const expectedBotActorId = botActorId ?? null;
    const expectedPendingSig = this.pendingSignature(thinking.pending);

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
        const latestTurnIndex = latest.turnIndex ?? null;
        const latestCurrentPlayerId = latest.turn?.currentPlayerId ?? null;
        const latestBotActorId = this.getBotActorIdForState(latest, handler);
        const latestPendingSig = this.pendingSignature(latest.pending);
        if (
          latestTurnIndex !== expectedTurnIndex ||
          latestCurrentPlayerId !== expectedCurrentPlayerId ||
          latestBotActorId !== expectedBotActorId ||
          latestPendingSig !== expectedPendingSig
        ) {
          this.gameLogger.debug('Bot turn skipped (stale)', {
            roomId,
            gameType,
            action: {
              expectedTurnIndex,
              latestTurnIndex,
              expectedCurrentPlayerId,
              latestCurrentPlayerId,
              expectedBotActorId,
              latestBotActorId,
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

  async checkPlayAccess(roomId: number, userId: number): Promise<void> {
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

    if (!isParticipant) {
      throw new UnauthorizedException(
        'Mode spectateur : action de jeu interdite',
      );
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
    return this.attachUiDescriptors(
      this.gridRender.attachGridRenderDescriptors(
        this.attachCurrentPlayerView(withLabel),
      ),
    );
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

    const extras =
      state.extras && typeof state.extras === 'object' ? state.extras : {};

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

  private attachUiDescriptors(state: GameStateWithActions): GameStateWithActions {
    // Les panneaux UI doivent Ļtre entiĶrement dķfinis par les jeux via `extras.ui.panels`.
    // Le moteur n'infĶre plus de panneaux gķnķriques (shopping, position, pollution, etc.).
    // Provide a generic "turn" panel derived from `turn.label` (no game rules).
    const turnLabel = String(state.turn?.label ?? '').trim();
    if (!turnLabel) return state;

    const extrasNow =
      state.extras && typeof state.extras === 'object' ? state.extras : {};

    const uiExistingNow = (extrasNow as any).ui;
    const uiNow =
      uiExistingNow &&
      typeof uiExistingNow === 'object' &&
      !Array.isArray(uiExistingNow)
        ? { ...(uiExistingNow as Record<string, unknown>) }
        : {};

    const panelsExistingNow = (uiNow as any).panels;
    const panelsNow =
      panelsExistingNow &&
      typeof panelsExistingNow === 'object' &&
      !Array.isArray(panelsExistingNow)
        ? { ...(panelsExistingNow as Record<string, unknown>) }
        : {};

    const existingTurn = panelsNow['turn'];
    const existingTurnMessage =
      existingTurn &&
      typeof existingTurn === 'object' &&
      !Array.isArray(existingTurn)
        ? (existingTurn as any).message
        : null;
    const hasTurnMessage =
      typeof existingTurnMessage === 'string' &&
      existingTurnMessage.trim().length > 0;

    if (!hasTurnMessage) {
      panelsNow['turn'] = {
        title: 'Tour',
        message: turnLabel.endsWith('.') ? turnLabel : `${turnLabel}.`,
      };
    }

    (uiNow as any).panels = panelsNow;
    return {
      ...state,
      extras: {
        ...extrasNow,
        ui: uiNow,
      },
    };

    const extras =
      state.extras && typeof state.extras === 'object' ? state.extras : {};

    const uiExisting = (extras as any).ui;
    const ui =
      uiExisting && typeof uiExisting === 'object' && !Array.isArray(uiExisting)
        ? { ...(uiExisting as Record<string, unknown>) }
        : {};

    const panelsExisting = (ui as any).panels;
    const panels =
      panelsExisting &&
      typeof panelsExisting === 'object' &&
      !Array.isArray(panelsExisting)
        ? { ...(panelsExisting as Record<string, unknown>) }
        : {};

    const currentPlayerView = (extras as any).currentPlayerView;
    const metadata = state.metadata ?? {};

    const upsertPanel = (id: string, title: string, message: string) => {
      if (!id || !title || !message) return;

      const existing = panels[id];
      const existingMessage =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as any).message
          : null;
      const hasMessage =
        typeof existingMessage === 'string' && existingMessage.trim().length > 0;
      if (hasMessage) return;

      panels[id] = { title, message };
    };

    const buildListMessage = (title: string, itemsRaw: unknown) => {
      const items = Array.isArray(itemsRaw)
        ? itemsRaw.map((x) => String(x ?? '').trim()).filter((x) => x)
        : [];

      if (items.length === 0) return `${title}: (vide)`;

      const max = 12;
      const shown = items.length > max ? items.slice(0, max) : items;
      const body = shown.join(', ');
      return items.length > max
        ? `${title}: ${body}, ... (+${items.length - max})`
        : `${title}: ${body}`;
    };

    const normalizeSentence = (text: unknown): string => {
      const t = String(text ?? '').trim();
      if (!t) return '';
      return t.endsWith('.') ? t : `${t}.`;
    };

    const buildJoinedLinesMessage = (title: string, linesRaw: unknown) => {
      const lines = Array.isArray(linesRaw)
        ? linesRaw.map(normalizeSentence).filter((x) => x)
        : [];
      if (lines.length === 0) return `${title}: inconnue.`;
      return lines.join(' ');
    };

    if (currentPlayerView && typeof currentPlayerView === 'object') {
      upsertPanel(
        'shopping',
        'Shopping list',
        buildListMessage('Shopping list', (currentPlayerView as any).shoppingList),
      );
      upsertPanel(
        'basket',
        'Panier',
        buildListMessage('Panier', (currentPlayerView as any).basket),
      );
      upsertPanel(
        'inventory',
        'Inventaire',
        buildListMessage('Inventaire', (currentPlayerView as any).inventory),
      );
      upsertPanel(
        'stable',
        'Écurie',
        buildJoinedLinesMessage('Écurie', (currentPlayerView as any).stable),
      );
      upsertPanel(
        'position',
        'Position',
        buildJoinedLinesMessage('Position', (currentPlayerView as any).position),
      );
    }

    upsertPanel('score', 'Score', buildListMessage('Score', (extras as any).score));
    upsertPanel('hand', 'Main', buildListMessage('Main', (extras as any).hand));
    upsertPanel('books', 'Familles', buildListMessage('Familles', (extras as any).books));

    if (typeof (metadata as any).pollution === 'number' || typeof (metadata as any).maxPollution === 'number') {
      const p = typeof (metadata as any).pollution === 'number' ? (metadata as any).pollution : null;
      const max = typeof (metadata as any).maxPollution === 'number' ? (metadata as any).maxPollution : null;

      let message = 'Pollution: inconnue.';
      if (p !== null && max !== null) message = `Pollution: ${p}/${max}.`;
      else if (p !== null) message = `Pollution: ${p}.`;
      else if (max !== null) message = `Pollution max: ${max}.`;

      upsertPanel('pollution', 'Pollution', message);
    }

    (ui as any).panels = panels;
    return {
      ...state,
      extras: {
        ...extras,
        ui,
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
