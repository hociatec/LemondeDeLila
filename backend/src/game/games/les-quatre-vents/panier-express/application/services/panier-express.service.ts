import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import {
  GameStateEntity,
  PendingState,
} from '../../../../../core/application/models/game-state.model';
import { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import { GameStateWithActions } from '../../../../../core/application/models/game-action.model';
import { AbstractGameService } from '../../../../../core/application/services/abstract-game.service';
import { TurnService } from '../../../../../core/application/services/turn.service';
import {
  DeckPoolService,
  DeckPoolState,
} from '../../../../../cards/public-api';
import { BoardMovementService } from '../../../../../core/application/services/board-movement.service';
import { TileEffectRegistryService } from '../../../../../effects/application/services/tile-effect-registry.service';
import { TurnActionsService } from '../../../../../core/application/services/turn-actions.service';
import { StandEffectRegistryService } from '../../../../../effects/application/services/stand-effect-registry.service';
import { ActionResolverService } from '../../../../../action-resolver/application/services/action-resolver.service';
import { TurnStatusService } from '../../../../../core/application/services/turn-status.service';
import { QuizRunnerService } from '../../../../../quiz/application/services/quiz-runner.service';
import { VictoryService } from '../../../../../victory/application/services/victory.service';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import { ActionLogService } from '../../../../../actionlog/application/services/action-log.service';
import {
  PanierExpressMetadata,
  PanierExpressTile,
  PanierExpressPlayer,
  PanierExpressDeckPool,
} from '../../model/panier-express-state.model';
import { playingLog } from '../../../../../../common/utils/public-api';
import { PanierExpressSetupService } from './panier-express-setup.service';
import { PanierExpressDrawService } from './panier-express-draw.service';
import { PanierExpressQuizService } from './panier-express-quiz.service';
import {
  assignConfiguredBotPawns,
  queueConfiguredPawnSelection,
} from '../../../../../pawn-selection/public-api';
import { PanierExpressExchangeService } from './panier-express-exchange.service';
import { PanierExpressUtils } from './panier-express-utils.service';
import * as PanierExpressRulebook from '../../rulebook/rulebook';
import { PanierExpressBotService } from './panier-express-bot.service';
import { PanierExpressPhaseService } from './panier-express-phase.service';
import { PanierExpressPresenterService } from './panier-express-presenter.service';
import { PanierExpressStateService } from './panier-express-state.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { resolvePendingPawnChoiceAction } from '../../../../../pawn-selection/public-api';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../shortcuts/public-api';
import { hydratePanierExpressInitialState } from '../../panier-express-initial-state.helpers';
import {
  asStringDeckPool,
  toDrawQueueEntries,
} from '../../panier-express-deck.helpers';
import {
  getPanierExpressActorIdFromAction,
  getPanierExpressMetadataRecord,
  getPanierExpressPawnText,
  getPanierExpressPendingRecord,
} from '../../panier-express-access.helpers';
import { buildExposedPanierExpressState } from '../../panier-express-expose.helpers';
import {
  advancePanierExpressAfterDraw,
  ensurePanierExpressStarted,
  finalizePanierExpressStarterAfterPawnSelection,
  movePanierExpressPlayer,
  queuePanierExpressCourseDraws,
  startPanierExpressDrawPending,
} from '../../panier-express-turn.helpers';
import {
  buildPanierExpressEventTargetChoices,
  buildPanierExpressEventTargets,
  continuePanierExpressQueuedDraw,
  handlePanierExpressGenerousProducerDraw,
  handlePanierExpressLuckyDraw,
  handlePanierExpressSeasonChangeDraw,
} from '../../panier-express-draw.helpers';
import { applyPanierExpressEventAction } from '../../actions/panier-express-event-action.helper';
import { applyBasicPanierExpressEvent } from '../../panier-express-event-basic.helpers';
import { applyAdvancedPanierExpressEvent } from '../../panier-express-event-advanced.helpers';
import { applyPanierExpressChoosePawnAction } from '../../actions/panier-express-choose-pawn-action.helper';
import { applyPanierExpressDrawAction } from '../../actions/panier-express-draw-action.helper';
import { applyPanierExpressPickChoiceAction } from '../../actions/panier-express-pick-choice-action.helper';
import { applyPanierExpressRollAction } from '../../actions/panier-express-roll-action.helper';
import {
  handlePanierExpressExchangeAccept,
  handlePanierExpressExchangeChooseGive,
  handlePanierExpressExchangeChooseTarget,
  handlePanierExpressExchangeRefuse,
  handlePanierExpressMerchantRequestAccept,
  handlePanierExpressMerchantRequestRefuse,
  handlePanierExpressSkipTurn,
} from '../../panier-express-action.helpers';
import {
  applyPanierExpressMoveChoice,
  applyPanierExpressMoveDelta,
  applyPanierExpressMoveToStandChoice,
  handlePanierExpressAnswerQuiz,
} from '../../panier-express-quiz-move.helpers';
import {
  addPanierExpressCourseToDiscards,
  applyPanierExpressMoveToNextStand,
  applyPanierExpressSkipTurnTile,
  applyPanierExpressWeatherBack,
  removePanierExpressIngredientFromInventory,
} from '../../panier-express-state-actions.helper';
import {
  applyPanierExpressMerchantRequest,
  getPanierExpressStandLabel,
  getPanierExpressTileLabel,
  registerPanierExpressStandHandlers,
  registerPanierExpressTileHandlers,
  resolvePanierExpressTile,
} from '../../panier-express-board.helpers';
import { buildPanierExpressShortcuts } from '../../panier-express.shortcuts';
import {
  asRecord,
  toText,
  toUnknownArray,
} from '../../panier-express-state.helpers';
import { drawPanierExpressCardFromPoolBlock } from './panier-express-state-block.utils';

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
    private readonly stateSvc: PanierExpressStateService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.registerTileHandlers();
    this.registerStandHandlers();
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const ensured = this.ensureMetadata(state);
    return buildExposedPanierExpressState({
      state: ensured,
      meta: this.getMetadata(ensured),
      getActions: (playerId) => this.getAvailableActions(ensured, playerId),
      expose: (args) => this.presenter.exposeState(args),
    });
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const ensured = this.ensureMetadata(state);
    return buildExposedPanierExpressState({
      state: ensured,
      meta: this.getMetadata(ensured),
      requestedUserId: userId,
      getActions: (playerId) => this.getAvailableActions(ensured, playerId),
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
      buildMetadata: (state) => this.stateSvc.buildMetadata(state),
      ensureMetadata: (state) => this.stateSvc.ensureMetadata(state),
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

  private buildTiles(): PanierExpressTile[] {
    return this.stateSvc.buildTiles();
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
    return applyPanierExpressRollAction({
      state,
      action,
      getMetadata: (value) => this.getMetadata(value),
      getMetadataRecord: (value) => this.getMetadataRecord(value),
      rollDice: (metadata, sides) => this.random.rollDice(metadata, sides),
      cloneState: (value) => this.core.cloneState(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      appendActionLog: (value, playerId, actionType, details) =>
        this.appendActionLog(value, playerId, actionType, details),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      movePlayer: (value, playerId, roll) =>
        this.movePlayer(value, playerId, roll),
      resolveTile: (value, playerId) => this.resolveTile(value, playerId),
      getAvailableActions: (value, playerId) =>
        this.getAvailableActions(value, playerId),
      getTurnStatus: (value, playerId, key) =>
        this.turnStatus.getStatus(value, playerId, key),
      clearTurnStatus: (value, playerId, key) =>
        this.turnStatus.setStatus(value, playerId, key, 0),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
      logEvent: (event, payload) => playingLog(event, payload),
    });
  }

  private handleDraw(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    return applyPanierExpressDrawAction({
      state,
      action,
      appendLog: (value, message) => this.core.appendLog(value, message),
      applyEvent: (value, playerId) => this.applyEvent(value, playerId),
      advanceAfterDraw: (value) => this.advanceAfterDraw(value),
      handleLuckyDraw: (value, playerId) =>
        handlePanierExpressLuckyDraw({
          state: value,
          playerId,
          getMetadata: (current) => this.getMetadata(current),
          createMetaRng: (metadata) => this.random.createMetaRng(metadata),
          drawPool: (pool, deckKey, rng) =>
            this.deckPool.draw<string>(asStringDeckPool(pool), deckKey, rng),
          discardPool: (pool, deckKey, card) =>
            this.deckPool.discard<string>(
              asStringDeckPool(pool),
              deckKey,
              card,
            ),
          appendLog: (current, message) =>
            this.core.appendLog(current, message),
          advanceAfterDraw: (current) => this.advanceAfterDraw(current),
          withPending: (current, pendingState) =>
            this.withPending(current, pendingState),
        }),
      handleGenerousProducerDraw: (value, playerId) =>
        handlePanierExpressGenerousProducerDraw({
          state: value,
          playerId,
          drawCourse: (current, targetPlayerId, standId) =>
            this.drawSvc.drawCourse(current, targetPlayerId, standId),
          getMetadata: (current) => this.getMetadata(current),
          createMetaRng: (metadata) => this.random.createMetaRng(metadata),
          drawPool: (pool, deckKey, rng) =>
            this.deckPool.draw<string>(asStringDeckPool(pool), deckKey, rng),
          discardPool: (pool, deckKey, card) =>
            this.deckPool.discard<string>(
              asStringDeckPool(pool),
              deckKey,
              card,
            ),
          appendLog: (current, message) =>
            this.core.appendLog(current, message),
          advanceAfterDraw: (current) => this.advanceAfterDraw(current),
          withPending: (current, pendingState) =>
            this.withPending(current, pendingState),
        }),
      handleSeasonChangeDraw: (value, playerId, data) =>
        handlePanierExpressSeasonChangeDraw({
          state: value,
          playerId,
          data,
          drawCourse: (current, targetPlayerId, standId) =>
            this.drawSvc.drawCourse(current, targetPlayerId, standId),
          toUnknownArray,
          toStringArray: (current) => this.utils.toStringArray(current),
          appendLog: (current, message) =>
            this.core.appendLog(current, message),
          advanceAfterDraw: (current) => this.advanceAfterDraw(current),
          withPending: (current, pendingState) =>
            this.withPending(current, pendingState),
        }),
      continueQueuedDraw: ({ state: value, queue, cursor, label }) =>
        continuePanierExpressQueuedDraw({
          state: value,
          queue: queue as ReturnType<typeof toDrawQueueEntries>,
          cursor,
          label,
          drawCourse: (current, playerId, standId) =>
            this.drawSvc.drawCourse(current, playerId, standId),
          advanceAfterDraw: (current) => this.advanceAfterDraw(current),
          withPending: (current, pendingState) =>
            this.withPending(current, pendingState),
        }),
      toQueueEntries: (value) => toDrawQueueEntries(value),
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
      createMetaRng: (metadata) => this.random.createMetaRng(metadata),
      pickOne: (metadata, items) => this.random.pickOne(metadata, items),
      formatCourseLabel: (ingredient) =>
        this.utils.formatCourseLabel(ingredient),
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
      standIds: () => this.stateSvc.standIds(),
      queueCourseDraws: (state, tasks, label) =>
        this.queueCourseDraws(state, tasks, label),
    });
  }

  private applyEvent(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return applyPanierExpressEventAction({
      state,
      playerId,
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      drawFromPool: (meta, key) => this.drawFromPool<string>(meta, key),
      refillEventDeck: (meta) =>
        this.deckPool.set<string>(
          meta.decks as DeckPoolState<string>,
          'events',
          this.deckPool.shuffle([...this.setup.eventCards()]),
        ) as PanierExpressDeckPool,
      formatEventLabel: (event) => this.utils.formatEventLabel(event),
      appendLog: (value, message) => this.core.appendLog(value, message),
      appendActionLog: (value, currentPlayerId, type, payload) =>
        this.appendActionLog(value, currentPlayerId, type, payload),
      getPlayers: (value) => this.getPlayers(value),
      toStringArray: (value) => this.utils.toStringArray(value),
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
      movePlayer: (value, currentPlayerId, delta) =>
        this.movePlayer(value, currentPlayerId, delta),
      resolveTile: (value, currentPlayerId) =>
        this.resolveTile(value, currentPlayerId),
      moveCircular: (length, currentPosition, delta) =>
        this.movement.moveCircular(length, currentPosition, delta),
      createMetaRng: (metadata) => this.random.createMetaRng(metadata),
      pickOne: (metadata, items) => this.random.pickOne(metadata, items),
      formatCourseLabel: (card) => this.utils.formatCourseLabel(card),
      courseItems: () => this.setup.courseItems(),
      withPending: (value, pendingState) =>
        this.withPending(value, pendingState),
    });
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
      acceptOffer: (value, actorId) =>
        this.exchangeSvc.acceptOffer(value, actorId),
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
      refuseOffer: (value, actorId) =>
        this.exchangeSvc.refuseOffer(value, actorId),
      applyQuiz: (value, initiatorId) =>
        this.quizSvc.applyQuiz(value, initiatorId),
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
    return applyPanierExpressChoosePawnAction({
      state,
      resolvePendingPawnChoiceAction: () =>
        resolvePendingPawnChoiceAction({
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
        }),
      appendLog: (value, message) => this.core.appendLog(value, message),
      getPlayers: (value) => this.getPlayers(value),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      ensureStarted: (value) => this.ensureStarted(value),
      queuePawnSelection: (value) => this.queuePawnSelection(value),
    });
  }

  private handlePickChoice(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId =
      this.getActorIdFromAction(action) ?? state.turn?.currentPlayerId ?? null;
    return applyPanierExpressPickChoiceAction({
      state,
      action,
      getActorIdFromAction: (value) => this.getActorIdFromAction(value),
      getPendingRecord: (value) => this.getPendingRecord(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
      getPlayers: (value) => this.getPlayers(value),
      getMetadata: (value) => this.getMetadata(value),
      toStringArray: (value) => this.utils.toStringArray(value),
      removeOne: (items, value) => this.utils.removeOne(items, value),
      discardMany: (pool, deckKey, cards) =>
        this.deckPool.discardMany<string>(
          asStringDeckPool(pool),
          deckKey,
          cards,
        ),
      appendActionLog: (value, playerId, type, payload) =>
        this.appendActionLog(value, playerId, type, payload),
      playerName: (value, playerId) => this.utils.playerName(value, playerId),
      formatCourseLabel: (card) => this.utils.formatCourseLabel(card),
      advanceTurn: (value) => this.phaseFlow.advanceTurn(value),
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
        } as GameSingleActionDto),
      handleMerchantRequestRefuse: (value) =>
        this.handleMerchantRequestRefuse(value, {
          type: 'merchant_request_refuse',
          meta: { actorId },
        } as GameSingleActionDto),
      standCourseCatalog: () => this.setup.standCourseCatalog(),
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
    return applyPanierExpressWeatherBack({
      state,
      playerId,
      appendLog: (value, message) => this.core.appendLog(value, message),
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      nextInt: (metadata, maxExclusive) =>
        this.random.nextInt(metadata, maxExclusive),
      movePlayer: (value, currentPlayerId, roll) =>
        this.movePlayer(value, currentPlayerId, roll),
      resolveTile: (value, currentPlayerId) =>
        this.resolveTile(value, currentPlayerId),
    });
  }

  private applyMoveToNextStand(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return applyPanierExpressMoveToNextStand({
      state,
      playerId,
      ensureMetadata: (value) => this.ensureMetadata(value),
      getMetadata: (value) => this.getMetadata(value),
      buildTiles: () => this.buildTiles(),
      moveCircular: (size, position, delta) =>
        this.movement.moveCircular(size, position, delta),
      movePlayer: (value, currentPlayerId, delta) =>
        this.movePlayer(value, currentPlayerId, delta),
      resolveTile: (value, currentPlayerId) =>
        this.resolveTile(value, currentPlayerId),
    });
  }

  private applySkipTurnTile(
    state: GameStateEntity,
    playerId: number,
    turns: number,
    silent = false,
  ): GameStateEntity {
    return applyPanierExpressSkipTurnTile({
      state,
      playerId,
      turns,
      silent,
      setTurnStatus: (value, currentPlayerId, status, count) =>
        this.turnStatus.setStatus(value, currentPlayerId, status, count),
      appendLog: (value, message) => this.core.appendLog(value, message),
      playerName: (value, currentPlayerId) =>
        this.utils.playerName(value, currentPlayerId),
    });
  }

  private removeIngredientFromInventory(
    state: GameStateEntity,
    playerId: number,
    ingredient: string,
  ): GameStateEntity {
    return removePanierExpressIngredientFromInventory({
      state,
      playerId,
      ingredient,
      toStringArray: (value) => this.utils.toStringArray(value),
      removeOne: (items, value) => this.utils.removeOne(items, value),
    });
  }

  private addCourseToDiscards(
    state: GameStateEntity,
    course: string,
  ): GameStateEntity {
    return addPanierExpressCourseToDiscards({
      state,
      course,
      getMetadata: (value) => this.getMetadata(value),
    });
  }

  private drawFromPool<T = unknown>(
    meta: PanierExpressMetadata,
    key: string,
  ): {
    card: T | undefined;
    metadata: PanierExpressMetadata;
  } {
    return drawPanierExpressCardFromPoolBlock<T>({
      meta,
      key,
      draw: (pool, deckKey) => {
        const result = this.deckPool.draw<unknown>(pool, deckKey);
        return {
          card: result.card,
          pool: result.pool as PanierExpressDeckPool,
        };
      },
    });
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
    return this.stateSvc.getPlayers(state);
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
    return this.stateSvc.getMetadata(state);
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    return this.stateSvc.ensureMetadata(state);
  }
}
