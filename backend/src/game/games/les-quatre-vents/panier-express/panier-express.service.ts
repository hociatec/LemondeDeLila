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
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import { buildPanierExpressShortcuts } from './panier-express.shortcuts';

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

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildPanierExpressShortcuts(ctx);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = (baseState.status || '').toLowerCase();
    const players = baseState.players ?? [];
    const inProgress =
      status === 'finished' ||
      status === 'running' ||
      status === 'started' ||
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

    // Attribution stable des listes/pions:
    // - indépendante de l'ordre du tableau `players` (qui peut changer selon l'aléatoire / reconnections)
    // - favorise les humains avant les bots pour éviter qu'un bot ajouté/retiré ne "décale" les humains
    const assignmentOrder = [...players].sort((a, b) => {
      const aBot = a?.isBot === true;
      const bBot = b?.isBot === true;
      if (aBot !== bBot) return aBot ? 1 : -1;
      return (a?.id ?? 0) - (b?.id ?? 0);
    });
    let listIndex = 0;
    let pawnIndex = 0;
    const usedPawns = new Set<string>();
    const assignedById = new Map<
      number,
      { list: string[]; pawn?: string; isBot: boolean }
    >();
    assignmentOrder.forEach((p) => {
      const username = (p.username ?? '').toLowerCase();
      const isBot = p.isBot === true || username.includes('bot');
      const existingList = this.toStringArray(p.shoppingList).slice(0, 3);
      const list =
        existingList.length > 0
          ? existingList
          : (shoppingDeck[listIndex++] ?? this.buildShoppingList());
      const existingPawn =
        typeof (p as any)?.pawn === 'string'
          ? String((p as any).pawn).trim()
          : '';
      let pawn: string | undefined =
        existingPawn.length > 0 ? existingPawn : undefined;
      if (pawn) {
        usedPawns.add(pawn);
      }
      if (!pawn && isBot && pawns.length) {
        const available = pawns.find((p) => !usedPawns.has(p));
        pawn = available ?? pawns[pawnIndex++ % pawns.length];
        if (pawn) usedPawns.add(pawn);
      }
      assignedById.set(p.id, { list, pawn, isBot });
    });

    const hydratedPlayers = players.map((p) => {
      const assigned = assignedById.get(p.id);
      return {
        ...p,
        isBot: assigned?.isBot ?? p.isBot === true,
        basket: Array.isArray(p.basket)
          ? p.basket.map((item) => String(item))
          : [],
        inventory: Array.isArray(p.inventory)
          ? p.inventory.map((item) => String(item))
          : [],
        shoppingList: assigned?.list ?? this.toStringArray(p.shoppingList).slice(0, 3),
        pawn: assigned?.pawn,
      };
    });
    const positions: Record<number, number> = {};
    hydratedPlayers.forEach((p) => {
      positions[p.id] = 0;
    });
    const baseMetadata = (baseState.metadata ?? {}) as Record<string, unknown>;
    const initial: GameStateEntity = {
      ...baseState,
      players: hydratedPlayers,
      status: baseState.status ?? 'open',
      metadata: {
        ...baseMetadata,
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
      const hadPawn =
        typeof (originalPlayer as any)?.pawn === 'string' &&
        String((originalPlayer as any)?.pawn).trim().length > 0;
      const hadList =
        Array.isArray(originalPlayer?.shoppingList) &&
        originalPlayer.shoppingList.length > 0;
      if (hadList) {
        return; // ne pas relogger une liste déjà attribuée (évite l'impression de réinitialisation).
      }
      const normalizedList = this.toStringArray(p.shoppingList).slice(0, 3);
      const list: string[] = normalizedList.length
        ? normalizedList
        : (shoppingDeck[idx] ?? []);
      const listLabel = this.utils.formatCourseLabels(list);
      const label = (p.username ?? '').trim() || 'Joueur ' + p.id;
      withLogs = this.core.appendLog(
        withLogs,
        '[Panier Express] ' +
          label +
          ' re\u00e7oit une liste de courses: ' +
          listLabel.join(', '),
      );
      const pawn =
        typeof (p as any)?.pawn === 'string'
          ? String((p as any).pawn).trim()
          : '';
      if (!hadPawn && pawn) {
        withLogs = this.core.appendLog(
          withLogs,
          '[Panier Express] ' + label + ' re\u00e7oit le pion: ' + pawn,
        );
      }
    });
    return this.queuePawnSelection(withLogs);
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
      case 'draw':
        return this.handleDraw(state, action);
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
      quizOutcome: {},
      actionLog: [],
      botProfile: 'greedy',
      movementDirection: 1,
      movementDirectionOwnerId: null,
      lastObtainedCourse: {},
      discards: { courses: [] },
      statuses: {
        skipTurn: {},
        keepTurn: {},
        revealInventory: {},
        revealShoppingList: {},
        noDrawCourses: {},
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
      quizOutcome: existing.quizOutcome ?? defaults.quizOutcome,
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
    const quizOutcome = this.ensureQuizOutcome(meta.quizOutcome, players);
    const statuses = this.mergeStatuses(
      {
        skipTurn: {},
        keepTurn: {},
        revealInventory: {},
        revealShoppingList: {},
        noDrawCourses: {},
      } as any,
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
    const lastObtainedCourse: Record<number, string | null> = {};
    Object.entries((meta as any)?.lastObtainedCourse ?? {}).forEach(
      ([pid, val]) => {
        const id = Number(pid);
        if (!Number.isFinite(id)) return;
        const trimmed = val != null ? String(val).trim() : '';
        lastObtainedCourse[id] = trimmed ? trimmed : null;
      },
    );
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
      quizOutcome,
      statuses,
      positions,
      laps,
      actionLog,
      discards,
      movementDirection,
      movementDirectionOwnerId,
      lastObtainedCourse,
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
      revealShoppingList: {
        ...((defaults as any)?.revealShoppingList ?? {}),
        ...((override as any)?.revealShoppingList ?? {}),
      },
      noDrawCourses: {
        ...((defaults as any)?.noDrawCourses ?? {}),
        ...((override as any)?.noDrawCourses ?? {}),
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

  private ensureQuizOutcome(
    entries: PanierExpressMetadata['quizOutcome'] | undefined,
    players: PanierExpressPlayer[],
  ): PanierExpressMetadata['quizOutcome'] {
    const normalized: PanierExpressMetadata['quizOutcome'] = {};
    if (!entries) return normalized;
    players.forEach((player) => {
      const entry = entries[player.id];
      if (entry) {
        normalized[player.id] = entry;
      }
    });
    return normalized;
  }

  private assignBotPawns(state: GameStateEntity): GameStateEntity {
    const pawns = this.setup.pawns();
    if (!pawns.length) return state;
    const players = state.players ?? [];
    const used = new Set(
      players
        .map((p: any) =>
          typeof p?.pawn === 'string' ? String(p.pawn).trim() : '',
        )
        .filter((p: string) => p.length > 0),
    );
    let fallbackIndex = 0;
    const updated = players.map((p: any) => {
      const currentPawn =
        typeof p?.pawn === 'string' ? String(p.pawn).trim() : '';
      if (currentPawn.length > 0) {
        used.add(currentPawn);
        return p;
      }
      if (!this.utils.isBot(p)) return p;
      const available = pawns.find((pawn) => !used.has(pawn));
      const chosen = available ?? pawns[fallbackIndex++ % pawns.length];
      if (!chosen) return p;
      used.add(chosen);
      return { ...p, pawn: chosen };
    });
    return { ...state, players: updated };
  }

  private queuePawnSelection(state: GameStateEntity): GameStateEntity {
    const pending = state.pending as any;
    if (
      pending &&
      pending.type === 'pick' &&
      pending?.data?.kind === 'setup.choose_pawn'
    ) {
      return state;
    }
    const pawns = this.setup.pawns();
    if (!pawns.length) return state;
    const players = state.players ?? [];
    const missing = players.filter(
      (p: any) => !p?.pawn && !this.utils.isBot(p),
    );
    if (!missing.length) return state;
    const taken = new Set(
      players
        .map((p: any) =>
          typeof p?.pawn === 'string' ? String(p.pawn).trim() : '',
        )
        .filter((p: string) => p.length > 0),
    );
    const available = pawns.filter((pawn) => !taken.has(pawn));
    const choices = available.length ? available : pawns;
    const chooser = missing[0];
    return {
      ...state,
      pending: {
        type: 'pick',
        playerId: chooser.id,
        blocking: true,
        label: 'Choisissez votre pion, puis Entrée.',
        choices,
        data: { kind: 'setup.choose_pawn', choices },
      } as any,
      turn: {
        ...(state.turn ?? { currentPlayerId: chooser.id, direction: 1 }),
        currentPlayerId: chooser.id,
        direction: state.turn?.direction === -1 ? -1 : 1,
      },
    };
  }

  private ensureStarted(state: GameStateEntity): GameStateEntity {
    const status = (state.status || '').toLowerCase();
    if (status === 'started') return state;
    if (status !== 'starting') return state; // ne démarre que quand la table l'a explicitement demandé
    const players = state.players ?? [];
    if (players.length < this.minPlayers) return state;
    const needsPawnSelection = players.some(
      (p: any) => !p?.pawn && !this.utils.isBot(p),
    );
    if (needsPawnSelection) {
      return this.queuePawnSelection(state);
    }
    const withBots = this.assignBotPawns(state);
    const readyPlayers = withBots.players ?? [];
    return {
      ...withBots,
      status: 'started',
      turnIndex: readyPlayers.length ? 0 : -1,
      turn: {
        currentPlayerId: readyPlayers[0]?.id ?? null,
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
      return this.core.appendLog(
        next,
        `[Panier Express] ${this.utils.playerName(state, currentId)} rejoue (bonus de tour).`,
      );
    }

    if (!hasBlockingQuiz && !hasBlockingExchange && !hasBlockingPending) {
      // Règle: sur un 6, le joueur rejoue, sauf si un effet lui fait perdre des tours.
      const skipTurn = this.turnStatus.getStatus(next, currentId, 'skipTurn');
      if (roll === 6 && !(skipTurn > 0)) {
        return this.core.appendLog(
          next,
          `[Panier Express] ${this.utils.playerName(state, currentId)} rejoue (sur un 6).`,
        );
      }
      next = this.phaseFlow.advanceTurn(next);
    }
    return next;
  }

  private handleDraw(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;
    const actorId =
      typeof (action.meta as any)?.actorId === 'number'
        ? (action.meta as any).actorId
        : Number(pending.playerId);
    const pendingPlayerId = Number(pending.playerId);
    if (
      Number.isFinite(pendingPlayerId) &&
      Number.isFinite(actorId) &&
      pendingPlayerId !== actorId
    ) {
      return this.core.appendLog(
        state,
        `[Panier Express] Pioche refusée : ce n'est pas le bon joueur.`,
      );
    }

    const data = (pending?.data ?? {}) as any;
    const kind = String(data.kind ?? 'queue').trim();
    let next: GameStateEntity = { ...state, pending: null };

    if (kind === 'event.card') {
      next = this.applyEvent(next, pendingPlayerId);
      return this.advanceAfterDraw(next);
    }

    if (kind === 'event.tirage_chanceux') {
      const metaNow = this.getMetadata(next) as any;
      const metaRng = this.random.createMetaRng(metaNow);
      const drawnCourses = this.deckPool.drawMany<string>(
        metaNow.decks ?? {},
        'courses-bonus',
        3,
        metaRng.rng,
      );
      next = {
        ...next,
        metadata: {
          ...metaRng.getMeta(),
          decks: drawnCourses.pool as any,
        },
      };
      const offered = (drawnCourses.cards ?? [])
        .map((v: any) => String(v))
        .filter((v: string) => v.length > 0);
      if (!offered.length) {
        next = this.core.appendLog(
          next,
          `[Panier Express] Tirage chanceux : aucune carte disponible.`,
        );
        return this.advanceAfterDraw(next);
      }
      return {
        ...next,
        pending: {
          type: 'pick',
          playerId: pendingPlayerId,
          blocking: true,
          label: 'Choisissez une carte (tirage chanceux), puis Entrée.',
          choices: offered,
          data: { kind: 'event.tirage_chanceux', offered },
        },
      } as any;
    }

    if (kind === 'event.producteur_genereux') {
      next = this.drawSvc.drawCourse(next, pendingPlayerId, 'bonus');
      const me = (next.players ?? []).find(
        (p) => p.id === pendingPlayerId,
      ) as any;
      const inv = this.utils.toStringArray(me?.inventory);
      const targets = (next.players ?? [])
        .filter((p) => p.id !== pendingPlayerId)
        .map((p: any) => ({ playerId: p.id, username: p.username }));
      if (!inv.length || !targets.length) {
        next = this.core.appendLog(
          next,
          `[Panier Express] Producteur généreux : aucun don possible.`,
        );
        return this.advanceAfterDraw(next);
      }
      return {
        ...next,
        pending: {
          type: 'pick',
          playerId: pendingPlayerId,
          blocking: true,
          label: 'Choisissez une carte à offrir (inventaire), puis Entrée.',
          choices: inv,
          data: { kind: 'event.producteur_genereux.choose_card', cards: inv, targets },
        },
      } as any;
    }

    if (kind === 'event.changement_de_saison') {
      next = this.drawSvc.drawCourse(next, pendingPlayerId, 'bonus');
      const order = Array.isArray(data?.order)
        ? data.order.map((v: any) => Number(v))
        : [];
      const cursor = Number(data?.cursor);
      const processed = Number(data?.processed);
      if (!order.length || !Number.isFinite(cursor) || !Number.isFinite(processed)) {
        return this.advanceAfterDraw(next);
      }

      let nextCursor = (cursor + 1) % order.length;
      let nextProcessed = processed + 1;
      while (nextProcessed < order.length) {
        const nextPid = Number(order[nextCursor]);
        const player = (next.players ?? []).find(
          (p: any) => p.id === nextPid,
        ) as any;
        const cards = this.utils.toStringArray(player?.inventory);
        if (cards.length) {
          return {
            ...next,
            pending: {
              type: 'pick',
              playerId: nextPid,
              blocking: true,
              label: 'Choisissez une carte à défausser, puis Entrée.',
              choices: cards,
              data: {
                kind: 'event.changement_de_saison',
                order,
                cursor: nextCursor,
                processed: nextProcessed,
              },
            } as any,
          };
        }
        return {
          ...next,
          pending: {
            type: 'draw',
            playerId: nextPid,
            blocking: true,
            label: 'Piocher une course bonus (Espace).',
            data: {
              kind: 'event.changement_de_saison',
              order,
              cursor: nextCursor,
              processed: nextProcessed,
            },
          },
        } as any;
      }

      next = this.core.appendLog(
        next,
        `[Panier Express] Changement de saison : terminé.`,
      );
      return this.advanceAfterDraw(next);
    }

    const queue = Array.isArray(data?.queue) ? data.queue : [];
    const cursor = Number(data?.cursor ?? 0);
    const entry = queue[cursor];
    if (!entry || !Number.isFinite(entry?.playerId)) {
      return this.advanceAfterDraw(next);
    }

    next = this.drawSvc.drawCourse(
      next,
      Number(entry.playerId),
      entry?.standId ? String(entry.standId) : undefined,
    );

    const nextCursor = cursor + 1;
    if (nextCursor < queue.length) {
      const nextEntry = queue[nextCursor];
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId: nextEntry?.playerId,
          blocking: true,
          label: pending.label ?? 'Piocher une carte (Espace).',
          data: { kind: 'queue', queue, cursor: nextCursor },
        },
      } as any;
    }

    return this.advanceAfterDraw(next);
  }

  private startDrawPending(
    state: GameStateEntity,
    playerId: number,
    data: Record<string, unknown>,
    label: string,
  ): GameStateEntity {
    if (state.pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Une action est déjà en attente.`,
      );
    }
    return {
      ...state,
      pending: {
        type: 'draw',
        playerId,
        blocking: true,
        label,
        data,
      },
    } as any;
  }

  private queueCourseDraws(
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId?: string }>,
    label: string,
  ): GameStateEntity {
    const sanitized = tasks
      .map((task) => ({
        kind: 'course',
        playerId: Number(task.playerId),
        standId: task.standId,
      }))
      .filter((task) => Number.isFinite(task.playerId));
    if (!sanitized.length) return state;

    const pending = state.pending as any;
    if (pending?.type === 'draw' && pending?.data?.kind === 'queue') {
      const queue = Array.isArray(pending.data.queue) ? pending.data.queue : [];
      return {
        ...state,
        pending: {
          ...pending,
          data: {
            ...(pending.data ?? {}),
            kind: 'queue',
            queue: [...queue, ...sanitized],
            cursor: Number(pending.data.cursor ?? 0),
          },
        },
      } as any;
    }

    if (state.pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Une action est déjà en attente.`,
      );
    }

    const first = sanitized[0];
    return {
      ...state,
      pending: {
        type: 'draw',
        playerId: first.playerId,
        blocking: true,
        label,
        data: { kind: 'queue', queue: sanitized, cursor: 0 },
      },
    } as any;
  }

  private advanceAfterDraw(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const metaAfter = this.getMetadata(state);
    const postActions = this.getAvailableActions(state, currentId);
    const hasBlockingQuiz = Boolean(metaAfter.quiz.pending[currentId]);
    const hasBlockingPending = Boolean(state.pending?.blocking);
    const hasBlockingExchange = postActions.some((a) =>
      ['exchange_choose_target', 'exchange_choose_give'].includes(
        (a.type || '').toLowerCase(),
      ),
    );
    if (hasBlockingQuiz || hasBlockingExchange || hasBlockingPending) {
      return state;
    }

    const keepTurn = this.turnStatus.getStatus(state, currentId, 'keepTurn');
    if (keepTurn > 0) {
      const cleared = this.turnStatus.setStatus(state, currentId, 'keepTurn', 0);
      return this.core.appendLog(
        cleared,
        `[Panier Express] ${this.utils.playerName(state, currentId)} rejoue (bonus de tour).`,
      );
    }

    const roll = typeof state.lastRoll === 'number' ? state.lastRoll : null;
    const skipTurn = this.turnStatus.getStatus(state, currentId, 'skipTurn');
    if (roll === 6 && !(skipTurn > 0)) {
      return this.core.appendLog(
        state,
        `[Panier Express] ${this.utils.playerName(state, currentId)} rejoue (sur un 6).`,
      );
    }

    return this.phaseFlow.advanceTurn(state);
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
    const abs = Math.abs(roll);
    const plural = abs > 1 ? 'cases' : 'case';
    const verb = roll < 0 ? 'recule' : 'avance';
    return this.core.appendLog(
      nextState,
      `${this.utils.playerName(state, playerId)} ${verb} de ${abs} ${plural}.`,
    );
  }

  private tileLabel(tile: PanierExpressTile | undefined): string {
    if (!tile) return 'inconnu';
    const label = String((tile as any)?.label ?? '').trim();
    if (label) return label;
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
      case 'move_choice':
        return 'stand au choix';
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
    const label = this.tileLabel(tile);
    const description = String((tile as any)?.description ?? '').trim();
    const caseNumber = position + 1;
    const announced = this.core.appendLog(
      ensured,
      description
        ? `[Panier Express] Case ${caseNumber} : ${label} — ${description}`
        : `[Panier Express] Case ${caseNumber} : ${label}`,
    );
    const resolved = this.tileRegistry.apply(tile.type, announced, {
      playerId,
      tile,
    });
    return resolved;
  }

  private registerTileHandlers(): void {
    this.tileRegistry.register('rest', (s) => s);
    this.tileRegistry.register('stand', (s, ctx) =>
      this.standEffects.applyStand('stand', s, {
        playerId: ctx.playerId,
        standId: ctx.tile.type === 'stand' ? ctx.tile.standId : 'stand',
        state: s,
      }),
    );
    this.tileRegistry.register('event', (s, ctx) =>
      this.startDrawPending(
        s,
        ctx.playerId,
        { kind: 'event.card' },
        'Piocher une carte Événement (Espace).',
      ),
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
    this.tileRegistry.register('move_choice', (s, ctx) =>
      this.applyMoveChoice(
        s,
        ctx.playerId,
        ctx.tile.type === 'move_choice' ? (ctx.tile.delta ?? 0) : 0,
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
      this.queueCourseDraws(
        s,
        [{ playerId: ctx.playerId, standId: 'bonus' }],
        'Piocher une course bonus (Espace).',
      ),
    );
    this.tileRegistry.register('move_to_stand', (s, ctx) =>
      this.applyMoveToNextStand(s, ctx.playerId),
    );
  }

  private registerStandHandlers(): void {
    // Stands paramétrables : tous les stands routent vers l'effet générique drawCourse
    this.standEffects.registerStand('stand', (s, ctx) =>
      this.queueCourseDraws(
        s,
        [{ playerId: ctx.playerId, standId: ctx.standId }],
        'Piocher une course (Espace).',
      ),
    );
    this.standIds().forEach((id) => {
      this.standEffects.registerStand(id, (s, ctx) =>
        this.queueCourseDraws(
          s,
          [{ playerId: ctx.playerId, standId: ctx.standId }],
          'Piocher une course (Espace).',
        ),
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
    const eventLabel = this.utils.formatEventLabel(event);
    next = this.core.appendLog(
      next,
      `[Panier Express] Carte Événement : ${eventLabel || String(event)}.`,
    );

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

    const removeOneCourseFromInventory = (
      pid: number,
      card: string,
    ): { updated: boolean } => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return { updated: false };
      let updated = false;
      const players = (next.players ?? []).map((p: any) => {
        if (p.id !== pid) return p;
        const inventory = this.utils.toStringArray(p.inventory);
        if (!inventory.includes(trimmed)) return p;
        updated = true;
        return { ...p, inventory: this.utils.removeOne(inventory, trimmed) };
      });
      next = { ...next, players };
      return { updated };
    };

    const addOneCourseToPlayer = (pid: number, card: string): void => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return;
      const players = (next.players ?? []).map((p: any) => {
        if (p.id !== pid) return p;
        const list = this.utils.toStringArray(p.shoppingList);
        const basket = this.utils.toStringArray(p.basket);
        const inventory = this.utils.toStringArray(p.inventory);
        const alreadyInBasket = basket.includes(trimmed);
        const alreadyInInventory = inventory.includes(trimmed);
        const isNeeded = list.includes(trimmed) && !alreadyInBasket;

        // Pas de doublons (inventaire/panier).
        // Bonus: si la carte est nécessaire et déjà dans l'inventaire, on la transfère au panier.
        // La nouvelle carte reçue est alors défaussée.
        if (alreadyInBasket || alreadyInInventory) {
          if (isNeeded && alreadyInInventory) {
            return {
              ...p,
              basket: [...basket, trimmed],
              inventory: this.utils.removeOne(inventory, trimmed),
            };
          }
          addToDiscard(trimmed);
          return p;
        }

        if (isNeeded) {
          return { ...p, basket: [...basket, trimmed], inventory };
        }

        // Cap inventaire: en cas de plein, défausser.
        if (inventory.length >= 5) {
          addToDiscard(trimmed);
          return p;
        }

        return { ...p, inventory: [...inventory, trimmed], basket };
      });
      next = { ...next, players };
      const metaNow = this.getMetadata(next) as any;
      const playerNow = (next.players ?? []).find((p: any) => p.id === pid);
      const hasCard =
        this.utils.toStringArray((playerNow as any)?.basket).includes(trimmed) ||
        this.utils.toStringArray((playerNow as any)?.inventory).includes(
          trimmed,
        );
      if (hasCard) {
        next = {
          ...next,
          metadata: {
            ...metaNow,
            lastObtainedCourse: {
              ...(metaNow?.lastObtainedCourse ?? {}),
              [pid]: trimmed,
            },
          },
        };
      }
    };

    const discardRandomCourse = (pid: number): string | null => {
      const player = (next.players ?? []).find((p) => p.id === pid) as any;
      if (!player) return null;
      const basket = this.utils.toStringArray(player.basket);
      const inventory = this.utils.toStringArray(player.inventory);
      if (!inventory.length) return null;

      // Robustesse : si une carte se retrouve à la fois dans panier+inventaire (état legacy / désync),
      // ne jamais défausser ce qui est déjà dans le panier.
      const inventoryOnly = basket.length
        ? inventory.filter((c) => !basket.includes(c))
        : inventory;
      if (!inventoryOnly.length) return null;
      const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
      const picked = this.random.pickOne(metaRng.getMeta(), inventoryOnly);
      next = { ...next, metadata: picked.meta };
      const card = String(picked.value ?? '').trim();
      if (!card) return null;
      const res = removeOneCourseFromInventory(pid, card);
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
        next = this.queueCourseDraws(
          next,
          [
            { playerId, standId: 'bonus' },
            { playerId, standId: 'bonus' },
          ],
          'Piocher une course bonus (Espace).',
        );
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
        next = this.core.appendLog(
          next,
          `[Panier Express] Stand exceptionnel : pioche 1 course bonus.`,
        );
        next = this.queueCourseDraws(
          next,
          [{ playerId, standId: 'bonus' }],
          'Piocher une course bonus (Espace).',
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'draw',
        });
        break;
      case 'fidelite-recompensee':
        next = this.turnStatus.setStatus(next, playerId, 'keepTurn', 1);
        next = this.core.appendLog(
          next,
          `[Panier Express] Fidélité récompensée : rejouez immédiatement.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'keepTurn',
        });
        break;
      case 'panier-bonus': {
        const targets = (next.players ?? [])
          .filter((p) => p.id !== playerId)
          .map((p: any) => ({ playerId: p.id, username: p.username }));
        const choices = targets
          .map((t: any) => String(t?.username ?? ''))
          .filter((v: string) => v.length > 0);
        if (!choices.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Panier bonus : aucun joueur disponible.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        next = setPickPending({
          label: 'Choisissez un joueur à qui prendre une carte, puis Entrée.',
          kind: 'event.panier_bonus.choose_target',
          choices,
          data: { targets },
        });
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'pick',
        });
        break;
      }
      case 'tirage-chanceux': {
        next = this.startDrawPending(
          next,
          playerId,
          { kind: 'event.tirage_chanceux' },
          'Tirage chanceux : piocher 3 cartes (Espace).',
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'pick',
        });
        break;
      }
      case 'producteur-genereux': {
        next = this.startDrawPending(
          next,
          playerId,
          { kind: 'event.producteur_genereux' },
          'Producteur généreux : piocher une course bonus (Espace).',
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'pick',
        });
        break;
      }
      case 'emballage-defectueux': {
        const me = (next.players ?? []).find((p) => p.id === playerId) as any;
        const cards = this.utils.toStringArray(me?.inventory);
        if (!cards.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Emballage défectueux : aucune carte à défausser.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        next = setPickPending({
          label: 'Choisissez une carte à défausser, puis Entrée.',
          kind: 'event.discard',
          choices: cards,
          data: { cards },
        });
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'pick_discard',
        });
        break;
      }
      case 'retour-en-arriere':
        next = this.core.appendLog(
          next,
          `[Panier Express] Retour en arrière : reculez de 3 cases.`,
        );
        next = this.applyMoveDelta(next, playerId, -3);
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'move',
          delta: -3,
        });
        break;
      case 'inspection-sanitaire':
        next = this.turnStatus.setStatus(
          next,
          playerId,
          'revealInventory',
          Math.max(1, (next.players ?? []).length),
        );
        next = this.turnStatus.setStatus(next, playerId, 'noDrawCourses', 1);
        next = this.core.appendLog(
          next,
          `[Panier Express] Inspection sanitaire : votre inventaire est visible jusqu'à votre prochain tour.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'reveal',
        });
        break;
      case 'file-inversee': {
        const metaNow = this.getMetadata(next);
        next = {
          ...next,
          metadata: {
            ...metaNow,
            movementDirection: -1,
            movementDirectionOwnerId: playerId,
          },
          turn: {
            ...(next.turn ?? { currentPlayerId: playerId, direction: 1 }),
            direction: -1,
          },
        };
        next = this.core.appendLog(
          next,
          `[Panier Express] File inversée : les joueurs reculent jusqu'à votre prochain tour.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'reverse',
        });
        break;
      }
      case 'don-du-maraicher':
        next = this.core.appendLog(
          next,
          `[Panier Express] Don du maraîcher : pioche 1 course bonus.`,
        );
        next = this.queueCourseDraws(
          next,
          [{ playerId, standId: 'bonus' }],
          'Piocher une course bonus (Espace).',
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'draw',
        });
        break;
      case 'marche-anime':
        next = this.queueCourseDraws(
          next,
          (next.players ?? []).map((p: any) => ({
            playerId: p.id,
            standId: 'bonus',
          })),
          'Piocher une course bonus (Espace).',
        );
        next = this.core.appendLog(
          next,
          `[Panier Express] Marché animé : tous les joueurs piochent 1 course.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'all_draw',
        });
        break;
      case 'journee-bio': {
        const metaNow = this.getMetadata(next);
        const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
        const positions = metaNow.positions ?? {};
        const targets = (next.players ?? [])
          .map((p: any) => {
            const pos = positions[p.id] ?? 0;
            const tile = tiles[pos] as any;
            if (
              tile?.type === 'stand' &&
              String(tile.standId ?? '').startsWith('bio')
            ) {
              return { playerId: p.id, standId: 'bonus' };
            }
            return null;
          })
          .filter(
            (t): t is { playerId: number; standId: string } =>
              t !== null && Number.isFinite(t.playerId),
          );
        if (targets.length) {
          next = this.queueCourseDraws(
            next,
            targets,
            'Piocher une course bonus (Espace).',
          );
        }
        next = this.core.appendLog(
          next,
          `[Panier Express] Journée bio : bonus pour les joueurs sur un stand Bio.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'multi_draw',
        });
        break;
      }
      case 'stand-ouvert-en-avance': {
        const metaNow = this.getMetadata(next);
        const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
        const total = tiles.length;
        const current = metaNow.positions?.[playerId] ?? 0;
        const direction = next.turn?.direction === -1 ? -1 : 1;
        let stands = 0;
        let stepsToMove = 0;
        for (let steps = 1; steps < total; steps += 1) {
          const idx = this.movement.moveCircular(
            total,
            current,
            steps * direction,
          );
          const tile = tiles[idx] as any;
          if (tile?.type === 'stand') {
            stands += 1;
            if (stands >= 2) {
              stepsToMove = steps * direction;
              break;
            }
          }
        }
        if (!stepsToMove) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Stand ouvert en avance : aucun stand trouvé.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        next = this.core.appendLog(
          next,
          `[Panier Express] Stand ouvert en avance : avance de 2 stands.`,
        );
        next = this.movePlayer(next, playerId, stepsToMove);
        next = this.resolveTile(next, playerId);
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'move_to_stand',
          stepsToMove,
        });
        break;
      }
      case 'echange-spontane': {
        const me = (next.players ?? []).find((p) => p.id === playerId) as any;
        const inv = this.utils.toStringArray(me?.inventory);
        const targets = (next.players ?? [])
          .filter((p) => p.id !== playerId)
          .map((p: any) => ({ playerId: p.id, username: p.username }));
        const choices = targets
          .map((t: any) => String(t?.username ?? ''))
          .filter((v: string) => v.length > 0);
        if (!inv.length || !choices.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Échange spontané : aucun échange possible.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        next = setPickPending({
          label: "Choisissez un joueur pour l'échange, puis Entrée.",
          kind: 'event.echange_spontane.choose_target',
          choices,
          data: { targets, giveChoices: inv },
        });
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'pick',
        });
        break;
      }
      case 'intemperie-au-marche':
        (next.players ?? []).forEach((p: any) => {
          next = this.movePlayer(next, p.id, -1);
        });
        next = this.core.appendLog(
          next,
          `[Panier Express] Intempérie : tous les joueurs reculent d'une case.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'all_move',
          delta: -1,
        });
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
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel} : avance jusqu'à la case 40.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'goto40',
        });
        break;
      }
      case 'recette-express': {
        const me = (next.players ?? []).find((p) => p.id === playerId) as any;
        const list = this.utils.toStringArray(me?.shoppingList);
        const basket = this.utils.toStringArray(me?.basket);
        const owned = new Set(basket);
        const uniques = new Set(list.filter((item) => owned.has(item)));
        const requiredItems = 1;
        const requirementLabel =
          requiredItems > 1
            ? `${requiredItems} ingrédients requis`
            : '1 ingrédient requis';
        if (list.length === 0 || uniques.size < requiredItems) {
          next = this.core.appendLog(
            next,
            `[Panier Express] ${eventLabel} : condition non remplie (${requirementLabel}).`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const metaRng = this.random.createMetaRng(
          this.getMetadata(next) as any,
        );
        const picked = this.random.pickOne(metaRng.getMeta(), list);
        next = { ...next, metadata: picked.meta };
        const card = String(picked.value ?? '').trim();
        if (!card) {
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        next = {
          ...next,
          players: (next.players ?? []).map((p: any) => {
            if (p.id !== playerId) return p;
            const nextBasket = this.utils.toStringArray(p.basket);
            return { ...p, basket: [...nextBasket, card] };
          }),
        };
        const metaNow = this.getMetadata(next);
        next = {
          ...next,
          metadata: {
            ...metaNow,
            lastObtainedCourse: {
              ...((metaNow as any)?.lastObtainedCourse ?? {}),
              [playerId]: card,
            },
          } as any,
        };
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel} : reçoit "${this.utils.formatCourseLabel(card)}".`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'grant',
          card,
        });
        break;
      }
      case 'stand-en-fete': {
        const metaNow = this.getMetadata(next);
        const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
        const total = tiles.length;
        const position = metaNow.positions?.[playerId] ?? 0;
        let bestIndex: number | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let idx = 0; idx < total; idx += 1) {
          const tile = tiles[idx] as any;
          if (tile?.type !== 'stand') continue;
          const forward = (idx - position + total) % total;
          const backward = (position - idx + total) % total;
          const dist = Math.min(forward, backward);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = idx;
          }
        }
        if (bestIndex == null) {
          next = this.core.appendLog(
            next,
            `[Panier Express] ${eventLabel} : aucun stand trouvé.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const targets = (next.players ?? []).filter(
          (p: any) => (metaNow.positions?.[p.id] ?? 0) === bestIndex,
        );
        if (!targets.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] ${eventLabel} : aucun joueur sur le stand.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        next = this.queueCourseDraws(
          next,
          targets.map((p: any) => ({ playerId: p.id, standId: 'bonus' })),
          'Piocher une course bonus (Espace).',
        );
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel} : bonus pour les joueurs sur le stand.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'multi_draw',
          count: targets.length,
        });
        break;
      }
      case 'produit-oublie': {
        const items = this.setup.courseItems();
        const metaRng = this.random.createMetaRng(
          this.getMetadata(next) as any,
        );
        const picked = items.length
          ? this.random.pickOne(metaRng.getMeta(), items)
          : null;
        next = picked ? { ...next, metadata: picked.meta } : next;
        const added = picked ? String(picked.value ?? '').trim() : null;
        if (!added) break;
        addOneCourseToPlayer(playerId, added);
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel} : récupère "${this.utils.formatCourseLabel(added)}".`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'grant',
          card: added,
        });
        break;
      }
      case 'offre-ephemere': {
        const discard = ensureDiscardCourses();
        if (!discard.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] ${eventLabel} : défausse vide.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const metaRng = this.random.createMetaRng(
          this.getMetadata(next) as any,
        );
        const picked = this.random.pickOne(metaRng.getMeta(), discard);
        next = { ...next, metadata: picked.meta };
        const card = String(picked.value ?? '').trim();
        if (!card) break;
        const remaining = discard.filter((c) => c !== card);
        const metaNow = this.getMetadata(next);
        next = {
          ...next,
          metadata: {
            ...metaNow,
            discards: { ...metaNow.discards, courses: remaining },
          },
        };
        addOneCourseToPlayer(playerId, card);
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel} : récupère "${this.utils.formatCourseLabel(card)}".`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'from_discard',
          card,
        });
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
          next = this.core.appendLog(
            next,
            `[Panier Express] ${eventLabel} : ${this.utils.playerName(state, maxId)} défausse "${this.utils.formatCourseLabel(discarded)}".`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'max_discard',
            discarded,
            targetPlayerId: maxId,
          });
          break;
        }
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'none',
        });
        break;
      }
      case 'stand-surprise': {
        const metaAny = this.getMetadata(next) as any;
        const rng = this.random.rollDice(metaAny, 6);
        next = { ...next, metadata: rng.meta };
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
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'move_to_nearest_stand',
          roll,
        });
        break;
      }
      case 'carton-abime':
        next = this.turnStatus.setStatus(
          next,
          playerId,
          'revealShoppingList',
          1,
        );
        next = this.core.appendLog(
          next,
          `[Panier Express] Carton abîmé : votre liste est visible (1 tour).`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'reveal_list',
        });
        break;
      case 'conseil-de-voisinage': {
        const me = (next.players ?? []).find((p) => p.id === playerId) as any;
        const myList = this.utils.toStringArray(me?.shoppingList);
        const myBasket = this.utils.toStringArray(me?.basket);
        const myInventory = this.utils.toStringArray(me?.inventory);
        const missing = new Set(
          myList.filter((item) => !myBasket.includes(item)),
        );
        if (!missing.size) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Conseil de voisinage : aucun besoin (liste déjà complète).`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const candidates: Array<{
          targetPlayerId: number;
          card: string;
          label: string;
        }> = [];
        (next.players ?? []).forEach((p: any) => {
          if (p.id === playerId) return;
          const inv = this.utils.toStringArray(p.inventory);
          inv.forEach((card) => {
            if (!missing.has(card)) return;
            const label = `${String(p.username ?? `Joueur ${p.id}`)}: ${card}`;
            candidates.push({ targetPlayerId: p.id, card, label });
          });
        });
        if (!candidates.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Conseil de voisinage : aucun autre joueur n'a de carte utile pour votre liste.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        next = setPickPending({
          label: 'Choisissez une carte à prendre, puis Entrée.',
          kind: 'event.conseil_voisinage.pick',
          choices: candidates.map((c) => c.label),
          data: { candidates, myInventory },
        });
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'pick',
        });
        break;
      }
      case 'troc-improvise': {
        const order = (next.players ?? [])
          .map((p: any) => Number(p.id))
          .filter((id: any) => Number.isFinite(id));
        const start = order.indexOf(playerId);
        if (!order.length || start < 0) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Troc improvisé : impossible.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        let cursor = start;
        let processed = 0;
        while (processed < order.length) {
          const pid = order[cursor];
          const inv = this.utils.toStringArray(
            (next.players ?? []).find((p: any) => p.id === pid)?.inventory,
          );
          if (inv.length) {
            next = {
              ...next,
              pending: {
                type: 'pick',
                playerId: pid,
                blocking: true,
                label:
                  'Choisissez une carte à donner au joueur suivant, puis Entrée.',
                choices: inv,
                data: {
                  kind: 'event.troc_improvise',
                  order,
                  cursor,
                  processed,
                },
              } as any,
            };
            break;
          }
          cursor = (cursor + 1) % order.length;
          processed += 1;
        }
        if (!next.pending) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Troc improvisé : aucun inventaire à échanger.`,
          );
        }
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'multi_pick',
        });
        break;
      }
      case 'changement-de-saison': {
        const order = (next.players ?? [])
          .map((p: any) => Number(p.id))
          .filter((id: any) => Number.isFinite(id));
        const start = order.indexOf(playerId);
        if (!order.length || start < 0) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Changement de saison : impossible.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }

        let cursor = start;
        let processed = 0;
        while (processed < order.length) {
          const pid = order[cursor];
          const player = (next.players ?? []).find(
            (p: any) => p.id === pid,
          ) as any;
          const cards = this.utils.toStringArray(player?.inventory);
          if (cards.length) {
            next = {
              ...next,
              pending: {
                type: 'pick',
                playerId: pid,
                blocking: true,
                label: 'Choisissez une carte à défausser, puis Entrée.',
                choices: cards,
                data: {
                  kind: 'event.changement_de_saison',
                  order,
                  cursor,
                  processed,
                  cards,
                },
              } as any,
            };
            break;
          }
          // Si le joueur n'a aucune carte : il pioche quand même.
          next = {
            ...next,
            pending: {
              type: 'draw',
              playerId: pid,
              blocking: true,
              label: 'Piocher une course bonus (Espace).',
              data: {
                kind: 'event.changement_de_saison',
                order,
                cursor,
                processed,
              },
            },
          } as any;
          break;
          cursor = (cursor + 1) % order.length;
          processed += 1;
        }

        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'multi_pick',
        });
        break;
      }
      case 'echange-obligatoire': {
        const players = next.players ?? [];
        const idx = players.findIndex((p: any) => p.id === playerId);
        if (idx < 0 || players.length < 2) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Échange obligatoire : aucun échange possible.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const targetId = Number(players[(idx + 1) % players.length]?.id);
        const me = (next.players ?? []).find(
          (p: any) => p.id === playerId,
        ) as any;
        const target = (next.players ?? []).find(
          (p: any) => p.id === targetId,
        ) as any;
        const myInv = this.utils.toStringArray(me?.inventory);
        const theirInv = this.utils.toStringArray(target?.inventory);
        if (!myInv.length || !theirInv.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Échange obligatoire : inventaire vide.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const metaRng = this.random.createMetaRng(
          this.getMetadata(next) as any,
        );
        const pickA = this.random.pickOne(metaRng.getMeta(), myInv);
        next = { ...next, metadata: pickA.meta };
        const giveA = String(pickA.value ?? '').trim();
        const pickB = this.random.pickOne(next.metadata as any, theirInv);
        next = { ...next, metadata: pickB.meta };
        const giveB = String(pickB.value ?? '').trim();
        if (giveA) removeOneCourseFromPlayer(playerId, giveA);
        if (giveB) removeOneCourseFromPlayer(targetId, giveB);
        if (giveA) addOneCourseToPlayer(targetId, giveA);
        if (giveB) addOneCourseToPlayer(playerId, giveB);
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange obligatoire : échange entre ${this.utils.playerName(state, playerId)} et ${this.utils.playerName(state, targetId)}.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'swap_random',
          targetId,
        });
        break;
      }
      case 'inversion-de-panier': {
        const others = (next.players ?? [])
          .filter((p: any) => p.id !== playerId)
          .map((p: any) => p.id);
        if (!others.length) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Inversion de panier : aucun joueur disponible.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const metaRng = this.random.createMetaRng(
          this.getMetadata(next) as any,
        );
        const picked = this.random.pickOne(metaRng.getMeta(), others);
        next = { ...next, metadata: picked.meta };
        const targetId = Number(picked.value);
        const playersWithInventory = (next.players ?? []).map((p: any) => {
          if (p.id !== playerId && p.id !== targetId) return p;
          return { ...p, inventory: this.utils.toStringArray(p.inventory) };
        });
        const me = playersWithInventory.find((p: any) => p.id === playerId);
        const target = playersWithInventory.find((p: any) => p.id === targetId);
        const myInventory = this.utils.toStringArray(me?.inventory);
        const theirInventory = this.utils.toStringArray(target?.inventory);
        const swapped = playersWithInventory.map((p: any) => {
          if (p.id === playerId) return { ...p, inventory: theirInventory };
          if (p.id === targetId) return { ...p, inventory: myInventory };
          return p;
        });
        next = { ...next, players: swapped };
        next = this.core.appendLog(
          next,
          `[Panier Express] Inversion de panier : échange d'inventaire avec ${this.utils.playerName(state, targetId)}.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'swap_inventory',
          targetId,
        });
        break;
      }
      case 'rupture-de-stock':
      case 'stand-detrempe':
        next = this.turnStatus.setStatus(next, playerId, 'noDrawCourses', 1);
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel || event} : aucune pioche de course ce tour-ci.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'no_draw',
        });
        break;
      case 'marche-bonde':
      case 'file-attente-interminable':
      case 'panne-de-caisse':
        next = this.turnStatus.setStatus(next, playerId, 'skipTurn', 1);
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel} : vous passez votre prochain tour.`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'skipTurn',
        });
        break;
      case 'chariot-perce': {
        const metaNow = this.getMetadata(next) as any;
        const last = String(
          metaNow?.lastObtainedCourse?.[playerId] ?? '',
        ).trim();
        if (!last) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Chariot percé : aucune dernière carte à défausser.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        const removed = removeOneCourseFromPlayer(playerId, last);
        if (!removed.updated) {
          next = this.core.appendLog(
            next,
            `[Panier Express] Chariot percé : "${this.utils.formatCourseLabel(last)}" introuvable.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'none',
          });
          break;
        }
        addToDiscard(last);
        const metaAfter = this.getMetadata(next) as any;
        next = {
          ...next,
          metadata: {
            ...metaAfter,
            lastObtainedCourse: {
              ...(metaAfter?.lastObtainedCourse ?? {}),
              [playerId]: null,
            },
          },
        };
        next = this.core.appendLog(
          next,
          `[Panier Express] Chariot percé : défausse "${this.utils.formatCourseLabel(last)}".`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'discard_last',
          card: last,
        });
        break;
      }
      default:
        if (
          event === 'erreur-de-livraison' ||
          event === 'produit-avarie' ||
          event === 'emballage-oublie'
        ) {
          const discarded = discardRandomCourse(playerId);
          next = this.core.appendLog(
            next,
            discarded
              ? `[Panier Express] ${eventLabel} : ${this.utils.playerName(state, playerId)} défausse "${this.utils.formatCourseLabel(discarded)}".`
              : `[Panier Express] ${eventLabel} : aucune carte à défausser.`,
          );
          next = this.appendActionLog(next, playerId, 'event', {
            event,
            effect: 'discard_random',
            discarded,
          });
          break;
        }
        next = this.core.appendLog(
          next,
          `[Panier Express] ${eventLabel} : aucun effet (best-effort).`,
        );
        next = this.appendActionLog(next, playerId, 'event', {
          event,
          effect: 'none',
        });
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
    if (resolved.pending?.type === 'draw') {
      return resolved;
    }
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
    const pending = state.pending as any;
    const pendingCard =
      pending && pending.type === 'exchange' && pending.step === 'confirm'
        ? String(pending.card ?? '')
        : '';
    const initiatorId =
      pending && pending.type === 'exchange' && pending.step === 'confirm'
        ? Number(pending.initiatorPlayerId)
        : NaN;

    const resolved = this.exchangeSvc.refuseOffer(state, actorId);
    if (pendingCard === 'troc-equitable' && Number.isFinite(initiatorId)) {
      const withQuiz = this.quizSvc.applyQuiz(resolved, initiatorId);
      return this.core.appendLog(
        withQuiz,
        `[Panier Express] Troc équitable : échange refusé, quiz pour ${this.utils.playerName(state, initiatorId)}.`,
      );
    }
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
        : (state.turn?.currentPlayerId ?? null);
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
      base: GameStateEntity,
      playerId: number,
      updater: (player: any) => any,
    ): GameStateEntity => {
      const players = (base.players ?? []).map((p: any) =>
        p.id === playerId ? updater(p) : p,
      );
      return { ...base, players };
    };

    const removeCourseFromPlayer = (
      base: GameStateEntity,
      playerId: number,
      card: string,
    ): { state: GameStateEntity; removed: boolean } => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return { state: base, removed: false };
      let removed = false;
      const updated = updatePlayer(base, playerId, (p: any) => {
        const inventory = this.utils.toStringArray(p.inventory);
        if (inventory.includes(trimmed)) {
          removed = true;
          return { ...p, inventory: this.utils.removeOne(inventory, trimmed) };
        }
        return p;
      });
      return { state: updated, removed };
    };

    const discardCourse = (
      base: GameStateEntity,
      playerId: number,
      card: string,
    ): GameStateEntity => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return base;
      const removed = removeCourseFromPlayer(base, playerId, trimmed);
      if (!removed.removed) return base;
      const currentMeta = this.getMetadata(removed.state);
      const nextMeta: PanierExpressMetadata = {
        ...currentMeta,
        discards: {
          ...currentMeta.discards,
          courses: [...(currentMeta.discards?.courses ?? []), trimmed],
        },
      };
      return { ...removed.state, metadata: nextMeta };
    };

    const addCourseToPlayer = (
      base: GameStateEntity,
      playerId: number,
      card: string,
    ): GameStateEntity => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return base;
      let kept = false;
      const next = updatePlayer(base, playerId, (p: any) => {
        const list = this.utils.toStringArray(p.shoppingList);
        const basket = this.utils.toStringArray(p.basket);
        const inventory = this.utils.toStringArray(p.inventory);
        const alreadyInBasket = basket.includes(trimmed);
        const alreadyInInventory = inventory.includes(trimmed);
        const isNeeded = list.includes(trimmed) && !alreadyInBasket;

        // Pas de doublons (inventaire/panier). Si nécessaire et présent en inventaire,
        // transférer vers le panier (et défausser la carte reçue).
        if (alreadyInBasket || alreadyInInventory) {
          if (isNeeded && alreadyInInventory) {
            return {
              ...p,
              basket: [...basket, trimmed],
              inventory: this.utils.removeOne(inventory, trimmed),
            };
          }
          return p;
        }

        if (isNeeded) {
          kept = true;
          return { ...p, basket: [...basket, trimmed], inventory };
        }

        if (inventory.length >= 5) {
          return p;
        }

        kept = true;
        return { ...p, inventory: [...inventory, trimmed], basket };
      });
      const nextMeta = this.getMetadata(next) as any;
      const discards = Array.isArray(nextMeta?.discards?.courses)
        ? nextMeta.discards.courses.map((v: any) => String(v))
        : [];
      const withDiscard = kept
        ? next
        : ({
            ...next,
            metadata: {
              ...nextMeta,
              discards: { ...nextMeta.discards, courses: [...discards, trimmed] },
            },
          } as any);
      if (!kept) return withDiscard;
      const metaAfter = this.getMetadata(withDiscard) as any;
      return {
        ...withDiscard,
        metadata: {
          ...metaAfter,
          lastObtainedCourse: {
            ...(metaAfter?.lastObtainedCourse ?? {}),
            [playerId]: trimmed,
          },
        } as any,
      };
    };

    const clearPending = (s: GameStateEntity): GameStateEntity => ({
      ...s,
      pending: null,
    });

    if (kind === 'setup.choose_pawn') {
      const choices = Array.isArray(pending?.choices) ? pending.choices : [];
      const chosen = String(choices[index] ?? '').trim();
      if (!chosen) {
        return clearPending(state);
      }
      let next = clearPending(state);
      next = updatePlayer(next, actorId, (p: any) => ({ ...p, pawn: chosen }));
      next = this.core.appendLog(
        next,
        `[Panier Express] ${this.utils.playerName(state, actorId)} choisit le pion: ${chosen}.`,
      );
      // Continuer la sélection des pions ou démarrer la partie si tout est prêt.
      const statusNow = String(state.status ?? '').toLowerCase();
      if (statusNow === 'starting') {
        return this.ensureStarted({ ...next, status: 'starting' });
      }
      return this.queuePawnSelection({ ...next, status: state.status ?? 'open' });
    }

    if (kind === 'event.tirage_chanceux') {
      const offered = Array.isArray(pending?.data?.offered)
        ? pending.data.offered.map((v: any) => String(v))
        : Array.isArray(pending?.data?.cards)
          ? pending.data.cards.map((v: any) => String(v))
          : [];
      const chosen = offered[index] ?? '';
      let next = clearPending(state);

      // Les 3 cartes proposées ont été retirées du deck lors du tirage ; remettre les non-choisies en discard.
      const unchosen = offered.filter((_v: string, i: number) => i !== index);
      if (unchosen.length) {
        const metaNow = this.getMetadata(next) as any;
        next = {
          ...next,
          metadata: {
            ...metaNow,
            decks: this.deckPool.discardMany<string>(
              metaNow.decks ?? {},
              'courses-bonus',
              unchosen,
            ) as any,
          },
        };
      }

      next = addCourseToPlayer(next, actorId, chosen);
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
      next = discardCourse(next, actorId, chosen);
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
      const choices = targets
        .map((t: any) => String(t?.username ?? ''))
        .filter((v: string) => v.length > 0);
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
      const removed = removeCourseFromPlayer(next, actorId, give);
      next = removed.state;
      if (removed.removed) {
        next = addCourseToPlayer(next, targetPlayerId, give);
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

    if (kind === 'event.panier_bonus.choose_target') {
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosenTarget = targets[index];
      const targetPlayerId = Number(chosenTarget?.playerId);
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);

      let next = clearPending(state);
      const target = (next.players ?? []).find(
        (p: any) => p.id === targetPlayerId,
      ) as any;
      const cards = this.utils.toStringArray(target?.inventory);
      if (!cards.length) {
        next = this.core.appendLog(
          next,
          `[Panier Express] Panier bonus : ${this.utils.playerName(state, targetPlayerId)} n'a aucune carte.`,
        );
        return this.phaseFlow.advanceTurn(next);
      }
      const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
      const picked = this.random.pickOne(metaRng.getMeta(), cards);
      next = { ...next, metadata: picked.meta };
      const stolen = String(picked.value ?? '').trim();
      if (stolen) {
        const removed = removeCourseFromPlayer(next, targetPlayerId, stolen);
        next = removed.state;
        if (removed.removed) {
          next = addCourseToPlayer(next, actorId, stolen);
        }
      }
      next = this.core.appendLog(
        next,
        `[Panier Express] Panier bonus : ${this.utils.playerName(state, actorId)} prend "${this.utils.formatCourseLabel(stolen)}" à ${this.utils.playerName(state, targetPlayerId)}.`,
      );
      next = this.appendActionLog(next, actorId, 'event', {
        event: 'panier-bonus',
        targetPlayerId,
        card: stolen,
      });
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'event.echange_spontane.choose_target') {
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosenTarget = targets[index];
      const targetPlayerId = Number(chosenTarget?.playerId);
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      const me = (state.players ?? []).find(
        (p: any) => p.id === actorId,
      ) as any;
      const inv = this.utils.toStringArray(me?.inventory);
      if (!inv.length) return clearPending(state);
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: actorId,
          blocking: true,
          label: 'Choisissez la carte à donner (inventaire), puis Entrée.',
          choices: inv,
          data: { kind: 'event.echange_spontane.choose_give', targetPlayerId },
        } as any,
      };
    }

    if (kind === 'event.echange_spontane.choose_give') {
      const targetPlayerId = Number(pending?.data?.targetPlayerId);
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      const give = String(choices[index] ?? '').trim();
      if (!give) return clearPending(state);

      let next = clearPending(state);
      const target = (next.players ?? []).find(
        (p: any) => p.id === targetPlayerId,
      ) as any;
      const targetInv = this.utils.toStringArray(target?.inventory);
      if (!targetInv.length) {
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange spontané : ${this.utils.playerName(state, targetPlayerId)} n'a aucune carte.`,
        );
        return this.phaseFlow.advanceTurn(next);
      }
      const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
      const picked = this.random.pickOne(metaRng.getMeta(), targetInv);
      next = { ...next, metadata: picked.meta };
      const take = String(picked.value ?? '').trim();
      if (!take) return this.phaseFlow.advanceTurn(next);

      const removedGive = removeCourseFromPlayer(next, actorId, give);
      next = removedGive.state;
      const removedTake = removeCourseFromPlayer(next, targetPlayerId, take);
      next = removedTake.state;
      if (removedGive.removed)
        next = addCourseToPlayer(next, targetPlayerId, give);
      if (removedTake.removed) next = addCourseToPlayer(next, actorId, take);

      next = this.core.appendLog(
        next,
        `[Panier Express] Échange spontané : ${this.utils.playerName(state, actorId)} donne "${this.utils.formatCourseLabel(give)}" à ${this.utils.playerName(state, targetPlayerId)} et reçoit "${this.utils.formatCourseLabel(take)}" de ${this.utils.playerName(state, targetPlayerId)}.`,
      );
      next = this.appendActionLog(next, actorId, 'event', {
        event: 'echange-spontane',
        give,
        take,
        targetPlayerId,
      });
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'event.conseil_voisinage.pick') {
      const candidates = Array.isArray(pending?.data?.candidates)
        ? pending.data.candidates
        : [];
      const chosen = candidates[index];
      const targetPlayerId = Number(chosen?.targetPlayerId);
      const card = String(chosen?.card ?? '').trim();
      if (!Number.isFinite(targetPlayerId) || !card) return clearPending(state);

      let next = clearPending(state);
      const removed = removeCourseFromPlayer(next, targetPlayerId, card);
      next = removed.state;
      if (removed.removed) {
        next = addCourseToPlayer(next, actorId, card);
      }

      const me = (next.players ?? []).find((p: any) => p.id === actorId) as any;
      const myInv = this.utils.toStringArray(me?.inventory);
      if (myInv.length) {
        const metaRng = this.random.createMetaRng(
          this.getMetadata(next) as any,
        );
        const picked = this.random.pickOne(metaRng.getMeta(), myInv);
        next = { ...next, metadata: picked.meta };
        const give = String(picked.value ?? '').trim();
        if (give) {
          const removedGive = removeCourseFromPlayer(next, actorId, give);
          next = removedGive.state;
          if (removedGive.removed) {
            next = addCourseToPlayer(next, targetPlayerId, give);
          }
        }
      }

      next = this.core.appendLog(
        next,
        `[Panier Express] Conseil de voisinage : ${this.utils.playerName(state, actorId)} prend "${this.utils.formatCourseLabel(card)}" à ${this.utils.playerName(state, targetPlayerId)}.`,
      );
      next = this.appendActionLog(next, actorId, 'event', {
        event: 'conseil-de-voisinage',
        card,
        targetPlayerId,
      });
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'event.troc_improvise') {
      const order = Array.isArray(pending?.data?.order)
        ? pending.data.order.map((v: any) => Number(v))
        : [];
      const cursor = Number(pending?.data?.cursor);
      const processed = Number(pending?.data?.processed);
      const give = String(choices[index] ?? '').trim();
      if (
        !order.length ||
        !Number.isFinite(cursor) ||
        !Number.isFinite(processed) ||
        !give
      ) {
        return clearPending(state);
      }

      let next = clearPending(state);
      const giverIndex = Math.max(0, Math.min(order.length - 1, cursor));
      const giverId = Number(order[giverIndex]);
      const receiverId = Number(order[(giverIndex + 1) % order.length]);

      const removed = removeCourseFromPlayer(next, giverId, give);
      next = removed.state;
      if (removed.removed) {
        next = addCourseToPlayer(next, receiverId, give);
      }

      let nextCursor = (giverIndex + 1) % order.length;
      let nextProcessed = processed + 1;
      while (nextProcessed < order.length) {
        const pid = Number(order[nextCursor]);
        const player = (next.players ?? []).find(
          (p: any) => p.id === pid,
        ) as any;
        const inv = this.utils.toStringArray(player?.inventory);
        if (inv.length) {
          return {
            ...next,
            pending: {
              type: 'pick',
              playerId: pid,
              blocking: true,
              label:
                'Choisissez une carte à donner au joueur suivant, puis Entrée.',
              choices: inv,
              data: {
                kind: 'event.troc_improvise',
                order,
                cursor: nextCursor,
                processed: nextProcessed,
              },
            } as any,
          };
        }
        nextCursor = (nextCursor + 1) % order.length;
        nextProcessed += 1;
      }

      next = this.core.appendLog(
        next,
        `[Panier Express] Troc improvisé : terminé.`,
      );
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'event.changement_de_saison') {
      const order = Array.isArray(pending?.data?.order)
        ? pending.data.order.map((v: any) => Number(v))
        : [];
      const cursor = Number(pending?.data?.cursor);
      const processed = Number(pending?.data?.processed);
      const chosen = String(choices[index] ?? '').trim();
      if (
        !order.length ||
        !Number.isFinite(cursor) ||
        !Number.isFinite(processed)
      ) {
        return clearPending(state);
      }

      let next = clearPending(state);
      const currentIndex = Math.max(0, Math.min(order.length - 1, cursor));
      const pid = Number(order[currentIndex]);

      if (chosen) {
        next = discardCourse(next, pid, chosen);
      }
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId: pid,
          blocking: true,
          label: 'Piocher une course bonus (Espace).',
          data: {
            kind: 'event.changement_de_saison',
            order,
            cursor: currentIndex,
            processed,
          },
        },
      } as any;
    }

    if (kind === 'tile.move_choice') {
      const delta = Math.max(1, Math.abs(Number(pending?.data?.delta ?? 2)));
      const signed = index === 0 ? delta : -delta;
      let next = clearPending(state);
      next = this.applyMoveDelta(next, actorId, signed);
      next = this.appendActionLog(next, actorId, 'tile', {
        tile: 'move_choice',
        delta: signed,
      });
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'exchange.troc_rapide.choose_give') {
      const targetPlayerId = Number(pending?.data?.targetPlayerId);
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      const give = String(choices[index] ?? '').trim();
      if (!give) return clearPending(state);
      let next = clearPending(state);
      const target = (next.players ?? []).find(
        (p: any) => p.id === targetPlayerId,
      ) as any;
      const targetInv = this.utils.toStringArray(target?.inventory);
      if (!targetInv.length) {
        next = this.core.appendLog(
          next,
          `[Panier Express] Troc rapide : cible sans inventaire.`,
        );
        return this.phaseFlow.advanceTurn(next);
      }
      const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
      const picked = this.random.pickOne(metaRng.getMeta(), targetInv);
      next = { ...next, metadata: picked.meta };
      const take = String(picked.value ?? '').trim();
      const removedGive = removeCourseFromPlayer(next, actorId, give);
      next = removedGive.state;
      const removedTake = removeCourseFromPlayer(next, targetPlayerId, take);
      next = removedTake.state;
      if (removedGive.removed)
        next = addCourseToPlayer(next, targetPlayerId, give);
      if (removedTake.removed) next = addCourseToPlayer(next, actorId, take);
      next = this.core.appendLog(
        next,
        `[Panier Express] Troc rapide : ${this.utils.playerName(state, actorId)} donne "${this.utils.formatCourseLabel(give)}" et reçoit "${this.utils.formatCourseLabel(take)}".`,
      );
      return this.phaseFlow.advanceTurn(next);
    }

    // ---- Exchanges: règles avancées (multi-étapes / contraintes) ----
    const buildCourseSets = () => {
      const stands = this.setup.standCourseMap();
      const fruitStand = (id: string) =>
        id.includes('fruit') || id === 'agrumes' || id === 'maraicher-automne';
      const winterVegStand = (id: string) =>
        id === 'primeur-hivernal' ||
        id === 'bio-legumes' ||
        id === 'champignons' ||
        id.startsWith('legumes-');
      const fruit = new Set<string>();
      const veg = new Set<string>();
      const summerFruit = new Set<string>();
      const winterVeg = new Set<string>();
      Object.entries(stands).forEach(([id, items]) => {
        const list = Array.isArray(items) ? items.map((v) => String(v)) : [];
        if (id === 'bonus') return;
        if (fruitStand(id)) {
          list.forEach((c) => fruit.add(c));
          if (id !== 'fruits-hiver') list.forEach((c) => summerFruit.add(c));
        } else {
          list.forEach((c) => veg.add(c));
          if (winterVegStand(id)) list.forEach((c) => winterVeg.add(c));
        }
      });
      return { fruit, veg, summerFruit, winterVeg };
    };

    if (kind === 'exchange.strategique.choose_target') {
      const exchangeId = pending?.data?.exchangeId ?? null;
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosenTarget = targets[index];
      const targetPlayerId = Number(chosenTarget?.playerId);
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      const target = (state.players ?? []).find(
        (p: any) => p.id === targetPlayerId,
      ) as any;
      const targetInv = this.utils.toStringArray(target?.inventory);
      if (!targetInv.length) {
        let next = clearPending(state);
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange stratégique : cible sans inventaire.`,
        );
        return this.phaseFlow.advanceTurn(next);
      }
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: actorId,
          blocking: true,
          label:
            'Choisissez la carte à recevoir (inventaire adverse), puis Entrée.',
          choices: targetInv,
          data: {
            kind: 'exchange.strategique.choose_take',
            exchangeId,
            targetPlayerId,
            takeChoices: targetInv,
          },
        } as any,
      };
    }

    if (kind === 'exchange.strategique.choose_take') {
      const exchangeId = pending?.data?.exchangeId ?? null;
      const targetPlayerId = Number(pending?.data?.targetPlayerId);
      const takeChoices = Array.isArray(pending?.data?.takeChoices)
        ? pending.data.takeChoices.map((v: any) => String(v))
        : [];
      const take = String(takeChoices[index] ?? '').trim();
      if (!Number.isFinite(targetPlayerId) || !take) return clearPending(state);
      const me = (state.players ?? []).find(
        (p: any) => p.id === actorId,
      ) as any;
      const myInv = this.utils.toStringArray(me?.inventory);
      if (!myInv.length) return clearPending(state);
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: actorId,
          blocking: true,
          label: 'Choisissez la carte à offrir (inventaire), puis Entrée.',
          choices: myInv,
          data: {
            kind: 'exchange.strategique.choose_give',
            exchangeId,
            targetPlayerId,
            take,
          },
        } as any,
      };
    }

    if (kind === 'exchange.strategique.choose_give') {
      const exchangeId = pending?.data?.exchangeId ?? null;
      const targetPlayerId = Number(pending?.data?.targetPlayerId);
      const take = String(pending?.data?.take ?? '').trim();
      const give = String(choices[index] ?? '').trim();
      if (!Number.isFinite(targetPlayerId) || !take || !give)
        return clearPending(state);
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: targetPlayerId,
          blocking: true,
          label: `Échange stratégique : accepter l'échange ?`,
          choices: ['Accepter', 'Refuser'],
          data: {
            kind: 'exchange.strategique.confirm',
            exchangeId,
            initiatorId: actorId,
            targetPlayerId,
            give,
            take,
          },
        } as any,
      };
    }

    if (kind === 'exchange.strategique.confirm') {
      const initiatorId = Number(pending?.data?.initiatorId);
      const targetPlayerId = Number(pending?.data?.targetPlayerId);
      const give = String(pending?.data?.give ?? '').trim();
      const take = String(pending?.data?.take ?? '').trim();
      const exchangeId = pending?.data?.exchangeId ?? null;
      if (
        !Number.isFinite(initiatorId) ||
        !Number.isFinite(targetPlayerId) ||
        !give ||
        !take
      ) {
        return clearPending(state);
      }

      const meta = this.getMetadata(state) as any;
      const alreadyResolved = Array.isArray(meta?.actionLog)
        ? meta.actionLog.some(
            (e: any) =>
              e?.type === 'exchange' &&
              e?.payload?.kind === 'exchange.strategique.confirm' &&
              exchangeId != null &&
              e?.payload?.exchangeId === exchangeId,
          )
        : false;

      if (alreadyResolved) {
        return clearPending(state);
      }
      let next = clearPending(state);
      const accepted = index === 0;
      next = this.appendActionLog(next, actorId, 'exchange', {
        kind: 'exchange.strategique.confirm',
        exchangeId,
        initiatorId,
        targetPlayerId,
        accepted,
        give,
        take,
      });
      if (accepted) {
        const removedGive = removeCourseFromPlayer(next, initiatorId, give);
        next = removedGive.state;
        const removedTake = removeCourseFromPlayer(next, actorId, take);
        next = removedTake.state;
        if (removedGive.removed) next = addCourseToPlayer(next, actorId, give);
        if (removedTake.removed)
          next = addCourseToPlayer(next, initiatorId, take);
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange stratégique : accepté (${this.utils.playerName(state, initiatorId)} ⇄ ${this.utils.playerName(state, actorId)}).`,
        );
      } else {
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange stratégique : refusé.`,
        );
      }
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'exchange.troc_fruit_legume.choose_target') {
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosenTarget = targets[index];
      const targetPlayerId = Number(chosenTarget?.playerId);
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      const { fruit } = buildCourseSets();
      const me = (state.players ?? []).find(
        (p: any) => p.id === actorId,
      ) as any;
      const myInv = this.utils.toStringArray(me?.inventory);
      const fruitCards = myInv.filter((c) => fruit.has(c));
      if (!fruitCards.length) {
        let next = clearPending(state);
        next = this.core.appendLog(
          next,
          `[Panier Express] Troquez un fruit contre un légume : aucun fruit.`,
        );
        return this.phaseFlow.advanceTurn(next);
      }
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: actorId,
          blocking: true,
          label: 'Choisissez le fruit à donner, puis Entrée.',
          choices: fruitCards,
          data: {
            kind: 'exchange.troc_fruit_legume.choose_give',
            targetPlayerId,
          },
        } as any,
      };
    }

    if (kind === 'exchange.troc_fruit_legume.choose_give') {
      const targetPlayerId = Number(pending?.data?.targetPlayerId);
      const give = String(choices[index] ?? '').trim();
      if (!Number.isFinite(targetPlayerId) || !give) return clearPending(state);
      let next = clearPending(state);
      const { veg } = buildCourseSets();
      const target = (next.players ?? []).find(
        (p: any) => p.id === targetPlayerId,
      ) as any;
      const targetInv = this.utils.toStringArray(target?.inventory);
      const vegCards = targetInv.filter((c) => veg.has(c));
      if (!vegCards.length) {
        next = this.core.appendLog(
          next,
          `[Panier Express] Troquez un fruit contre un légume : cible sans légume.`,
        );
        return this.phaseFlow.advanceTurn(next);
      }
      const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
      const picked = this.random.pickOne(metaRng.getMeta(), vegCards);
      next = { ...next, metadata: picked.meta };
      const take = String(picked.value ?? '').trim();
      const removedGive = removeCourseFromPlayer(next, actorId, give);
      next = removedGive.state;
      const removedTake = removeCourseFromPlayer(next, targetPlayerId, take);
      next = removedTake.state;
      if (removedGive.removed)
        next = addCourseToPlayer(next, targetPlayerId, give);
      if (removedTake.removed) next = addCourseToPlayer(next, actorId, take);
      next = this.core.appendLog(
        next,
        `[Panier Express] Troc fruit/légume : échange effectué.`,
      );
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'exchange.echange_saison.choose_target') {
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosenTarget = targets[index];
      const targetPlayerId = Number(chosenTarget?.playerId);
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      const { summerFruit } = buildCourseSets();
      const me = (state.players ?? []).find(
        (p: any) => p.id === actorId,
      ) as any;
      const myInv = this.utils.toStringArray(me?.inventory);
      const fruitCards = myInv.filter((c) => summerFruit.has(c));
      if (!fruitCards.length) {
        let next = clearPending(state);
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange de saison : aucun fruit d'été, pioche.`,
        );
        return this.queueCourseDraws(
          next,
          [{ playerId: actorId, standId: 'bonus' }],
          'Piocher une course bonus (Espace).',
        );
      }
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: actorId,
          blocking: true,
          label: "Choisissez le fruit d'été à donner, puis Entrée.",
          choices: fruitCards,
          data: { kind: 'exchange.echange_saison.choose_give', targetPlayerId },
        } as any,
      };
    }

    if (kind === 'exchange.echange_saison.choose_give') {
      const targetPlayerId = Number(pending?.data?.targetPlayerId);
      const give = String(choices[index] ?? '').trim();
      if (!Number.isFinite(targetPlayerId) || !give) return clearPending(state);
      let next = clearPending(state);
      const { winterVeg } = buildCourseSets();
      const target = (next.players ?? []).find(
        (p: any) => p.id === targetPlayerId,
      ) as any;
      const targetInv = this.utils.toStringArray(target?.inventory);
      const winterVegCards = targetInv.filter((c) => winterVeg.has(c));
      if (!winterVegCards.length) {
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange de saison : cible sans légume d'hiver.`,
        );
        return this.phaseFlow.advanceTurn(next);
      }
      const metaRng = this.random.createMetaRng(this.getMetadata(next) as any);
      const picked = this.random.pickOne(metaRng.getMeta(), winterVegCards);
      next = { ...next, metadata: picked.meta };
      const take = String(picked.value ?? '').trim();
      const removedGive = removeCourseFromPlayer(next, actorId, give);
      next = removedGive.state;
      const removedTake = removeCourseFromPlayer(next, targetPlayerId, take);
      next = removedTake.state;
      if (removedGive.removed)
        next = addCourseToPlayer(next, targetPlayerId, give);
      if (removedTake.removed) next = addCourseToPlayer(next, actorId, take);
      next = this.core.appendLog(
        next,
        `[Panier Express] Échange de saison : échange effectué.`,
      );
      return this.phaseFlow.advanceTurn(next);
    }

    if (kind === 'exchange.marche_noir.discard') {
      const chosen = String(choices[index] ?? '').trim();
      let next = clearPending(state);
      if (chosen) {
        next = discardCourse(next, actorId, chosen);
      }
      next = this.core.appendLog(
        next,
        `[Panier Express] Marché noir : défausse puis pioche un quiz.`,
      );
      next = this.appendActionLog(next, actorId, 'exchange', {
        card: 'marche-noir',
        discarded: chosen,
      });
      return this.quizSvc.applyQuiz(next, actorId);
    }

    if (kind === 'exchange.choose_target') {
      const targets = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const chosen = targets[index];
      const targetPlayerId = Number(chosen?.playerId);
      const card = String(pending?.data?.card ?? '').trim();
      if (!Number.isFinite(targetPlayerId)) return clearPending(state);
      const next = clearPending(state);
      return this.exchangeSvc.applyExchangeCard(
        next,
        actorId,
        targetPlayerId,
        card,
      );
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
      const removed = removeCourseFromPlayer(next, actorId, give);
      next = removed.state;
      if (removed.removed) {
        next = addCourseToPlayer(next, initiatorId, give);
      }
      try {
        const initiator = (next.players ?? []).find(
          (p: any) => p.id === initiatorId,
        ) as any;
        const initiatorInv = this.utils.toStringArray(initiator?.inventory);
        if (initiatorInv.length > 0) {
          const metaRng = this.random.createMetaRng(
            this.getMetadata(next) as any,
          );
          const picked = this.random.pickOne(metaRng.getMeta(), initiatorInv);
          next = { ...next, metadata: picked.meta };
          const back = String(picked.value ?? '').trim();
          if (back) {
            const removedBack = removeCourseFromPlayer(next, initiatorId, back);
            next = removedBack.state;
            if (removedBack.removed) {
              next = addCourseToPlayer(next, actorId, back);
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
        )} donne "${this.utils.formatCourseLabel(give)}" \u00e0 ${this.utils.playerName(state, initiatorId)}.`,
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
    const outcomeEntry = {
      correct,
      message: correct ? 'Bonne réponse !' : 'Mauvaise réponse !',
      timestamp: Date.now(),
    };
    let next: GameStateEntity = {
      ...state,
      metadata: {
        ...meta,
        quiz: updatedQuiz,
        quizOutcome: { ...(meta.quizOutcome ?? {}), [playerId]: outcomeEntry },
      },
      pending: null,
    };
    next = this.core.appendLog(
      next,
      `[Panier Express] Quiz : réponse ${correct ? 'correcte' : 'incorrecte'} pour ${this.utils.playerName(
        state,
        playerId,
      )}.`,
    );
    next = this.appendActionLog(next, playerId, 'answer_quiz', { correct });
    if (correct) {
      next = this.queueCourseDraws(
        next,
        [{ playerId, standId: 'bonus' }],
        'Piocher une course bonus (Espace).',
      );
      if (next.pending) return next;
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

  private applyMoveChoice(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const steps = Math.max(1, Math.abs(delta || 2));
    if (state.pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Un autre choix est déjà en attente.`,
      );
    }
    return {
      ...state,
      pending: {
        type: 'pick',
        playerId,
        blocking: true,
        label: `Choisissez : avancer ou reculer de ${steps} cases, puis Entrée.`,
        choices: [`Avancer (+${steps})`, `Reculer (-${steps})`],
        data: { kind: 'tile.move_choice', delta: steps },
      } as any,
    };
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
    Object.entries(meta.statuses?.revealInventory ?? {}).forEach(
      ([pid, val]) => {
        const nextVal = Math.max(0, Number(val) - 1);
        if (nextVal > 0) {
          revealInventory[Number(pid)] = nextVal;
        }
      },
    );

    const revealShoppingList: Record<number, number> = {};
    Object.entries((meta.statuses as any)?.revealShoppingList ?? {}).forEach(
      ([pid, val]) => {
        const nextVal = Math.max(0, Number(val) - 1);
        if (nextVal > 0) {
          revealShoppingList[Number(pid)] = nextVal;
        }
      },
    );

    const noDrawCourses: Record<number, number> = {};
    Object.entries((meta.statuses as any)?.noDrawCourses ?? {}).forEach(
      ([pid, val]) => {
        const nextVal = Math.max(0, Number(val) - 1);
        if (nextVal > 0) {
          noDrawCourses[Number(pid)] = nextVal;
        }
      },
    );

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
      statuses: {
        ...meta.statuses,
        skipTurn: next.skipTurn,
        revealInventory,
        revealShoppingList,
        noDrawCourses,
      } as any,
    };
    return {
      ...state,
      metadata: nextMeta,
      turnIndex: next.turnIndex,
      turn: {
        currentPlayerId: next.currentPlayerId,
        direction: movementDirection,
        label:
          next.currentPlayerId != null
            ? `Tour ${next.turnIndex + 1} : ${this.utils.playerName(
                state,
                next.currentPlayerId,
              )}`
            : undefined,
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
    const answer = typeof pending?.answer === 'string' ? pending.answer : null;
    if (!pending || (!choices.length && !answer)) return actions;
    const effectiveAnswer = answer ?? choices[0];
    return actions.map((a) => {
      if (!a || (a.type || '').toLowerCase() !== 'answer_quiz') return a;
      return { ...a, payload: { ...(a.payload ?? {}), answer: effectiveAnswer } };
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
