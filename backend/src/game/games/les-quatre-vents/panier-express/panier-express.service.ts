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
import { playingLog } from '../../../../common/utils/playing-logger';
import { PanierExpressSetupService } from './setup/panier-express-setup.service';
import { PanierExpressDrawService } from './actions/panier-express-draw.service';
import { PanierExpressQuizService } from './actions/panier-express-quiz.service';
import {
  assignConfiguredBotPawns,
  queueConfiguredPawnSelection,
} from '../../../core/helpers/configured-pawn-setup.helper';
import { PanierExpressExchangeService } from './actions/panier-express-exchange.service';
import { PanierExpressUtils } from './model/panier-express-utils.service';
import * as PanierExpressRulebook from './rulebook/rulebook';
import { PanierExpressBotService } from './bots/panier-express-bot.service';
import { PanierExpressPhaseService } from './phases/panier-express-phase.service';
import { PanierExpressPresenterService } from './presenter/panier-express-presenter.service';
import { RandomService } from '../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../modules/setup-flow/services/setup-flow.service';
import { resolvePendingPawnChoiceAction } from '../../../core/helpers/pawn-choice-action.helper';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import { hydratePanierExpressInitialState } from './panier-express-initial-state.helpers';
import {
  asStringDeckPool,
  toDrawQueueEntries,
} from './panier-express-deck.helpers';
import {
  getPanierExpressActorIdFromAction,
  getPanierExpressMetadata,
  getPanierExpressMetadataRecord,
  getPanierExpressPawnText,
  getPanierExpressPendingRecord,
  getPanierExpressPlayers,
} from './panier-express-access.helpers';
import { buildExposedPanierExpressState } from './panier-express-expose.helpers';
import {
  ensurePanierExpressPlayerLaps,
  ensurePanierExpressPlayerPositions,
  ensurePanierExpressQuizOutcome,
  hydratePanierExpressMetadataCollections,
  mergePanierExpressDecks,
  mergePanierExpressMetadataWithDefaults,
  mergePanierExpressStatuses,
} from './panier-express-metadata.helpers';
import {
  advancePanierExpressAfterDraw,
  ensurePanierExpressStarted,
  finalizePanierExpressStarterAfterPawnSelection,
  movePanierExpressPlayer,
  queuePanierExpressCourseDraws,
  startPanierExpressDrawPending,
} from './panier-express-turn.helpers';
import {
  buildPanierExpressEventTargetChoices,
  buildPanierExpressEventTargets,
  continuePanierExpressQueuedDraw,
  handlePanierExpressGenerousProducerDraw,
  handlePanierExpressLuckyDraw,
  handlePanierExpressSeasonChangeDraw,
} from './panier-express-draw.helpers';
import { applyBasicPanierExpressEvent } from './panier-express-event-basic.helpers';
import { applyAdvancedPanierExpressEvent } from './panier-express-event-advanced.helpers';
import {
  addPanierExpressCourseToDiscard,
  addPanierExpressCourseToPlayer,
  discardPanierExpressRandomCourse,
  getPanierExpressDiscardCourses,
  removePanierExpressCourseFromInventory,
  removePanierExpressCourseFromPlayer,
  setPanierExpressPickPending,
} from './panier-express-event-state.helpers';
import {
  handlePanierExpressExchangeAccept,
  handlePanierExpressExchangeChooseGive,
  handlePanierExpressExchangeChooseTarget,
  handlePanierExpressExchangeRefuse,
  handlePanierExpressMerchantRequestAccept,
  handlePanierExpressMerchantRequestRefuse,
  handlePanierExpressSkipTurn,
} from './panier-express-action.helpers';
import {
  applyPanierExpressMoveChoice,
  applyPanierExpressMoveDelta,
  applyPanierExpressMoveToStandChoice,
  handlePanierExpressAnswerQuiz,
  updatePanierExpressPlayer,
} from './panier-express-quiz-move.helpers';
import { resolveBasicPanierExpressPickChoice } from './panier-express-pick-choice-basic.helpers';
import { resolvePanierExpressExchangePickChoice } from './panier-express-pick-choice-exchange.helpers';
import {
  applyPanierExpressMerchantRequest,
  getPanierExpressStandLabel,
  getPanierExpressTileLabel,
  registerPanierExpressStandHandlers,
  registerPanierExpressTileHandlers,
  resolvePanierExpressTile,
} from './panier-express-board.helpers';
import { buildPanierExpressShortcuts } from './panier-express.shortcuts';
import { ensureShoppingLists, toStringArray } from './panier-express.shopping';
import {
  stringEqualsInsensitive,
  toPlayerIdValue,
  toUnknownArray,
} from './panier-express-state.helpers';

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
  private static readonly SHOPPING_LIST_SIZE = 3;

  constructor(
    registry: GameRegistryService,
    private readonly core: GameCoreService,
    _turns: TurnService,
    private readonly deckPool: DeckPoolService,
    private readonly movement: BoardMovementService,
    private readonly tileRegistry: TileEffectRegistryService<
      GameStateEntity,
      { playerId: number; tile: PanierExpressTile }
    >,
    _turnActions: TurnActionsService,
    private readonly standEffects: StandEffectRegistryService<GameStateEntity>,
    private readonly resolver: ActionResolverService,
    private readonly turnStatus: TurnStatusService,
    _victory: VictoryService,
    _botRunner: BotRunnerService,
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
    private readonly setupFlow: SetupFlowService,
  ) {
    super(registry);
  }

  onModuleInit(): void {
    super.onModuleInit();
    this.registerTileHandlers();
    this.registerStandHandlers();
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    return buildExposedPanierExpressState({
      state,
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      getAvailableActions: (value, playerId) =>
        this.getAvailableActions(value, playerId),
      expose: (args) => this.presenter.exposeState(args),
    });
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return buildExposedPanierExpressState({
      state,
      userId,
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      getAvailableActions: (value, playerId) =>
        this.getAvailableActions(value, playerId),
      expose: (args) => this.presenter.exposeState(args),
    });
  }

  getShortcuts(
    ctx: GameShortcutsContext<PanierExpressMetadata>,
  ): GameShortcutHint[] {
    return buildPanierExpressShortcuts(ctx);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return hydratePanierExpressInitialState({
      baseState,
      buildMetadata: (state) => this.buildMetadata(state),
      ensureMetadata: (state) => this.ensureMetadata(state),
      queuePawnSelection: (state) => this.queuePawnSelection(state),
      pawns: this.setup.pawns(),
      courseItems: this.setup.courseItems(),
      getPawnText: (player) => this.getPawnText(player),
      category: this.category,
      subcategory: this.subcategory,
      shoppingListSize: PanierExpressService.SHOPPING_LIST_SIZE,
    });
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
      case 'choose_pawn':
        return this.handleChoosePawn(state, action);
      case 'exchange_choose_target':
        return this.handleExchangeChooseTarget(state, action);
      case 'exchange_choose_give':
        return this.handleExchangeChooseGive(state, action);
      case 'exchange_accept':
        return this.handleExchangeAccept(state, action);
      case 'exchange_refuse':
        return this.handleExchangeRefuse(state, action);
      case 'merchant_request_accept':
        return this.handleMerchantRequestAccept(state, action);
      case 'merchant_request_refuse':
        return this.handleMerchantRequestRefuse(state, action);
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
      shoppingLists: {},
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
    const metadataBeforeRepair = this.hydrateMetadataCollections(
      state,
      merged,
      normalizedPlayers,
    );
    const repaired = ensureShoppingLists({
      metadata: metadataBeforeRepair,
      players: normalizedPlayers,
      courseItems: this.setup.courseItems(),
      shoppingListSize: PanierExpressService.SHOPPING_LIST_SIZE,
      toStringArray: (value) => this.utils.toStringArray(value),
    });
    return { ...state, metadata: repaired.metadata, players: repaired.players };
  }

  private mergeMetadataWithDefaults(
    state: GameStateEntity,
  ): PanierExpressMetadata {
    return mergePanierExpressMetadataWithDefaults(state, this.buildMetadata(state));
  }

  private hydrateMetadataCollections(
    state: GameStateEntity,
    meta: PanierExpressMetadata,
    players: PanierExpressPlayer[],
  ): PanierExpressMetadata {
    return hydratePanierExpressMetadataCollections({
      state,
      metadata: meta,
      players,
      buildDeckPool: (value) => this.setup.buildDeckPool(value),
    });
  }

  private ensurePlayerLaps(
    laps: Record<number, number> | undefined,
    players: PanierExpressPlayer[],
  ): Record<number, number> {
    return ensurePanierExpressPlayerLaps(laps, players);
  }

  private mergeDecks(
    defaults: PanierExpressMetadata['decks'],
    override?: PanierExpressMetadata['decks'],
  ): PanierExpressMetadata['decks'] {
    return mergePanierExpressDecks(defaults, override);
  }

  private mergeStatuses(
    defaults: PanierExpressMetadata['statuses'],
    override?: PanierExpressMetadata['statuses'],
  ): PanierExpressMetadata['statuses'] {
    return mergePanierExpressStatuses(defaults, override);
  }

  private ensurePlayerPositions(
    positions: Record<number, number> | undefined,
    players: PanierExpressPlayer[],
  ): Record<number, number> {
    return ensurePanierExpressPlayerPositions(positions, players);
  }

  private ensureQuizOutcome(
    entries: PanierExpressMetadata['quizOutcome'] | undefined,
    players: PanierExpressPlayer[],
  ): PanierExpressMetadata['quizOutcome'] {
    return ensurePanierExpressQuizOutcome(entries, players);
  }

  private assignBotPawns(state: GameStateEntity): GameStateEntity {
    const pawnChoices = this.setup.pawnChoices();
    if (!pawnChoices.length) return state;
    return assignConfiguredBotPawns({
      state,
      core: this.core,
      catalog: pawnChoices.map((pawn) => ({
        id: pawn.name,
        label: pawn.name,
        description: pawn.description ?? '',
      })),
      playerPawnField: 'pawn',
      isBotPlayer: (player) => this.utils.isBot(player),
      pickChoice: ({ state: currentState, available, catalog }) => {
        const meta = this.getMetadata(currentState);
        const pool = available.length > 0 ? available : catalog;
        const picked = this.random.pickOne(
          meta,
          pool.map((choice) => choice.id),
        );
        const choiceId = toText(picked.value).trim();
        return {
          choice:
            pool.find((choice) => choice.id === choiceId) ??
            catalog.find((choice) => choice.id === choiceId) ??
            null,
          state: {
            ...currentState,
            metadata: {
              ...(currentState.metadata ?? {}),
              ...picked.meta,
            },
          },
        };
      },
    });
  }

  private withPending(
    state: GameStateEntity,
    pending: PendingState,
  ): GameStateEntity {
    return {
      ...state,
      pending,
    };
  }

  private queuePawnSelection(state: GameStateEntity): GameStateEntity {
    const pending = state.pending;
    if (pending?.type === 'choose_pawn') {
      return state;
    }
    const pawnChoices = this.setup.pawnChoices();
    if (!pawnChoices.length) return state;

    const players = state.players ?? [];
    const missing = players.filter(
      (p) => !this.getPawnText(p) && !this.utils.isBot(p),
    );
    if (!missing.length) {
      const withBots = this.assignBotPawns(state);
      return this.finalizeStarterAfterPawnSelection(withBots);
    }

    // Reset bot pawns during setup so humans can pick among all options.
    const normalizedPlayers = players.map((p) => {
      if (!this.utils.isBot(p)) return p;
      const pawn = this.getPawnText(p);
      if (!pawn) return p;
      return { ...p, pawn: undefined };
    });
    const withClearedBots =
      normalizedPlayers === players
        ? state
        : { ...state, players: normalizedPlayers };

    return queueConfiguredPawnSelection({
      state: withClearedBots,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: pawnChoices.map((pawn) => ({
        id: pawn.name,
        label: pawn.name,
        description: pawn.description ?? '',
      })),
      startPlayerId: missing[0]?.id ?? normalizedPlayers[0]?.id ?? null,
      pendingType: 'choose_pawn',
      playerPawnField: 'pawn',
      isBotPlayer: (player) => this.utils.isBot(player),
      takenPawnIdsResolver: (currentState) =>
        new Set(
          (Array.isArray(currentState.players) ? currentState.players : [])
            .filter((player) => !this.utils.isBot(player))
            .map((player) => this.getPawnText(player))
            .filter((pawn) => pawn.length > 0),
        ),
      pawnDataMapper: (choice) => ({
        id: String(choice.id ?? '').trim(),
        label:
          String(choice.description ?? '').trim().length > 0
            ? `${String(choice.label ?? '').trim()}: ${String(choice.description ?? '').trim()}`
            : String(choice.label ?? '').trim(),
        description: String(choice.description ?? '').trim(),
      }),
    });
  }

  private ensureStarted(state: GameStateEntity): GameStateEntity {
    return ensurePanierExpressStarted({
      state,
      minPlayers: this.minPlayers,
      getPawnText: (player) => this.getPawnText(player),
      isBot: (player) => this.utils.isBot(player),
      queuePawnSelection: (value) => this.queuePawnSelection(value),
      assignBotPawns: (value) => this.assignBotPawns(value),
      finalizeStarterAfterPawnSelection: (value) =>
        this.finalizeStarterAfterPawnSelection(value),
    });
  }

  private finalizeStarterAfterPawnSelection(
    state: GameStateEntity,
  ): GameStateEntity {
    return finalizePanierExpressStarterAfterPawnSelection({
      state,
      getMetadata: (value) => this.getMetadata(value),
      nextRandomInt: (metadata, maxExclusive) =>
        this.random.nextInt(metadata, maxExclusive),
      appendLog: (value, message) => this.core.appendLog(value, message),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      formatCourseLabels: (items) => this.utils.formatCourseLabels(items),
    });
  }

  private handleRoll(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    // Anti-triche: le serveur est la source de vérité pour l'aléatoire (dés).
    // Bonus: RNG seedé dans metadata pour rendre le dé déterministe en debug/tests (si besoin).
    const meta = this.getMetadata(state);
    const rng = this.random.rollDice(meta, 6);
    const roll = rng.roll;
    const direction = state.turn?.direction === -1 ? -1 : 1;
    const signedRoll = roll * direction;

    playingLog('panier.roll', {
      roomId: this.getMetadataRecord(state).roomId ?? null,
      gameType: this.getMetadataRecord(state).gameType ?? null,
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
    const pending = state.pending;
    if (!pending || pending.type !== 'draw') return state;
    const actionMeta = asRecord(action.meta);
    const actorId =
      typeof actionMeta.actorId === 'number'
        ? actionMeta.actorId
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

    const data = asRecord(pending.data);
    const kind = toText(data.kind).trim() || 'queue';
    let next: GameStateEntity = { ...state, pending: null };

    if (kind === 'event.card') {
      next = this.applyEvent(next, pendingPlayerId);
      return this.advanceAfterDraw(next);
    }

    if (kind === 'event.tirage_chanceux') {
      return handlePanierExpressLuckyDraw({
        state: next,
        playerId: pendingPlayerId,
        getMetadata: (value) => this.getMetadata(value),
        createMetaRng: (metadata) => this.random.createMetaRng(metadata),
        drawPool: (pool, deckKey, rng) =>
          this.deckPool.draw<string>(asStringDeckPool(pool), deckKey, rng),
        discardPool: (pool, deckKey, card) =>
          this.deckPool.discard<string>(asStringDeckPool(pool), deckKey, card),
        appendLog: (value, message) => this.core.appendLog(value, message),
        advanceAfterDraw: (value) => this.advanceAfterDraw(value),
        withPending: (value, pendingState) => this.withPending(value, pendingState),
      });
    }

    if (kind === 'event.producteur_genereux') {
      return handlePanierExpressGenerousProducerDraw({
        state: next,
        playerId: pendingPlayerId,
        drawCourse: (value, playerId, standId) =>
          this.drawSvc.drawCourse(value, playerId, standId),
        getMetadata: (value) => this.getMetadata(value),
        createMetaRng: (metadata) => this.random.createMetaRng(metadata),
        drawPool: (pool, deckKey, rng) =>
          this.deckPool.draw<string>(asStringDeckPool(pool), deckKey, rng),
        discardPool: (pool, deckKey, card) =>
          this.deckPool.discard<string>(asStringDeckPool(pool), deckKey, card),
        appendLog: (value, message) => this.core.appendLog(value, message),
        advanceAfterDraw: (value) => this.advanceAfterDraw(value),
        withPending: (value, pendingState) => this.withPending(value, pendingState),
      });
    }

    if (kind === 'event.changement_de_saison') {
      return handlePanierExpressSeasonChangeDraw({
        state: next,
        playerId: pendingPlayerId,
        data,
        drawCourse: (value, playerId, standId) =>
          this.drawSvc.drawCourse(value, playerId, standId),
        toUnknownArray,
        toStringArray: (value) => this.utils.toStringArray(value),
        appendLog: (value, message) => this.core.appendLog(value, message),
        advanceAfterDraw: (value) => this.advanceAfterDraw(value),
        withPending: (value, pendingState) => this.withPending(value, pendingState),
      });
    }

    const queue = toDrawQueueEntries(data.queue);
    const cursor = Number(data.cursor ?? 0);
    return continuePanierExpressQueuedDraw({
      state: next,
      queue,
      cursor,
      label: pending.label ?? 'Piocher une carte (Espace).',
      drawCourse: (value, playerId, standId) =>
        this.drawSvc.drawCourse(value, playerId, standId),
      advanceAfterDraw: (value) => this.advanceAfterDraw(value),
      withPending: (value, pendingState) => this.withPending(value, pendingState),
    });
  }

  private startDrawPending(
    state: GameStateEntity,
    playerId: number,
    data: Record<string, unknown>,
    label: string,
  ): GameStateEntity {
    return startPanierExpressDrawPending({
      state,
      playerId,
      data,
      label,
      appendLog: (value, message) => this.core.appendLog(value, message),
      withPending: (value, pending) => this.withPending(value, pending),
    });
  }

  private queueCourseDraws(
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId?: string }>,
    label: string,
  ): GameStateEntity {
    return queuePanierExpressCourseDraws({
      state,
      tasks,
      label,
      appendLog: (value, message) => this.core.appendLog(value, message),
      withPending: (value, pending) => this.withPending(value, pending),
      toDrawQueueEntries,
      asRecord,
    });
  }

  private advanceAfterDraw(state: GameStateEntity): GameStateEntity {
    return advancePanierExpressAfterDraw({
      state,
      getMetadata: (value) => this.getMetadata(value),
      getAvailableActions: (value, playerId) =>
        this.getAvailableActions(value, playerId),
      getTurnStatus: (value, playerId, key) =>
        this.turnStatus.getStatus(value, playerId, key),
      clearTurnStatus: (value, playerId, key) =>
        this.turnStatus.setStatus(value, playerId, key, 0),
      appendLog: (value, message) => this.core.appendLog(value, message),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
    });
  }

  private movePlayer(
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ): GameStateEntity {
    return movePanierExpressPlayer({
      state,
      playerId,
      roll,
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      buildTiles: () => this.buildTiles(),
      moveCircular: (length, currentPosition, delta) =>
        this.movement.moveCircular(length, currentPosition, delta),
      tileAt: (tiles, index) => this.movement.tileAt(tiles, index),
      appendLog: (value, message) => this.core.appendLog(value, message),
      playerName: (value, currentPlayerId) =>
        this.utils.playerName(value, currentPlayerId),
    });
  }

  private tileLabel(tile: PanierExpressTile | undefined): string {
    return getPanierExpressTileLabel(tile);
  }

  private standLabel(standId: string | undefined): string {
    return getPanierExpressStandLabel(standId);
  }

  private resolveTile(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return resolvePanierExpressTile({
      state,
      playerId,
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      buildTiles: () => this.buildTiles(),
      appendLog: (value, message) => this.core.appendLog(value, message),
      playerName: (value, currentPlayerId) =>
        this.utils.playerName(value, currentPlayerId),
      tileRegistry: this.tileRegistry,
    });
  }

  private registerTileHandlers(): void {
    registerPanierExpressTileHandlers({
      tileRegistry: this.tileRegistry,
      applyStand: (standId, state, ctx) =>
        this.standEffects.applyStand(standId, state, ctx),
      startDrawPending: (state, playerId, data, label) =>
        this.startDrawPending(state, playerId, data, label),
      applyMerchantRequest: (state, playerId) =>
        this.applyMerchantRequest(state, playerId),
      applyExchange: (state, playerId) => this.applyExchange(state, playerId),
      applyQuiz: (state, playerId) => this.applyQuiz(state, playerId),
      applyMoveToStandChoice: (state, playerId) =>
        this.applyMoveToStandChoice(state, playerId),
      applyWeatherBack: (state, playerId) =>
        this.applyWeatherBack(state, playerId),
      applyMoveDelta: (state, playerId, delta) =>
        this.applyMoveDelta(state, playerId, delta),
      applyMoveChoice: (state, playerId, delta) =>
        this.applyMoveChoice(state, playerId, delta),
      applySkipTurnTile: (state, playerId, turns) =>
        this.applySkipTurnTile(state, playerId, turns),
      queueCourseDraws: (state, tasks, label) =>
        this.queueCourseDraws(state, tasks, label),
      applyMoveToNextStand: (state, playerId) =>
        this.applyMoveToNextStand(state, playerId),
    });
  }

  private applyMerchantRequest(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return applyPanierExpressMerchantRequest({
      state,
      playerId,
      ensureMetadata: (value) => this.ensureMetadata(value),
      courseItems: () => this.setup.courseItems(),
      getMetadata: (value) => this.getMetadata(value),
      createMetaRng: (metadata) => this.random.createMetaRng(metadata as any),
      pickOne: (metadata, items) => this.random.pickOne(metadata, items),
      formatCourseLabel: (ingredient) => this.utils.formatCourseLabel(ingredient),
      playerName: (value, currentPlayerId) =>
        this.utils.playerName(value, currentPlayerId),
      appendLog: (value, message) => this.core.appendLog(value, message),
      getPlayers: (value) => this.getPlayers(value),
      toStringArray: (value) => this.utils.toStringArray(value),
    });
  }

  private registerStandHandlers(): void {
    registerPanierExpressStandHandlers({
      standEffects: this.standEffects,
      standIds: () => this.standIds(),
      queueCourseDraws: (state, tasks, label) =>
        this.queueCourseDraws(state, tasks, label),
    });
  }

  private applyEvent(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    let drawn = this.drawFromPool<string>(meta, 'events');
    let metadata = drawn.metadata;
    if (!drawn.card) {
      // Réinitialiser le deck d'événements si épuisé, puis retenter.
      const refilled = this.deckPool.set<string>(
        meta.decks as DeckPoolState<string>,
        'events',
        this.deckPool.shuffle([...this.setup.eventCards()]),
      );
      drawn = this.drawFromPool<string>(
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
      `[Panier Express] Carte Événement : ${eventLabel || event}.`,
    );

    const setPickPending = (params: {
      label: string;
      kind: string;
      choices: string[];
      data?: Record<string, unknown>;
    }): GameStateEntity =>
      setPanierExpressPickPending({
        state: next,
        playerId,
        label: params.label,
        kind: params.kind,
        choices: params.choices,
        data: params.data,
      });

    const ensureDiscardCourses = (): string[] =>
      getPanierExpressDiscardCourses(next, (value) => this.getMetadata(value));

    const addToDiscard = (card: string): void => {
      next = addPanierExpressCourseToDiscard({
        state: next,
        card,
        getMetadata: (value) => this.getMetadata(value),
      });
    };

    const removeOneCourseFromPlayer = (
      pid: number,
      card: string,
    ): { updated: boolean } => {
      const result = removePanierExpressCourseFromPlayer({
        state: next,
        playerId: pid,
        card,
        toStringArray: (value) => this.utils.toStringArray(value),
        removeOne: (items, value) => this.utils.removeOne(items, value),
      });
      next = result.state;
      return { updated: result.updated };
    };

    const removeOneCourseFromInventory = (
      pid: number,
      card: string,
    ): { updated: boolean } => {
      const result = removePanierExpressCourseFromInventory({
        state: next,
        playerId: pid,
        card,
        toStringArray: (value) => this.utils.toStringArray(value),
        removeOne: (items, value) => this.utils.removeOne(items, value),
      });
      next = result.state;
      return { updated: result.updated };
    };

    const addOneCourseToPlayer = (pid: number, card: string): void => {
      next = addPanierExpressCourseToPlayer({
        state: next,
        playerId: pid,
        card,
        getMetadata: (value) => this.getMetadata(value),
        toStringArray: (value) => this.utils.toStringArray(value),
        removeOne: (items, value) => this.utils.removeOne(items, value),
      });
    };

    const discardRandomCourse = (pid: number): string | null => {
      const result = discardPanierExpressRandomCourse({
        state: next,
        playerId: pid,
        getMetadata: (value) => this.getMetadata(value),
        createMetaRng: (metadata) => this.random.createMetaRng(metadata),
        pickOne: (metadata, items) => this.random.pickOne(metadata, items),
        toStringArray: (value) => this.utils.toStringArray(value),
        removeOne: (items, value) => this.utils.removeOne(items, value),
      });
      next = result.state;
      return result.discarded;
    };
    const buildTargets = (excludePlayerId: number) =>
      buildPanierExpressEventTargets(next.players ?? [], excludePlayerId);
    const buildTargetChoices = (
      targets: Array<{ playerId: number; username?: string | null }>,
    ) => buildPanierExpressEventTargetChoices(targets);

    const basicEventApplied = applyBasicPanierExpressEvent({
      event,
      eventLabel,
      state,
      next,
      playerId,
      setPickPending,
      buildTargets,
      buildTargetChoices,
      getPlayers: (value) => this.getPlayers(value),
      toStringArray: (value) => this.utils.toStringArray(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      appendActionLog: (value, currentPlayerId, type, payload) =>
        this.appendActionLog(value, currentPlayerId, type, payload),
      playerName: (value, currentPlayerId) =>
        this.utils.playerName(value, currentPlayerId),
      queueCourseDraws: (value, tasks, label) =>
        this.queueCourseDraws(value, tasks, label),
      applyMoveDelta: (value, currentPlayerId, delta) =>
        this.applyMoveDelta(value, currentPlayerId, delta),
      startDrawPending: (value, currentPlayerId, data, label) =>
        this.startDrawPending(value, currentPlayerId, data, label),
      setTurnStatus: (value, currentPlayerId, key, amount) =>
        this.turnStatus.setStatus(value, currentPlayerId, key, amount),
      getMetadata: (value) => this.getMetadata(value),
      movePlayer: (value, currentPlayerId, delta) =>
        this.movePlayer(value, currentPlayerId, delta),
      resolveTile: (value, currentPlayerId) =>
        this.resolveTile(value, currentPlayerId),
      moveCircular: (length, currentPosition, delta) =>
        this.movement.moveCircular(length, currentPosition, delta),
    });
    if (basicEventApplied) {
      return basicEventApplied;
    }

    const addToDiscardState = (current: GameStateEntity, card: string) => {
      next = current;
      addToDiscard(card);
      return next;
    };
    const addOneCourseToPlayerState = (
      current: GameStateEntity,
      currentPlayerId: number,
      card: string,
    ) => {
      next = current;
      addOneCourseToPlayer(currentPlayerId, card);
      return next;
    };
    const discardRandomCourseState = (
      current: GameStateEntity,
      currentPlayerId: number,
    ) => {
      next = current;
      const discarded = discardRandomCourse(currentPlayerId);
      return { state: next, discarded };
    };
    const removeOneCourseFromPlayerState = (
      current: GameStateEntity,
      currentPlayerId: number,
      card: string,
    ) => {
      next = current;
      const result = removeOneCourseFromPlayer(currentPlayerId, card);
      return { state: next, updated: result.updated };
    };

    const advancedEventApplied = applyAdvancedPanierExpressEvent({
      event,
      eventLabel,
      state,
      next,
      playerId,
      getPlayers: (value) => this.getPlayers(value),
      toStringArray: (value) => this.utils.toStringArray(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      appendActionLog: (value, currentPlayerId, type, payload) =>
        this.appendActionLog(value, currentPlayerId, type, payload),
      playerName: (value, currentPlayerId) =>
        this.utils.playerName(value, currentPlayerId),
      queueCourseDraws: (value, tasks, label) =>
        this.queueCourseDraws(value, tasks, label),
      getMetadata: (value) => this.getMetadata(value),
      createMetaRng: (metadata) => this.random.createMetaRng(metadata),
      pickOne: (metadata, items) => this.random.pickOne(metadata, items),
      moveCircular: (length, currentPosition, delta) =>
        this.movement.moveCircular(length, currentPosition, delta),
      movePlayer: (value, currentPlayerId, delta) =>
        this.movePlayer(value, currentPlayerId, delta),
      resolveTile: (value, currentPlayerId) =>
        this.resolveTile(value, currentPlayerId),
      setTurnStatus: (value, currentPlayerId, key, amount) =>
        this.turnStatus.setStatus(value, currentPlayerId, key, amount),
      formatCourseLabel: (card) => this.utils.formatCourseLabel(card),
      courseItems: () => this.setup.courseItems(),
      setPickPending,
      withPending: (value, pendingState) => this.withPending(value, pendingState),
      addOneCourseToPlayer: addOneCourseToPlayerState,
      addToDiscard: addToDiscardState,
      ensureDiscardCourses: (value) => {
        next = value;
        return ensureDiscardCourses();
      },
      discardRandomCourse: discardRandomCourseState,
      removeOneCourseFromPlayer: removeOneCourseFromPlayerState,
    });
    if (advancedEventApplied) {
      return advancedEventApplied;
    }

    switch (event) {
      default:
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
    return handlePanierExpressExchangeChooseTarget({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      chooseTarget: (value, playerId, targetPlayerId) =>
        this.exchangeSvc.chooseTarget(value, playerId, targetPlayerId),
    });
  }

  private handleExchangeChooseGive(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    return handlePanierExpressExchangeChooseGive({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      chooseGive: (value, playerId, give) =>
        this.exchangeSvc.chooseGive(value, playerId, give),
    });
  }

  private handleExchangeAccept(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    return handlePanierExpressExchangeAccept({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      acceptOffer: (value, actorId) => this.exchangeSvc.acceptOffer(value, actorId),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
    });
  }

  private handleExchangeRefuse(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    return handlePanierExpressExchangeRefuse({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      getPendingRecord: (value) => this.getPendingRecord(value),
      refuseOffer: (value, actorId) => this.exchangeSvc.refuseOffer(value, actorId),
      applyQuiz: (value, initiatorId) => this.quizSvc.applyQuiz(value, initiatorId),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
    });
  }

  private handleMerchantRequestAccept(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    return handlePanierExpressMerchantRequestAccept({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      getPendingRecord: (value) => this.getPendingRecord(value),
      toStringArray: (value) => this.utils.toStringArray(value),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      formatCourseLabel: (value) => this.utils.formatCourseLabel(value),
      removeIngredientFromInventory: (value, actorId, ingredient) =>
        this.removeIngredientFromInventory(value, actorId, ingredient),
      addCourseToDiscards: (value, ingredient) =>
        this.addCourseToDiscards(value, ingredient),
      appendActionLog: (value, playerId, type, payload) =>
        this.appendActionLog(value, playerId, type, payload),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
    });
  }

  private handleMerchantRequestRefuse(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    return handlePanierExpressMerchantRequestRefuse({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      getPendingRecord: (value) => this.getPendingRecord(value),
      formatCourseLabel: (value) => this.utils.formatCourseLabel(value),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      applySkipTurnTile: (value, actorId, turns, silent) =>
        this.applySkipTurnTile(value, actorId, turns, silent),
      appendActionLog: (value, playerId, type, payload) =>
        this.appendActionLog(value, playerId, type, payload),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
    });
  }
  private handleSkipTurn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    return handlePanierExpressSkipTurn({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      getMetadata: (value) => this.getMetadata(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
    });
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const resolved = resolvePendingPawnChoiceAction({
      state,
      action,
      pendingType: 'choose_pawn',
      resolveChoice: (rawValue, options) => {
        const key = toText(rawValue).trim().toLowerCase();
        if (!key) return null;
        return (
          options.find((option) => {
            const optionRecord = asRecord(option);
            const byId = toText(optionRecord.id).trim().toLowerCase();
            const byLabel = toText(optionRecord.label).trim().toLowerCase();
            return (
              (byId.length > 0 && byId === key) ||
              (byLabel.length > 0 && byLabel === key)
            );
          }) ?? null
        );
      },
    });
    if (!resolved) {
      return this.core.appendLog(
        state,
        `[Panier Express] Choix de pion invalide.`,
      );
    }

    const chosen = String(resolved.chosen?.id ?? '').trim();
    if (!chosen) {
      return { ...state, pending: null };
    }

    let next: GameStateEntity = {
      ...state,
      pending: null,
      players: this.getPlayers(state).map((player) =>
        player.id === resolved.playerId ? { ...player, pawn: chosen } : player,
      ),
    };
    next = this.core.appendLog(
      next,
      `${this.utils.playerName(state, resolved.playerId)} a choisi le pion: ${chosen}.`,
    );

    const statusNow = String(state.status ?? '').toLowerCase();
    if (statusNow === 'starting') {
      return this.ensureStarted({ ...next, status: 'starting' });
    }
    return this.queuePawnSelection({
      ...next,
      status: state.status ?? 'open',
    });
  }

  private handlePickChoice(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId =
      this.getActorIdFromAction(action) ?? state.turn?.currentPlayerId ?? null;
    if (typeof actorId !== 'number') return state;

    const pending = this.getPendingRecord(state);
    if (!pending || pending.type !== 'pick' || pending.playerId !== actorId) {
      return this.core.appendLog(
        state,
        `[Panier Express] Choix invalide (aucun pending).`,
      );
    }

    const index = Number(action.payload?.index);
    const choices = toUnknownArray(pending.choices).map((value) =>
      toText(value),
    );
    if (!Number.isFinite(index) || index < 0 || index >= choices.length) {
      return this.core.appendLog(state, `[Panier Express] Choix invalide.`);
    }

    const pendingData = asRecord(pending.data);
    const kind = toText(pendingData.kind).trim();

    const updatePlayer = (
      base: GameStateEntity,
      playerId: number,
      updater: (player: PanierExpressPlayer) => PanierExpressPlayer,
    ): GameStateEntity =>
      updatePanierExpressPlayer(base, this.getPlayers(base), playerId, updater);

    const removeCourseFromPlayer = (
      base: GameStateEntity,
      playerId: number,
      card: string,
    ): { state: GameStateEntity; removed: boolean } => {
      const trimmed = String(card ?? '').trim();
      if (!trimmed) return { state: base, removed: false };
      let removed = false;
      const updated = updatePlayer(base, playerId, (p) => {
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
      const next = updatePlayer(base, playerId, (p) => {
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
      const nextMeta = this.getMetadata(next);
      const discards = Array.isArray(nextMeta.discards?.courses)
        ? nextMeta.discards.courses.map((v) => String(v))
        : [];
      const withDiscard = kept
        ? next
        : {
            ...next,
            metadata: {
              ...nextMeta,
              discards: {
                ...nextMeta.discards,
                courses: [...discards, trimmed],
              },
            },
          };
      if (!kept) return withDiscard;
      const metaAfter = this.getMetadata(withDiscard);
      return {
        ...withDiscard,
        metadata: {
          ...metaAfter,
          lastObtainedCourse: {
            ...(metaAfter.lastObtainedCourse ?? {}),
            [playerId]: trimmed,
          },
        },
      };
    };

    const clearPending = (s: GameStateEntity): GameStateEntity => ({
      ...s,
      pending: null,
    });
    const basicPickChoiceResolved = resolveBasicPanierExpressPickChoice({
      kind,
      state,
      actorId,
      index,
      choices,
      pendingData,
      clearPending,
      getMetadata: (value) => this.getMetadata(value),
      asStringDeckPool,
      discardMany: (pool, deckKey, cards) =>
        this.deckPool.discardMany<string>(pool, deckKey, cards),
      addCourseToPlayer,
      discardCourse,
      removeCourseFromPlayer,
      appendLog: (value, message) => this.core.appendLog(value, message),
      appendActionLog: (value, playerId, type, payload) =>
        this.appendActionLog(value, playerId, type, payload),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      formatCourseLabel: (card) => this.utils.formatCourseLabel(card),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
      getPlayers: (value) => this.getPlayers(value),
      toStringArray: (value) => this.utils.toStringArray(value),
      createMetaRng: (metadata) => this.random.createMetaRng(metadata),
      pickOne: (metadata, items) => this.random.pickOne(metadata, items),
      ensureMetadata: (value) => this.ensureMetadata(value),
      buildTiles: () => this.buildTiles(),
      movePlayer: (value, playerId, delta) =>
        this.movePlayer(value, playerId, delta),
      resolveTile: (value, playerId) => this.resolveTile(value, playerId),
      advanceAfterDraw: (value) => this.advanceAfterDraw(value),
      applyMoveDelta: (value, playerId, delta) =>
        this.applyMoveDelta(value, playerId, delta),
      handleMerchantRequestAccept: (value) =>
        this.handleMerchantRequestAccept(value, {
          type: 'merchant_request_accept',
          meta: { actorId },
        } as any),
      handleMerchantRequestRefuse: (value) =>
        this.handleMerchantRequestRefuse(value, {
          type: 'merchant_request_refuse',
          meta: { actorId },
        } as any),
    });
    if (basicPickChoiceResolved) {
      return basicPickChoiceResolved;
    }
    const exchangePickChoiceResolved = resolvePanierExpressExchangePickChoice({
      kind,
      state,
      actorId,
      index,
      choices,
      pendingData,
      clearPending,
      standCourseCatalog: () => this.setup.standCourseCatalog(),
      getMetadata: (value) => this.getMetadata(value),
      getPlayers: (value) => this.getPlayers(value),
      toStringArray: (value) => this.utils.toStringArray(value),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      formatCourseLabel: (card) => this.utils.formatCourseLabel(card),
      appendLog: (value, message) => this.core.appendLog(value, message),
      appendActionLog: (value, playerId, type, payload) =>
        this.appendActionLog(value, playerId, type, payload),
      addCourseToPlayer,
      discardCourse,
      removeCourseFromPlayer,
      createMetaRng: (metadata) => this.random.createMetaRng(metadata),
      pickOne: (metadata, items) => this.random.pickOne(metadata, items),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
      queueCourseDraws: (value, tasks, label) =>
        this.queueCourseDraws(value, tasks, label),
      applyExchangeCard: (value, currentActorId, targetPlayerId, card) =>
        this.exchangeSvc.applyExchangeCard(
          value,
          currentActorId,
          targetPlayerId,
          card,
        ),
      applyQuiz: (value, playerId) => this.quizSvc.applyQuiz(value, playerId),
    });
    if (exchangePickChoiceResolved) {
      return exchangePickChoiceResolved;
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
    return handlePanierExpressAnswerQuiz({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      getMetadata: (value) => this.getMetadata(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      validateAnswer: (quizState, playerId, answer) =>
        this.quizRunner.validateAnswer(quizState, playerId, answer),
      appendActionLog: (value, playerId, type, payload) =>
        this.appendActionLog(value, playerId, type, payload),
      queueCourseDraws: (value, tasks, label) =>
        this.queueCourseDraws(value, tasks, label),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
    });
  }

  private applyMoveDelta(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    return applyPanierExpressMoveDelta({
      state,
      playerId,
      delta,
      movePlayer: (value, currentPlayerId, moveDelta) =>
        this.movePlayer(value, currentPlayerId, moveDelta),
      resolveTile: (value, currentPlayerId) =>
        this.resolveTile(value, currentPlayerId),
    });
  }

  private applyMoveChoice(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    return applyPanierExpressMoveChoice({
      state,
      playerId,
      delta,
      appendLog: (value, message) => this.core.appendLog(value, message),
    });
  }

  private applyMoveToStandChoice(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return applyPanierExpressMoveToStandChoice({
      state,
      playerId,
      appendLog: (value, message) => this.core.appendLog(value, message),
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      buildTiles: () => this.buildTiles(),
      tileLabel: (tile) => this.tileLabel(tile),
    });
  }

  private applyWeatherBack(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    if (state.pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Un autre choix est déjà en attente.`,
      );
    }

    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const rng = this.random.nextInt(meta, 10);
    const steps = rng.value + 1;
    const baseState = { ...ensured, metadata: rng.meta };
    const moved = this.movePlayer(baseState, playerId, -steps);
    return this.resolveTile(moved, playerId);
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
    silent = false,
  ): GameStateEntity {
    const count = Math.max(1, turns || 1);
    const next = this.turnStatus.setStatus(state, playerId, 'skipTurn', count);
    if (silent) return next;
    return this.core.appendLog(
      next,
      `[Panier Express] ${this.utils.playerName(state, playerId)} perd ${count} tour(s).`,
    );
  }

  private removeIngredientFromInventory(
    state: GameStateEntity,
    playerId: number,
    ingredient: string,
  ): GameStateEntity {
    const trimmed = String(ingredient ?? '').trim();
    if (!trimmed) return state;
    const players = (state.players ?? []).map((player) => {
      if (player.id !== playerId) return player;
      const inventory = this.utils.toStringArray(player.inventory);
      if (!inventory.includes(trimmed)) return player;
      return { ...player, inventory: this.utils.removeOne(inventory, trimmed) };
    });
    return { ...state, players };
  }

  private addCourseToDiscards(
    state: GameStateEntity,
    course: string,
  ): GameStateEntity {
    const trimmed = String(course ?? '').trim();
    if (!trimmed) return state;
    const meta = this.getMetadata(state);
    const current = Array.isArray(meta.discards?.courses)
      ? meta.discards?.courses.map((v) => String(v))
      : [];
    return {
      ...state,
      metadata: {
        ...meta,
        discards: {
          ...meta.discards,
          courses: [...current, trimmed],
        },
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

  private getMetadataRecord(state: GameStateEntity): Record<string, unknown> {
    return getPanierExpressMetadataRecord(state);
  }

  private getPawnText(player: unknown): string {
    return getPanierExpressPawnText(player);
  }

  private getPlayers(state: GameStateEntity): PanierExpressPlayer[] {
    return getPanierExpressPlayers(state);
  }

  private getActorIdFromAction(action: GameSingleActionDto): number | null {
    return getPanierExpressActorIdFromAction(action);
  }

  private getPendingRecord(
    state: GameStateEntity,
  ): Record<string, unknown> | null {
    return getPanierExpressPendingRecord(state);
  }

  private getMetadata(state: GameStateEntity): PanierExpressMetadata {
    return getPanierExpressMetadata(state, (nextState) =>
      this.buildMetadata(nextState),
    );
  }
}
