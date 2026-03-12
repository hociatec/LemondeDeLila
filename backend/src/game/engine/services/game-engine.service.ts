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
  RoomPlayer,
  RoomBotState,
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
import type { GameShortcutHint } from '../shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../shortcuts/shortcut-utils';
import { isRollActionType } from '../../actions/action-service.helper';
import {
  fixMojibakeDeep,
  fixMojibakeString,
} from '../../../common/utils/mojibake';
import { SocialProfile } from '../../../social/entities/social-profile.entity';
import { BoardPayloadService } from '../../modules/board/services/board-payload.service';

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

type CurrentPlayerView = {
  shoppingList?: unknown;
  basket?: unknown;
  inventory?: unknown;
  stable?: unknown;
  position?: unknown;
};

function normalizePromptToken(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractPawnPromptToken(message: string): string | null {
  const text = String(message ?? '').trim();
  if (!text) return null;

  const withPlayer = /^c['’]est à (.+?) de choisir (?:son|un) pion(?:[.,!?]|$)/i.exec(
    text,
  );
  if (!withPlayer) return null;
  return `prompt:choose-pawn:${normalizePromptToken(withPlayer[1])}`;
}

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
    const withDescriptors = this.attachCanonicalPositionPanel(
      this.attachUiDescriptors(
        this.gridRender.attachGridRenderDescriptors(
          this.attachViewerContext(
            this.attachCurrentPlayerView(withLabel),
            userId,
          ),
        ),
      ),
      state,
      userId,
    );
    const withShortcuts = this.attachShortcuts(withDescriptors, handler);
    const withLifecycle = this.attachStartLifecycle(withShortcuts, userId);
    const finalState = fixMojibakeDeep(
      this.stripBoardAndGridIfNotStarted(withLifecycle),
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

      const extras = GameEngineService.extractExtras(state);
      const ui = GameEngineService.extractUi(extras);
      const panels = GameEngineService.extractPanels(ui);
      const panel = panels
        ? (panels[panelId] as Record<string, unknown> | undefined)
        : undefined;
      let message = GameEngineService.extractPanelMessage(panel);

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
                .map((v) => this.normalizeMetadataString(v))
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
      return this.buildCanonicalPositionPanelMessage(internal, state);
    } catch {
      return '';
    }
  }

  private buildCanonicalPositionPanelMessage(
    internal: GameStateEntity | null | undefined,
    state: GameStateWithActions | null | undefined,
  ): string {
    const internalMeta =
      internal?.metadata && typeof internal.metadata === 'object'
        ? (internal.metadata as Record<string, unknown>)
        : {};
    const boardRaw =
      state?.board && typeof state.board === 'object'
        ? (state.board as Record<string, unknown>)
        : {};
    const playersRaw =
      Array.isArray(internal?.players) && internal.players.length > 0
        ? internal.players
        : state?.players;

    const tilesRaw = internalMeta['tiles'] ?? boardRaw['tiles'] ?? null;
    const positionsRaw =
      internalMeta['positions'] ?? boardRaw['positions'] ?? null;
    const lapsRaw = internalMeta['laps'] ?? boardRaw['laps'] ?? null;

    if (tilesRaw && positionsRaw) {
      return this.boardPayload.buildPositionPanelMessage({
        tilesRaw,
        positionsRaw,
        lapsRaw,
        playerId: null,
        playersRaw,
      });
    }

    const pawnsByPlayerRaw =
      internalMeta['pawnsByPlayer'] ?? boardRaw['pawnsByPlayer'] ?? null;
    const trackLengthRaw =
      internalMeta['trackLength'] ?? boardRaw['trackLength'] ?? null;
    if (pawnsByPlayerRaw && trackLengthRaw) {
      return this.boardPayload.buildPawnProgressPositionPanelMessage({
        playersRaw,
        pawnsByPlayerRaw,
        trackLengthRaw,
        homeLengthRaw:
          internalMeta['homeLength'] ?? boardRaw['homeLength'] ?? null,
        offsetsRaw: internalMeta['offsets'] ?? boardRaw['offsets'] ?? null,
        pawnNamesByPlayerRaw:
          internalMeta['pawnNamesByPlayer'] ??
          boardRaw['pawnNamesByPlayer'] ??
          null,
      });
    }

    return this.tryBuildCanonicalGridPositionPanelMessage(
      internalMeta,
      boardRaw,
      playersRaw,
    );
  }

  private tryBuildCanonicalGridPositionPanelMessage(
    internalMeta: Record<string, unknown>,
    boardRaw: Record<string, unknown>,
    playersRaw: unknown,
  ): string {
    const sizeRaw = internalMeta['size'] ?? boardRaw['size'] ?? null;
    const size = Number(sizeRaw);
    if (!Number.isFinite(size) || size <= 0) {
      return '';
    }

    const rawPositions =
      internalMeta['pawnsByPlayerId'] ??
      boardRaw['pawnsByPlayerId'] ??
      null;
    if (!rawPositions || typeof rawPositions !== 'object') {
      return '';
    }

    const players = Array.isArray(playersRaw) ? playersRaw : [];
    const namesById = new Map<number, string>();
    for (const player of players) {
      if (!player || typeof player !== 'object') continue;
      const record = player as Record<string, unknown>;
      const id = Number(record['id']);
      if (!Number.isFinite(id) || id === 0) continue;
      const username = this.normalizeMetadataString(record['username']).trim();
      namesById.set(id, username || `Joueur ${id}`);
    }

    const entries = Object.entries(rawPositions as Record<string, unknown>)
      .map(([rawId, rawPos]) => {
        const id = Number(rawId);
        if (!Number.isFinite(id) || id === 0) return null;
        if (!rawPos || typeof rawPos !== 'object') return null;
        const pos = rawPos as Record<string, unknown>;
        const x = Number(pos['x']);
        const y = Number(pos['y']);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const name = namesById.get(id) ?? `Joueur ${id}`;
        return {
          id,
          line: `${name} ${this.toGridCellRef(Math.trunc(x), Math.trunc(y), Math.trunc(size)).toLowerCase()}`,
        };
      })
      .filter((entry): entry is { id: number; line: string } => entry != null)
      .sort((a, b) => a.id - b.id);

    if (entries.length === 0) {
      return '';
    }

    return `Positions. ${entries.map((entry) => entry.line).join('. ')}.`;
  }

  private toGridCellRef(x: number, y: number, size: number): string {
    const safeSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
    if (safeSize <= 0) {
      return `${x},${y}`;
    }

    let n = Math.max(1, Math.trunc(x) + 1);
    let col = '';
    while (n > 0) {
      n -= 1;
      col = String.fromCharCode(65 + (n % 26)) + col;
      n = Math.floor(n / 26);
    }
    const row = Math.max(1, safeSize - Math.trunc(y));
    return `${col}${row}`;
  }

  private attachCanonicalPositionPanel(
    state: GameStateWithActions,
    internal: GameStateEntity,
    userId: number | null,
  ): GameStateWithActions {
    const status = String(state?.status ?? '')
      .toLowerCase()
      .trim();
    if (status !== 'started') {
      return state;
    }

    const message = this.buildCanonicalPositionPanelMessage(internal, state);
    if (!message) {
      return state;
    }

    const extras = GameEngineService.extractExtras(state);
    const uiExisting = GameEngineService.extractUi(extras);
    const ui = uiExisting ? { ...uiExisting } : {};
    const panelsExisting = GameEngineService.extractPanels(uiExisting);
    const panels = panelsExisting ? { ...panelsExisting } : {};
    const current =
      (panels['position'] as Record<string, unknown> | undefined) ?? {};
    const title =
      typeof current['title'] === 'string' && String(current['title']).trim()
        ? String(current['title']).trim()
        : 'Position';

    panels['position'] = {
      ...current,
      title,
      message,
      scope: 'global',
      source: 'canonical',
      viewerPlayerId: userId,
    };
    ui['panels'] = panels;

    return {
      ...state,
      extras: {
        ...extras,
        ui,
      },
    };
  }

  async refreshAndBroadcast(roomId: number, gameType: string): Promise<void> {
    const state = await this.getInternalState(roomId, gameType);
    this.broadcaster?.(gameType, roomId, state);
  }

  private attachShortcuts(
    state: GameStateWithActions,
    handler: GameRulesAdapter | undefined,
  ): GameStateWithActions {
    const extras = GameEngineService.extractExtras(state);

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
    const actions = Array.isArray(state?.actions)
      ? (state.actions as GameSingleActionDto[])
      : [];
    const types = new Set(
      actions
        .map((a) =>
          typeof a?.type === 'string' ? a.type.trim().toLowerCase() : '',
        )
        .filter((t) => t),
    );

    const hasRoll = Array.isArray(actions)
      ? actions.some((a) => isRollActionType(a?.type))
      : false;
    if (hasRoll) {
      common.push(actionShortcut('ENTER', 'roll'));
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
      const keyStr = s.key;
      const typeStr = s.type;
      const idStr = typeStr === 'interface' ? String(s.id ?? '') : '';
      const actionTypeStr =
        typeStr === 'action' ? String(s.actionType ?? '') : '';
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
      const metadata = this.toMetadata(existing);
      const previousStatus = String(existing.status ?? '').toLowerCase();
      const roomStatus = String(payload.room.status ?? '').toLowerCase();
      const storedStartedAt = this.normalizeMetadataString(
        metadata['roomStartedAt'],
      );
      const roomStartedAt = this.normalizeMetadataString(
        payload.room.startedAt,
      );

      // Garde-fou : si un état "finished" est encore stocké alors que la room est restée en "started"
      // (crash/restart serveur ou événement WS manqué), forcer un reset pour retrouver une table
      // modifiable (ajout/suppression de bots, relance).
      const maybeFinished =
        previousStatus === 'finished'
          ? existing
          : this.forceFinishedIfWinnerDetected(existing);
      const maybeFinishedStatus = String(
        maybeFinished?.status ?? '',
      ).toLowerCase();
      if (roomStatus === 'started' && maybeFinishedStatus === 'finished') {
        if (this.isWithinFinishedGraceWindow(maybeFinished)) {
          await this.scheduleFinishedRoomReset(roomId, gameType, maybeFinished);
          return maybeFinished;
        }

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
        const rebuilt = this.buildInitialState(payload, gameType);
        const marked = await this.normalizeBotThinking(
          roomId,
          gameType,
          await this.markBotThinking(roomId, gameType, rebuilt),
        );
        await this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }

      const storedRunId = this.parseMetadataNumber(metadata['roomRunId']);
      const roomRunId = this.parseMetadataNumber(payload.room.runId);
      const hasRunId =
        storedRunId !== null &&
        roomRunId !== null &&
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
        const rebuilt = this.buildInitialState(payload, gameType);
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
            isBot: Boolean(p.isBot),
          })) ?? [],
        incomingPlayers,
        gameStarted,
      });
      // Démarrage : à la transition vers "started", reconstruire l'état initial à partir de la room
      // (permet d'avoir un premier joueur aléatoire via le GameCoreService).
      if (previousStatus !== 'started' && nextStatus === 'started') {
        const rebuilt = this.buildInitialState(payload, gameType);
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
          storedRunId: storedRunId ?? null,
          roomRunId: roomRunId ?? null,
        });
        this.cleanupRoom(roomId, gameType);
        const rebuilt = this.buildInitialState(payload, gameType);
        const marked = await this.normalizeBotThinking(
          roomId,
          gameType,
          await this.markBotThinking(roomId, gameType, rebuilt),
        );
        await this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
      }
      if (!gameStarted && incomingPlayers !== currentPlayers) {
        const rebuilt = this.buildInitialState(payload, gameType);
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
      const forcedFinished = this.forceFinishedIfWinnerDetected(normalized);
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

    const state = this.buildInitialState(payload, gameType);
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
          .map((a) => this.normalizeActionType(a.type))
          .filter((t) => t.length > 0),
      );
      if (allowedTypes.size === 0) return false;

      const requestedTypes = (Array.isArray(actions) ? actions : [])
        .map((a) => this.normalizeActionType(a.type))
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

    const next = handler.applyActions(current, sanitizedActions);
    const botTurn = this.isBotTurn(next);
    let marked = await this.markBotThinking(roomId, gameType, next, botTurn);
    const drawAction = sanitizedActions.find((a) => this.isDrawAction(a));
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
      const metadata = this.toMetadata(marked);
      const obj = { ...metadata };
      const { winnerId, outcomesByPlayerId } =
        this.deriveFinishedOutcomes(marked);

      marked = {
        ...marked,
        metadata: {
          ...obj,
          finishedAt: new Date().toISOString(),
          ...(winnerId != null ? { winnerId, winnerPlayerId: winnerId } : {}),
          ...(outcomesByPlayerId ? { outcomesByPlayerId } : {}),
        },
      };

      // Expose victory/defeat profile phrases in the main log so all clients can see them,
      // even if they don't consume the dedicated game.ended event.
      try {
        if (outcomesByPlayerId && Object.keys(outcomesByPlayerId).length > 0) {
          const endgameMessagesByPlayerId =
            await this.buildEndgameMessagesByPlayerId(marked.players ?? []);
          const players = marked.players ?? [];
          const nameById = new Map<number, string>();
          for (const p of players) {
            if (!p || typeof p.id !== 'number') continue;
            const normalized = this.normalizeUsernameForLog(p.username);
            nameById.set(p.id, normalized || `Joueur ${p.id}`);
          }

          const log = Array.isArray(marked.log) ? [...marked.log] : [];
          const recent = new Set(
            log.slice(-80).map((e) => String(e?.message ?? '').trim()),
          );
          let nextLog = log;
          for (const [playerIdRaw, outcome] of Object.entries(outcomesByPlayerId)) {
            const normalizedOutcome = String(outcome ?? '')
              .trim()
              .toLowerCase();
            if (normalizedOutcome !== 'won' && normalizedOutcome !== 'lost') {
              continue;
            }

            const byPlayer = endgameMessagesByPlayerId[playerIdRaw];
            if (!byPlayer || typeof byPlayer !== 'object') {
              continue;
            }

            const chosen =
              normalizedOutcome === 'won'
                ? byPlayer.victoryMessage
                : byPlayer.defeatMessage;
            if (!chosen) {
              continue;
            }

            const pid = Number(playerIdRaw);
            const name =
              Number.isFinite(pid) && pid > 0
                ? (nameById.get(pid) ?? `Joueur ${pid}`)
                : `Joueur ${playerIdRaw}`;
            const line = `${name} dit: ${chosen}`.trim();
            if (!line || recent.has(line)) {
              continue;
            }

            nextLog = [
              ...nextLog,
              { message: line, timestamp: new Date().toISOString() },
            ];
            recent.add(line);
          }

          if (nextLog !== log) {
            marked = { ...marked, log: nextLog };
          }
        }
      } catch {
        // Best-effort: endgame phrases must not block state updates.
      }
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
        const endedPayload = await this.buildEndedPayload(
          roomId,
          gameType,
          marked,
        );
        this.endedBroadcaster?.(gameType, roomId, marked, endedPayload);
      } catch (err) {
        this.gameLogger.error(
          'Broadcast game.ended failed',
          err instanceof Error ? err : undefined,
          { roomId, gameType },
        );
      }

      try {
        await this.scheduleFinishedRoomReset(roomId, gameType, marked);
      } catch (err) {
        this.gameLogger.error(
          'Schedule finished game reset failed',
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

  private toMetadata(target: { metadata?: unknown }): Record<string, unknown> {
    const meta = target.metadata;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      return meta as Record<string, unknown>;
    }
    return {};
  }

  private normalizeMetadataString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    return '';
  }

  private parseMetadataNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private getMetadataObject(
    metadata: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | null {
    const value = metadata[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private normalizeWinnerMetadata<TState extends { metadata?: unknown }>(
    state: TState,
  ): TState {
    const meta = this.toMetadata(state);
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

  private buildPlayersFromPayload(payload: RoomPayload): PlayerStateEntity[] {
    const result: PlayerStateEntity[] = [];
    const roomPlayers: RoomPlayer[] = Array.isArray(payload?.room?.players)
      ? payload.room.players
      : [];
    for (const player of roomPlayers) {
      const pid =
        typeof player?.id === 'number' ? player.id : Number(player?.id ?? NaN);
      if (!Number.isFinite(pid) || pid === 0) continue;
      const username = this.normalizeUsernameForLog(player.username);
      // Some room implementations keep a "ghost" seat after a disconnect/leave (id present, name empty).
      // In a started game, we must not keep this seat, otherwise the UI shows "Joueur X" alongside bots.
      if (!username) continue;
      result.push({
        id: pid,
        username,
        isBot: false,
      });
    }
    const roomBots: RoomBotState[] = Array.isArray(payload?.room?.bots)
      ? payload.room.bots
      : [];
    for (const bot of roomBots) {
      const rawId =
        typeof bot?.id === 'number'
          ? bot.id
          : typeof bot?.id === 'string'
            ? Number(bot.id)
            : NaN;
      if (!Number.isFinite(rawId)) continue;
      const pid = -Math.abs(rawId);
      if (pid === 0) continue;
      result.push({
        id: pid,
        username:
          this.normalizeUsernameForLog(bot.name) || `Bot ${Math.abs(pid)}`,
        isBot: true,
      });
    }
    return result;
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

    const meta = this.toMetadata(state);
    if (Object.keys(meta).length === 0) {
      return state;
    }

    // Certains jeux peuvent déjà marquer une fin logique via `finishedAt`/`outcomesByPlayerId`
    // sans avoir basculé `status` -> finished (legacy / bug). On force dans ce cas pour
    // déclencher le reset automatique de table côté moteur.
    const finishedAt = this.normalizeMetadataString(meta['finishedAt']);
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
        .map((p) => (typeof p?.id === 'number' && Number.isFinite(p.id) ? p.id : null))
        .filter((id): id is number => id != null),
    );

    const metadata = this.toMetadata(state);

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
    const metadata = this.toMetadata(state);
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
    for (const key of ['winnerId', 'winnerPlayerId', 'winner_id']) {
      const raw = meta[key];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
      }
      if (typeof raw === 'string' && raw.trim().length > 0) {
        const n = Number(raw.trim());
        if (Number.isFinite(n)) {
          return n;
        }
      }
    }

    return null;
  }

  private tryReadOutcomesByPlayerId(
    meta: Record<string, unknown>,
  ): Record<string, 'won' | 'lost'> | null {
    const rawOutcomes = meta.outcomesByPlayerId;
    if (!rawOutcomes || typeof rawOutcomes !== 'object') {
      return null;
    }

    const out: Record<string, 'won' | 'lost'> = {};
    for (const [key, value] of Object.entries(
      rawOutcomes as Record<string, unknown>,
    )) {
      const normalized = this.normalizeMetadataString(value).toLowerCase();
      if (normalized !== 'won' && normalized !== 'lost') {
        continue;
      }
      out[String(key)] = normalized;
    }

    return Object.keys(out).length > 0 ? out : null;
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
    let state = await this.normalizeBotThinking(
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

    state = this.appendFirstTurnAnnouncement(state);

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
      let changed = false;
      if (
        !state ||
        String(state.status ?? '')
          .toLowerCase()
          .trim() !== 'started'
      ) {
        return state;
      }
      let players = state.players ?? [];
      const desiredPlayers = this.buildPlayersFromPayload(payload);
      if (players.length === 0 && desiredPlayers.length === 0) {
        return state;
      }
      if (desiredPlayers.length > 0) {
        const same =
          players.length === desiredPlayers.length &&
          players.every((p, i) => p?.id === desiredPlayers[i]?.id);
        if (!same) {
          players = desiredPlayers;
          changed = true;
        }
      }

      const roomPlayers: RoomPlayer[] = Array.isArray(payload?.room?.players)
        ? payload.room.players
        : [];
      const roomBots: RoomBotState[] = Array.isArray(payload?.room?.bots)
        ? payload.room.bots
        : [];

      const humanById = new Map<number, string>();
      for (const p of roomPlayers) {
        const id = p.id;
        if (!Number.isFinite(id) || id <= 0) continue;
        const username = this.normalizeUsernameForLog(p.username);
        if (!username) continue;
        humanById.set(id, username);
      }

      const roomBotNames = roomBots
        .map((b) => this.normalizeUsernameForLog(b.name))
        .filter((n) => n.length > 0);
      const allowedBotNames = new Set(roomBotNames);

      // Bots "sièges" (id négatif) proviennent de payload.room.bots (GameCoreService buildPlayers).
      // Si un bot est retiré de la room pendant une partie, il doit aussi disparaître du roster du jeu
      // sinon l'exclusion est visuellement sans effet et le bot continue de jouer.
      const allowedBotIds = new Set<number>(
        roomBots
          .map((b) => -Math.abs(b.id))
          .filter((id) => Number.isFinite(id) && id < 0),
      );

      // Bots already present in the game state (initial bots / already replaced seats).
      const assignedBotNames = new Set(
        players
          .filter((p) => p.isBot === true)
          .map((p) => this.normalizeUsernameForLog(p.username))
          .filter((n) => n.length > 0),
      );

      const availableBotNames: string[] = [];
      for (const name of roomBotNames) {
        if (!assignedBotNames.has(name)) {
          availableBotNames.push(name);
        }
      }

      const mappedPlayers = players.map((p) => {
        const id = p.id;
        if (!Number.isFinite(id) || id === 0) return p;

        const roomUsername = humanById.get(id) ?? null;
        const isBot = p.isBot === true;

        // Human is present in room: ensure player is human with correct username.
        if (roomUsername) {
          if (
            isBot ||
            this.normalizeUsernameForLog(p.username) !== roomUsername
          ) {
            changed = true;
            return { ...p, isBot: false, username: roomUsername };
          }
          return p;
        }

        // Human left the room: let an available room bot take over this seat (same id).
        if (!isBot && availableBotNames.length > 0) {
          const botName = availableBotNames.shift()!;
          changed = true;
          return { ...p, isBot: true, username: botName };
        }

        return p;
      });

      // Remove room bots that no longer exist (id < 0 and not in allowedBotIds).
      const filteredPlayers = mappedPlayers.filter((p) => {
        const id = p.id;
        if (!Number.isFinite(id) || id === 0) return true;
        const isBot = p.isBot === true;
        // Stable bot seats are identified by negative ids.
        // Keep/remove them by id only (name may evolve/canonicalize across layers).
        if (id < 0) {
          if (!isBot) return true;
          return allowedBotIds.has(id);
        }
        if (!isBot) return true;
        const name = this.normalizeUsernameForLog(p.username);
        return Boolean(name && allowedBotNames.has(name));
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

      const pendingPlayerId = state.pending?.playerId ?? null;
      if (
        typeof pendingPlayerId === 'number' &&
        pendingPlayerId !== 0 &&
        !nextPlayers.some((p) => p?.id === pendingPlayerId)
      ) {
        changed = true;
        state = {
          ...state,
          pending: state.pending
            ? { ...state.pending, playerId: null }
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

      const meta = this.toMetadata(current);
      const fallbackActorId =
        typeof meta['ownerPlayerId'] === 'number'
          ? meta['ownerPlayerId']
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

      const next = handler.applyActions(current, sanitizedActions);
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
      const lamaMeta = this.toMetadata(state);
      const step = this.normalizeMetadataString(lamaMeta['step']);
      if (step === 'round_pause') {
        const untilMs = this.parseMetadataNumber(lamaMeta['roundPauseUntilMs']);
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
            const latestMeta = this.toMetadata(latest);
            const latestStep = this.normalizeMetadataString(latestMeta['step']);
            if (latestStep !== 'round_pause') return;
            const latestUntilMs = this.parseMetadataNumber(
              latestMeta['roundPauseUntilMs'],
            );
            if (
              typeof untilMs === 'number' &&
              latestUntilMs !== null &&
              latestUntilMs !== untilMs
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
      const mnemoMeta = this.toMetadata(state);
      const configMeta = this.getMetadataObject(mnemoMeta, 'config');
      const useTimer = configMeta?.['useTimer'] === true;
      const untilMs = this.parseMetadataNumber(mnemoMeta['quizDeadlineAtMs']);
      const questionMeta = this.getMetadataObject(mnemoMeta, 'currentQuestion');
      const questionId =
        questionMeta && typeof questionMeta['id'] === 'string'
          ? questionMeta['id']
          : null;
      const interUntilMs = this.parseMetadataNumber(
        mnemoMeta['interQuestionUntilMs'],
      );

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
            const latestMeta = this.toMetadata(latest);
            const latestQuestionMeta = this.getMetadataObject(
              latestMeta,
              'currentQuestion',
            );
            if (
              latestQuestionMeta &&
              typeof latestQuestionMeta['id'] === 'string'
            ) {
              return;
            }
            const latestInterUntilMs = this.parseMetadataNumber(
              latestMeta['interQuestionUntilMs'],
            );
            if (latestInterUntilMs === null) return;
            if (latestInterUntilMs !== interUntilMs) return;
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
            const latestMeta = this.toMetadata(latest);
            const latestConfigMeta = this.getMetadataObject(
              latestMeta,
              'config',
            );
            if (latestConfigMeta?.['useTimer'] !== true) return;
            const latestQuestionMeta = this.getMetadataObject(
              latestMeta,
              'currentQuestion',
            );
            if (
              !latestQuestionMeta ||
              typeof latestQuestionMeta['id'] !== 'string'
            ) {
              return;
            }
            if (latestQuestionMeta['id'] !== questionId) return;
            const latestDeadline = this.parseMetadataNumber(
              latestMeta['quizDeadlineAtMs'],
            );
            if (latestDeadline !== null && latestDeadline !== untilMs) {
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
    const meta = this.toMetadata(state);
    const immediateStart = meta['botImmediateStartPending'] === true;
    const pending = state.pending ?? null;
    const pendingType =
      typeof pending?.type === 'string'
        ? pending.type.trim().toLowerCase()
        : '';
    const isQuizPending =
      gameType === 'arche-de-mnemosyne' && pending?.type === 'quiz';
    const configMeta = this.getMetadataObject(meta, 'config');
    const quizTimerSeconds =
      isQuizPending &&
      configMeta &&
      typeof configMeta['timerSeconds'] === 'number'
        ? Number(configMeta['timerSeconds'])
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
    }
    if (isQuizPending && quizTimerMs != null) {
      delayMs = Math.min(delayMs, quizTimerMs);
    }
    const stateForSchedule = immediateStart
      ? {
          ...state,
          metadata: { ...meta, botImmediateStartPending: false },
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
          await this.scheduleBotTurn(roomId, gameType, latest);
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

  private buildInitialState(
    payload: RoomPayload,
    gameType: string,
  ): GameStateEntity {
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
    const status = String(state.status ?? '')
      .toLowerCase()
      .trim();
    if (status !== 'started') return state;

    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const pending = state.pending ?? null;
    const pendingPlayerId =
      typeof pending?.playerId === 'number' ? pending.playerId : null;
    const blockingPending = pending?.blocking === true;
    if (blockingPending && pendingPlayerId != null) {
      // Les jeux avec setup bloquant (choix de pion/config propriétaire) gardent leur acteur pending.
      return state;
    }

    const starterMeta = this.toMetadata(state);
    if (starterMeta['starterChosenAfterPawnSelection'] === true) {
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
    const status = String(state.status ?? '')
      .toLowerCase()
      .trim();
    if (status !== 'started') {
      return state;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (
      typeof currentPlayerId !== 'number' ||
      !Number.isFinite(currentPlayerId)
    ) {
      return state;
    }
    const pending = state.pending ?? null;
    const pendingType = String(pending?.type ?? '')
      .trim()
      .toLowerCase();

    const players = Array.isArray(state.players) ? state.players : [];
    const name =
      this.normalizeUsernameForLog(
        players.find((p) => p?.id === currentPlayerId)?.username,
      ) || `Joueur ${currentPlayerId}`;

    const log = Array.isArray(state.log) ? state.log : [];
    const recentMessages = log.slice(-6).map((entry) =>
      String(entry?.message ?? '').trim(),
    );
    if (pendingType === 'choose_pawn' || pendingType === 'pick_pawn') {
      const expectedPromptToken = `prompt:choose-pawn:${normalizePromptToken(name)}`;
      const hasSamePrompt = recentMessages.some(
        (message) => extractPawnPromptToken(message) === expectedPromptToken,
      );
      const turnAnnouncement = `C'est au tour de ${name}.`;
      const cleaned = this.removeRecentExactLogMessage(state, turnAnnouncement);
      if (hasSamePrompt) {
        return cleaned;
      }
      return this.core.appendLog(
        cleaned,
        `C'est à ${name} de choisir son pion.`,
      );
    }

    if (
      recentMessages.some((message) =>
        message.toLowerCase().startsWith("c'est au tour de "),
      )
    ) {
      return state;
    }

    return this.core.appendLog(state, `C'est au tour de ${name}.`);
  }

  private removeRecentExactLogMessage(
    state: GameStateEntity,
    expectedMessage: string,
  ): GameStateEntity {
    const log = Array.isArray(state.log) ? [...state.log] : [];
    for (let i = log.length - 1; i >= 0 && i >= log.length - 6; i -= 1) {
      const message =
        typeof log[i]?.message === 'string' ? String(log[i].message).trim() : '';
      if (message !== expectedMessage) continue;
      log.splice(i, 1);
      return { ...state, log };
    }
    return state;
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

    const metadata = this.toMetadata(state);
    const finishedAt = this.normalizeMetadataString(metadata['finishedAt']);
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

    const expectedFinishedAt = this.normalizeMetadataString(
      this.toMetadata(state)['finishedAt'],
    );

    this.botScheduler.schedule({
      key: systemKey,
      delayMs: GameEngineService.FINISHED_STATE_GRACE_MS,
      roomId,
      gameType,
      run: async () => {
        await this.enqueueMutation(
          this.buildKey(roomId, gameType),
          async () => {
            const latest = (await this.store.get(roomId, gameType)) ?? null;
            if (!latest) return;
            if (String(latest.status ?? '').toLowerCase() !== 'finished') {
              return;
            }

            const latestFinishedAt = this.normalizeMetadataString(
              this.toMetadata(latest)['finishedAt'],
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
        );
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
    const handler = this.registry.getHandler(gameType);
    // `botThinking` doit refléter un bot réellement actionnable.
    // Sinon, on bloque les humains avec "Un bot joue..." alors qu'aucune action bot n'est possible
    // (ex: pending bloquant pour un humain pendant setup).
    const actionableBotId = this.getBotActorIdForState(state, handler);
    const isBot = actionableBotId != null || (botTurn === true && !handler);
    const now = GameEngineService.nowMs();
    const marked = {
      ...this.store.markBotThinking(state, isBot),
      botThinkingSince: isBot ? now : null,
    };
    await this.store.set(roomId, gameType, marked, { asyncPersist: true });
    return marked;
  }

  private async normalizeBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<GameStateEntity> {
    const since =
      typeof state.botThinkingSince === 'number'
        ? state.botThinkingSince
        : null;
    if (!state.botThinking) {
      return state;
    }
    if (since == null) {
      const patched = {
        ...state,
        botThinkingSince: GameEngineService.nowMs(),
      };
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
      ...state,
      botThinking: false,
      botThinkingSince: null,
    };
    await this.store.set(roomId, gameType, cleared, { asyncPersist: true });
    return cleared;
  }

  private async validateActions(
    state: GameStateEntity,
    handler: GameRulesAdapter | undefined,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): Promise<GameSingleActionDto[]> {
    const ctx = this.toMetadata(state);
    const ctxGameType =
      typeof ctx['gameType'] === 'string' ? ctx['gameType'] : null;
    const ctxRoomId = this.parseMetadataNumber(ctx['roomId']);
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
    const withLabel = this.attachTurnLabel(exposed, label);
    const withDescriptors = this.attachCanonicalPositionPanel(
      this.attachUiDescriptors(
        this.gridRender.attachGridRenderDescriptors(
          this.attachCurrentPlayerView(withLabel),
        ),
      ),
      state,
      null,
    );
    const withLifecycle = this.attachStartLifecycle(withDescriptors);
    return fixMojibakeDeep(this.stripBoardAndGridIfNotStarted(withLifecycle));
  }

  private stripBoardAndGridIfNotStarted(
    state: GameStateWithActions,
  ): GameStateWithActions {
    const status = String(state?.status ?? '')
      .toLowerCase()
      .trim();
    if (status === 'started') return state;

    const extras = GameEngineService.extractExtras(state);
    const nextExtras = { ...extras };
    if (nextExtras.grid !== undefined) {
      delete nextExtras.grid;
    }

    const out = {
      ...state,
      actions: [],
      pending: null,
      extras: nextExtras,
    } as GameStateWithActions & Record<string, unknown>;
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

    const extras = GameEngineService.extractExtras(state);

    // Si le jeu a déjà défini currentPlayerView, on ne l'écrase pas
    if (extras['currentPlayerView'] !== undefined) return state;

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
    _gameType: string,
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

      const prevMeta = this.toMetadata(previous);
      const nextMeta = this.toMetadata(next);

      const tiles = Array.isArray(nextMeta['tiles'])
        ? (nextMeta['tiles'] as Record<string, unknown>[])
        : [];
      const prevPositions =
        this.getMetadataObject(prevMeta, 'positions') ??
        ({} as Record<string, unknown>);
      const nextPositions =
        this.getMetadataObject(nextMeta, 'positions') ??
        ({} as Record<string, unknown>);

      if (tiles.length === 0) {
        return next;
      }

      const players = Array.isArray(next.players) ? next.players : [];
      type PlayerMovement = {
        id: number;
        username: string;
        prevPos: number | null;
        nextPos: number | null;
      };
      const changed = players
        .map<PlayerMovement | null>((p) => {
          if (!p || typeof p.id !== 'number') return null;
          const username =
            this.normalizeUsernameForLog(p.username) || `joueur ${p.id}`;
          const prevRaw = prevPositions[String(p.id)];
          const nextRaw = nextPositions[String(p.id)];
          const prevPos =
            typeof prevRaw === 'number' ? prevRaw : Number(prevRaw);
          const nextPos =
            typeof nextRaw === 'number' ? nextRaw : Number(nextRaw);
          return {
            id: p.id,
            username,
            prevPos: Number.isFinite(prevPos) ? Math.trunc(prevPos) : null,
            nextPos: Number.isFinite(nextPos) ? Math.trunc(nextPos) : null,
          };
        })
        .filter(
          (p): p is PlayerMovement =>
            p != null &&
            p.nextPos != null &&
            p.prevPos != null &&
            p.nextPos !== p.prevPos,
        )
        .sort((a, b) => a.id - b.id);

      if (changed.length === 0) {
        return next;
      }

      let out = next;
      for (const p of changed) {
        const idx = p.nextPos as number;
        if (idx < 0 || idx >= tiles.length) {
          continue;
        }

        const tile = tiles[idx] ?? {};
        const labelRaw = this.normalizeMetadataString(tile['label']);
        const titleRaw = this.normalizeMetadataString(
          tile['title'] ?? tile['name'],
        );
        const descriptionRaw = this.normalizeMetadataString(
          tile['description'],
        );

        const caseNumber = idx + 1;
        const label = labelRaw || titleRaw ? labelRaw || titleRaw : '';
        const desc = descriptionRaw ? ` ${descriptionRaw}` : '';

        const name = p.username || `joueur ${p.id}`;

        // Éviter les doublons évidents : si la dernière entrée mentionne déjà l'arrivée sur cette case.
        const recentMsgs = (() => {
          const log = Array.isArray(out.log) ? out.log : [];
          const msgs: string[] = [];
          for (let i = log.length - 1; i >= 0 && msgs.length < 4; i -= 1) {
            const entry = log[i];
            const msg = entry?.message;
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

        const gameTypeRaw = this.normalizeMetadataString(nextMeta['gameType']);
        const isContes = gameTypeRaw === 'contes-et-cacahuetes';

        if (
          label &&
          (/^case\\s+\\d+/i.test(label) || (isContes && /^case\s+/i.test(label)))
        ) {
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
      const meta = this.toMetadata(state);
      const turnFlow =
        this.getMetadataObject(meta, 'turnFlow') ??
        ({} as Record<string, unknown>);
      const skippedRaw = turnFlow['skipped'];
      const skipped = Array.isArray(skippedRaw)
        ? (skippedRaw as unknown[])
        : [];
      if (!skipped.length) {
        return state;
      }

      const currentPlayerId = state.turn?.currentPlayerId ?? null;
      const currentPlayer =
        currentPlayerId != null
          ? (state.players?.find((p) => p?.id === currentPlayerId) ?? null)
          : null;
      const currentName = this.normalizeUsernameForLog(currentPlayer?.username);
      const expectedTurnAnnouncement = currentName
        ? `C'est au tour de ${currentName}.`
        : null;

      let out = state;
      const existingLog = Array.isArray(state.log) ? [...state.log] : [];
      const lastEntry =
        existingLog.length > 0 ? existingLog[existingLog.length - 1] : null;
      const lastMessage =
        lastEntry && typeof lastEntry.message === 'string'
          ? String(lastEntry.message).trim()
          : '';
      const shouldMoveTurnAnnouncement =
        expectedTurnAnnouncement != null &&
        lastMessage === expectedTurnAnnouncement;
      if (shouldMoveTurnAnnouncement) {
        existingLog.pop();
        out = {
          ...out,
          log: existingLog,
        };
      }

      for (const entry of skipped) {
        if (!entry || typeof entry !== 'object') continue;
        const data = entry as Record<string, unknown>;
        const id = typeof data['id'] === 'number' ? data['id'] : null;
        if (id == null) continue;
        const remaining =
          typeof data['remainingAfter'] === 'number'
            ? data['remainingAfter']
            : 0;
        const player = out.players?.find((p) => p?.id === id) ?? null;
        const name = this.normalizeUsernameForLog(player?.username);
        const who = name ? name : `joueur ${id}`;
        const suffix = remaining > 0 ? ` (${remaining} restant)` : '';
        out = this.core.appendLog(out, `${who} passe son tour${suffix}.`);
      }

      if (shouldMoveTurnAnnouncement) {
        out = this.core.appendLog(out, expectedTurnAnnouncement!);
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
    const extras = GameEngineService.extractExtras(state);

    // Ne pas écraser si un jeu a déjà défini ces champs.
    if (extras['viewerPlayerId'] !== undefined) return state;

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

    const extrasNow = GameEngineService.extractExtras(state);
    const uiExistingNow = GameEngineService.extractUi(extrasNow);
    const uiNow = uiExistingNow ? { ...uiExistingNow } : {};
    const panelsExistingNow = GameEngineService.extractPanels(uiExistingNow);
    const panelsNow = panelsExistingNow ? { ...panelsExistingNow } : {};
    const existingTurn = panelsNow['turn'] as
      | Record<string, unknown>
      | undefined;
    const existingTurnMessage =
      existingTurn && typeof existingTurn['message'] === 'string'
        ? existingTurn['message']
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

    uiNow['panels'] = panelsNow;
    const stateWithTurnPanel: GameStateWithActions = {
      ...state,
      extras: {
        ...extrasNow,
        ui: uiNow,
      },
    };

    const extrasAfter = GameEngineService.extractExtras(stateWithTurnPanel);
    const uiExisting = GameEngineService.extractUi(extrasAfter);
    const ui = uiExisting ? { ...uiExisting } : {};
    const panelsExisting = GameEngineService.extractPanels(uiExisting);
    const panels = panelsExisting ? { ...panelsExisting } : {};
    const hasGameDefinedPanels = Object.keys(panels).some((id) => id !== 'turn');
    const currentPlayerView =
      (extrasAfter['currentPlayerView'] as CurrentPlayerView | null) ?? null;
    const metadata =
      stateWithTurnPanel.metadata &&
      typeof stateWithTurnPanel.metadata === 'object'
        ? (stateWithTurnPanel.metadata as Record<string, unknown>)
        : {};
    const upsertPanel = (id: string, title: string, message: string) => {
      if (!id || !title || !message) return;

      const existing = panels[id] as Record<string, unknown> | undefined;
      const existingMessage =
        existing && typeof existing['message'] === 'string'
          ? existing['message']
          : null;
      const hasMessage =
        typeof existingMessage === 'string' &&
        existingMessage.trim().length > 0;
      if (hasMessage) return;

      panels[id] = { title, message };
    };

    const buildListMessage = (title: string, itemsRaw: unknown) => {
      const items = Array.isArray(itemsRaw)
        ? itemsRaw.map((x) => this.normalizeMetadataString(x)).filter((x) => x)
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
      const t = this.normalizeMetadataString(text);
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

    if (
      !hasGameDefinedPanels &&
      currentPlayerView &&
      typeof currentPlayerView === 'object'
    ) {
      upsertPanel(
        'shopping',
        'Shopping list',
        buildListMessage('Shopping list', currentPlayerView.shoppingList),
      );
      upsertPanel(
        'basket',
        'Panier',
        buildListMessage('Panier', currentPlayerView.basket),
      );
      upsertPanel(
        'inventory',
        'Inventaire',
        buildListMessage('Inventaire', currentPlayerView.inventory),
      );
      upsertPanel(
        'stable',
        'Écurie',
        buildJoinedLinesMessage('Écurie', currentPlayerView.stable),
      );
      upsertPanel(
        'position',
        'Position',
        buildJoinedLinesMessage('Position', currentPlayerView.position),
      );
    }

    if (!hasGameDefinedPanels) {
      upsertPanel(
        'score',
        'Score',
        buildListMessage('Score', extrasAfter['score']),
      );
      upsertPanel('hand', 'Main', buildListMessage('Main', extrasAfter['hand']));
      upsertPanel(
        'books',
        'Familles',
        buildListMessage('Familles', extrasAfter['books']),
      );
    }

    const pollution =
      typeof metadata['pollution'] === 'number' ? metadata['pollution'] : null;
    const maxPollution =
      typeof metadata['maxPollution'] === 'number'
        ? metadata['maxPollution']
        : null;

    if (!hasGameDefinedPanels && (pollution !== null || maxPollution !== null)) {
      let message = 'Pollution: inconnue.';
      if (pollution !== null && maxPollution !== null)
        message = `Pollution: ${pollution}/${maxPollution}.`;
      else if (pollution !== null) message = `Pollution: ${pollution}.`;
      else if (maxPollution !== null)
        message = `Pollution max: ${maxPollution}.`;

      upsertPanel('pollution', 'Pollution', message);
    }

    ui['panels'] = panels;
    return {
      ...stateWithTurnPanel,
      extras: {
        ...extrasAfter,
        ui,
      },
    };
  }

  private attachStartLifecycle(
    state: GameStateWithActions,
    userId?: number,
  ): GameStateWithActions {
    const status = String(state?.status ?? '')
      .toLowerCase()
      .trim();
    const pendingType = String(state?.pending?.type ?? '')
      .toLowerCase()
      .trim();
    const currentPlayerId =
      typeof state?.turn?.currentPlayerId === 'number'
        ? state.turn.currentPlayerId
        : null;
    const hasActions =
      Array.isArray(state?.actions) && state.actions.length > 0;
    const botThinking = state?.botThinking === true;

    const pendingPlayerIdRaw = state?.pending?.playerId;
    const pendingPlayerId =
      typeof pendingPlayerIdRaw === 'number'
        ? pendingPlayerIdRaw
        : Number(pendingPlayerIdRaw);
    const viewerPendingTurn =
      userId != null &&
      Number.isFinite(pendingPlayerId) &&
      pendingPlayerId === userId;
    const viewerPendingFallback =
      userId != null &&
      !Number.isFinite(pendingPlayerId) &&
      currentPlayerId != null &&
      currentPlayerId === userId;

    const started = status === 'started';
    const hasConfigPrompt =
      pendingType === 'config_prompt' || pendingType.endsWith('_set_config');
    const startReady = started && !hasConfigPrompt;
    const viewerMustChoosePawn =
      userId != null &&
      started &&
      this.isPawnPendingType(pendingType) &&
      (viewerPendingTurn || viewerPendingFallback);
    const viewerTurnActionable =
      userId != null &&
      started &&
      currentPlayerId != null &&
      currentPlayerId === userId &&
      hasActions &&
      !botThinking &&
      !viewerMustChoosePawn;

    const metadataRaw =
      state?.metadata && typeof state.metadata === 'object'
        ? (state.metadata as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const lifecycleRaw =
      metadataRaw['lifecycle'] && typeof metadataRaw['lifecycle'] === 'object'
        ? (metadataRaw['lifecycle'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const currentStartReady = lifecycleRaw['startReady'];
    const currentViewerTurnActionable = lifecycleRaw['viewerTurnActionable'];
    const currentViewerMustChoosePawn = lifecycleRaw['viewerMustChoosePawn'];
    if (
      typeof currentStartReady === 'boolean' &&
      currentStartReady === startReady &&
      typeof currentViewerTurnActionable === 'boolean' &&
      currentViewerTurnActionable === viewerTurnActionable &&
      typeof currentViewerMustChoosePawn === 'boolean' &&
      currentViewerMustChoosePawn === viewerMustChoosePawn
    ) {
      return state;
    }

    return {
      ...state,
      metadata: {
        ...metadataRaw,
        lifecycle: {
          ...lifecycleRaw,
          startReady,
          viewerTurnActionable,
          viewerMustChoosePawn,
        },
      },
    };
  }

  private isPawnPendingType(pendingType: string): boolean {
    const normalized = String(pendingType ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'choose_pawn' || normalized === 'pick_pawn';
  }

  private isRoomNotFound(err: unknown): boolean {
    if (err instanceof NotFoundException) return true;
    const message = this.normalizeMetadataString(
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

  private static extractExtras(
    state: GameStateWithActions | GameStateEntity | null | undefined,
  ): Record<string, unknown> {
    if (!state) {
      return {};
    }
    const candidate =
      'extras' in state ? (state as { extras?: unknown }).extras : undefined;
    if (
      candidate &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate)
    ) {
      return candidate as Record<string, unknown>;
    }
    return {};
  }

  private static extractUi(
    extras: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const uiRaw = extras['ui'];
    if (uiRaw && typeof uiRaw === 'object' && !Array.isArray(uiRaw)) {
      return uiRaw as Record<string, unknown>;
    }
    return null;
  }

  private static extractPanels(
    ui: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!ui) {
      return null;
    }
    const panelsRaw = ui['panels'];
    if (
      panelsRaw &&
      typeof panelsRaw === 'object' &&
      !Array.isArray(panelsRaw)
    ) {
      return panelsRaw as Record<string, unknown>;
    }
    return null;
  }

  private static extractPanelMessage(
    panel: Record<string, unknown> | undefined,
  ): string {
    if (!panel) {
      return '';
    }
    const message = panel['message'];
    return typeof message === 'string' ? message.trim() : '';
  }
}
