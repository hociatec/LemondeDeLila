import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../core/services/game-core.service';
import {
  GameStateEntity,
  PendingState,
} from '../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
import { GameStateWithActions } from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import { TurnService } from '../../../modules/turn/services/turn.service';
import {
  DeckPoolService,
  DeckPoolState,
} from '../../../modules/cards/services/deck-pool.service';
import { BoardMovementService } from '../../../modules/board/services/board-movement.service';
import { TileEffectRegistryService } from '../../../modules/effects/services/tile-effect-registry.service';
import { TurnActionsService } from '../../../modules/turn/services/turn-actions.service';
import { StandEffectRegistryService } from '../../../modules/effects/services/stand-effect-registry.service';
import { ActionResolverService } from '../../../modules/action-resolver/services/action-resolver.service';
import { TurnStatusService } from '../../../modules/turn/services/turn-status.service';
import {
  QuizRunnerService,
  QuizQuestion,
} from '../../../modules/quiz/services/quiz-runner.service';
import { VictoryService } from '../../../modules/victory/services/victory.service';
import { BotRunnerService } from '../../../modules/bot/services/bot-runner.service';
import { ActionLogService } from '../../../modules/actionlog/services/action-log.service';
import {
  PanierExpressMetadata,
  PanierExpressTile,
  PanierExpressPlayer,
  PanierExpressDeckPool,
} from './model/panier-express-state.entity';
import { PANIER_EXPRESS_PHASES } from './definitions/rules.definition';
import { PANIER_EXPRESS_VICTORY } from './definitions/victory.definition';
import { playingLog } from '../../../../common/utils/playing-logger';
import { PanierExpressSetupService } from './setup/panier-express-setup.service';
import { PanierExpressDrawService } from './actions/panier-express-draw.service';
import { PanierExpressQuizService } from './actions/panier-express-quiz.service';
import { PanierExpressExchangeService } from './actions/panier-express-exchange.service';
import { PanierExpressUtils } from './model/panier-express-utils.service';
import * as PanierExpressRulebook from './rulebook/rulebook';
import { PanierExpressBotService } from './bots/panier-express-bot.service';
import { PanierExpressPhaseService } from './phases/panier-express-phase.service';
import { PanierExpressPresenterService } from './presenter/panier-express-presenter.service';
import { RandomService } from '../../../modules/random/services/random.service';

@Injectable()
export class PanierExpressService extends AbstractGameService {
  readonly gameType = 'panier-express';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = 'Panier Express';
  readonly description =
    'Course au marché : compléter sa liste puis revenir pile sur la case départ.';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;
  private readonly phaseOrder = PANIER_EXPRESS_PHASES;

  constructor(
    registry: GameRegistryService,
    private readonly core: GameCoreService,
    private readonly turns: TurnService,
    private readonly deckPool: DeckPoolService,
    private readonly movement: BoardMovementService,
    private readonly tileRegistry: TileEffectRegistryService<
      GameStateEntity,
      { playerId: number; tile: PanierExpressTile }
    >,
    private readonly turnActions: TurnActionsService,
    private readonly standEffects: StandEffectRegistryService<GameStateEntity>,
    private readonly resolver: ActionResolverService,
    private readonly turnStatus: TurnStatusService,
    private readonly victory: VictoryService,
    private readonly botRunner: BotRunnerService,
    private readonly actionLogSvc: ActionLogService,
    private readonly setup: PanierExpressSetupService,
    private readonly drawSvc: PanierExpressDrawService,
    private readonly quizSvc: PanierExpressQuizService,
    private readonly quizRunner: QuizRunnerService,
    private readonly exchangeSvc: PanierExpressExchangeService,
    private readonly utils: PanierExpressUtils,
    private readonly bots: PanierExpressBotService,
    private readonly phaseFlow: PanierExpressPhaseService,
    private readonly presenter: PanierExpressPresenterService,
    private readonly random: RandomService,
  ) {
    super(registry);
  }

  onModuleInit(): void {
    super.onModuleInit();
    this.registerTileHandlers();
    this.registerStandHandlers();
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const ensured = this.ensureMetadata(state);
    const currentId = ensured.turn?.currentPlayerId ?? null;
    const current = (ensured.players ?? []).find((p) => p.id === currentId);
    const isBot = current?.isBot === true;
    const actions =
      !isBot && typeof currentId === 'number'
        ? this.getAvailableActions(ensured, currentId)
        : [];
    const meta = this.getMetadata(ensured);
    const rawPending: PendingState | null = ensured.pending ?? null;
    const pendingQuiz: QuizQuestion | undefined =
      typeof currentId === 'number'
        ? (meta.quiz.pending[currentId] ?? undefined)
        : undefined;
    return this.presenter.exposeState({
      state: ensured,
      actions,
      rawPending,
      pendingQuiz,
      currentId,
    });
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const ensured = this.ensureMetadata(state);

    const viewerId =
      typeof userId === 'number' &&
      (ensured.players ?? []).some((p) => p && p.id === userId)
        ? userId
        : null;

    const actions =
      typeof viewerId === 'number'
        ? this.getAvailableActions(ensured, viewerId)
        : [];
    const meta = this.getMetadata(ensured);
    const rawPending: PendingState | null = ensured.pending ?? null;
    const pendingQuiz: QuizQuestion | undefined =
      typeof viewerId === 'number'
        ? (meta.quiz.pending[viewerId] ?? undefined)
        : undefined;

    return this.presenter.exposeState({
      state: ensured,
      actions,
      rawPending,
      pendingQuiz,
      currentId: viewerId,
    });
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = (baseState.status || '').toLowerCase();
    const players = baseState.players ?? [];
    const inProgress =
      status === 'finished' ||
      (typeof baseState.turnIndex === 'number' && baseState.turnIndex > 0) ||
      players.some((p) => {
        const hasList =
          Array.isArray(p.shoppingList) && p.shoppingList.length > 0;
        const hasBasket = Array.isArray(p.basket) && p.basket.length > 0;
        const hasInventory =
          Array.isArray(p.inventory) && p.inventory.length > 0;
        return hasList || hasBasket || hasInventory;
      });
    if (inProgress) {
      // Partie déjà démarrée ou en reprise : ne pas réattribuer de listes ni de decks, juste normaliser.
      return this.ensureMetadata({
        ...baseState,
        status: baseState.status ?? 'started',
      });
    }

    const existingMeta = (baseState.metadata as PanierExpressMetadata) ?? null;
    const baseMeta = this.buildMetadata(baseState);
    // Conserver les decks existants si présents (évite de réattribuer de nouvelles listes).
    const metadata: PanierExpressMetadata = {
      ...baseMeta,
      ...(existingMeta ?? {}),
      decks: existingMeta?.decks
        ? { ...baseMeta.decks, ...existingMeta.decks }
        : baseMeta.decks,
    };
    const shoppingDeck = this.extractShoppingLists(metadata);
    const pawns = this.setup.pawns();
    const hydratedPlayers = players.map((p, idx) => {
      const username = (p.username ?? '').toLowerCase();
      const isBot = p.isBot === true || username.includes('bot');
      const hasList =
        Array.isArray(p.shoppingList) && p.shoppingList.length > 0;
      const list: string[] = hasList
        ? this.toStringArray(p.shoppingList)
        : (shoppingDeck[idx] ?? this.buildShoppingList());
      const pawn =
        typeof (p as any)?.pawn === 'string' && String((p as any).pawn).trim()
          ? String((p as any).pawn).trim()
          : pawns.length
            ? pawns[idx % pawns.length]
            : undefined;
      return {
        ...p,
        isBot,
        basket: Array.isArray(p.basket)
          ? p.basket.map((item) => String(item))
          : [],
        inventory: Array.isArray(p.inventory)
          ? p.inventory.map((item) => String(item))
          : [],
        shoppingList: list,
        pawn,
      };
    });
    const positions: Record<number, number> = {};
    hydratedPlayers.forEach((p) => {
      positions[p.id] = 0;
    });
    const initial: GameStateEntity = {
      ...baseState,
      players: hydratedPlayers,
      status: baseState.status ?? 'open',
      metadata: {
        ...baseState.metadata,
        category: this.category,
        subcategory: this.subcategory,
        ...metadata,
        positions,
      },
    };
    // Journaliser la liste attribuée à chaque joueur dès le lancement.
    let withLogs: GameStateEntity = initial;
    hydratedPlayers.forEach((p, idx) => {
      const originalPlayer = (baseState.players ?? [])[idx];
      const hadList =
        Array.isArray(originalPlayer?.shoppingList) &&
        originalPlayer.shoppingList.length > 0;
      if (hadList) {
        return; // ne pas relogger une liste déjà attribuée (évite l'impression de réinitialisation).
      }
      const normalizedList = this.toStringArray(p.shoppingList);
      const list: string[] = normalizedList.length
        ? normalizedList
        : (shoppingDeck[idx] ?? []);
      const label = (p.username ?? '').trim() || 'Joueur ' + p.id;
      withLogs = this.core.appendLog(
        withLogs,
        '[Panier Express] ' +
          label +
          ' re\u00e7oit une liste de courses: ' +
          list.join(', '),
      );
    });
    return withLogs;
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    let next = this.ensureMetadata(state);
    next = this.ensureStarted(next);
    next = this.resolver.apply(next, actions, (s, a) =>
      this.dispatchAction(s, a),
    );
    next = this.phaseFlow.advancePhases(next);
    // Signaler au moteur si un bot doit jouer au prochain tick.
    const current = next.turn?.currentPlayerId ?? null;
    const isBot =
      (next.players ?? []).find((p) => p.id === current)?.isBot ?? false;
    next = { ...next, botThinking: Boolean(isBot) };
    return next;
  }

  private dispatchAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (!action?.type) return state;
    switch (action.type) {
      case 'roll':
        return this.handleRoll(state, action);
      case 'answer_quiz':
        return this.handleAnswerQuiz(state, action);
      case 'pick_choice':
        return this.handlePickChoice(state, action);
      case 'exchange_choose_target':
        return this.handleExchangeChooseTarget(state, action);
      case 'exchange_choose_give':
        return this.handleExchangeChooseGive(state, action);
      case 'exchange_accept':
        return this.handleExchangeAccept(state, action);
      case 'exchange_refuse':
        return this.handleExchangeRefuse(state, action);
      case 'skip_turn':
        return this.handleSkipTurn(state, action);
      // Compat actions depuis le client Java
      case 'ROLL_DICE':
        return this.handleRoll(state, { ...action, type: 'roll' });
      default:
        return this.core.appendLog(
          state,
          `[Panier Express] Action non gérée: ${action.type}`,
        );
    }
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const ensured = this.ensureMetadata(state);
    return this.bots.getBotActions(
      ensured,
      this.getMetadata(ensured),
      botPlayerId,
    );
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return PanierExpressRulebook.getAvailableActions(
      this.ensureMetadata(state),
      playerId,
    );
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return PanierExpressRulebook.validateAction(
      this.ensureMetadata(state),
      action,
      actorId,
    );
  }

  private buildMetadata(baseState: GameStateEntity): PanierExpressMetadata {
    return {
      stands: this.standIds(),
      tiles: this.setup.buildTiles(),
      decks: this.setup.buildDeckPool(baseState),
      positions: {},
      laps: {},
      winnerId: null,
      quiz: { pending: {} },
      actionLog: [],
      botProfile: 'greedy',
      movementDirection: 1,
      movementDirectionOwnerId: null,
      discards: { courses: [] },
      statuses: {
        skipTurn: {},
        keepTurn: {},
        revealInventory: {},
      },
    };
  }

  private standIds(): string[] {
    const ids = new Set<string>();
    this.setup
      .buildTiles()
      .filter((tile) => tile.type === 'stand')
      .forEach((tile) => ids.add(tile.standId));
    return Array.from(ids.values());
  }

  private buildTiles(): PanierExpressTile[] {
    return this.setup.buildTiles();
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    const normalizedPlayers = this.utils.normalizePlayers(state.players);
    const merged = this.mergeMetadataWithDefaults(state);
    const metadata = this.hydrateMetadataCollections(
      state,
      merged,
      normalizedPlayers,
    );
    return { ...state, metadata, players: normalizedPlayers };
  }

  private mergeMetadataWithDefaults(
    state: GameStateEntity,
  ): PanierExpressMetadata {
    const defaults = this.buildMetadata(state);
    const existing = (state.metadata as PanierExpressMetadata) ?? null;
    if (!existing) {
      return defaults;
    }
    return {
      ...defaults,
      ...existing,
      decks: this.mergeDecks(defaults.decks, existing.decks),
      positions: { ...defaults.positions, ...(existing.positions ?? {}) },
      laps: { ...defaults.laps, ...(existing.laps ?? {}) },
      quiz: existing.quiz ?? defaults.quiz,
      actionLog: existing.actionLog ?? defaults.actionLog,
      botProfile: existing.botProfile ?? defaults.botProfile,
      statuses: this.mergeStatuses(defaults.statuses, existing.statuses),
    };
  }

  private hydrateMetadataCollections(
    state: GameStateEntity,
    meta: PanierExpressMetadata,
    players: PanierExpressPlayer[],
  ): PanierExpressMetadata {
    const decks = meta.decks ?? this.setup.buildDeckPool(state);
    const quiz = meta.quiz;
    const statuses = this.mergeStatuses(
      { skipTurn: {}, keepTurn: {}, revealInventory: {} },
      meta.statuses,
    );
    const positions = this.ensurePlayerPositions(meta.positions, players);
    const actionLog = Array.isArray(meta.actionLog) ? meta.actionLog : [];
    const laps = this.ensurePlayerLaps(meta.laps, players);
    const discards: PanierExpressMetadata['discards'] = {
      courses: Array.isArray(meta.discards?.courses)
        ? meta.discards?.courses.map((v) => String(v))
        : [],
    };
    const movementDirection =
      meta.movementDirection === -1 || meta.movementDirection === 1
        ? meta.movementDirection
        : 1;
    const movementDirectionOwnerId =
      typeof meta.movementDirectionOwnerId === 'number'
        ? meta.movementDirectionOwnerId
        : null;

    return {
      ...meta,
      decks,
      quiz,
      statuses,
      positions,
      laps,
      actionLog,
      discards,
      movementDirection,
      movementDirectionOwnerId,
    };
  }

  private ensurePlayerLaps(
    laps: Record<number, number> | undefined,
    players: PanierExpressPlayer[],
  ): Record<number, number> {
    const ensured: Record<number, number> = { ...(laps ?? {}) };
    players.forEach((p) => {
      if (typeof ensured[p.id] !== 'number') {
        ensured[p.id] = 0;
      }
      if (ensured[p.id] < -1) {
        ensured[p.id] = -1;
      }
    });
    return ensured;
  }

  private mergeDecks(
    defaults: PanierExpressMetadata['decks'],
    override?: PanierExpressMetadata['decks'],
  ): PanierExpressMetadata['decks'] {
    if (!override) {
      return defaults;
    }
    const merged = { ...defaults };
    Object.keys(override).forEach((key) => {
      merged[key] = override[key];
    });
    return merged;
  }

  private mergeStatuses(
    defaults: PanierExpressMetadata['statuses'],
    override?: PanierExpressMetadata['statuses'],
  ): PanierExpressMetadata['statuses'] {
    return {
      skipTurn: { ...(defaults.skipTurn ?? {}), ...(override?.skipTurn ?? {}) },
      keepTurn: { ...(defaults.keepTurn ?? {}), ...(override?.keepTurn ?? {}) },
      revealInventory: {
        ...(defaults.revealInventory ?? {}),
        ...(override?.revealInventory ?? {}),
      },
    };
  }

  private ensurePlayerPositions(
    positions: Record<number, number> | undefined,
    players: PanierExpressPlayer[],
  ): Record<number, number> {
    const resolved = { ...(positions ?? {}) };
    players.forEach((player) => {
      if (typeof resolved[player.id] !== 'number') {
        resolved[player.id] = 0;
      }
    });
    return resolved;
  }

  private ensureStarted(state: GameStateEntity): GameStateEntity {
    const status = (state.status || '').toLowerCase();
    if (status === 'started') return state;
    if (status !== 'starting') return state; // ne démarre que quand la table l'a explicitement demandé
    const players = state.players ?? [];
    if (players.length < this.minPlayers) return state;
    return {
      ...state,
      status: 'started',
      turnIndex: players.length ? 0 : -1,
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1,
      },
    };
  }

  private handleRoll(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    // Anti-triche: le serveur est la source de vérité pour l'aléatoire (dés).
    // Bonus: RNG seedé dans metadata pour rendre le dé déterministe en debug/tests (si besoin).
    const meta = this.getMetadata(state) as any;
    const rng = this.random.rollDice(meta, 6);
    const roll = rng.roll;
    const direction = state.turn?.direction === -1 ? -1 : 1;
    const signedRoll = roll * direction;

    playingLog('panier.roll', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: action?.meta?.actorId ?? currentId,
      type: action?.type ?? 'roll',
      currentId,
      turnIndex: state.turnIndex,
      roll,
      status: state.status,
    });

    let next = this.core.cloneState(state);
    next.metadata = rng.meta;
    next.lastRoll = roll;
    next = this.core.appendLog(
      next,
      `${this.utils.playerName(state, currentId)} lance le dé : "${roll}"`,
    );
    next = this.appendActionLog(next, currentId, 'roll', { roll });

    // Orchestration : move -> resolve tile -> check blocking -> advance turn
    next = this.movePlayer(next, currentId, signedRoll);
    next = this.resolveTile(next, currentId);

    const metaAfter = this.getMetadata(next);
    const postActions = this.getAvailableActions(next, currentId);
    const hasBlockingQuiz = Boolean(metaAfter.quiz.pending[currentId]);
    const hasBlockingPending = Boolean(next.pending?.blocking);
    const hasBlockingExchange = postActions.some((a) =>
      ['exchange_choose_target', 'exchange_choose_give'].includes(
        (a.type || '').toLowerCase(),
      ),
    );
    const keepTurn = this.turnStatus.getStatus(next, currentId, 'keepTurn');
    if (keepTurn > 0) {
      next = this.turnStatus.setStatus(next, currentId, 'keepTurn', 0);
      return next;
    }

    if (!hasBlockingQuiz && !hasBlockingExchange && !hasBlockingPending) {
      next = this.phaseFlow.advanceTurn(next);
    }
    return next;
  }

  private movePlayer(
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const tiles =
      Array.isArray(meta.tiles) && meta.tiles.length
        ? meta.tiles
        : this.buildTiles();
    const currentPos = meta.positions[playerId] ?? 0;
    const nextPos = this.movement.moveCircular(tiles.length, currentPos, roll);
    const tile = this.movement.tileAt(tiles, nextPos);

    // Tour de plateau : modifier quand le joueur "repasse" par la case départ.
    // - Avancer et dépasser la case départ => +1 (ou plus si gros déplacement)
    // - Reculer et repasser la case départ => -1 (ex: tour 1 -> tour 0)
    const laps = { ...(meta.laps ?? {}) };
    const currentLaps = typeof laps[playerId] === 'number' ? laps[playerId] : 0;
    if (roll != null && roll !== 0 && tiles.length > 0) {
      // Robuste même si |roll| > tiles.length (move_to_stand, effets, etc.).
      // Math.floor gère correctement les valeurs négatives (ex: -1/40 => -1).
      const wraps = Math.floor((currentPos + roll) / tiles.length);
      laps[playerId] = Math.max(-1, currentLaps + wraps);
    } else {
      laps[playerId] = currentLaps;
    }

    const nextMeta: PanierExpressMetadata = {
      ...meta,
      positions: { ...meta.positions, [playerId]: nextPos },
      laps,
    };
    const nextState: GameStateEntity = { ...ensured, metadata: nextMeta };
    const plural = Math.abs(roll) > 1 ? 'cases' : 'case';
    return this.core.appendLog(
      nextState,
      `${this.utils.playerName(state, playerId)} avance de ${roll} ${plural} sur ${this.tileLabel(tile)}`,
    );
  }

  private tileLabel(tile: PanierExpressTile | undefined): string {
    if (!tile) return 'inconnu';
    const fallbackId = tile.id ?? 'inconnu';
    switch (tile.type) {
      case 'start':
        return 'depart';
      case 'rest':
        return 'repos';
      case 'stand':
        return `stand ${this.standLabel(tile.standId)}`;
      case 'event':
        return 'evenement';
      case 'exchange':
        return '\u00e9change';
      case 'quiz':
        return 'quiz';
      case 'move':
        return 'avancer/reculer';
      case 'move_to_stand':
        return "avance jusqu'au prochain stand";
      case 'skip':
        return 'perd un tour';
      case 'bonus_course':
        return 'pioche course bonus';
    }
    return fallbackId;
  }

  private standLabel(standId: string | undefined): string {
    const raw = (standId ?? 'inconnu').trim();
    if (!raw) return 'inconnu';
    const tokenMap: Record<string, string> = {
      legumes: 'l\u00e9gumes',
      ete: '\u00e9t\u00e9',
      maraicher: 'mara\u00eecher',
    };
    return raw
      .split('-')
      .map((token) => tokenMap[token] ?? token)
      .join('-');
  }

  private resolveTile(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const tiles =
      Array.isArray(meta.tiles) && meta.tiles.length
        ? meta.tiles
        : this.buildTiles();
    const position = meta.positions[playerId] ?? 0;
    const tile = tiles[position] ?? null;
    if (!tile) {
      return this.core.appendLog(
        state,
        `[Panier Express] Résolution tuile: aucune tuile en position ${position} pour ${this.utils.playerName(state, playerId)}.`,
      );
    }
    const resolved = this.tileRegistry.apply(tile.type, ensured, {
      playerId,
      tile,
    });
    return resolved;
  }

  private registerTileHandlers(): void {
    this.tileRegistry.register('rest', (s) =>
      this.core.appendLog(s, `[Panier Express] Repos : rien ne se passe.`),
    );
    this.tileRegistry.register('stand', (s, ctx) =>
      this.standEffects.applyStand('stand', s, {
        playerId: ctx.playerId,
        standId: ctx.tile.type === 'stand' ? ctx.tile.standId : 'stand',
        state: s,
      }),
    );
    this.tileRegistry.register('event', (s, ctx) =>
      this.applyEvent(s, ctx.playerId),
    );
    this.tileRegistry.register('exchange', (s, ctx) =>
      this.applyExchange(s, ctx.playerId),
    );
    this.tileRegistry.register('quiz', (s, ctx) =>
      this.applyQuiz(s, ctx.playerId),
    );
    this.tileRegistry.register('move', (s, ctx) =>
      this.applyMoveDelta(
        s,
        ctx.playerId,
        ctx.tile.type === 'move' ? (ctx.tile.delta ?? 0) : 0,
      ),
    );
    this.tileRegistry.register('skip', (s, ctx) =>
      this.applySkipTurnTile(
        s,
        ctx.playerId,
        ctx.tile.type === 'skip' ? (ctx.tile.turns ?? 1) : 1,
      ),
    );
    this.tileRegistry.register('bonus_course', (s, ctx) =>
      this.drawBonusCourse(s, ctx.playerId),
    );
    this.tileRegistry.register('move_to_stand', (s, ctx) =>
      this.applyMoveToNextStand(s, ctx.playerId),
    );
  }

  private registerStandHandlers(): void {
    // Stands paramétrables : tous les stands routent vers l'effet générique drawCourse
    this.standEffects.registerStand('stand', (s, ctx) =>
      this.drawSvc.drawCourse(s, ctx.playerId, ctx.standId),
    );
    this.standIds().forEach((id) => {
      this.standEffects.registerStand(id, (s, ctx) =>
        this.drawSvc.drawCourse(s, ctx.playerId, ctx.standId),
      );
    });
  }

  private applyEvent(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    let drawn = this.drawFromPool(meta, 'events');
    let metadata = drawn.metadata;
    if (!drawn.card) {
      // Réinitialiser le deck d'événements si épuisé, puis retenter.
      const refilled = this.deckPool.set<string>(
        meta.decks as DeckPoolState<string>,
        'events',
        this.deckPool.shuffle([...this.setup.eventCards()]),
      );
      drawn = this.drawFromPool(
        { ...meta, decks: refilled as PanierExpressDeckPool },
        'events',
      );
      metadata = drawn.metadata;
      if (!drawn.card) {
        return state;
      }
    }
    const { card: event } = drawn;
    let next: GameStateEntity = { ...ensured, metadata };

    const setPickPending = (params: {
      label: string;
      kind: string;
      choices: string[];
      data?: Record<string, unknown>;
    }): GameStateEntity => {
      return {
        ...next,
        pending: {
          type: 'pick',
          playerId,
          blocking: true,
          label: params.label,
          choices: params.choices,
          data: { kind: params.kind, ...(params.data ?? {}) },
        },
      } as any;
    };

    const ensureDiscardCourses = (): string[] => {
      const metaNow = this.getMetadata(next);
      const current = Array.isArray(metaNow.discards?.courses)
        ? metaNow.discards?.courses.map((v) => String(v))
        : [];
      return current;
    };

    const addToDiscard = (card: string): void => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return;
      const current = ensureDiscardCourses();
      const metaNow = this.getMetadata(next);
      next = {
        ...next,
        metadata: {
          ...metaNow,
          discards: { ...metaNow.discards, courses: [...current, trimmed] },
        },
      };
    };

    const removeOneCourseFromPlayer = (
      pid: number,
      card: string,
    ): { updated: boolean } => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return { updated: false };
      let updated = false;
      const players = (next.players ?? []).map((p: any) => {
        if (p.id !== pid) return p;
        const basket = this.utils.toStringArray(p.basket);
        const inventory = this.utils.toStringArray(p.inventory);
        if (basket.includes(trimmed)) {
          updated = true;
          return { ...p, basket: this.utils.removeOne(basket, trimmed) };
        }
        if (inventory.includes(trimmed)) {
          updated = true;
          return { ...p, inventory: this.utils.removeOne(inventory, trimmed) };
        }
        return p;
      });
      next = { ...next, players };
      return { updated };
    };

    const discardRandomCourse = (pid: number): string | null => {
      const player = (next.players ?? []).find((p) => p.id === pid) as any;
      if (!player) return null;
      const basket = this.utils.toStringArray(player.basket);
      const inventory = this.utils.toStringArray(player.inventory);
      const cards = [...inventory, ...basket];
      if (!cards.length) return null;
      const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
      const picked = this.random.pickOne(metaRng.getMeta() as any, cards);
      next = { ...next, metadata: picked.meta as any };
      const card = String(picked.value ?? '').trim();
      if (!card) return null;
      const res = removeOneCourseFromPlayer(pid, card);
      if (res.updated) {
        addToDiscard(card);
        return card;
      }
      return null;
    };
    switch (event) {
      case 'stand-ferme':
        next = this.turnStatus.setStatus(next, playerId, 'skipTurn', 1);
        next = this.core.appendLog(
          next,
          `[Panier Express] Stand ferm\u00e9 : ${this.utils.playerName(state, playerId)} saute un tour.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'skipTurn',
        });
        break;
      case 'promo-surprise':
        next = this.core.appendLog(
          next,
          `[Panier Express] Promo surprise : ${this.utils.playerName(state, playerId)} pioche 2 courses.`,
        );
        next = this.drawSvc.drawCourse(next, playerId, 'bonus');
        next = this.drawSvc.drawCourse(next, playerId, 'bonus');
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'draw2',
        });
        break;
      case 'coup-de-chance':
        next = this.core.appendLog(
          next,
          `[Panier Express] Coup de chance : ${this.utils.playerName(state, playerId)} avance de 2 cases.`,
        );
        next = this.applyMoveDelta(next, playerId, 2);
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'move',
          delta: 2,
        });
        break;
      case 'stand-exceptionnel':
        next = this.core.appendLog(next, `[Panier Express] Stand exceptionnel : pioche 1 course bonus.`);
        next = this.drawSvc.drawCourse(next, playerId, 'bonus');
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'draw',
        });
        break;
      case 'fidelite-recompensee':
        next = this.turnStatus.setStatus(next, playerId, 'keepTurn', 1);
        next = this.core.appendLog(next, `[Panier Express] Fidélité récompensée : rejouez immédiatement.`);
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'keepTurn',
        });
        break;
      case 'tirage-chanceux': {
        const pool = (this.getMetadata(next).decks as any)?.['courses-bonus']?.deck ?? [];
        const offered = Array.isArray(pool)
          ? pool
              .slice(0, 3)
              .map((v: any) => String(v))
              .filter((v: string) => v.length > 0)
          : [];
        if (!offered.length) {
          next = this.core.appendLog(next, `[Panier Express] Tirage chanceux : aucune carte disponible.`);
          next = this.appendActionLog(next, playerId, 'event', { event, effect: 'none' });
          break;
        }
        next = setPickPending({
          label: 'Choisissez une carte (tirage chanceux), puis Entrée.',
          kind: 'event.tirage_chanceux',
          choices: offered,
          data: { cards: offered },
        });
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'pick' });
        break;
      }
      case 'producteur-genereux': {
        next = this.drawSvc.drawCourse(next, playerId, 'bonus');
        const me = (next.players ?? []).find((p) => p.id === playerId) as any;
        const inv = this.utils.toStringArray(me?.inventory);
        const targets = (next.players ?? [])
          .filter((p) => p.id !== playerId)
          .map((p: any) => ({ playerId: p.id, username: p.username }));
        if (!inv.length || !targets.length) {
          next = this.core.appendLog(next, `[Panier Express] Producteur généreux : aucun don possible.`);
          next = this.appendActionLog(next, playerId, 'event', { event, effect: 'none' });
          break;
        }
        next = setPickPending({
          label: 'Choisissez une carte à offrir (inventaire), puis Entrée.',
          kind: 'event.producteur_genereux.choose_card',
          choices: inv,
          data: { cards: inv, targets },
        });
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'pick' });
        break;
      }
      case 'emballage-defectueux': {
        const me = (next.players ?? []).find((p) => p.id === playerId) as any;
        const cards = [
          ...this.utils.toStringArray(me?.inventory),
          ...this.utils.toStringArray(me?.basket),
        ];
        if (!cards.length) {
          next = this.core.appendLog(next, `[Panier Express] Emballage défectueux : aucune carte à défausser.`);
          next = this.appendActionLog(next, playerId, 'event', { event, effect: 'none' });
          break;
        }
        next = setPickPending({
          label: 'Choisissez une carte à défausser, puis Entrée.',
          kind: 'event.discard',
          choices: cards,
          data: { cards },
        });
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'pick_discard' });
        break;
      }
      case 'retour-en-arriere':
        next = this.core.appendLog(next, `[Panier Express] Retour en arrière : reculez de 3 cases.`);
        next = this.applyMoveDelta(next, playerId, -3);
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'move',
          delta: -3,
        });
        break;
      case 'inspection-sanitaire':
        next = this.turnStatus.setStatus(next, playerId, 'revealInventory', 1);
        next = this.core.appendLog(next, `[Panier Express] Inspection sanitaire : votre inventaire est visible (1 tour).`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'reveal' });
        break;
      case 'file-inversee': {
        const metaNow = this.getMetadata(next);
        next = {
          ...next,
          metadata: { ...metaNow, movementDirection: -1, movementDirectionOwnerId: playerId },
          turn: { ...(next.turn ?? { currentPlayerId: playerId, direction: 1 }), direction: -1 },
        };
        next = this.core.appendLog(next, `[Panier Express] File inversée : les joueurs reculent jusqu'à votre prochain tour.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'reverse' });
        break;
      }
      case 'don-du-maraicher':
        next = this.core.appendLog(next, `[Panier Express] Don du maraîcher : pioche 1 course bonus.`);
        next = this.drawSvc.drawCourse(next, playerId, 'bonus');
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'draw' });
        break;
      case 'marche-anime':
        (next.players ?? []).forEach((p: any) => {
          next = this.drawSvc.drawCourse(next, p.id, 'bonus');
        });
        next = this.core.appendLog(next, `[Panier Express] Marché animé : tous les joueurs piochent 1 course.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'all_draw' });
        break;
      case 'journee-bio': {
        const metaNow = this.getMetadata(next);
        const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
        const positions = metaNow.positions ?? {};
        (next.players ?? []).forEach((p: any) => {
          const pos = positions[p.id] ?? 0;
          const tile = tiles[pos] as any;
          if (tile?.type === 'stand' && String(tile.standId ?? '').startsWith('bio')) {
            next = this.drawSvc.drawCourse(next, p.id, 'bonus');
          }
        });
        next = this.core.appendLog(next, `[Panier Express] Journée bio : bonus pour les joueurs sur un stand Bio.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'multi_draw' });
        break;
      }
      case 'intemperie-au-marche':
        (next.players ?? []).forEach((p: any) => {
          next = this.movePlayer(next, p.id, -1);
        });
        next = this.core.appendLog(next, `[Panier Express] Intempérie : tous les joueurs reculent d'une case.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'all_move', delta: -1 });
        break;
      case 'pause-fatigue': {
        const metaNow = this.getMetadata(next);
        const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
        const index0 = Math.max(0, Math.min(tiles.length - 1, 39));
        next = {
          ...next,
          metadata: {
            ...metaNow,
            positions: { ...(metaNow.positions ?? {}), [playerId]: index0 },
          },
        };
        next = this.core.appendLog(next, `[Panier Express] Pause fatigue : avance jusqu'à la case 40.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'goto40' });
        break;
      }
      case 'produit-oublie': {
        const items = this.setup.courseItems();
        const added = items.length ? items[0] : null;
        if (added) {
          next = {
            ...next,
            players: (next.players ?? []).map((p: any) => {
              if (p.id !== playerId) return p;
              const list = this.utils.toStringArray(p.shoppingList);
              return { ...p, shoppingList: [...list, added] };
            }),
          };
          next = this.core.appendLog(next, `[Panier Express] Produit oublié : +1 produit dans la liste (${added}).`);
          next = this.appendActionLog(next, playerId, 'event', { event, effect: 'add_shopping', added });
        }
        break;
      }
      case 'offre-ephemere': {
        const discard = ensureDiscardCourses();
        if (!discard.length) {
          next = this.core.appendLog(next, `[Panier Express] Offre éphémère : défausse vide.`);
          next = this.appendActionLog(next, playerId, 'event', { event, effect: 'none' });
          break;
        }
        const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
        const picked = this.random.pickOne(metaRng.getMeta() as any, discard);
        next = { ...next, metadata: picked.meta as any };
        const card = String(picked.value ?? '').trim();
        if (!card) break;
        const remaining = discard.filter((c) => c !== card);
        const metaNow = this.getMetadata(next);
        next = { ...next, metadata: { ...metaNow, discards: { ...metaNow.discards, courses: remaining } } };
        next = {
          ...next,
          players: (next.players ?? []).map((p: any) => {
            if (p.id !== playerId) return p;
            const list = this.utils.toStringArray(p.shoppingList);
            const basket = this.utils.toStringArray(p.basket);
            const inventory = this.utils.toStringArray(p.inventory);
            if (list.includes(card) && !basket.includes(card)) {
              return { ...p, basket: [...basket, card], inventory };
            }
            return { ...p, inventory: [...inventory, card], basket };
          }),
        };
        next = this.core.appendLog(next, `[Panier Express] Offre éphémère : récupère "${card}".`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'from_discard', card });
        break;
      }
      case 'controle-des-inventaires': {
        let maxId: number | null = null;
        let max = -1;
        (next.players ?? []).forEach((p: any) => {
          const inv = this.utils.toStringArray(p.inventory);
          if (inv.length > max) {
            max = inv.length;
            maxId = p.id;
          }
        });
        if (maxId != null && max > 0) {
          const discarded = discardRandomCourse(maxId);
          next = this.core.appendLog(next, `[Panier Express] Contrôle des inventaires : ${this.utils.playerName(state, maxId)} défausse "${discarded}".`);
          next = this.appendActionLog(next, playerId, 'event', { event, effect: 'max_discard', discarded, targetPlayerId: maxId });
          break;
        }
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'none' });
        break;
      }
      case 'stand-surprise': {
        const metaAny = this.getMetadata(next) as any;
        const rng = this.random.rollDice(metaAny, 6);
        next = { ...next, metadata: rng.meta as any };
        const roll = rng.roll;
        const matcher =
          roll <= 2
            ? (id: string) => id.startsWith('bio')
            : roll <= 4
              ? (id: string) => id === 'fruitier'
              : (id: string) => id.startsWith('primeur');
        const metaNow = this.getMetadata(next);
        const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
        const total = tiles.length;
        const current = metaNow.positions?.[playerId] ?? 0;
        for (let steps = 1; steps < total; steps += 1) {
          const idx = this.movement.moveCircular(total, current, steps);
          const tile = tiles[idx] as any;
          if (tile?.type === 'stand' && matcher(String(tile.standId ?? ''))) {
            next = this.movePlayer(next, playerId, steps);
            break;
          }
        }
        next = this.resolveTile(next, playerId);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'move_to_nearest_stand', roll });
        break;
      }
      case 'rupture-de-stock':
      default:
        if (event === 'erreur-de-livraison' || event === 'produit-avarie' || event === 'emballage-oublie' || event === 'chariot-perce') {
          const discarded = discardRandomCourse(playerId);
          next = this.core.appendLog(
            next,
            discarded
              ? `[Panier Express] ${event} : ${this.utils.playerName(state, playerId)} défausse "${discarded}".`
              : `[Panier Express] ${event} : aucune carte à défausser.`,
          );
          next = this.appendActionLog(next, playerId, 'event', { event, effect: 'discard_random', discarded });
          break;
        }
        next = this.core.appendLog(next, `[Panier Express] ${event} : aucun effet (best-effort).`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'none' });
        break;
    }
    return next;
  }

  private applyExchange(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return this.exchangeSvc.applyExchange(state, playerId);
  }

  private handleExchangeChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId =
      typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : null;
    const playerId = actorId ?? state.turn?.currentPlayerId ?? null;
    const targetPlayerId = action.payload?.targetPlayerId ?? null;
    if (typeof playerId !== 'number' || typeof targetPlayerId !== 'number') {
      return this.core.appendLog(
        state,
        "[Panier Express] Choix cible d'échange invalide.",
      );
    }
    return this.exchangeSvc.chooseTarget(state, playerId, targetPlayerId);
  }

  private handleExchangeChooseGive(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId =
      typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : null;
    const playerId = actorId ?? state.turn?.currentPlayerId ?? null;
    const give = action.payload?.give ?? null;
    if (typeof playerId !== 'number' || typeof give !== 'string') {
      return this.core.appendLog(
        state,
        "[Panier Express] Choix carte d'échange invalide.",
      );
    }
    // À ce stade, on crée une offre d'échange à confirmer par la cible (A/R).
    // On n'avance pas le tour tant que la cible n'a pas répondu.
    return this.exchangeSvc.chooseGive(state, playerId, give);
  }

  private handleExchangeAccept(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId =
      typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : null;
    if (typeof actorId !== 'number') {
      return this.core.appendLog(
        state,
        "[Panier Express] Acceptation d'échange invalide.",
      );
    }
    const resolved = this.exchangeSvc.acceptOffer(state, actorId);
    return this.phaseFlow.advanceTurn(resolved);
  }

  private handleExchangeRefuse(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId =
      typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : null;
    if (typeof actorId !== 'number') {
      return this.core.appendLog(
        state,
        "[Panier Express] Refus d'échange invalide.",
      );
    }
    const resolved = this.exchangeSvc.refuseOffer(state, actorId);
    return this.phaseFlow.advanceTurn(resolved);
  }
  private handleSkipTurn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId =
      (typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : action.payload?.playerId) ??
      state.turn?.currentPlayerId ??
      null;
    if (typeof playerId !== 'number') {
      return state;
    }
    const meta = this.getMetadata(state);
    const currentSkip = meta.statuses.skipTurn?.[playerId] ?? 0;
    const nextSkip = Math.max(0, currentSkip - 1);
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: nextSkip },
      },
    };
    const next = { ...state, metadata: nextMeta };
    const logged = this.core.appendLog(
      next,
      `[Panier Express] ${this.utils.playerName(state, playerId)} passe son tour.`,
    );
    return this.phaseFlow.advanceTurn(logged);
  }

  private handlePickChoice(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId =
      typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : state.turn?.currentPlayerId ?? null;
    if (typeof actorId !== 'number') return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'pick' || pending.playerId !== actorId) {
      return this.core.appendLog(
        state,
        `[Panier Express] Choix invalide (aucun pending).`,
      );
    }

    const index = Number(action.payload?.index);
    const choices = Array.isArray(pending.choices) ? pending.choices : [];
    if (!Number.isFinite(index) || index < 0 || index >= choices.length) {
      return this.core.appendLog(state, `[Panier Express] Choix invalide.`);
    }

    const meta = this.getMetadata(state);
    const kind = String(pending?.data?.kind ?? '').trim();

    const updatePlayer = (
      playerId: number,
      updater: (player: any) => any,
    ): GameStateEntity => {
      const players = (state.players ?? []).map((p: any) =>
        p.id === playerId ? updater(p) : p,
      );
      return { ...state, players };
    };

    const removeCourseFromPlayer = (
      playerId: number,
      card: string,
    ): { state: GameStateEntity; removed: boolean } => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return { state, removed: false };
      let removed = false;
      const updated = updatePlayer(playerId, (p: any) => {
        const basket = this.utils.toStringArray(p.basket);
        const inventory = this.utils.toStringArray(p.inventory);
        if (basket.includes(trimmed)) {
          removed = true;
          return { ...p, basket: this.utils.removeOne(basket, trimmed) };
        }
        if (inventory.includes(trimmed)) {
          removed = true;
          return { ...p, inventory: this.utils.removeOne(inventory, trimmed) };
        }
        return p;
      });
      return { state: updated, removed };
    };

    const discardCourse = (playerId: number, card: string): GameStateEntity => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return state;
      const removed = removeCourseFromPlayer(playerId, trimmed);
      if (!removed.removed) return state;
      const nextMeta: PanierExpressMetadata = {
        ...meta,
        discards: {
          ...meta.discards,
          courses: [...(meta.discards?.courses ?? []), trimmed],
        },
      };
      return {
        ...removed.state,
        metadata: nextMeta,
      };
    };

    const addCourseToPlayer = (playerId: number, card: string): GameStateEntity => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return state;
      const next = updatePlayer(playerId, (p: any) => {
        const list = this.utils.toStringArray(p.shoppingList);
        const basket = this.utils.toStringArray(p.basket);
        const inventory = this.utils.toStringArray(p.inventory);
        if (list.includes(trimmed) && !basket.includes(trimmed)) {
          return { ...p, basket: [...basket, trimmed], inventory };
        }
        return { ...p, inventory: [...inventory, trimmed], basket };
      });
      return next;
    };

    const clearPending = (s: GameStateEntity): GameStateEntity => ({
      ...s,
      pending: null,
    });

    if (kind === 'event.tirage_chanceux') {
      const cards = Array.isArray(pending?.data?.cards)
        ? pending.data.cards.map((v: any) => String(v))
        : [];
      const chosen = cards[index] ?? '';
      let next = clearPending(state);
      next = addCourseToPlayer(actorId, chosen);
      next = this.core.appendLog(
        next,
        `[Panier Express] Tirage chanceux : ${this.utils.playerName(
          state,
          actorId,
        )} choisit "${chosen}".`,
      );
      next = this.appendActionLog(next, actorId, 'event', {
        event: 'tirage-chanceux',
        choice: chosen,
      });
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'event.discard') {
      const cards = Array.isArray(pending?.data?.cards)
        ? pending.data.cards.map((v: any) => String(v))
        : [];
      const chosen = cards[index] ?? '';
      let next = clearPending(state);
      next = discardCourse(actorId, chosen);
      next = this.core.appendLog(
        next,
        `[Panier Express] ${this.utils.playerName(
          state,
          actorId,
        )} d\u00e9fausse "${chosen}".`,
      );
      next = this.appendActionLog(next, actorId, 'event', {
        effect: 'discard',
        card: chosen,
      });
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'event.producteur_genereux.choose_card') {
      const cards = Array.isArray(pending?.data?.cards)
        ? pending.data.cards.map((v: any) => String(v))
        : [];
      const chosen = cards[index] ?? '';
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const choices = targets.map((t: any) => String(t?.username ?? '')).filter((v: string) => v.length > 0);
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: actorId,
          blocking: true,
          label: 'Choisissez un joueur pour recevoir la carte.',
          choices,
          data: {
            kind: 'event.producteur_genereux.choose_target',
            give: chosen,
            targets,
          },
        },
      } as any;
    }

    if (kind === 'event.producteur_genereux.choose_target') {
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosenTarget = targets[index];
      const targetPlayerId = Number(chosenTarget?.playerId);
      const give = String(pending?.data?.give ?? '').trim();
      if (!Number.isFinite(targetPlayerId) || !give) {
        return clearPending(state);
      }

      let next = clearPending(state);
      const removed = removeCourseFromPlayer(actorId, give);
      next = removed.state;
      if (removed.removed) {
        next = addCourseToPlayer(targetPlayerId, give);
      }
      next = this.core.appendLog(
        next,
        `[Panier Express] ${this.utils.playerName(
          state,
          actorId,
        )} offre "${give}" \u00e0 ${this.utils.playerName(state, targetPlayerId)}.`,
      );
      next = this.appendActionLog(next, actorId, 'event', {
        event: 'producteur-genereux',
        give,
        targetPlayerId,
      });
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'exchange.choose_target') {
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosen = targets[index];
      const targetPlayerId = Number(chosen?.playerId);
      const card = String(pending?.data?.card ?? '').trim();
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      let next = clearPending(state);
      return this.exchangeSvc.applyExchangeCard(next, actorId, targetPlayerId, card);
    }

    if (kind === 'exchange.impose.choose_card') {
      const initiatorId = Number(pending?.data?.initiatorId);
      const cards = Array.isArray(pending?.data?.cards)
        ? pending.data.cards.map((v: any) => String(v))
        : [];
      const give = cards[index] ?? '';
      if (!Number.isFinite(initiatorId) || !give) return clearPending(state);
      let next = clearPending(state);
      // Target gives chosen card to initiator; initiator gives a random card back (best-effort).
      const removed = removeCourseFromPlayer(actorId, give);
      next = removed.state;
      if (removed.removed) {
        next = addCourseToPlayer(initiatorId, give);
      }
      try {
        const initiator = (next.players ?? []).find((p: any) => p.id === initiatorId) as any;
        const initiatorInv = this.utils.toStringArray(initiator?.inventory);
        if (initiatorInv.length > 0) {
          const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
          const picked = this.random.pickOne(metaRng.getMeta() as any, initiatorInv);
          next = { ...next, metadata: picked.meta as any };
          const back = String(picked.value ?? '').trim();
          if (back) {
            const removedBack = removeCourseFromPlayer(initiatorId, back);
            next = removedBack.state;
            if (removedBack.removed) {
              next = addCourseToPlayer(actorId, back);
            }
          }
        }
      } catch {
        // ignore
      }
      next = this.core.appendLog(
        next,
        `[Panier Express] \u00c9change impos\u00e9 : ${this.utils.playerName(
          state,
          actorId,
        )} donne "${give}" \u00e0 ${this.utils.playerName(state, initiatorId)}.`,
      );
      return this.phaseFlow.advanceTurn(next);
    }

    return clearPending(state);
  }

  private applyQuiz(state: GameStateEntity, playerId: number): GameStateEntity {
    return this.quizSvc.applyQuiz(state, playerId);
  }

  // Résolution de quiz : PanierExpressQuizService ne fait que mettre une question en pending.
  // La validation de la réponse et la levée du pending restent ici via QuizRunner
  // pour garder la logique de tour et de scoring centralisée dans le service principal.
  private handleAnswerQuiz(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId =
      typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : (state.turn?.currentPlayerId ?? null);
    if (typeof playerId !== 'number') return state;
    const meta = this.getMetadata(state);
    const quizState = meta.quiz;
    const pending = quizState.pending[playerId];
    if (!pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Pas de question en attente pour ${this.utils.playerName(state, playerId)}.`,
      );
    }
    const answer =
      typeof action.payload?.answer === 'string' ? action.payload.answer : null;
    if (!answer) {
      return this.core.appendLog(
        state,
        `[Panier Express] Quiz : réponse manquante pour ${this.utils.playerName(state, playerId)}.`,
      );
    }
    const result = this.quizRunner.validateAnswer(quizState, playerId, answer);
    const correct = result.correct;
    const updatedQuiz = result.state;
    let next: GameStateEntity = {
      ...state,
      metadata: { ...meta, quiz: updatedQuiz },
      pending: null,
    };
    next = this.core.appendLog(
      next,
      `[Panier Express] ${this.utils.playerName(state, playerId)} répond au quiz (${correct ? 'réussite' : 'échec'})`,
    );
    next = this.appendActionLog(next, playerId, 'answer_quiz', { correct });
    if (correct) {
      next = this.drawBonusCourse(next, playerId);
    }
    return this.phaseFlow.advanceTurn(next);
  }

  private drawBonusCourse(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return this.drawSvc.drawCourse(state, playerId, 'bonus');
  }

  private applyMoveDelta(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    if (!delta || delta === 0) return state;
    const next = this.movePlayer(state, playerId, delta);
    return this.resolveTile(next, playerId);
  }

  private applyMoveToNextStand(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const tiles =
      Array.isArray(meta.tiles) && meta.tiles.length
        ? meta.tiles
        : this.buildTiles();
    const currentPos = meta.positions[playerId] ?? 0;
    const total = tiles.length;
    let steps = 1;
    for (; steps < total; steps += 1) {
      const idx = this.movement.moveCircular(total, currentPos, steps);
      const tile = tiles[idx];
      if (tile?.type === 'stand') {
        break;
      }
    }
    const moved = this.movePlayer(ensured, playerId, steps);
    return this.resolveTile(moved, playerId);
  }

  private applySkipTurnTile(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const count = Math.max(1, turns || 1);
    const next = this.turnStatus.setStatus(state, playerId, 'skipTurn', count);
    return this.core.appendLog(
      next,
      `[Panier Express] ${this.utils.playerName(state, playerId)} perd ${count} tour(s).`,
    );
  }

  private applyVictory(state: GameStateEntity): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    const meta = this.getMetadata(state);
    const result = this.victory.evaluate(state, PANIER_EXPRESS_VICTORY);
    if (!result || !result.finished) return state;
    const winnerId =
      typeof result.winnerId === 'number' ? result.winnerId : meta.winnerId;
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      winnerId: winnerId ?? null,
    };
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      status: 'finished',
    };
    const winnerName =
      winnerId != null
        ? this.utils.playerName(state, winnerId)
        : 'Partie terminée';
    const logged = this.core.appendLog(
      nextState,
      `[Panier Express] ${winnerName} remporte la partie !`,
    );
    return this.appendActionLog(logged, winnerId ?? null, 'victory', {
      conditionId: result.conditionId,
    });
  }

  private advancePhases(state: GameStateEntity): GameStateEntity {
    let next = state;
    for (const phase of this.phaseOrder) {
      if (phase.id === 'check_victory') {
        next = this.applyVictory(next);
      } else if (phase.onEnter) {
        next = phase.onEnter(next);
      }
      if ((next.status || '').toLowerCase() === 'finished') break;
    }
    return next;
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    const players = state.players ?? [];
    if (players.length === 0) return state;
    const meta = this.getMetadata(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p) => p.id === currentId)
        : state.turnIndex;
    const next = this.turns.nextTurn(
      players,
      currentIndex >= 0 ? currentIndex : state.turnIndex,
      meta.statuses.skipTurn,
    );
    playingLog('panier.advanceTurn', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: currentId,
      type: 'advance_turn',
      currentId,
      currentIndex,
      nextTurnIndex: next.turnIndex,
      nextCurrentPlayerId: next.currentPlayerId,
      skipTurn: next.skipTurn,
    });

    const revealInventory: Record<number, number> = {};
    Object.entries(meta.statuses?.revealInventory ?? {}).forEach(([pid, val]) => {
      const nextVal = Math.max(0, Number(val) - 1);
      if (nextVal > 0) {
        revealInventory[Number(pid)] = nextVal;
      }
    });

    let movementDirection: 1 | -1 = meta.movementDirection === -1 ? -1 : 1;
    let movementDirectionOwnerId =
      typeof meta.movementDirectionOwnerId === 'number'
        ? meta.movementDirectionOwnerId
        : null;
    if (
      movementDirection === -1 &&
      movementDirectionOwnerId != null &&
      next.currentPlayerId === movementDirectionOwnerId
    ) {
      movementDirection = 1;
      movementDirectionOwnerId = null;
    }

    const nextMeta: PanierExpressMetadata = {
      ...meta,
      movementDirection,
      movementDirectionOwnerId,
      statuses: { ...meta.statuses, skipTurn: next.skipTurn, revealInventory },
    };
    return {
      ...state,
      metadata: nextMeta,
      turnIndex: next.turnIndex,
      turn: {
        currentPlayerId: next.currentPlayerId,
        direction: movementDirection,
      },
    };
  }

  private drawFromPool<T = unknown>(
    meta: PanierExpressMetadata,
    key: string,
  ): {
    card: T | null;
    metadata: PanierExpressMetadata;
  } {
    const { card, pool } = this.deckPool.draw<unknown>(meta.decks, key);
    return {
      card: (card as T) ?? null,
      metadata: { ...meta, decks: pool as PanierExpressDeckPool },
    };
  }

  private appendActionLog(
    state: GameStateEntity,
    actorId: number | null,
    type: string,
    payload?: Record<string, unknown>,
  ): GameStateEntity {
    const meta = this.getMetadata(state);
    const actionLog = this.actionLogSvc.append(meta.actionLog, {
      actorId,
      type,
      payload,
    });
    return { ...state, metadata: { ...meta, actionLog } };
  }

  private injectQuizAnswer(
    actions: GameSingleActionDto[],
    meta: PanierExpressMetadata,
    playerId: number,
  ): GameSingleActionDto[] {
    if (!Array.isArray(actions)) return [];
    const pending = meta.quiz?.pending?.[playerId];
    const choices = Array.isArray(pending?.choices) ? pending?.choices : [];
    if (!pending || !choices.length) return actions;
    const answer = choices[0];
    return actions.map((a) => {
      if (!a || (a.type || '').toLowerCase() !== 'answer_quiz') return a;
      return { ...a, payload: { ...(a.payload ?? {}), answer } };
    });
  }

  private getMetadata(state: GameStateEntity): PanierExpressMetadata {
    return (state.metadata ??
      this.buildMetadata(state)) as PanierExpressMetadata;
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((v) => (v == null ? '' : String(v)))
        .filter((v) => v.length > 0);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v) => (v == null ? '' : String(v)))
            .filter((v) => v.length > 0);
        }
      } catch {
        /* ignore */
      }
      return value
        .split(/[,;]+/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return [];
  }

  private extractShoppingLists(meta: PanierExpressMetadata): string[][] {
    const deck = meta.decks?.shoppingLists?.deck ?? [];
    if (!Array.isArray(deck)) {
      return [];
    }
    return deck.map((entry) =>
      Array.isArray(entry)
        ? entry.map((item) => String(item))
        : this.toStringArray(entry),
    );
  }

  private buildShoppingList(): string[] {
    return this.deckPool.shuffle([...this.setup.courseItems()]).slice(0, 5);
  }
}
