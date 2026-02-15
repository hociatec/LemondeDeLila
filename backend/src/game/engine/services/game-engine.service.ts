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
import {
  fixMojibakeDeep,
  fixMojibakeString,
} from '../../../common/utils/mojibake';

@Injectable()
export class GameEngineService {
  private broadcaster?: (
    gameType: string,
    roomId: number,
    state: GameStateEntity,
  ) => void;
  private readonly mutationQueue = new Map<string, Promise<unknown>>();
  private readonly exposedStateByUserCache = new WeakMap<
    GameStateEntity,
    Map<string, GameStateWithActions>
  >();

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
    const cacheKey = `${gameType}|${userId}`;
    const byState = this.exposedStateByUserCache.get(state);
    const cached = byState?.get(cacheKey);
    if (cached) {
      return cached;
    }

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
        this.attachViewerContext(
          this.attachCurrentPlayerView(withLabel),
          userId,
        ),
      ),
    );
    const withShortcuts = this.attachShortcuts(
      withDescriptors,
      handler,
      userId,
    );
    const finalState = fixMojibakeDeep(
      this.stripBoardAndGridIfNotStarted(withShortcuts),
    );
    if (byState) {
      byState.set(cacheKey, finalState);
    } else {
      this.exposedStateByUserCache.set(
        state,
        new Map<string, GameStateWithActions>([[cacheKey, finalState]]),
      );
    }
    return finalState;
  }

  async handleKeyPress(
    roomId: number,
    gameType: string,
    userId: number,
    key: string,
  ): Promise<
    | { kind: 'action'; actions: GameSingleActionDto[] }
    | { kind: 'panel'; panelId: string; message: string }
    | { kind: 'room'; op: 'reset' | 'start' | 'restart' }
    | null
  > {
    const normalized = String(key ?? '')
      .trim()
      .toUpperCase();
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

    if (!match || typeof match !== 'object') {
      const status = String(state?.status ?? '')
        .toLowerCase()
        .trim();
      if (normalized === 'X') {
        return { kind: 'room', op: 'reset' };
      }
      if (normalized === 'ENTER') {
        if (status === 'finished') {
          return { kind: 'room', op: 'restart' };
        }
        if (status !== 'started') {
          return { kind: 'room', op: 'start' };
        }
      }
      return null;
    }

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
      let message =
        panel && typeof panel === 'object' && typeof panel.message === 'string'
          ? String(panel.message).trim()
          : '';

      if (!message && panelId === 'turn') {
        const status = String(state?.status ?? '').toLowerCase().trim();
        if (status === 'finished') {
          message = 'Partie terminée.';
        } else if (status !== 'started') {
          message = 'Partie non démarrée.';
        } else if (typeof state?.turn?.label === 'string' && state.turn.label.trim()) {
          message = state.turn.label.trim();
        } else {
          const currentPlayerId =
            typeof state?.turn?.currentPlayerId === 'number' &&
            Number.isFinite(state.turn.currentPlayerId)
              ? state.turn.currentPlayerId
              : null;
          const players = Array.isArray((state as any)?.players) ? (state as any).players : [];
          const name =
            currentPlayerId != null
              ? String(
                  players.find((p: any) => Number(p?.id) === currentPlayerId)
                    ?.username ?? '',
                ).trim()
              : '';
          if (currentPlayerId != null && currentPlayerId === userId) {
            message = 'À toi de jouer.';
          } else if (currentPlayerId != null && name) {
            message = `C'est au tour de ${name}.`;
          } else if (currentPlayerId != null) {
            message = `C'est au tour du joueur ${currentPlayerId}.`;
          } else {
            message = 'Tour en cours indisponible.';
          }
        }
      }

      return message
        ? {
            kind: 'panel',
            panelId,
            message: fixMojibakeString(message),
          }
        : null;
    }

    return null;
  }

  async refreshAndBroadcast(roomId: number, gameType: string): Promise<void> {
    const state = await this.getInternalState(roomId, gameType);
    this.broadcaster?.(gameType, roomId, state);
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

    // Rules overlay (client-side): prefer Ctrl+R (avoid interfering with in-game text inputs).
    common.push(interfaceShortcut('Ctrl+R', 'rules'));

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

    const hasRoll = types.has('roll');
    const hasRollDice = types.has('roll_dice');
    if (hasRoll || hasRollDice) {
      // Compat: certains jeux exposent "ROLL_DICE"/"roll_dice" au lieu de "roll".
      const action = hasRoll ? 'roll' : 'roll_dice';
      common.push(actionShortcut('ENTER', action));
    }
    if (types.has('draw')) {
      common.push(actionShortcut('SPACE', 'draw'));
    }
    if (types.has('lama_pass')) {
      common.push(actionShortcut('S', 'lama_pass'));
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
      // (ex: "generic" alors que la room est en "corridor").
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

      // Garde-fou : si un état "finished" est encore stocké alors que la room est restée en "started"
      // (crash/restart serveur ou événement WS manqué), forcer un reset pour retrouver une table
      // modifiable (ajout/suppression de bots, relance).
      const maybeFinished =
        previousStatus === 'finished'
          ? existing
          : (this.forceFinishedIfWinnerDetected(existing as any) as any);
      const maybeFinishedStatus = String(
        maybeFinished?.status ?? '',
      ).toLowerCase();
      if (roomStatus === 'started' && maybeFinishedStatus === 'finished') {
        this.gameLogger.warn(
          'Stale finished game detected while room is started; auto-resetting room',
          {
            roomId,
            gameType,
            previousStatus,
            roomStatus,
          },
        );

        try {
          await this.rooms.resetRoomSystem(roomId);
        } catch (err) {
          this.gameLogger.error(
            'Auto-reset room (stale finished) failed',
            err instanceof Error ? err : undefined,
            { roomId, gameType },
          );
        }

        try {
          await this.store.delete(roomId, gameType);
        } catch (err) {
          this.gameLogger.error(
            'Auto-reset game state (stale finished) failed',
            err instanceof Error ? err : undefined,
            { roomId, gameType },
          );
        }

        try {
          await this.rooms.notifyRoomStateUpdated(roomId);
        } catch {
          // best effort
        }

        try {
          payload = await this.rooms.getRoomPayload(roomId);
        } catch (err) {
          this.cleanupRoom(roomId, gameType);
          if (this.isRoomNotFound(err)) {
            throw new NotFoundException('Table introuvable');
          }
          throw err;
        }

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
      const withRoster = this.syncRosterForStartedRoom(synced, payload);
      if (withRoster !== synced) {
        try {
          await this.store.set(roomId, gameType, withRoster);
        } catch {
          // best effort
        }
      }
      const nextStatus = String(withRoster.status ?? '').toLowerCase();
      const currentPlayers = existing.players?.length ?? 0;
      const incomingPlayers =
        (payload.room.players?.length ?? 0) + (payload.room.bots?.length ?? 0);
      const gameStarted = (existing.status || '').toLowerCase() === 'started';
      this.gameLogger.debug('Retrieved game state', {
        roomId,
        gameType,
        status: withRoster.status,
        turnIndex: withRoster.turnIndex,
        currentPlayerId: withRoster.turn?.currentPlayerId ?? null,
        players:
          withRoster.players?.map((p) => ({
            id: p.id,
            isBot: (p as any).isBot,
          })) ?? [],
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
        withRoster,
      );
      const forcedFinished = this.forceFinishedIfWinnerDetected(
        normalized as any,
      ) as any as GameStateEntity;
      if (forcedFinished !== normalized) {
        try {
          await this.store.set(roomId, gameType, forcedFinished);
        } catch {
          // best effort
        }
      }
      await this.scheduleBotTurn(roomId, gameType, forcedFinished);
      return forcedFinished;
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
    const actingPlayer =
      actorId != null && Number.isFinite(actorId)
        ? (current.players?.find((p) => p.id === actorId) ?? null)
        : null;

    if (!allowBotTurn) {
      if (!actingPlayer || actingPlayer.isBot) {
        throw new UnauthorizedException(
          'Mode spectateur : action de jeu interdite',
        );
      }
    }

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
      // Si ce n'est pas le tour d'un bot, préférer le message "pas votre tour"
      // (le flag botThinking peut rester true un court instant).
      if (currentPlayer?.isBot) {
        return this.exposeState(current, gameType);
      }
    }

    const actorOverride =
      allowOutOfTurnActions ||
      handler?.validateActor?.(current, actions, actorId ?? null) === true;
    if (!allowBotTurn && !actorOverride) {
      if (currentPlayer?.isBot) {
        return this.exposeState(current, gameType);
      }
      if (currentPlayerId !== actorId) {
        return this.exposeState(current, gameType);
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
    const drawAction = sanitizedActions.find(
      (a) =>
        ['draw', 'draw_card'].includes(
          String(a.type ?? '')
            .trim()
            .toLowerCase(),
        ),
    );
    if (drawAction) {
      const actionPlayerId = allowBotTurn
        ? (botActorId ?? null)
        : (actorId ?? null);
      marked = {
        ...marked,
        lastDraw: { playerId: actionPlayerId, at: new Date().toISOString() },
      };
    }
    marked = this.normalizeWinnerMetadata(marked);
    marked = this.forceFinishedIfWinnerDetected(marked);
    marked = this.appendBoardArrivalAnnouncements(
      gameType,
      handler,
      current,
      marked,
    );
    marked = this.appendSkipTurnAnnouncements(marked);
    if ((marked.status || '').toLowerCase() === 'finished') {
      const meta = (marked as any)?.metadata;
      const obj = meta && typeof meta === 'object' ? meta : {};
      const winnerRaw = (obj as any)?.winnerId ?? null;
      const winnerId = typeof winnerRaw === 'number' ? winnerRaw : null;
      const outcomesByPlayerId: Record<string, 'won' | 'lost'> | null =
        winnerId != null
          ? Object.fromEntries(
              (marked.players ?? [])
                .filter((p: any) => p && typeof p.id === 'number' && !p.isBot)
                .map((p: any) => [
                  String(p.id),
                  p.id === winnerId ? 'won' : 'lost',
                ]),
            )
          : null;

      marked = {
        ...marked,
        metadata: {
          ...obj,
          finishedAt: new Date().toISOString(),
          ...(outcomesByPlayerId ? { outcomesByPlayerId } : {}),
        },
      };
    }

    // Persiste l'état final post-traité (logs d'arrivée / sauts de tour nettoyés).
    // Sans cette écriture, des métadonnées temporaires (ex: turnFlow.skipped) peuvent être rejouées au tour suivant.
    await this.store.set(roomId, gameType, marked, { asyncPersist: true });

    // L'annonce de tour est déjà exposée via le label "C'est à X de jouer.".
    // Ne pas logger une seconde phrase dans l'historique pour éviter les doublons.
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

      // Reset le state du moteur pour repartir d'un état "setup" propre (sans plateau figé).
      try {
        await this.store.delete(roomId, gameType);
      } catch (err) {
        this.gameLogger.error(
          'Auto-reset game state after finish failed',
          err instanceof Error ? err : undefined,
          { roomId, gameType },
        );
      }

      try {
        await this.rooms.notifyRoomStateUpdated(roomId);
      } catch {
        // best effort
      }

      // Diffuser un état "setup" frais aux clients /ws/game pour rafraîchir l'UI immédiatement.
      try {
        const fresh = await this.getInternalState(roomId, gameType);
        this.broadcaster?.(gameType, roomId, fresh);
      } catch (err) {
        this.gameLogger.error(
          'Broadcast fresh state after finish failed',
          err instanceof Error ? err : undefined,
          { roomId, gameType },
        );
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

  private normalizeWinnerMetadata<TState extends { metadata?: unknown }>(
    state: TState,
  ): TState {
    const meta = (state as any)?.metadata;
    if (!meta || typeof meta !== 'object') return state;

    const winnerId = (meta as any)?.winnerId;
    if (winnerId !== null && winnerId !== undefined) {
      if (typeof winnerId !== 'string' || winnerId.trim().length > 0) {
        return state;
      }
    }

    for (const key of ['winnerPlayerId', 'winner_id'] as const) {
      const value = (meta as any)?.[key];
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim().length === 0) continue;
      return {
        ...(state as any),
        metadata: {
          ...(meta as any),
          winnerId: value,
        },
      } as TState;
    }

    return state;
  }

  private normalizeUsernameForLog(username: unknown): string {
    let name = String(username ?? '').trim();
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    return name;
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
  private forceFinishedIfWinnerDetected(
    state: GameStateWithActions,
  ): GameStateWithActions {
    const status = String(state?.status ?? '').toLowerCase();
    if (status !== 'started') {
      return state;
    }

    const meta = (state as any)?.metadata;
    if (!meta || typeof meta !== 'object') {
      return state;
    }

    // Certains jeux peuvent déjà marquer une fin logique via `finishedAt`/`outcomesByPlayerId`
    // sans avoir basculé `status` -> finished (legacy / bug). On force dans ce cas pour
    // déclencher le reset automatique de table côté moteur.
    const finishedAt = (meta as any)?.finishedAt;
    if (typeof finishedAt === 'string' && finishedAt.trim().length > 0) {
      return state.status === 'finished'
        ? state
        : { ...state, status: 'finished' };
    }
    const outcomes = (meta as any)?.outcomesByPlayerId;
    if (
      outcomes &&
      typeof outcomes === 'object' &&
      Object.keys(outcomes).length > 0
    ) {
      return state.status === 'finished'
        ? state
        : { ...state, status: 'finished' };
    }

    for (const key of ['winnerPlayerId', 'winnerId', 'winner_id']) {
      const value = (meta as any)[key];
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        continue;
      }

      const normalizedMeta =
        key === 'winnerId'
          ? meta
          : {
              ...meta,
              winnerId: value,
            };
      return { ...state, status: 'finished', metadata: normalizedMeta };
    }

    return state;
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

  private syncRosterForStartedRoom(
    state: GameStateEntity,
    payload: RoomPayload,
  ): GameStateEntity {
    try {
      if (
        !state ||
        String(state.status ?? '')
          .toLowerCase()
          .trim() !== 'started'
      ) {
        return state;
      }
      const players = Array.isArray(state.players) ? state.players : [];
      if (players.length === 0) return state;

      const roomPlayers = Array.isArray(payload?.room?.players)
        ? payload.room.players
        : [];
      const roomBots = Array.isArray(payload?.room?.bots)
        ? payload.room.bots
        : [];

      const humanById = new Map<number, string>();
      for (const p of roomPlayers) {
        const id = Number((p as any)?.id ?? 0);
        if (!Number.isFinite(id) || id <= 0) continue;
        const username = String((p as any)?.username ?? '').trim();
        if (!username) continue;
        humanById.set(id, username);
      }

      const roomBotNames = roomBots
        .map((b: any) => String(b?.name ?? '').trim())
        .filter((n: string) => n.length > 0);
      const allowedBotNames = new Set(roomBotNames);

      // Bots "sièges" (id négatif) proviennent de payload.room.bots (GameCoreService buildPlayers).
      // Si un bot est retiré de la room pendant une partie, il doit aussi disparaître du roster du jeu
      // sinon l'exclusion est visuellement sans effet et le bot continue de jouer.
      const allowedBotIds = new Set<number>(
        roomBots
          .map((b: any) => Number((b as any)?.id ?? 0))
          .filter((id: number) => Number.isFinite(id) && id > 0)
          .map((id: number) => -Math.abs(id)),
      );

      // Bots already present in the game state (initial bots / already replaced seats).
      const assignedBotNames = new Set(
        players
          .filter((p) => (p as any)?.isBot === true)
          .map((p) => String((p as any)?.username ?? '').trim())
          .filter((n) => n.length > 0),
      );

      const availableBotNames: string[] = [];
      for (const name of roomBotNames) {
        if (!assignedBotNames.has(name)) {
          availableBotNames.push(name);
        }
      }

      let changed = false;
      const mappedPlayers = players.map((p) => {
        const id = Number((p as any)?.id ?? 0);
        if (!Number.isFinite(id) || id === 0) return p;

        const roomUsername = humanById.get(id) ?? null;
        const isBot = (p as any)?.isBot === true;

        // Human is present in room: ensure player is human with correct username.
        if (roomUsername) {
          if (
            isBot ||
            String((p as any)?.username ?? '').trim() !== roomUsername
          ) {
            changed = true;
            return { ...(p as any), isBot: false, username: roomUsername };
          }
          return p;
        }

        // Human left the room: let an available room bot take over this seat (same id).
        if (!isBot && availableBotNames.length > 0) {
          const botName = availableBotNames.shift()!;
          changed = true;
          return { ...(p as any), isBot: true, username: botName };
        }

        return p;
      });

      // Remove room bots that no longer exist (id < 0 and not in allowedBotIds).
      const filteredPlayers = mappedPlayers.filter((p) => {
        const id = Number((p as any)?.id ?? 0);
        if (!Number.isFinite(id) || id === 0) return true;
        const isBot = (p as any)?.isBot === true;
        const name = String((p as any)?.username ?? '').trim();
        if (isBot && (!name || !allowedBotNames.has(name))) {
          return false;
        }
        if (id >= 0) return true;
        if (!isBot) return true;
        return allowedBotIds.has(id);
      });
      const nextPlayers = filteredPlayers;
      if (nextPlayers.length !== mappedPlayers.length) {
        changed = true;
      }

      const currentPlayerId = state.turn?.currentPlayerId ?? null;
      if (
        typeof currentPlayerId === 'number' &&
        currentPlayerId !== 0 &&
        !nextPlayers.some((p) => p?.id === currentPlayerId)
      ) {
        // Keep a stable index if possible; otherwise fallback to first player.
        const prevIndex = Math.max(
          0,
          players.findIndex((p) => p?.id === currentPlayerId),
        );
        const fallbackIndex = Math.min(
          prevIndex,
          Math.max(0, nextPlayers.length - 1),
        );
        const fallbackId =
          nextPlayers[fallbackIndex]?.id ?? nextPlayers[0]?.id ?? null;
        if (fallbackId !== currentPlayerId) {
          changed = true;
          state = {
            ...state,
            turn: {
              ...(state.turn ?? { direction: 1 }),
              currentPlayerId: fallbackId,
            },
          };
        }
      }

      const pendingPlayerId = (state.pending as any)?.playerId ?? null;
      if (
        typeof pendingPlayerId === 'number' &&
        pendingPlayerId !== 0 &&
        !nextPlayers.some((p) => p?.id === pendingPlayerId)
      ) {
        changed = true;
        state = {
          ...state,
          pending: state.pending
            ? { ...(state.pending as any), playerId: null }
            : state.pending,
        };
      }

      return changed ? { ...state, players: nextPlayers } : state;
    } catch {
      return state;
    }
  }

  /**
   * Snapshot helper: returns the full internal state (not per-user redacted),
   * and ensures the state exists (builds it if needed).
   */
  async exportInternalState(
    roomId: number,
    gameType: string,
  ): Promise<GameStateEntity | null> {
    if (!Number.isFinite(roomId) || roomId <= 0) return null;
    const gt = String(gameType ?? '').trim();
    if (!gt) return null;
    const internal = await this.enqueueMutation(this.buildKey(roomId, gt), () =>
      this.getInternalState(roomId, gt),
    );
    return internal ?? null;
  }

  /**
   * Snapshot helper: imports a raw internal state, persists it and schedules bot turn if needed.
   */
  async restoreInternalState(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new Error('roomId invalide');
    }
    const gt = String(gameType ?? '').trim();
    if (!gt) {
      throw new Error('gameType invalide');
    }
    await this.enqueueMutation(this.buildKey(roomId, gt), async () => {
      await this.store.set(roomId, gt, state);
      const marked = await this.normalizeBotThinking(
        roomId,
        gt,
        await this.markBotThinking(roomId, gt, state),
      );
      await this.scheduleBotTurn(roomId, gt, marked);
      this.broadcaster?.(gt, roomId, marked);
    });
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

    const hasAvailableActions = (playerId: number): boolean => {
      if (!handler?.getAvailableActions) {
        return true;
      }
      try {
        const available = handler.getAvailableActions(state, playerId);
        return !Array.isArray(available) || available.length > 0;
      } catch {
        // Fallback permissif: ne pas casser le flux bot si le handler lève ici.
        return true;
      }
    };

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
        if (hasAvailableActions(pendingPlayerId)) {
          return pendingPlayerId;
        }
        return null;
      }
      if (pending?.blocking === true) {
        // Pending bloquant attendu d'un humain: ne pas planifier le bot courant.
        return null;
      }
    }

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer =
      state.players?.find((p) => p.id === currentId) ?? null;
    if (currentPlayer?.isBot && typeof currentId === 'number') {
      if (!hasAvailableActions(currentId)) {
        return null;
      }
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

  private buildSystemTimerKey(
    roomId: number,
    gameType: string,
    suffix: string,
  ): string {
    return `${this.buildKey(roomId, gameType)}:${suffix}`;
  }

  private async applySystemActions(
    roomId: number,
    gameType: string,
    actions: GameSingleActionDto[],
  ): Promise<void> {
    await this.enqueueMutation(this.buildKey(roomId, gameType), async () => {
      const current = await this.normalizeBotThinking(
        roomId,
        gameType,
        await this.getInternalState(roomId, gameType),
      );
      if ((current.status || '').toLowerCase() === 'finished') {
        return;
      }

      const handler = this.registry.getHandler(gameType);
      if (!handler) {
        return;
      }

      const meta: any =
        current?.metadata && typeof current.metadata === 'object'
          ? current.metadata
          : {};
      const fallbackActorId =
        typeof meta.ownerPlayerId === 'number'
          ? meta.ownerPlayerId
          : (current.turn?.currentPlayerId ?? current.players?.[0]?.id ?? null);

      const sanitizedActions = (Array.isArray(actions) ? actions : []).map(
        (action) => ({
          ...action,
          meta: {
            ...(action?.meta ?? {}),
            actor: 'system',
            actorId: fallbackActorId,
          },
        }),
      );

      const next = await handler.applyActions(current, sanitizedActions);
      const botTurn = this.isBotTurn(next);
      let marked = await this.markBotThinking(roomId, gameType, next, botTurn);
      marked = this.normalizeWinnerMetadata(marked);
      marked = this.forceFinishedIfWinnerDetected(marked);
      marked = this.appendBoardArrivalAnnouncements(
        gameType,
        handler,
        current,
        marked,
      );
      marked = this.appendSkipTurnAnnouncements(marked);
      await this.store.set(roomId, gameType, marked, { asyncPersist: true });

      // Pas d'annonce de tour dans l'historique (évite doublon avec le label de tour).

      await this.scheduleBotTurn(roomId, gameType, marked);
      this.broadcaster?.(gameType, roomId, marked);
    });
  }

  private async scheduleBotTurn(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    const key = this.buildKey(roomId, gameType);
    const systemKey = this.buildSystemTimerKey(roomId, gameType, 'system');
    const status = (state.status || '').toLowerCase();
    if (
      status === 'finished' ||
      status === 'setup' ||
      status === 'open' ||
      status === 'pending' ||
      status === 'preparing'
    ) {
      this.botScheduler.clear(key);
      this.botScheduler.clear(systemKey);
      return;
    }

    // Timed transitions (currently used by LAMA for "pause between rounds").
    if (gameType === 'lama') {
      const meta: any =
        state?.metadata && typeof state.metadata === 'object'
          ? state.metadata
          : {};
      if (String(meta.step ?? '') === 'round_pause') {
        const untilMs =
          typeof meta.roundPauseUntilMs === 'number'
            ? meta.roundPauseUntilMs
            : null;
        const delayMs =
          untilMs != null
            ? Math.max(0, untilMs - GameEngineService.nowMs())
            : 0;
        this.botScheduler.clear(key);
        this.botScheduler.schedule({
          key: systemKey,
          delayMs,
          roomId,
          gameType,
          run: async () => {
            const latest = (await this.store.get(roomId, gameType)) ?? null;
            if (!latest) return;
            const latestMeta: any =
              latest?.metadata && typeof latest.metadata === 'object'
                ? latest.metadata
                : {};
            if (String(latestMeta.step ?? '') !== 'round_pause') return;
            if (
              typeof latestMeta.roundPauseUntilMs === 'number' &&
              typeof untilMs === 'number' &&
              latestMeta.roundPauseUntilMs !== untilMs
            ) {
              return;
            }
            await this.applySystemActions(roomId, gameType, [
              { type: 'lama_resume_round', payload: {} },
            ]);
          },
          onStale: () => this.cleanupRoom(roomId, gameType),
        });
        return;
      }

      // No pause: ensure timer is cleared.
      this.botScheduler.clear(systemKey);
    }

    // Timed transitions: Arche de Mnemosyne quiz timeout.
    if (gameType === 'arche-de-mnemosyne') {
      const meta: any =
        state?.metadata && typeof state.metadata === 'object'
          ? state.metadata
          : {};
      const useTimer = Boolean(meta?.config?.useTimer);
      const untilMs =
        typeof meta.quizDeadlineAtMs === 'number'
          ? meta.quizDeadlineAtMs
          : null;
      const questionId =
        typeof meta?.currentQuestion?.id === 'string'
          ? meta.currentQuestion.id
          : null;
      const interUntilMs =
        typeof meta?.interQuestionUntilMs === 'number'
          ? meta.interQuestionUntilMs
          : null;

      if (interUntilMs != null && !questionId) {
        const delayMs = Math.max(0, interUntilMs - GameEngineService.nowMs());
        this.botScheduler.clear(systemKey);
        this.botScheduler.schedule({
          key: systemKey,
          delayMs,
          roomId,
          gameType,
          run: async () => {
            const latest = (await this.store.get(roomId, gameType)) ?? null;
            if (!latest) return;
            const latestMeta: any =
              latest?.metadata && typeof latest.metadata === 'object'
                ? latest.metadata
                : {};
            if (typeof latestMeta?.currentQuestion?.id === 'string') return;
            if (typeof latestMeta?.interQuestionUntilMs !== 'number') return;
            if (latestMeta.interQuestionUntilMs !== interUntilMs) return;
            await this.applySystemActions(roomId, gameType, [
              { type: 'mnemo_timeout', payload: {} },
            ]);
          },
          onStale: () => this.cleanupRoom(roomId, gameType),
        });
      } else if (useTimer && untilMs != null && questionId) {
        const delayMs = Math.max(0, untilMs - GameEngineService.nowMs());
        this.botScheduler.clear(systemKey);
        this.botScheduler.schedule({
          key: systemKey,
          delayMs,
          roomId,
          gameType,
          run: async () => {
            const latest = (await this.store.get(roomId, gameType)) ?? null;
            if (!latest) return;
            const latestMeta: any =
              latest?.metadata && typeof latest.metadata === 'object'
                ? latest.metadata
                : {};
            if (!Boolean(latestMeta?.config?.useTimer)) return;
            if (typeof latestMeta?.currentQuestion?.id !== 'string') return;
            if (latestMeta.currentQuestion.id !== questionId) return;
            if (
              typeof latestMeta.quizDeadlineAtMs === 'number' &&
              latestMeta.quizDeadlineAtMs !== untilMs
            ) {
              return;
            }
            await this.applySystemActions(roomId, gameType, [
              { type: 'mnemo_timeout', payload: {} },
            ]);
          },
          onStale: () => this.cleanupRoom(roomId, gameType),
        });
      } else {
        this.botScheduler.clear(systemKey);
      }
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

    const baseDelayMs = this.botSettings.getBotTurnDelayMs();
    const initialDelayMs = this.botSettings.getBotStartDelayMs();
    const drawDelayMs = this.botSettings.getBotDrawDelayMs();
    const meta: any =
      state?.metadata && typeof state.metadata === 'object'
        ? state.metadata
        : {};
    const immediateStart = meta?.botImmediateStartPending === true;
    const pending: any = state.pending as any;
    const pendingType =
      typeof pending?.type === 'string'
        ? String(pending.type).trim().toLowerCase()
        : '';
    const pendingPlayerIdRaw = pending?.playerId;
    const pendingPlayerId =
      typeof pendingPlayerIdRaw === 'number'
        ? pendingPlayerIdRaw
        : Number(pendingPlayerIdRaw);
    const fastPendingBotAction =
      Number.isFinite(pendingPlayerId) &&
      pendingPlayerId === botActorId &&
      (pendingType === 'draw' ||
        pendingType === 'choose_pawn' ||
        pendingType === 'choose_target');
    const isQuizPending =
      gameType === 'arche-de-mnemosyne' && pending?.type === 'quiz';
    const quizTimerSeconds =
      isQuizPending && typeof meta?.config?.timerSeconds === 'number'
        ? Number(meta.config.timerSeconds)
        : null;
    const quizTimerMs =
      quizTimerSeconds != null && Number.isFinite(quizTimerSeconds)
        ? Math.max(1, quizTimerSeconds) * 1000
        : null;
    let delayMs = baseDelayMs;
    if (immediateStart) {
      delayMs = initialDelayMs;
    } else if (pendingType === 'draw') {
      delayMs = drawDelayMs;
    } else if (fastPendingBotAction) {
      delayMs = 0;
    }
    if (isQuizPending && quizTimerMs != null) {
      delayMs = Math.min(delayMs, quizTimerMs);
    }
    const stateForSchedule = immediateStart
      ? {
          ...state,
          metadata: { ...(meta as any), botImmediateStartPending: false },
        }
      : state;
    const thinking = await this.markBotThinking(
      roomId,
      gameType,
      stateForSchedule,
      true,
    );
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
    const status = String(baseState.status ?? '')
      .toLowerCase()
      .trim();
    // Tant que la table n'est pas en "started", on ne doit pas hydrater un état de partie :
    // sinon certains jeux reconstruisent un plateau "started" et empêchent d'ajouter/retirer des bots
    // ou de relancer proprement après une fin de partie.
    if (status !== 'started') {
      return baseState;
    }
    const handler = this.registry.getHandler(gameType);
    if (handler) {
      const hydrated = handler.hydrateInitialState(baseState);
      const randomizedStarter = this.ensureRandomStarterAtGameStart(
        baseState,
        hydrated,
      );
      const withMeta = {
        ...randomizedStarter,
        metadata: {
          ...(randomizedStarter.metadata ?? {}),
          botImmediateStartPending: true,
        },
      } as GameStateEntity;
      return this.appendFirstTurnAnnouncement(withMeta);
    }
    const logged = this.core.appendLog(
      baseState,
      `Type de jeu non spécialisé: ${gameType}`,
    );
    const withMeta = {
      ...logged,
      metadata: {
        ...(logged.metadata ?? {}),
        botImmediateStartPending: true,
      },
    } as GameStateEntity;
    return this.appendFirstTurnAnnouncement(withMeta);
  }

  private ensureRandomStarterAtGameStart(
    baseState: GameStateEntity,
    state: GameStateEntity,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase().trim();
    if (status !== 'started') return state;

    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const pending = state.pending as any;
    const pendingPlayerId =
      typeof pending?.playerId === 'number' ? pending.playerId : null;
    const blockingPending = pending?.blocking === true;
    if (blockingPending && pendingPlayerId != null) {
      // Les jeux avec setup bloquant (choix de pion/config propriétaire) gardent leur acteur pending.
      return state;
    }

    if ((state.metadata as any)?.starterChosenAfterPawnSelection === true) {
      // Certains jeux tirent explicitement le starter après setup (ex: choix de pion).
      return state;
    }

    const baseStarterId = baseState.turn?.currentPlayerId ?? null;
    const starterId =
      typeof baseStarterId === 'number' &&
      players.some((p) => p?.id === baseStarterId)
        ? baseStarterId
        : (players[0]?.id ?? null);
    if (typeof starterId !== 'number') return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    const starterIndex = Math.max(
      0,
      players.findIndex((p) => p?.id === starterId),
    );
    const currentTurnIndex =
      typeof state.turnIndex === 'number' ? state.turnIndex : 0;
    if (currentId === starterId && currentTurnIndex === starterIndex) {
      return state;
    }

    return {
      ...state,
      turnIndex: starterIndex,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: starterId,
      },
    };
  }

  private appendFirstTurnAnnouncement(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase().trim();
    if (status !== 'started') {
      return state;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (typeof currentPlayerId !== 'number' || !Number.isFinite(currentPlayerId)) {
      return state;
    }

    const log = Array.isArray(state.log) ? state.log : [];
    const recentMessages = log
      .slice(-3)
      .map((entry: any) => String(entry?.message ?? '').trim().toLowerCase());
    if (recentMessages.some((m) => m.startsWith("c'est au tour de "))) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const name =
      players.find((p) => p?.id === currentPlayerId)?.username?.trim() ??
      `Joueur ${currentPlayerId}`;
    return this.core.appendLog(state, `C'est au tour de ${name}.`);
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
    const handler = this.registry.getHandler(gameType);
    // `botThinking` doit refléter un bot réellement actionnable.
    // Sinon, on bloque les humains avec "Un bot joue..." alors qu'aucune action bot n'est possible
    // (ex: pending bloquant pour un humain pendant setup).
    const actionableBotId = this.getBotActorIdForState(state, handler);
    const isBot = actionableBotId != null || (botTurn === true && !handler);
    const now = GameEngineService.nowMs();
    const marked = {
      ...(this.store.markBotThinking(state, isBot) as any),
      botThinkingSince: isBot ? now : null,
    } as GameStateEntity;
    await this.store.set(roomId, gameType, marked, { asyncPersist: true });
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
      await this.store.set(roomId, gameType, patched, { asyncPersist: true });
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
    await this.store.set(roomId, gameType, cleared, { asyncPersist: true });
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
        if (
          this.shouldSilentlyIgnoreUnavailableAction(
            type,
            action,
            state,
            actorId ?? null,
          )
        ) {
          continue;
        }
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
          if (this.isOutOfTurnMessage(message)) {
            continue;
          }
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

  private shouldSilentlyIgnoreUnavailableAction(
    type: string,
    _action: GameSingleActionDto,
    state: GameStateEntity,
    actorId: number | null,
  ): boolean {
    // UX: appuyer sur Espace hors contexte ne doit pas afficher d'erreur.
    // On ignore donc silencieusement toute tentative de "draw" indisponible.
    if (type === 'draw') {
      return true;
    }
    return this.isOutOfTurn(state, actorId);
  }

  private isOutOfTurn(state: GameStateEntity, actorId: number | null): boolean {
    if (actorId == null || !Number.isFinite(actorId)) return false;
    const currentPlayerId = state?.turn?.currentPlayerId;
    if (typeof currentPlayerId !== 'number' || !Number.isFinite(currentPlayerId)) {
      return false;
    }
    return actorId !== currentPlayerId;
  }

  private isOutOfTurnMessage(message: string): boolean {
    const normalized = String(message ?? '').trim().toLowerCase();
    if (!normalized) return false;
    return (
      normalized.includes("pas votre tour") ||
      normalized.includes("n'est pas votre tour") ||
      normalized.includes('attendez votre tour') ||
      normalized.includes('tour en cours')
    );
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
    const withDescriptors = this.attachUiDescriptors(
      this.gridRender.attachGridRenderDescriptors(
        this.attachCurrentPlayerView(withLabel),
      ),
    );
    return fixMojibakeDeep(
      this.stripBoardAndGridIfNotStarted(withDescriptors),
    );
  }

  private stripBoardAndGridIfNotStarted(
    state: GameStateWithActions,
  ): GameStateWithActions {
    const status = String(state?.status ?? '')
      .toLowerCase()
      .trim();
    if (status === 'started') return state;

    const extras =
      state.extras && typeof state.extras === 'object' ? state.extras : {};
    const nextExtras = { ...(extras as any) };
    if (nextExtras.grid !== undefined) {
      delete nextExtras.grid;
    }

    const out: any = {
      ...state,
      actions: [],
      pending: null,
      extras: nextExtras,
    };
    if (out.board !== undefined) {
      delete out.board;
    }
    return out as GameStateWithActions;
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

  private appendBoardArrivalAnnouncements(
    gameType: string,
    handler: GameRulesAdapter | undefined,
    previous: GameStateEntity,
    next: GameStateEntity,
  ): GameStateEntity {
    try {
      if (!handler?.shouldAnnounceBoardArrivals?.()) {
        return next;
      }
      if (
        String(next.status ?? '')
          .toLowerCase()
          .trim() !== 'started'
      ) {
        return next;
      }

      const prevMeta: any =
        previous?.metadata && typeof previous.metadata === 'object'
          ? previous.metadata
          : {};
      const nextMeta: any =
        next?.metadata && typeof next.metadata === 'object'
          ? next.metadata
          : {};

      const tiles = Array.isArray(nextMeta.tiles) ? nextMeta.tiles : [];
      const prevPositions =
        prevMeta.positions &&
        typeof prevMeta.positions === 'object' &&
        !Array.isArray(prevMeta.positions)
          ? prevMeta.positions
          : {};
      const nextPositions =
        nextMeta.positions &&
        typeof nextMeta.positions === 'object' &&
        !Array.isArray(nextMeta.positions)
          ? nextMeta.positions
          : {};

      if (tiles.length === 0) {
        return next;
      }

      const players = Array.isArray(next.players) ? next.players : [];
      const changed = players
        .map((p: any) => ({
          id: p?.id,
          username: String(p?.username ?? '').trim(),
        }))
        .filter((p: any) => typeof p.id === 'number' && Number.isFinite(p.id))
        .map((p: any) => {
          const prevRaw = (prevPositions as any)[String(p.id)];
          const nextRaw = (nextPositions as any)[String(p.id)];
          const prevPos =
            typeof prevRaw === 'number' ? prevRaw : Number(prevRaw);
          const nextPos =
            typeof nextRaw === 'number' ? nextRaw : Number(nextRaw);
          return {
            id: p.id as number,
            username: p.username,
            prevPos: Number.isFinite(prevPos) ? Math.trunc(prevPos) : null,
            nextPos: Number.isFinite(nextPos) ? Math.trunc(nextPos) : null,
          };
        })
        .filter(
          (p: any) =>
            p.nextPos != null && p.prevPos != null && p.nextPos !== p.prevPos,
        )
        .sort((a: any, b: any) => (a.id as number) - (b.id as number));

      if (changed.length === 0) {
        return next;
      }

      let out = next;
      for (const p of changed) {
        const idx = p.nextPos as number;
        if (idx < 0 || idx >= tiles.length) {
          continue;
        }

        const tile: any = tiles[idx] ?? {};
        const labelRaw = String(tile.label ?? '').trim();
        const titleRaw = String(tile.title ?? tile.name ?? '').trim();
        const descriptionRaw = String(tile.description ?? '').trim();

        const caseNumber = idx + 1;
        const label = labelRaw || titleRaw ? labelRaw || titleRaw : '';
        const desc = descriptionRaw ? ` ${descriptionRaw}` : '';

        const name = p.username || `joueur ${p.id}`;

        // Éviter les doublons évidents : si la dernière entrée mentionne déjà l'arrivée sur cette case.
        const recentMsgs = (() => {
          const log = Array.isArray(out.log) ? out.log : [];
          const msgs: string[] = [];
          for (let i = log.length - 1; i >= 0 && msgs.length < 4; i -= 1) {
            const msg = (log[i] as any)?.message;
            if (typeof msg === 'string' && msg.trim().length > 0) {
              msgs.push(String(msg).trim());
            }
          }
          return msgs;
        })();
        const needleByNumber = `arrive sur case ${caseNumber}`.toLowerCase();
        const needleByLabel = label ? `arrive sur ${label}`.toLowerCase() : '';
        const needleByPlacement = `en case ${caseNumber}`.toLowerCase();
        const hasRecentArrival = recentMsgs.some((m) => {
          const lower = m.toLowerCase();
          return (
            lower.includes(needleByNumber) ||
            (needleByLabel && lower.includes(needleByLabel)) ||
            lower.includes(needleByPlacement)
          );
        });
        if (hasRecentArrival) {
          continue;
        }

        if (label && /^case\\s+\\d+/i.test(label)) {
          out = this.core.appendLog(
            out,
            `${name} arrive sur ${label}.${desc}`.trim(),
          );
        } else {
          const suffix = label ? ` - ${label}` : '';
          out = this.core.appendLog(
            out,
            `${name} arrive sur case ${caseNumber}${suffix}.${desc}`.trim(),
          );
        }
      }

      return out;
    } catch {
      return next;
    }
  }

  private appendSkipTurnAnnouncements(state: GameStateEntity): GameStateEntity {
    try {
      const meta: any =
        state?.metadata && typeof state.metadata === 'object'
          ? state.metadata
          : {};
      const turnFlow: any =
        meta?.turnFlow && typeof meta.turnFlow === 'object'
          ? meta.turnFlow
          : {};
      const skippedRaw = turnFlow?.skipped;
      const skipped = Array.isArray(skippedRaw) ? skippedRaw : [];
      if (!skipped.length) {
        return state;
      }

      let out = state;
      for (const entry of skipped) {
        const id = typeof entry?.id === 'number' ? entry.id : null;
        if (id == null) continue;
        const remaining =
          typeof entry?.remainingAfter === 'number' ? entry.remainingAfter : 0;
        const player = out.players?.find((p: any) => p?.id === id) ?? null;
        const name = this.normalizeUsernameForLog(player?.username);
        const who = name ? name : `joueur ${id}`;
        const suffix = remaining > 0 ? ` (${remaining} restant)` : '';
        out = this.core.appendLog(out, `${who} passe son tour${suffix}.`);
      }

      const cleanedTurnFlow = { ...turnFlow, skipped: [] };
      return {
        ...out,
        metadata: {
          ...meta,
          turnFlow: cleanedTurnFlow,
        },
      };
    } catch {
      return state;
    }
  }

  private attachViewerContext(
    state: GameStateWithActions,
    userId: number,
  ): GameStateWithActions {
    const extras =
      state.extras && typeof state.extras === 'object' ? state.extras : {};

    // Ne pas écraser si un jeu a déjà défini ces champs.
    if ((extras as any).viewerPlayerId !== undefined) return state;

    const players = Array.isArray(state.players) ? state.players : [];
    const viewerPlayer = players.find((p) => p?.id === userId) ?? null;
    const viewerPlayerId = viewerPlayer ? viewerPlayer.id : null;
    const viewerUsername =
      viewerPlayer && typeof viewerPlayer.username === 'string'
        ? viewerPlayer.username
        : viewerPlayer
          ? `Joueur ${viewerPlayer.id}`
          : null;

    return {
      ...state,
      extras: {
        ...extras,
        viewerPlayerId,
        viewerUsername,
      },
    };
  }

  private attachUiDescriptors(
    state: GameStateWithActions,
  ): GameStateWithActions {
    // Les panneaux UI doivent Ä»tre entiÄ¶rement dÄ·finis par les jeux via `extras.ui.panels`.
    // Le moteur n'infÄ¶re plus de panneaux gÄ·nÄ·riques (shopping, position, pollution, etc.).
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
    const stateWithTurnPanel: GameStateWithActions = {
      ...state,
      extras: {
        ...extrasNow,
        ui: uiNow,
      },
    };

    const extras =
      stateWithTurnPanel.extras &&
      typeof stateWithTurnPanel.extras === 'object'
        ? stateWithTurnPanel.extras
        : {};

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
    const metadata = stateWithTurnPanel.metadata ?? {};
    const upsertPanel = (id: string, title: string, message: string) => {
      if (!id || !title || !message) return;

      const existing = panels[id];
      const existingMessage =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as any).message
          : null;
      const hasMessage =
        typeof existingMessage === 'string' &&
        existingMessage.trim().length > 0;
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
        buildListMessage(
          'Shopping list',
          (currentPlayerView as any).shoppingList,
        ),
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
        buildJoinedLinesMessage(
          'Position',
          (currentPlayerView as any).position,
        ),
      );
    }

    upsertPanel(
      'score',
      'Score',
      buildListMessage('Score', (extras as any).score),
    );
    upsertPanel('hand', 'Main', buildListMessage('Main', (extras as any).hand));
    upsertPanel(
      'books',
      'Familles',
      buildListMessage('Familles', (extras as any).books),
    );

    if (
      typeof (metadata as any).pollution === 'number' ||
      typeof (metadata as any).maxPollution === 'number'
    ) {
      const p =
        typeof (metadata as any).pollution === 'number'
          ? (metadata as any).pollution
          : null;
      const max =
        typeof (metadata as any).maxPollution === 'number'
          ? (metadata as any).maxPollution
          : null;

      let message = 'Pollution: inconnue.';
      if (p !== null && max !== null) message = `Pollution: ${p}/${max}.`;
      else if (p !== null) message = `Pollution: ${p}.`;
      else if (max !== null) message = `Pollution max: ${max}.`;

      upsertPanel('pollution', 'Pollution', message);
    }

    (ui as any).panels = panels;
    return {
      ...stateWithTurnPanel,
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



