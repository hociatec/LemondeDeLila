import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoomService } from '../../../room/services/room.service';
import {
  RoomPayload,
} from '../../../room/dto/room-response.dto';
import { GameCoreService } from '../../core/services/game-core.service';
import {
  GameSingleActionDto,
  GameStateResponse,
  GameStateWithActions,
} from '../dto/game-action.dto';
import { GameRegistryService } from './game-registry.service';
import type {
  GameStateEntity,
  PendingState,
  PlayerStateEntity,
} from '../../core/entities/game-state.entity';
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
import type { ValidatedGameActionDto } from '../dto/validated-action.dto';
import { PayloadValidationError } from '../../../common/errors/game-errors';
import { GameLoggerService } from '../../../common/services/game-logger.service';
import { GameStatsService } from '../../../stats/services/game-stats.service';
import { GridRenderService } from '../../modules/grid/services/grid-render.service';
import {
  fixMojibakeDeep,
  fixMojibakeString,
} from '../../../common/utils/mojibake';
import { SocialProfile } from '../../../social/entities/social-profile.entity';
import { BoardPayloadService } from '../../modules/board/services/board-payload.service';
import {
  getMetadataObject,
  normalizeMetadataString,
  parseMetadataNumber,
  toMetadata,
  tryReadOutcomesByPlayerId,
  tryReadWinnerId,
} from './game-engine.metadata';
import {
  extractExtras,
  extractPanelMessage,
  extractPanels,
  extractUi,
} from './game-engine-extras';
import { attachUiDescriptors } from './game-engine-ui-descriptors';
import {
  attachCurrentPlayerView,
  attachTurnLabel,
  stripBoardAndGridIfNotStarted,
} from './game-engine-presentation';
import { attachViewerContext } from './game-engine-viewer-context';
import { attachStartLifecycle } from './game-engine-lifecycle';
import { attachShortcuts, buildShortcuts } from './game-engine-shortcuts';
import {
  attachPendingChoiceActions,
  attachSyntheticPendingFromActions,
} from './game-engine-pending-presentation';
import {
  attachCanonicalPositionPanel,
  buildCanonicalPositionPanelMessage,
} from './game-engine-position-panel';
import { enqueueMutation } from './game-engine-mutation-queue';
import { runApplyActionsInternal } from './runtime/game-engine-runtime.apply-actions';
import { runPlayBotTurnInternal } from './runtime/game-engine-runtime.bot-turn';
import { runApplySystemActions } from './runtime/game-engine-runtime.system-actions';
import { runScheduleBotTurn } from './runtime/game-engine-runtime.scheduler';
import { runGetInternalState } from './runtime/game-engine-runtime.internal-state';
import {
  buildPlayersFromPayload as buildPlayersFromRoomPayload,
  syncRosterForStartedRoom,
} from './runtime/game-engine-runtime.roster-sync';
import { buildInitialState } from './runtime/game-engine-runtime.initial-state';
import {
  appendFirstTurnAnnouncement as appendFirstTurnAnnouncementRuntime,
  ensureRandomStarterAtGameStart as ensureRandomStarterAtGameStartRuntime,
} from './runtime/game-engine-runtime.turn-announcements';
import {
  appendBoardArrivalAnnouncements as appendBoardArrivalAnnouncementsRuntime,
  appendSkipTurnAnnouncements as appendSkipTurnAnnouncementsRuntime,
} from './runtime/game-engine-runtime.log-announcements';
import {
  runMarkBotThinking,
  runNormalizeBotThinking,
} from './runtime/game-engine-runtime.bot-thinking';

type GameEndedOutcome = 'won' | 'lost' | 'draw' | 'unknown';

type GameEndedPayload = {
  roomId: number;
  gameType: string;
  status: 'finished';
  finishedAt: string;
  winnerPlayerId: number | null;
  outcomesByPlayerId: Record<string, GameEndedOutcome>;
  playersById: Record<string, string>;
  endgameMessagesByPlayerId: Record<
    string,
    {
      victoryMessage: string | null;
      defeatMessage: string | null;
    }
  >;
  turnIndex: number | null;
};

@Injectable()
export class GameEngineService {
  private broadcaster?: (
    gameType: string,
    roomId: number,
    state: GameStateEntity,
  ) => void;
  private endedBroadcaster?: (
    gameType: string,
    roomId: number,
    state: GameStateEntity,
    payload: GameEndedPayload,
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
  private static readonly FINISHED_STATE_GRACE_MS = 5_000;

  private static nowMs(): number {
    return Date.now();
  }

  private readonly runtimeDeps = {
    nowMs: () => GameEngineService.nowMs(),
    roomsGetRoomPayload: (roomId: number) => this.rooms.getRoomPayload(roomId),
    roomsResetRoomSystem: (roomId: number) => this.rooms.resetRoomSystem(roomId),
    roomsNotifyRoomStateUpdated: (roomId: number) =>
      this.rooms.notifyRoomStateUpdated(roomId),
    registryGetHandler: (gameType: string) => this.registry.getHandler(gameType),
    storeGet: (roomId: number, gameType: string) => this.store.get(roomId, gameType),
    storeSet: (
      roomId: number,
      gameType: string,
      state: GameStateEntity,
      opts?: { asyncPersist?: boolean },
    ) => this.store.set(roomId, gameType, state, opts),
    storeDelete: (roomId: number, gameType: string) => this.store.delete(roomId, gameType),
    storeSyncRoomStatus: (state: GameStateEntity, payload: RoomPayload) =>
      this.store.syncRoomStatus(state, payload),
    storeMarkBotThinking: (state: GameStateEntity, isBot: boolean) =>
      this.store.markBotThinking(state, isBot),
    botSchedulerClear: (key: string) => this.botScheduler.clear(key),
    buildKey: (roomId: number, gameType: string) => this.buildKey(roomId, gameType),
    buildSystemTimerKey: (roomId: number, gameType: string, suffix: string) =>
      this.buildSystemTimerKey(roomId, gameType, suffix),
    cleanupRoom: (roomId: number, gameType: string) => this.cleanupRoom(roomId, gameType),
    getInternalState: (roomId: number, gameType: string) =>
      this.getInternalState(roomId, gameType),
    normalizeBotThinking: (roomId: number, gameType: string, state: GameStateEntity) =>
      this.normalizeBotThinking(roomId, gameType, state),
    markBotThinking: (
      roomId: number,
      gameType: string,
      state: GameStateEntity,
      botTurn?: boolean,
    ) => this.markBotThinking(roomId, gameType, state, botTurn),
    scheduleBotTurn: (roomId: number, gameType: string, state: GameStateEntity) =>
      this.scheduleBotTurn(roomId, gameType, state),
    applySystemActions: (
      roomId: number,
      gameType: string,
      actions: GameSingleActionDto[],
    ) => this.applySystemActions(roomId, gameType, actions),
    playBotTurn: (roomId: number, gameType: string) => this.playBotTurn(roomId, gameType),
    getBotActorIdForState: (
      state: GameStateEntity,
      handler: GameRulesAdapter | undefined,
    ) => this.getBotActorIdForState(state, handler),
    pendingSignature: (pending: PendingState | null | undefined) =>
      this.pendingSignature(pending),
    exposeState: (state: GameStateEntity, gameType: string) =>
      this.exposeState(state, gameType),
    applyActionsInternal: (
      roomId: number,
      gameType: string,
      actions: GameSingleActionDto[],
      actorId: number | null,
      allowBotTurn: boolean,
      botActorIdOverride: number | null,
    ) =>
      this.applyActionsInternal(
        roomId,
        gameType,
        actions,
        actorId,
        allowBotTurn,
        botActorIdOverride,
      ),
    appendFirstTurnAnnouncement: (state: GameStateEntity) =>
      this.appendFirstTurnAnnouncement(state),
    appendBoardArrivalAnnouncements: (
      gameType: string,
      handler: GameRulesAdapter | undefined,
      previous: GameStateEntity,
      next: GameStateEntity,
    ) => this.appendBoardArrivalAnnouncements(gameType, handler, previous, next),
    appendSkipTurnAnnouncements: (state: GameStateEntity) =>
      this.appendSkipTurnAnnouncements(state),
    normalizeWinnerMetadata: (state: GameStateEntity) =>
      this.normalizeWinnerMetadata(state),
    forceFinishedIfWinnerDetected: (state: GameStateEntity) =>
      this.forceFinishedIfWinnerDetected(state),
    isWithinFinishedGraceWindow: (state: GameStateEntity) =>
      this.isWithinFinishedGraceWindow(state),
    scheduleFinishedRoomReset: (
      roomId: number,
      gameType: string,
      state: GameStateEntity,
    ) => this.scheduleFinishedRoomReset(roomId, gameType, state),
    buildInitialState: (payload: RoomPayload, gameType: string) =>
      this.buildInitialState(payload, gameType),
    syncRosterForStartedRoom: (state: GameStateEntity, payload: RoomPayload) =>
      this.syncRosterForStartedRoom(state, payload),
    validateActions: (
      state: GameStateEntity,
      handler: GameRulesAdapter | undefined,
      actions: GameSingleActionDto[],
      actorId: number | null,
    ) => this.validateActions(state, handler, actions, actorId),
    normalizeActionType: (value: unknown) => this.normalizeActionType(value),
    isDrawAction: (action: GameSingleActionDto) => this.isDrawAction(action),
    isBotTurn: (state: GameStateEntity) => this.isBotTurn(state),
    deriveFinishedOutcomes: (state: GameStateEntity) =>
      this.deriveFinishedOutcomes(state),
    buildEndgameMessagesByPlayerId: (players: PlayerStateEntity[]) =>
      this.buildEndgameMessagesByPlayerId(players),
    buildEndedPayload: (roomId: number, gameType: string, state: GameStateEntity) =>
      this.buildEndedPayload(roomId, gameType, state),
    broadcastCurrentStateAndExpose: (
      roomId: number,
      gameType: string,
      state: GameStateEntity,
    ) => this.broadcastCurrentStateAndExpose(roomId, gameType, state),
    coreAppendLog: (state: GameStateEntity, message: string) =>
      this.core.appendLog(state, message),
    coreBuildBaseState: (payload: RoomPayload, gameType: string) =>
      this.core.buildBaseState(payload, gameType),
    normalizeUsernameForLog: (username: unknown) =>
      this.normalizeUsernameForLog(username),
    botSettings: () => this.botSettings,
    botScheduler: () => this.botScheduler,
    botRunner: () => this.botRunner,
    statsFinalizeFinished: (roomId: number, state: GameStateEntity) =>
      this.stats.finalizeFinished(roomId, state),
    broadcaster: () => this.broadcaster,
    endedBroadcaster: () => this.endedBroadcaster,
  };

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
    private readonly boardPayload: BoardPayloadService = new BoardPayloadService(),
    @Optional()
    @InjectRepository(SocialProfile)
    private readonly socialProfiles?: Repository<SocialProfile>,
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

  setEndedBroadcaster(
    fn: (
      gameType: string,
      roomId: number,
      state: GameStateEntity,
      payload: GameEndedPayload,
    ) => void,
  ): void {
    this.endedBroadcaster = fn;
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
    const internal = await enqueueMutation({
      queue: this.mutationQueue,
      key: this.buildKey(roomId, gameType),
      task: () => this.getInternalState(roomId, gameType),
    });
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
    const internal = await enqueueMutation({
      queue: this.mutationQueue,
      key: this.buildKey(roomId, gameType),
      task: () => this.getInternalState(roomId, gameType),
    });
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
    const withLabel = attachTurnLabel(exposed, label);
    const withDescriptors = attachCanonicalPositionPanel({
      state: attachUiDescriptors({
        state: this.gridRender.attachGridRenderDescriptors(
          attachViewerContext(attachCurrentPlayerView(withLabel), userId),
        ),
        normalizeString: normalizeMetadataString,
      }),
      internal: state,
      userId,
      boardPayload: this.boardPayload,
      normalizeString: normalizeMetadataString,
    });
    const withShortcuts = attachShortcuts({ state: withDescriptors, handler });
    const withLifecycle = attachStartLifecycle({
      state: withShortcuts,
      userId,
    });
    const withSyntheticPending =
      attachSyntheticPendingFromActions(withLifecycle);
    const withChoiceActions = attachPendingChoiceActions(withSyntheticPending);
    const finalState = fixMojibakeDeep(
      stripBoardAndGridIfNotStarted(withChoiceActions),
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
    const status = String(state?.status ?? '')
      .toLowerCase()
      .trim();

    // Priority rule: ENTER must always restart when the game is finished,
    // regardless of any declared shortcut mapping.
    if (normalized === 'ENTER' && status === 'finished') {
      return { kind: 'room', op: 'restart' };
    }

    const shortcuts = buildShortcuts({ state, handler });

    const match = shortcuts.find((s) => {
      const rawKey = typeof s?.key === 'string' ? s.key : '';
      const prefix = 'pressed ';
      const k = rawKey.toLowerCase().startsWith(prefix)
        ? rawKey.substring(prefix.length).trim().toUpperCase()
        : rawKey.trim().toUpperCase();
      return k === normalized;
    });

    if (!match || typeof match !== 'object') {
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
      const action = { type: actionType, payload: {} } as GameSingleActionDto;
      try {
        const fresh = await this.getInternalState(roomId, gameType);
        if (handler?.validateAction) {
          handler.validateAction(fresh, action, userId);
        }
      } catch {
        return null;
      }
      return { kind: 'action', actions: [action] };
    }

    if (match.type === 'interface') {
      const panelId = String(match.id ?? '').trim();
      if (!panelId) return null;

      const extras = extractExtras(state);
      const ui = extractUi(extras);
      const panels = extractPanels(ui);
      const panel = panels
        ? (panels[panelId] as Record<string, unknown> | undefined)
        : undefined;
      let message = extractPanelMessage(panel);

      if (!message && panelId === 'turn') {
        const status = String(state?.status ?? '')
          .toLowerCase()
          .trim();
        if (status === 'finished') {
          message = 'Partie terminée.';
        } else if (status !== 'started') {
          message = 'Partie non démarrée.';
        } else if (
          typeof state?.turn?.label === 'string' &&
          state.turn.label.trim()
        ) {
          message = state.turn.label.trim();
        } else {
          const currentPlayerId =
            typeof state?.turn?.currentPlayerId === 'number' &&
            Number.isFinite(state.turn.currentPlayerId)
              ? state.turn.currentPlayerId
              : null;
          const players = state.players ?? [];
          const name =
            currentPlayerId != null
              ? String(
                  players.find((p) => Number(p.id) === currentPlayerId)
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
      if (!message) {
        const toStringList = (raw: unknown): string[] =>
          Array.isArray(raw)
            ? raw
                .map((v) => normalizeMetadataString(v))
                .filter((v) => v.length > 0)
            : [];

        if (panelId === 'hand' || panelId === 'hands') {
          const hand = toStringList(extras['hand']);
          if (hand.length > 0) {
            message = `Main : ${hand.join(', ')}.`;
          }
        } else if (panelId === 'score') {
          const score = toStringList(extras['score']);
          if (score.length > 0) {
            message = `Score : ${score.join(' | ')}.`;
          }
        }
      }

      if (panelId === 'position') {
        const rebuilt = await this.tryBuildCanonicalPositionPanelMessage(
          roomId,
          gameType,
          state,
        );
        if (rebuilt) {
          message = rebuilt;
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

  private async tryBuildCanonicalPositionPanelMessage(
    roomId: number,
    gameType: string,
    state: GameStateWithActions,
  ): Promise<string> {
    try {
      const internal = await this.getInternalState(roomId, gameType).catch(
        () => null,
      );
      return buildCanonicalPositionPanelMessage({
        internal,
        state,
        boardPayload: this.boardPayload,
        normalizeString: normalizeMetadataString,
      });
    } catch {
      return '';
    }
  }

  async refreshAndBroadcast(roomId: number, gameType: string): Promise<void> {
    const state = await this.getInternalState(roomId, gameType);
    this.broadcaster?.(gameType, roomId, state);
  }

  private async getInternalState(
    roomId: number,
    gameType: string,
  ): Promise<GameStateEntity> {
    return runGetInternalState({
      roomId,
      gameType,
      roomsGetRoomPayload: this.runtimeDeps.roomsGetRoomPayload,
      roomsResetRoomSystem: this.runtimeDeps.roomsResetRoomSystem,
      roomsNotifyRoomStateUpdated: this.runtimeDeps.roomsNotifyRoomStateUpdated,
      storeGet: this.runtimeDeps.storeGet,
      storeSet: this.runtimeDeps.storeSet,
      storeDelete: this.runtimeDeps.storeDelete,
      storeSyncRoomStatus: this.runtimeDeps.storeSyncRoomStatus,
      cleanupRoom: this.runtimeDeps.cleanupRoom,
      isRoomNotFound: (err) => this.isRoomNotFound(err),
      toMetadata,
      normalizeMetadataString,
      parseMetadataNumber,
      forceFinishedIfWinnerDetected: this.runtimeDeps.forceFinishedIfWinnerDetected,
      isWithinFinishedGraceWindow: this.runtimeDeps.isWithinFinishedGraceWindow,
      scheduleFinishedRoomReset: this.runtimeDeps.scheduleFinishedRoomReset,
      buildInitialState: this.runtimeDeps.buildInitialState,
      markBotThinking: this.runtimeDeps.markBotThinking,
      normalizeBotThinking: this.runtimeDeps.normalizeBotThinking,
      scheduleBotTurn: this.runtimeDeps.scheduleBotTurn,
      syncRosterForStartedRoom: this.runtimeDeps.syncRosterForStartedRoom,
      gameLogger: this.gameLogger as any,
      exceptions: { NotFoundException, BadRequestException },
    });
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
    return enqueueMutation({
      queue: this.mutationQueue,
      key: this.buildKey(roomId, gameType),
      task: () =>
        this.applyActionsInternal(
          roomId,
          gameType,
          actions,
          actorId,
          allowBotTurn,
        ),
    });
  }

  private async applyActionsInternal(
    roomId: number,
    gameType: string,
    actions: GameSingleActionDto[],
    actorId: number | null,
    allowBotTurn = false,
    botActorIdOverride: number | null = null,
  ): Promise<GameStateResponse> {
    return runApplyActionsInternal({
      roomId,
      gameType,
      actions,
      actorId,
      allowBotTurn,
      botActorIdOverride,
      getInternalState: this.runtimeDeps.getInternalState,
      normalizeBotThinking: this.runtimeDeps.normalizeBotThinking,
      registryGetHandler: this.runtimeDeps.registryGetHandler,
      validateActions: this.runtimeDeps.validateActions,
      normalizeActionType: this.runtimeDeps.normalizeActionType,
      isDrawAction: this.runtimeDeps.isDrawAction,
      isBotTurn: this.runtimeDeps.isBotTurn,
      markBotThinking: this.runtimeDeps.markBotThinking,
      scheduleBotTurn: this.runtimeDeps.scheduleBotTurn,
      botSchedulerClear: this.runtimeDeps.botSchedulerClear,
      buildKey: this.runtimeDeps.buildKey,
      exposeState: this.runtimeDeps.exposeState,
      broadcastCurrentStateAndExpose: this.runtimeDeps.broadcastCurrentStateAndExpose,
      coreAppendLog: this.runtimeDeps.coreAppendLog,
      storeSet: this.runtimeDeps.storeSet,
      normalizeWinnerMetadata: this.runtimeDeps.normalizeWinnerMetadata,
      forceFinishedIfWinnerDetected:
        this.runtimeDeps.forceFinishedIfWinnerDetected,
      appendBoardArrivalAnnouncements:
        this.runtimeDeps.appendBoardArrivalAnnouncements,
      appendSkipTurnAnnouncements: this.runtimeDeps.appendSkipTurnAnnouncements,
      toMetadata,
      deriveFinishedOutcomes: this.runtimeDeps.deriveFinishedOutcomes,
      buildEndgameMessagesByPlayerId:
        this.runtimeDeps.buildEndgameMessagesByPlayerId,
      normalizeUsernameForLog: this.runtimeDeps.normalizeUsernameForLog,
      statsFinalizeFinished: this.runtimeDeps.statsFinalizeFinished,
      buildEndedPayload: this.runtimeDeps.buildEndedPayload,
      endedBroadcaster: this.runtimeDeps.endedBroadcaster(),
      scheduleFinishedRoomReset: this.runtimeDeps.scheduleFinishedRoomReset,
      broadcaster: this.runtimeDeps.broadcaster(),
      gameLogger: this.gameLogger as any,
      exceptions: { BadRequestException, UnauthorizedException },
    });
  }

  private broadcastCurrentStateAndExpose(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): GameStateResponse {
    this.broadcaster?.(gameType, roomId, state);
    return this.exposeState(state, gameType);
  }

  private normalizeWinnerMetadata<TState extends { metadata?: unknown }>(
    state: TState,
  ): TState {
    const meta = toMetadata(state);
    if (Object.keys(meta).length === 0) return state;

    const winnerId = meta?.winnerId;
    if (winnerId !== null && winnerId !== undefined) {
      if (typeof winnerId !== 'string' || winnerId.trim().length > 0) {
        return state;
      }
    }

    for (const key of ['winnerPlayerId', 'winner_id'] as const) {
      const value = meta[key];
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim().length === 0) continue;
      return {
        ...state,
        metadata: {
          ...meta,
          winnerId: value,
        },
      } as TState;
    }

    return state;
  }

  private normalizeUsernameForLog(username: unknown): string {
    let name = '';
    if (typeof username === 'string') {
      name = username.trim();
    } else if (typeof username === 'number' || typeof username === 'boolean') {
      name = String(username).trim();
    } else {
      return '';
    }
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    const lowered = name.toLowerCase();
    if (
      lowered.endsWith('(zone de jeu)') ||
      lowered.endsWith('(zone de jeux)') ||
      lowered.endsWith('(game zone)')
    ) {
      const openParen = name.lastIndexOf('(');
      if (openParen > 0) {
        name = name.slice(0, openParen).trimEnd();
      }
    }
    return name;
  }

  private normalizeActionType(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim().toLowerCase();
  }

  private isDrawAction(action: GameSingleActionDto): boolean {
    const type = this.normalizeActionType(action.type);
    return type === 'draw' || type === 'draw_card';
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
    state: GameStateEntity,
  ): GameStateEntity {
    const status = String(state?.status ?? '').toLowerCase();
    if (status !== 'started') {
      return state;
    }

    const meta = toMetadata(state);
    if (Object.keys(meta).length === 0) {
      return state;
    }

    // Certains jeux peuvent déjà marquer une fin logique via `finishedAt`/`outcomesByPlayerId`
    // sans avoir basculé `status` -> finished (legacy / bug). On force dans ce cas pour
    // déclencher le reset automatique de table côté moteur.
    const finishedAt = normalizeMetadataString(meta['finishedAt']);
    if (finishedAt.length > 0) {
      return state.status === 'finished'
        ? state
        : { ...state, status: 'finished' };
    }
    const outcomes = meta['outcomesByPlayerId'];
    if (
      outcomes &&
      typeof outcomes === 'object' &&
      Object.keys(outcomes).length > 0
    ) {
      return state.status === 'finished'
        ? state
        : { ...state, status: 'finished' };
    }

    for (const key of ['winnerPlayerId', 'winnerId', 'winner_id'] as const) {
      const value = meta[key];
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
      return {
        ...state,
        status: 'finished',
        metadata: normalizedMeta,
      };
    }

    return state;
  }

  private deriveFinishedOutcomes(state: GameStateWithActions): {
    winnerId: number | null;
    outcomesByPlayerId: Record<string, 'won' | 'lost'> | null;
  } {
    const players = state.players ?? [];
    const humans = players.filter((p) => !p.isBot);
    const humanIdSet = new Set(
      humans
        .map((p) =>
          typeof p?.id === 'number' && Number.isFinite(p.id) ? p.id : null,
        )
        .filter((id): id is number => id != null),
    );

    const metadata = toMetadata(state);

    const winnerFromMeta = this.tryReadWinnerId(metadata);
    const existingOutcomesRaw = this.tryReadOutcomesByPlayerId(metadata);
    const existingOutcomes =
      existingOutcomesRaw && Object.keys(existingOutcomesRaw).length > 0
        ? Object.fromEntries(
            Object.entries(existingOutcomesRaw).filter(([key]) => {
              const id = Number(key);
              return Number.isFinite(id) && humanIdSet.has(id);
            }),
          )
        : null;

    let winnerId = winnerFromMeta;
    if (winnerId == null && existingOutcomes) {
      const winners = Object.entries(existingOutcomes)
        .filter(([, v]) => v === 'won')
        .map(([k]) => Number(k))
        .filter((n) => Number.isFinite(n));
      if (winners.length === 1) {
        winnerId = winners[0]!;
      }
    }

    let outcomesByPlayerId: Record<string, 'won' | 'lost'> | null = null;
    if (existingOutcomes && Object.keys(existingOutcomes).length > 0) {
      outcomesByPlayerId = existingOutcomes;
    } else if (winnerId != null) {
      outcomesByPlayerId = Object.fromEntries(
        humans.map((p) => [String(p.id), p.id === winnerId ? 'won' : 'lost']),
      );
    }

    return { winnerId, outcomesByPlayerId };
  }

  private async buildEndedPayload(
    roomId: number,
    gameType: string,
    state: GameStateWithActions,
  ): Promise<GameEndedPayload> {
    const metadata = toMetadata(state);
    const { winnerId, outcomesByPlayerId } = this.deriveFinishedOutcomes(state);
    const players = state.players ?? [];

    const playersById: Record<string, string> = {};
    for (const p of players) {
      const id =
        typeof p?.id === 'number' && Number.isFinite(p.id) ? p.id : null;
      if (id == null) {
        continue;
      }
      const username = this.normalizeUsernameForLog(p.username);
      if (!username) {
        continue;
      }
      playersById[String(id)] = username;
    }

    const outcomes: Record<string, GameEndedOutcome> = {};
    if (outcomesByPlayerId) {
      for (const [playerId, raw] of Object.entries(outcomesByPlayerId)) {
        const normalized = String(raw ?? '')
          .trim()
          .toLowerCase();
        if (
          normalized === 'won' ||
          normalized === 'lost' ||
          normalized === 'draw' ||
          normalized === 'unknown'
        ) {
          outcomes[String(playerId)] = normalized as GameEndedOutcome;
          continue;
        }
        outcomes[String(playerId)] = 'unknown';
      }
    }

    const finishedAtRaw = metadata['finishedAt'];
    const finishedAt =
      typeof finishedAtRaw === 'string' && finishedAtRaw.trim().length > 0
        ? finishedAtRaw.trim()
        : new Date().toISOString();
    const turnIndex =
      typeof state?.turnIndex === 'number' && Number.isFinite(state.turnIndex)
        ? state.turnIndex
        : null;
    const endgameMessagesByPlayerId =
      await this.buildEndgameMessagesByPlayerId(players);

    return {
      roomId,
      gameType,
      status: 'finished',
      finishedAt,
      winnerPlayerId: winnerId ?? null,
      outcomesByPlayerId: outcomes,
      playersById,
      endgameMessagesByPlayerId,
      turnIndex,
    };
  }

  private async buildEndgameMessagesByPlayerId(
    players: PlayerStateEntity[],
  ): Promise<GameEndedPayload['endgameMessagesByPlayerId']> {
    if (!this.socialProfiles) {
      return {};
    }

    const playerIds = Array.from(
      new Set(
        (players ?? [])
          .filter((p) => p && p.isBot !== true)
          .map((p) => (typeof p?.id === 'number' ? p.id : null))
          .filter((id): id is number => id != null && Number.isFinite(id)),
      ),
    );

    if (playerIds.length === 0) {
      return {};
    }

    try {
      const rows = await this.socialProfiles.find({
        select: {
          userId: true,
          victoryMessage: true,
          defeatMessage: true,
        },
        where: {
          userId: In(playerIds),
        },
      });

      const out: GameEndedPayload['endgameMessagesByPlayerId'] = {};
      for (const row of rows) {
        const userId =
          typeof row?.userId === 'number' && Number.isFinite(row.userId)
            ? row.userId
            : null;
        if (userId == null) {
          continue;
        }

        const victoryMessage = this.normalizeProfileEndgameMessage(
          row.victoryMessage,
        );
        const defeatMessage = this.normalizeProfileEndgameMessage(
          row.defeatMessage,
        );
        if (!victoryMessage && !defeatMessage) {
          continue;
        }

        out[String(userId)] = {
          victoryMessage,
          defeatMessage,
        };
      }

      return out;
    } catch {
      // Ne pas bloquer la fin de partie si la lecture de profil échoue.
      return {};
    }
  }

  private normalizeProfileEndgameMessage(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const text = fixMojibakeString(value).trim();
    if (!text) {
      return null;
    }
    return text.slice(0, 280);
  }

  private tryReadWinnerId(meta: Record<string, unknown>): number | null {
    return tryReadWinnerId(meta);
  }

  private tryReadOutcomesByPlayerId(
    meta: Record<string, unknown>,
  ): Record<string, 'won' | 'lost'> | null {
    return tryReadOutcomesByPlayerId(meta);
  }

  async playBotTurn(
    roomId: number,
    gameType: string,
  ): Promise<GameStateWithActions> {
    return enqueueMutation({
      queue: this.mutationQueue,
      key: this.buildKey(roomId, gameType),
      task: () => this.playBotTurnInternal(roomId, gameType),
    });
  }

  private async playBotTurnInternal(
    roomId: number,
    gameType: string,
  ): Promise<GameStateWithActions> {
    return runPlayBotTurnInternal({
      roomId,
      gameType,
      getInternalState: this.runtimeDeps.getInternalState,
      normalizeBotThinking: this.runtimeDeps.normalizeBotThinking,
      buildKey: this.runtimeDeps.buildKey,
      botSchedulerClear: this.runtimeDeps.botSchedulerClear,
      registryGetHandler: this.runtimeDeps.registryGetHandler,
      getBotActorIdForState: this.runtimeDeps.getBotActorIdForState,
      appendFirstTurnAnnouncement: this.runtimeDeps.appendFirstTurnAnnouncement,
      botRunner: this.runtimeDeps.botRunner() as any,
      applyActionsInternal: this.runtimeDeps.applyActionsInternal,
      storeGet: this.runtimeDeps.storeGet,
      exposeState: this.runtimeDeps.exposeState,
      markBotThinking: this.runtimeDeps.markBotThinking,
      broadcaster: this.runtimeDeps.broadcaster(),
      gameLogger: this.gameLogger as any,
    });
  }

  private syncRosterForStartedRoom(
    state: GameStateEntity,
    payload: RoomPayload,
  ): GameStateEntity {
    return syncRosterForStartedRoom({
      state,
      payload,
      buildPlayersFromPayload: (nextPayload) =>
        buildPlayersFromRoomPayload({
          payload: nextPayload,
          normalizeUsernameForLog: this.runtimeDeps.normalizeUsernameForLog,
        }),
      normalizeUsernameForLog: this.runtimeDeps.normalizeUsernameForLog,
    });
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
    const internal = await enqueueMutation({
      queue: this.mutationQueue,
      key: this.buildKey(roomId, gt),
      task: () => this.getInternalState(roomId, gt),
    });
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
    await enqueueMutation({
      queue: this.mutationQueue,
      key: this.buildKey(roomId, gt),
      task: async () => {
        await this.store.set(roomId, gt, state);
        const marked = await this.normalizeBotThinking(
          roomId,
          gt,
          await this.markBotThinking(roomId, gt, state),
        );
        await this.scheduleBotTurn(roomId, gt, marked);
        this.broadcaster?.(gt, roomId, marked);
      },
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
    const pending = state.pending ?? null;
    const pendingPlayerIdRaw = pending?.playerId;
    const pendingPlayerId =
      pendingPlayerIdRaw != null && Number.isFinite(Number(pendingPlayerIdRaw))
        ? Number(pendingPlayerIdRaw)
        : null;
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

  private pendingSignature(
    pending: PendingState | null | undefined,
  ): string | null {
    if (!pending) return null;
    return JSON.stringify({
      type: typeof pending.type === 'string' ? pending.type : null,
      step: typeof pending.step === 'string' ? pending.step : null,
      playerId: typeof pending.playerId === 'number' ? pending.playerId : null,
      initiatorPlayerId:
        typeof pending.initiatorPlayerId === 'number'
          ? pending.initiatorPlayerId
          : null,
      targetPlayerId:
        typeof pending.targetPlayerId === 'number'
          ? pending.targetPlayerId
          : null,
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
    await enqueueMutation({
      queue: this.mutationQueue,
      key: this.buildKey(roomId, gameType),
      task: async () => {
        await runApplySystemActions({
          roomId,
          gameType,
          actions,
          getInternalState: this.runtimeDeps.getInternalState,
          normalizeBotThinking: this.runtimeDeps.normalizeBotThinking,
          registryGetHandler: this.runtimeDeps.registryGetHandler,
          toMetadata,
          isBotTurn: this.runtimeDeps.isBotTurn,
          markBotThinking: this.runtimeDeps.markBotThinking,
          normalizeWinnerMetadata: this.runtimeDeps.normalizeWinnerMetadata,
          forceFinishedIfWinnerDetected:
            this.runtimeDeps.forceFinishedIfWinnerDetected,
          appendBoardArrivalAnnouncements:
            this.runtimeDeps.appendBoardArrivalAnnouncements,
          appendSkipTurnAnnouncements:
            this.runtimeDeps.appendSkipTurnAnnouncements,
          storeSet: this.runtimeDeps.storeSet,
          scheduleBotTurn: this.runtimeDeps.scheduleBotTurn,
          broadcaster: this.runtimeDeps.broadcaster(),
        });
      },
    });
  }

  private async scheduleBotTurn(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    await runScheduleBotTurn({
      roomId,
      gameType,
      state,
      buildKey: this.runtimeDeps.buildKey,
      buildSystemTimerKey: this.runtimeDeps.buildSystemTimerKey,
      toMetadata,
      normalizeString: normalizeMetadataString,
      parseNumber: parseMetadataNumber,
      getMetadataObject,
      registryGetHandler: this.runtimeDeps.registryGetHandler,
      getBotActorIdForState: this.runtimeDeps.getBotActorIdForState,
      pendingSignature: this.runtimeDeps.pendingSignature,
      markBotThinking: this.runtimeDeps.markBotThinking,
      scheduleBotTurn: this.runtimeDeps.scheduleBotTurn,
      applySystemActions: this.runtimeDeps.applySystemActions,
      playBotTurn: this.runtimeDeps.playBotTurn,
      storeGet: this.runtimeDeps.storeGet,
      broadcaster: this.runtimeDeps.broadcaster(),
      cleanupRoom: this.runtimeDeps.cleanupRoom,
      botSettings: this.runtimeDeps.botSettings(),
      botScheduler: this.runtimeDeps.botScheduler() as any,
      nowMs: this.runtimeDeps.nowMs,
      gameLogger: this.gameLogger as any,
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

  private buildInitialState(
    payload: RoomPayload,
    gameType: string,
  ): GameStateEntity {
    return buildInitialState({
      payload,
      gameType,
      coreBuildBaseState: this.runtimeDeps.coreBuildBaseState,
      coreAppendLog: this.runtimeDeps.coreAppendLog,
      registryGetHandler: this.runtimeDeps.registryGetHandler,
      ensureRandomStarterAtGameStart:
        (baseState, currentState) =>
          this.ensureRandomStarterAtGameStart(baseState, currentState),
      appendFirstTurnAnnouncement: this.runtimeDeps.appendFirstTurnAnnouncement,
    });
  }

  private ensureRandomStarterAtGameStart(
    baseState: GameStateEntity,
    state: GameStateEntity,
  ): GameStateEntity {
    return ensureRandomStarterAtGameStartRuntime({
      baseState,
      state,
      toMetadata,
    });
  }

  private appendFirstTurnAnnouncement(state: GameStateEntity): GameStateEntity {
    return appendFirstTurnAnnouncementRuntime({
      state,
      appendLog: this.runtimeDeps.coreAppendLog,
      normalizeUsernameForLog: this.runtimeDeps.normalizeUsernameForLog,
    });
  }

  private buildKey(roomId: number, gameType: string): string {
    return this.store.buildKey(roomId, gameType);
  }

  private isWithinFinishedGraceWindow(
    state: GameStateEntity | null | undefined,
  ): boolean {
    if (!state) return false;
    if (String(state.status ?? '').toLowerCase() !== 'finished') {
      return false;
    }

    const metadata = toMetadata(state);
    const finishedAt = normalizeMetadataString(metadata['finishedAt']);
    if (!finishedAt) {
      return false;
    }

    const finishedAtMs = Date.parse(finishedAt);
    if (!Number.isFinite(finishedAtMs)) {
      return false;
    }

    const ageMs = GameEngineService.nowMs() - finishedAtMs;
    return ageMs >= 0 && ageMs < GameEngineService.FINISHED_STATE_GRACE_MS;
  }

  private async scheduleFinishedRoomReset(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    await Promise.resolve();
    if (String(state?.status ?? '').toLowerCase() !== 'finished') {
      return;
    }

    const systemKey = this.buildSystemTimerKey(
      roomId,
      gameType,
      'finished-reset',
    );
    if (this.botScheduler.has(systemKey)) {
      return;
    }

    const expectedFinishedAt = normalizeMetadataString(toMetadata(state)['finishedAt']);

    this.botScheduler.schedule({
      key: systemKey,
      delayMs: GameEngineService.FINISHED_STATE_GRACE_MS,
      roomId,
      gameType,
      run: async () => {
        await enqueueMutation({
          queue: this.mutationQueue,
          key: this.buildKey(roomId, gameType),
          task: async () => {
            const latest = (await this.store.get(roomId, gameType)) ?? null;
            if (!latest) return;
            if (String(latest.status ?? '').toLowerCase() !== 'finished') {
              return;
            }

            const latestFinishedAt = normalizeMetadataString(
              toMetadata(latest)['finishedAt'],
            );
            if (
              expectedFinishedAt &&
              latestFinishedAt &&
              latestFinishedAt !== expectedFinishedAt
            ) {
              return;
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
          },
        });
      },
      onStale: () => this.cleanupRoom(roomId, gameType),
    });
  }

  private async markBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    botTurn?: boolean,
  ): Promise<GameStateEntity> {
    return runMarkBotThinking({
      roomId,
      gameType,
      state,
      botTurn,
      runtime: {
        registryGetHandler: this.runtimeDeps.registryGetHandler,
        getBotActorIdForState: this.runtimeDeps.getBotActorIdForState,
        nowMs: this.runtimeDeps.nowMs,
        storeMarkBotThinking: this.runtimeDeps.storeMarkBotThinking,
        storeSet: this.runtimeDeps.storeSet,
      },
    });
  }

  private async normalizeBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<GameStateEntity> {
    return runNormalizeBotThinking({
      roomId,
      gameType,
      state,
      botThinkingTtlMs: GameEngineService.BOT_THINKING_TTL_MS,
      runtime: {
        nowMs: this.runtimeDeps.nowMs,
        storeSet: this.runtimeDeps.storeSet,
        gameLogger: this.gameLogger,
      },
    });
  }

  private async validateActions(
    state: GameStateEntity,
    handler: GameRulesAdapter | undefined,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): Promise<GameSingleActionDto[]> {
    const ctx = toMetadata(state);
    const ctxGameType =
      typeof ctx['gameType'] === 'string' ? ctx['gameType'] : null;
    const ctxRoomId = parseMetadataNumber(ctx['roomId']);
    const list = Array.isArray(actions) ? actions : [];
    if (list.length === 0) {
      return [];
    }
    if (list.length > GameEngineService.MAX_ACTIONS_PER_MESSAGE) {
      throw new BadRequestException("Trop d'actions dans un seul message");
    }

    // Step 1: Validate DTOs with class-validator
    let validatedDtos: ValidatedGameActionDto[] = [];
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
        const availableList = Array.isArray(available) ? available : [];
        allowedTypes = new Set(
          availableList.map((entry) => {
            if (!entry || typeof entry !== 'object') return '';
            const entryType = typeof entry.type === 'string' ? entry.type : '';
            return this.normalizeActionType(entryType);
          }),
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
    if (
      typeof currentPlayerId !== 'number' ||
      !Number.isFinite(currentPlayerId)
    ) {
      return false;
    }
    return actorId !== currentPlayerId;
  }

  private isOutOfTurnMessage(message: string): boolean {
    const normalized = String(message ?? '')
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    return (
      normalized.includes('pas votre tour') ||
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
    const withLabel = attachTurnLabel(exposed, label);
    const withDescriptors = this.attachCanonicalPositionPanel(
      attachUiDescriptors({
        state: this.gridRender.attachGridRenderDescriptors(
          attachCurrentPlayerView(withLabel),
        ),
        normalizeString: normalizeMetadataString,
      }),
      state,
      null,
    );
    const withLifecycle = attachStartLifecycle({ state: withDescriptors });
    return fixMojibakeDeep(stripBoardAndGridIfNotStarted(withLifecycle));
  }

  private appendBoardArrivalAnnouncements(
    gameType: string,
    handler: GameRulesAdapter | undefined,
    previous: GameStateEntity,
    next: GameStateEntity,
  ): GameStateEntity {
    return appendBoardArrivalAnnouncementsRuntime({
      gameType,
      handler,
      previous,
      next,
      toMetadata,
      getMetadataObject,
      normalizeMetadataString,
      normalizeUsernameForLog: this.runtimeDeps.normalizeUsernameForLog,
      appendLog: this.runtimeDeps.coreAppendLog,
    });
  }

  private appendSkipTurnAnnouncements(state: GameStateEntity): GameStateEntity {
    return appendSkipTurnAnnouncementsRuntime({
      state,
      toMetadata,
      getMetadataObject,
      normalizeUsernameForLog: this.runtimeDeps.normalizeUsernameForLog,
      appendLog: this.runtimeDeps.coreAppendLog,
    });
  }

  private isRoomNotFound(err: unknown): boolean {
    if (err instanceof NotFoundException) return true;
    const message = normalizeMetadataString(
      err instanceof Error ? err.message : err,
    );
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
