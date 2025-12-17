import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity, PendingState, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GameStateWithActions } from '../../../../../engine/dto/game-action.dto';
import { GameRulesAdapter } from '../../../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../../../engine/services/game-registry.service';
import { TurnService } from '../../../../../modules/turn/services/turn.service';
import { DeckPoolService, DeckPoolState } from '../../../../../modules/cards/services/deck-pool.service';
import { BoardMovementService } from '../../../../../modules/board/services/board-movement.service';
import { TileEffectRegistryService } from '../../../../../modules/effects/services/tile-effect-registry.service';
import { TurnActionsService } from '../../../../../modules/turn/services/turn-actions.service';
import { StandEffectRegistryService } from '../../../../../modules/effects/services/stand-effect-registry.service';
import { ActionResolverService } from '../../../../../modules/action-resolver/services/action-resolver.service';
import { TurnStatusService } from '../../../../../modules/turn/services/turn-status.service';
import { QuizRunnerService, QuizQuestion } from '../../../../../modules/quiz/services/quiz-runner.service';
import { GenericExchangeService } from '../../../../../modules/exchange/services/generic-exchange.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import { BotRunnerService } from '../../../../../modules/bot/services/bot-runner.service';
import { ActionLogService } from '../../../../../modules/actionlog/services/action-log.service';
import {
  PanierExpressMetadata,
  PanierExpressTile,
  PanierExpressPlayerState,
  PanierExpressDeckPool,
} from '../entities/panier-express-state.entity';
import { PANIER_EXPRESS_PHASES } from '../definitions/rules.definition';
import { PANIER_EXPRESS_VICTORY } from '../definitions/victory.definition';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import { sanitizeText } from '../../../../../../common/utils/sanitize-text';
import { PanierExpressSetupService } from './panier-express-setup.service';
import { PanierExpressDrawService } from './panier-express-draw.service';
import { PanierExpressQuizService } from './panier-express-quiz.service';
import { PanierExpressExchangeService } from './panier-express-exchange.service';
import { PanierExpressUtils } from '../utils/panier-express-utils.service';

type PanierExpressPlayerView = {
  id: number;
  username: string | null;
  isBot: boolean;
  shoppingList: string[];
  basket: string[];
  inventory: string[];
};

type PanierExpressPlayerSummary = Pick<
  PanierExpressPlayerView,
  'id' | 'username' | 'isBot' | 'shoppingList' | 'basket' | 'inventory'
>;

type PendingQuizPayload = {
  question: string;
  choices: string[];
};

@Injectable()
export class PanierExpressService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'panier-express';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = 'Panier Express';
  readonly description = 'Course au marché : compléter sa liste puis revenir pile sur la case départ.';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;
  private readonly phaseOrder = PANIER_EXPRESS_PHASES;

  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnService,
    private readonly deckPool: DeckPoolService,
    private readonly movement: BoardMovementService,
    private readonly tileRegistry: TileEffectRegistryService<GameStateEntity, { playerId: number; tile: PanierExpressTile }>,
    private readonly turnActions: TurnActionsService,
    private readonly standEffects: StandEffectRegistryService<GameStateEntity>,
    private readonly resolver: ActionResolverService,
    private readonly turnStatus: TurnStatusService,
    private readonly victory: VictoryService,
    private readonly botRunner: BotRunnerService,
    private readonly actionLogSvc: ActionLogService,
    private readonly registry: GameRegistryService,
    private readonly setup: PanierExpressSetupService,
    private readonly drawSvc: PanierExpressDrawService,
    private readonly quizSvc: PanierExpressQuizService,
    private readonly quizRunner: QuizRunnerService,
    private readonly exchangeHelper: GenericExchangeService,
    private readonly exchangeSvc: PanierExpressExchangeService,
    private readonly utils: PanierExpressUtils,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.registerTileHandlers();
    this.registerStandHandlers();
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const ensured = this.ensureMetadata(state);
    const currentId = ensured.turn?.currentPlayerId ?? null;
    const current = (ensured.players ?? []).find((p) => p.id === currentId);
    const isBot = current?.isBot === true;
    const actions = !isBot && typeof currentId === 'number' ? this.getAvailableActions(ensured, currentId) : [];
    const meta = this.getMetadata(ensured);
    const rawPending: PendingState | null = ensured.pending ?? null;
    const pendingQuiz: QuizQuestion | undefined =
      typeof currentId === 'number' ? meta.quiz.pending[currentId] ?? undefined : undefined;
    return this.buildView({ state: ensured, actions, rawPending, pendingQuiz, currentId });
  }

  /** Presenter / ViewBuilder pour l'état exposé Panier Express. */
  private buildView(params: {
    state: GameStateEntity;
    actions: GameSingleActionDto[];
    rawPending: PendingState | null;
    pendingQuiz: QuizQuestion | undefined;
    currentId: number | null;
  }): GameStateWithActions {
    const { state, actions, rawPending, pendingQuiz, currentId } = params;
    const pending = this.buildPendingView({ rawPending, pendingQuiz, currentId });
    const playerViews = this.buildPlayerViews(state);
    const players = playerViews.map(({ id, username, isBot, shoppingList, basket, inventory }) => ({
      id,
      username,
      isBot,
      shoppingList,
      basket,
      inventory,
    }));
    const extras = this.buildExtrasView(state, { currentId, playerViews, players });
    return {
      ...state,
      catalog: {
        phases: PANIER_EXPRESS_PHASES.map((p) => p.id),
        victory: PANIER_EXPRESS_VICTORY,
      },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending,
      extras,
    } as GameStateWithActions;
  }

  private buildPendingView(params: {
    rawPending: PendingState | null;
    pendingQuiz: QuizQuestion | undefined;
    currentId: number | null;
  }): PendingState | null {
    const quizPayload = this.normalizeQuizPending(params.pendingQuiz);
    if (quizPayload) {
      return {
        type: 'quiz',
        question: quizPayload.question,
        choices: quizPayload.choices,
        playerId: params.currentId,
        blocking: true,
      };
    }
    if (params.rawPending && params.rawPending.type && params.rawPending.type !== 'quiz') {
      return params.rawPending;
    }
    return null;
  }

  private normalizeQuizPending(pendingQuiz: QuizQuestion | undefined): PendingQuizPayload | null {
    if (!pendingQuiz) {
      return null;
    }
    const question = sanitizeText(pendingQuiz.question ?? '');
    const rawChoices =
      Array.isArray(pendingQuiz.choices) && pendingQuiz.choices.length
        ? pendingQuiz.choices
        : pendingQuiz.answer
        ? [pendingQuiz.answer]
        : [];
    const choices = rawChoices
      .map((choice) => sanitizeText(String(choice)))
      .filter((choice) => choice.length > 0);
    if (!question && choices.length === 0) {
      return null;
    }
    return { question, choices };
  }

  private buildPlayerViews(state: GameStateEntity): PanierExpressPlayerView[] {
    return (state.players ?? [])
      .map((p) => this.buildPlayerView(state, p.id))
      .filter((view): view is PanierExpressPlayerView => Boolean(view));
  }

  private buildExtrasView(
    state: GameStateEntity,
    params: {
      currentId: number | null;
      playerViews: PanierExpressPlayerView[];
      players: PanierExpressPlayerSummary[];
    },
  ): Record<string, unknown> {
    const extrasFromState = (state as GameStateEntity & { extras?: unknown }).extras;
    const baseExtras: Record<string, unknown> =
      extrasFromState && typeof extrasFromState === 'object' ? (extrasFromState as Record<string, unknown>) : {};
    const currentPlayerView =
      typeof params.currentId === 'number'
        ? params.playerViews.find((view) => view.id === params.currentId) ?? null
        : null;
    return {
      ...baseExtras,
      currentPlayerView,
      playerViews: params.playerViews,
      players: params.players,
      // "pressed X" => KeyEvent.KEY_PRESSED, fonctionne sur la touche seule (b, s, i) sans Maj.
      shortcuts: [
        { key: 'pressed S', type: 'interface', id: 'shopping' },
        { key: 'pressed B', type: 'interface', id: 'basket' },
        { key: 'pressed I', type: 'interface', id: 'inventory' },
        { key: 'pressed P', type: 'interface', id: 'position' },
      ],
    };
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = (baseState.status || '').toLowerCase();
    const players = baseState.players ?? [];
    const inProgress =
      status === 'finished' ||
      (typeof baseState.turnIndex === 'number' && baseState.turnIndex > 0) ||
      players.some((p) => {
        const hasList = Array.isArray(p.shoppingList) && p.shoppingList.length > 0;
        const hasBasket = Array.isArray(p.basket) && p.basket.length > 0;
        const hasInventory = Array.isArray(p.inventory) && p.inventory.length > 0;
        return hasList || hasBasket || hasInventory;
      });
    if (inProgress) {
      // Partie déjà démarrée ou en reprise : ne pas réattribuer de listes ni de decks, juste normaliser.
      return this.ensureMetadata({ ...baseState, status: baseState.status ?? 'started' });
    }

    const existingMeta = (baseState.metadata as PanierExpressMetadata) ?? null;
    const baseMeta = this.buildMetadata(baseState);
    // Conserver les decks existants si présents (évite de réattribuer de nouvelles listes).
    const metadata: PanierExpressMetadata = {
      ...baseMeta,
      ...(existingMeta ?? {}),
      decks: existingMeta?.decks ? { ...baseMeta.decks, ...existingMeta.decks } : baseMeta.decks,
    };
    const shoppingDeck = this.extractShoppingLists(metadata);
    const hydratedPlayers = players.map((p, idx) => {
      const username = (p.username ?? '').toLowerCase();
      const isBot = p.isBot === true || username.includes('bot');
      const hasList = Array.isArray(p.shoppingList) && p.shoppingList.length > 0;
      const list: string[] = hasList
        ? this.toStringArray(p.shoppingList)
        : (shoppingDeck[idx] ?? this.buildShoppingList());
      return {
        ...p,
        isBot,
        basket: Array.isArray(p.basket) ? (p.basket as unknown[]).map((item) => String(item)) : [],
        inventory: Array.isArray(p.inventory) ? (p.inventory as unknown[]).map((item) => String(item)) : [],
        shoppingList: list,
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
      const hadList = Array.isArray(originalPlayer?.shoppingList) && originalPlayer.shoppingList.length > 0;
      if (hadList) {
        return; // ne pas relogger une liste déjà attribuée (évite l'impression de réinitialisation).
      }
      const normalizedList = this.toStringArray(p.shoppingList);
      const list: string[] = normalizedList.length ? normalizedList : (shoppingDeck[idx] ?? []);
      const label = (p.username ?? '').trim() || 'Joueur ' + p.id;
      withLogs = this.core.appendLog(
        withLogs,
        '[Panier Express] ' + label + ' recoit une liste de courses: ' + list.join(', '),
      );
    });
    return withLogs;
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    let next = this.ensureMetadata(state);
    next = this.ensureStarted(next);
    next = this.resolver.apply(next, actions, (s, a) => this.dispatchAction(s, a));
    next = this.advancePhases(next);
    // Signaler au moteur si un bot doit jouer au prochain tick.
    const current = next.turn?.currentPlayerId ?? null;
    const isBot = (next.players ?? []).find((p) => p.id === current)?.isBot ?? false;
    next = { ...next, botThinking: Boolean(isBot) };
    return next;
  }

  private dispatchAction(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    if (!action?.type) return state;
    switch (action.type) {
      case 'roll':
        return this.handleRoll(state, action);
      case 'answer_quiz':
        return this.handleAnswerQuiz(state, action);
      case 'exchange_with':
        return this.handleExchangeWith(state, action);
      case 'skip_turn':
        return this.handleSkipTurn(state, action);
      // Compat actions depuis le client Java
      case 'ROLL_DICE':
        return this.handleRoll(state, { ...action, type: 'roll' });
      case 'apply_exchange':
        return this.handleLegacyExchange(state, action);
      default:
        return this.core.appendLog(state, `[Panier Express] Action non gérée: ${action.type}`);
    }
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const ensured = this.ensureMetadata(state);
    const current = ensured.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const meta = this.getMetadata(ensured);
    const profile = meta.botProfile ?? 'greedy';
    const skip = this.turnStatus.getStatus(state, botPlayerId, 'skipTurn');
    if (skip > 0) {
      // Bot passe son tour : action explicite pour avancer sans rester bloqué.
      playingLog('panier.bot.skip', { botPlayerId, skip });
      return [{ type: 'skip_turn', payload: { playerId: botPlayerId } }];
    }

    const available = this.injectQuizAnswer(this.getAvailableActions(ensured, botPlayerId), meta, botPlayerId);
    const rawPlayer = (ensured.players ?? []).find((p) => p.id === botPlayerId);
    const shoppingListRaw = rawPlayer?.shoppingList;
    const basketRaw = rawPlayer?.basket;
    const shoppingList = Array.isArray(shoppingListRaw) ? shoppingListRaw : [];
    const basket = Array.isArray(basketRaw) ? basketRaw : [];
    if (!Array.isArray(shoppingListRaw) || !Array.isArray(basketRaw)) {
      playingLog('panier.bot.warn', {
        playerId: botPlayerId,
        shoppingListType: typeof shoppingListRaw,
        basketType: typeof basketRaw,
      });
    }
    const missing = new Set(shoppingList.filter((item) => !basket.includes(item)));
    const score = (action: GameSingleActionDto) => {
      const type = action.type?.toLowerCase() ?? '';
      if (type === 'answer_quiz') return 6;
      if (type === 'exchange_with') {
        const take = action.payload?.take;
        const give = action.payload?.give;
        const gain = missing.has(take) ? 3 : 0;
        const cost = missing.has(give) ? -2 : 0;
        return 4 + gain + cost;
      }
      if (type === 'roll') return 1;
      return 0;
    };
    const chosen = this.botRunner.choose(available, { state, playerId: botPlayerId }, profile, {
      preferTypes: ['answer_quiz', 'exchange_with', 'roll'],
      fallbackTypes: ['roll'],
      score,
    });
    if (chosen.length === 0 && available.length > 0) {
      // Sécurité : on joue la première action proposée pour éviter que le bot reste bloqué.
      return [available[0]];
    }
    if (chosen.length) {
      playingLog('panier.bot.actions', { botPlayerId, actions: chosen.map((a) => a.type) });
    }
    return chosen;
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    if ((state.status || '').toLowerCase() === 'finished') return [];
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const tiles = Array.isArray(meta.tiles) && meta.tiles.length ? meta.tiles : this.buildTiles();
    const pos = meta.positions[playerId] ?? 0;
    const tile = tiles[pos] ?? null;
    const hasPendingQuiz = Boolean(meta.quiz.pending[playerId]);
    const rawPending = ensured.pending ?? null;
    const hasPendingExchange = Boolean(rawPending && rawPending.type === 'exchange' && rawPending.playerId === playerId);

    const base: GameSingleActionDto[] = (() => {
      switch (tile?.type) {
        case 'quiz':
          if (hasPendingQuiz) {
            return [
              { type: 'answer_quiz', payload: { playerId, correct: true } },
              { type: 'answer_quiz', payload: { playerId, correct: false } },
            ];
          }
          // Si aucune question n'est en attente, on laisse le joueur relancer.
          return [{ type: 'roll' }];
        case 'exchange':
          // Les échanges ne sont proposés que lorsqu'un échange a été déclenché (landing sur la tuile).
          return hasPendingExchange ? this.buildExchangeActions(state, playerId) : [{ type: 'roll' }];
        default:
          return [{ type: 'roll' }];
      }
    })();

    return this.turnActions.buildAvailableActions({
      state: ensured,
      playerId,
      pending: hasPendingQuiz ? { playerId, type: 'quiz' } : null,
      base,
    });
  }

  private buildExchangeActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    return this.exchangeSvc.buildExchangeActions(state, playerId);
  }

  private buildMetadata(baseState: GameStateEntity): PanierExpressMetadata {
    return {
      stands: this.standIds(),
      tiles: this.setup.buildTiles(),
      decks: this.setup.buildDeckPool(baseState),
      positions: {},
      winnerId: null,
      quiz: { pending: {} },
      actionLog: [],
      botProfile: 'greedy',
      statuses: {
        skipTurn: {},
      },
    };
  }

  private standIds(): string[] {
    const ids = new Set<string>();
    this.setup.buildTiles()
      .filter((tile) => tile.type === 'stand')
      .forEach((tile) => ids.add(tile.standId));
    return Array.from(ids.values());
  }

  private buildTiles(): PanierExpressTile[] {
    return this.setup.buildTiles();
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    const normalizedPlayers = this.normalizePlayers(state.players as PlayerStateEntity[] | undefined);
    const merged = this.mergeMetadataWithDefaults(state);
    const metadata = this.hydrateMetadataCollections(state, merged, normalizedPlayers);
    return { ...state, metadata, players: normalizedPlayers };
  }

  private mergeMetadataWithDefaults(state: GameStateEntity): PanierExpressMetadata {
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
      quiz: existing.quiz ?? defaults.quiz,
      actionLog: existing.actionLog ?? defaults.actionLog,
      botProfile: existing.botProfile ?? defaults.botProfile,
      statuses: this.mergeStatuses(defaults.statuses, existing.statuses),
    };
  }

  private hydrateMetadataCollections(
    state: GameStateEntity,
    meta: PanierExpressMetadata,
    players: PanierExpressPlayerState[],
  ): PanierExpressMetadata {
    const decks = meta.decks ?? this.setup.buildDeckPool(state);
    const quiz = meta.quiz;
    const statuses = this.mergeStatuses({ skipTurn: {} }, meta.statuses);
    const positions = this.ensurePlayerPositions(meta.positions, players);
    const actionLog = Array.isArray(meta.actionLog) ? meta.actionLog : [];
    return { ...meta, decks, quiz, statuses, positions, actionLog };
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
    };
  }

  private ensurePlayerPositions(
    positions: Record<number, number> | undefined,
    players: PanierExpressPlayerState[],
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

  private handleRoll(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const roll =
      typeof action.payload?.roll === 'number' && action.payload.roll >= 1 && action.payload.roll <= 6
        ? action.payload.roll
        : Math.floor(Math.random() * 6) + 1;

    playingLog('panier.roll', {
      currentId,
      turnIndex: state.turnIndex,
      roll,
      status: state.status,
    });

    let next = this.core.cloneState(state);
    next.lastRoll = roll;
    next = this.core.appendLog(next, `${this.utils.playerName(state, currentId)} lance le dé : "${roll}"`);
    next = this.appendActionLog(next, currentId, 'roll', { roll });

    // Orchestration : move -> resolve tile -> check blocking -> advance turn
    next = this.movePlayer(next, currentId, roll);
    next = this.resolveTile(next, currentId);

    const metaAfter = this.getMetadata(next);
    const postActions = this.getAvailableActions(next, currentId);
    const hasBlockingQuiz = Boolean(metaAfter.quiz.pending[currentId]);
    const hasBlockingExchange = postActions.some((a) => (a.type || '').toLowerCase() === 'exchange_with');
    if (!hasBlockingQuiz && !hasBlockingExchange) {
      next = this.advanceTurn(next);
    }
    return next;
  }

  private movePlayer(state: GameStateEntity, playerId: number, roll: number): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const tiles = Array.isArray(meta.tiles) && meta.tiles.length ? meta.tiles : this.buildTiles();
    const currentPos = meta.positions[playerId] ?? 0;
    const nextPos = this.movement.moveCircular(tiles.length, currentPos, roll);
    const tile = this.movement.tileAt(tiles, nextPos);
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      positions: { ...meta.positions, [playerId]: nextPos },
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
      case 'stand':
        return `stand ${tile.standId ?? 'inconnu'}`;
      case 'event':
        return 'evenement';
      case 'exchange':
        return 'echange';
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

  private resolveTile(state: GameStateEntity, playerId: number): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const tiles = Array.isArray(meta.tiles) && meta.tiles.length ? meta.tiles : this.buildTiles();
    const position = meta.positions[playerId] ?? 0;
    const tile = tiles[position] ?? null;
    if (!tile) {
      return this.core.appendLog(
        state,
        `[Panier Express] Résolution tuile: aucune tuile en position ${position} pour ${this.utils.playerName(state, playerId)}.`,
      );
    }
    const resolved = this.tileRegistry.apply(tile.type, ensured, { playerId, tile });
    return resolved;
  }

  private registerTileHandlers(): void {
    this.tileRegistry.register('stand', (s, ctx) =>
      this.standEffects.applyStand('stand', s, {
        playerId: ctx.playerId,
        standId: ctx.tile.type === 'stand' ? ctx.tile.standId : 'stand',
        state: s,
      }),
    );
    this.tileRegistry.register('event', (s, ctx) => this.applyEvent(s, ctx.playerId));
    this.tileRegistry.register('exchange', (s, ctx) => this.applyExchange(s, ctx.playerId));
    this.tileRegistry.register('quiz', (s, ctx) => this.applyQuiz(s, ctx.playerId));
    this.tileRegistry.register('move', (s, ctx) =>
      this.applyMoveDelta(s, ctx.playerId, ctx.tile.type === 'move' ? ctx.tile.delta ?? 0 : 0),
    );
    this.tileRegistry.register('skip', (s, ctx) =>
      this.applySkipTurnTile(s, ctx.playerId, ctx.tile.type === 'skip' ? ctx.tile.turns ?? 1 : 1),
    );
    this.tileRegistry.register('bonus_course', (s, ctx) => this.drawBonusCourse(s, ctx.playerId));
    this.tileRegistry.register('move_to_stand', (s, ctx) => this.applyMoveToNextStand(s, ctx.playerId));
  }

  private registerStandHandlers(): void {
    // Stands paramétrables : tous les stands routent vers l'effet générique drawCourse
    this.standEffects.registerStand('stand', (s, ctx) => this.drawSvc.drawCourse(s, ctx.playerId, ctx.standId));
    this.standIds().forEach((id) => {
      this.standEffects.registerStand(id, (s, ctx) => this.drawSvc.drawCourse(s, ctx.playerId, ctx.standId));
    });
  }

  private applyEvent(state: GameStateEntity, playerId: number): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    let drawn = this.drawFromPool(meta, 'events');
    let metadata = drawn.metadata;
    if (!drawn.card) {
      // Réinitialiser le deck d'événements si épuisé, puis retenter.
      const refilled = this.deckPool.set<string>(
        meta.decks as DeckPoolState<string>,
        'events',
        ['rupture-de-stock', 'stand-ferme', 'promo-surprise', 'orage-au-marche'],
      );
      drawn = this.drawFromPool({ ...meta, decks: refilled as PanierExpressDeckPool }, 'events');
      metadata = drawn.metadata;
      if (!drawn.card) {
        return state;
      }
    }
    const { card: event } = drawn;
    let next: GameStateEntity = { ...ensured, metadata };
    switch (event) {
      case 'stand-ferme':
        next = this.turnStatus.setStatus(next, playerId, 'skipTurn', 1);
        next = this.core.appendLog(next, `[Panier Express] Stand ferm? : ${this.utils.playerName(state, playerId)} saute un tour.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'skipTurn' });
        break;
      case 'promo-surprise':
        next = this.core.appendLog(next, `[Panier Express] Promo surprise : ${this.utils.playerName(state, playerId)} pioche 2 courses.`);
        next = this.drawSvc.drawCourse(next, playerId, 'bonus');
        next = this.drawSvc.drawCourse(next, playerId, 'bonus');
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'draw2' });
        break;
      case 'orage-au-marche':
        next = this.core.appendLog(next, `[Panier Express] Orage : ${this.utils.playerName(state, playerId)} recule de 2 cases.`);
        next = this.movePlayer(next, playerId, -2);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'move', delta: -2 });
        break;
      case 'rupture-de-stock':
      default:
        next = this.core.appendLog(next, `[Panier Express] Rupture de stock : aucun achat ce tour.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'none' });
        break;
    }
    return next;
  }

  private applyExchange(state: GameStateEntity, playerId: number): GameStateEntity {
    return this.exchangeSvc.applyExchange(state, playerId);
  }

  private handleExchangeWith(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const playerId = action.payload?.playerId;
    const targetPlayerId = action.payload?.targetPlayerId;
    const give = action.payload?.give;
    const take = action.payload?.take;
    if (typeof playerId !== 'number' || typeof targetPlayerId !== 'number') {
      return this.core.appendLog(state, `[Panier Express] Échange invalide: identifiants manquants.`);
    }
    if (typeof give !== 'string' || typeof take !== 'string') {
      return this.core.appendLog(state, `[Panier Express] Échange invalide: cartes manquantes.`);
    }
    const pending = state.pending ?? null;
    if (!pending || pending.type !== 'exchange' || pending.playerId !== playerId) {
      return this.core.appendLog(state, `[Panier Express] Échange invalide: aucun échange en attente.`);
    }
    const resolved = this.exchangeSvc.resolveExchange(state, playerId, targetPlayerId, give, take);
    return this.advanceTurn(resolved);
  }

  private handleSkipTurn(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const playerId = action.payload?.playerId ?? state.turn?.currentPlayerId ?? null;
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
    const logged = this.core.appendLog(next, `[Panier Express] ${this.utils.playerName(state, playerId)} passe son tour.`);
    return this.advanceTurn(logged);
  }

  private handleLegacyExchange(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const playerId = action.payload?.playerId ?? state.turn?.currentPlayerId ?? null;
    const targetPlayerId = action.payload?.targetId;
    const give = action.payload?.card;
    if (typeof playerId !== 'number' || typeof targetPlayerId !== 'number' || typeof give !== 'string') {
      return this.core.appendLog(state, `[Panier Express] Échange legacy invalide.`);
    }
    const players = state.players ?? [];
    const current = players.find((p) => p.id === playerId);
    const target = players.find((p) => p.id === targetPlayerId);
    if (!current || !target) {
      return this.core.appendLog(state, `[Panier Express] Échange legacy: joueur introuvable.`);
    }
    const currentInv = Array.isArray(current.inventory) ? [...current.inventory] : [];
    const targetInv = Array.isArray(target.inventory) ? [...target.inventory] : [];
    if (!currentInv.includes(give) || targetInv.length === 0) {
      return this.core.appendLog(state, `[Panier Express] Échange legacy refusé (cartes insuffisantes).`);
    }
    const take = targetInv[0];
    const updatedPlayers = players.map((p) => {
      if (p.id === current.id) {
        return { ...p, inventory: [take, ...currentInv.filter((c) => c !== give)] };
      }
      if (p.id === target.id) {
        return { ...p, inventory: [give, ...targetInv.slice(1)] };
      }
      return p;
    });
    const next: GameStateEntity = { ...state, players: updatedPlayers };
    const logged = this.core.appendLog(
      next,
      `[Panier Express] Échange legacy: ${current.username} donne ${give} et reçoit ${take} de ${target.username}`,
    );
    return this.appendActionLog(logged, playerId, 'apply_exchange', { targetPlayerId, give, take });
  }

  private applyQuiz(state: GameStateEntity, playerId: number): GameStateEntity {
    return this.quizSvc.applyQuiz(state, playerId);
  }

  // Résolution de quiz : PanierExpressQuizService ne fait que mettre une question en pending.
  // La validation de la réponse et la levée du pending restent ici via QuizRunner
  // pour garder la logique de tour et de scoring centralisée dans le service principal.
  private handleAnswerQuiz(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const playerId =
      typeof action.payload?.playerId === 'number'
        ? action.payload.playerId
        : state.turn?.currentPlayerId ?? null;
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
    let correct = Boolean(action.payload?.correct);
    let updatedQuiz = quizState;
    if (typeof action.payload?.answer === 'string') {
      const result = this.quizRunner.validateAnswer(quizState, playerId, action.payload.answer);
      correct = result.correct;
      updatedQuiz = result.state;
    } else {
      updatedQuiz = this.quizRunner.clearPending(quizState, playerId);
    }
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
    return this.advanceTurn(next);
  }

  private drawBonusCourse(state: GameStateEntity, playerId: number): GameStateEntity {
    return this.drawSvc.drawCourse(state, playerId, 'bonus');
  }

  private applyMoveDelta(state: GameStateEntity, playerId: number, delta: number): GameStateEntity {
    if (!delta || delta === 0) return state;
    const next = this.movePlayer(state, playerId, delta);
    return next;
  }

  private applyMoveToNextStand(state: GameStateEntity, playerId: number): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.getMetadata(ensured);
    const tiles = Array.isArray(meta.tiles) && meta.tiles.length ? meta.tiles : this.buildTiles();
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

  private applySkipTurnTile(state: GameStateEntity, playerId: number, turns: number): GameStateEntity {
    const count = Math.max(1, turns || 1);
    const next = this.turnStatus.setStatus(state, playerId, 'skipTurn', count);
    return this.core.appendLog(next, `[Panier Express] ${this.utils.playerName(state, playerId)} perd ${count} tour(s).`);
  }

  private applyVictory(state: GameStateEntity): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    const meta = this.getMetadata(state);
    const result = this.victory.evaluate(state, PANIER_EXPRESS_VICTORY);
    if (!result || !result.finished) return state;
    const winnerId = typeof result.winnerId === 'number' ? result.winnerId : meta.winnerId;
    const nextMeta: PanierExpressMetadata = { ...meta, winnerId: winnerId ?? null };
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      status: 'finished',
    };
    const winnerName = winnerId != null ? this.utils.playerName(state, winnerId) : 'Partie terminée';
    const logged = this.core.appendLog(nextState, `[Panier Express] ${winnerName} remporte la partie !`);
    return this.appendActionLog(logged, winnerId ?? null, 'victory', { conditionId: result.conditionId });
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
    const currentIndex = currentId != null ? players.findIndex((p) => p.id === currentId) : state.turnIndex;
    const next = this.turns.nextTurn(
      players as PlayerStateEntity[],
      currentIndex >= 0 ? currentIndex : state.turnIndex,
      meta.statuses.skipTurn,
    );
    playingLog('panier.advanceTurn', {
      currentId,
      currentIndex,
      nextTurnIndex: next.turnIndex,
      nextCurrentPlayerId: next.currentPlayerId,
      skipTurn: next.skipTurn,
    });
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      statuses: { ...meta.statuses, skipTurn: next.skipTurn },
    };
    return {
      ...state,
      metadata: nextMeta,
      turnIndex: next.turnIndex,
      turn: {
        currentPlayerId: next.currentPlayerId,
        direction: 1,
      },
    };
  }

  private drawFromPool<T = unknown>(meta: PanierExpressMetadata, key: string): {
    card: T | null;
    metadata: PanierExpressMetadata;
  } {
    const { card, pool } = this.deckPool.draw<unknown>(meta.decks as PanierExpressDeckPool, key);
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
    const actionLog = this.actionLogSvc.append(meta.actionLog, { actorId, type, payload });
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
    const answer = choices[Math.floor(Math.random() * choices.length)];
    return actions.map((a) => {
      if (!a || (a.type || '').toLowerCase() !== 'answer_quiz') return a;
      return { ...a, payload: { ...(a.payload ?? {}), answer } };
    });
  }

  private normalizePlayers(players: PlayerStateEntity[] | undefined): PanierExpressPlayerState[] {
    if (!Array.isArray(players)) return [];
    return players.map((p) => ({
      ...p,
      shoppingList: this.toStringArray(p.shoppingList),
      basket: Array.isArray(p.basket) ? p.basket.map((card) => String(card)) : [],
      inventory: Array.isArray(p.inventory) ? p.inventory.map((card) => String(card)) : [],
    }));
  }

  private getMetadata(state: GameStateEntity): PanierExpressMetadata {
    return (state.metadata ?? this.buildMetadata(state)) as PanierExpressMetadata;
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((v) => (v == null ? '' : String(v))).filter((v) => v.length > 0);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => (v == null ? '' : String(v))).filter((v) => v.length > 0);
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
    return deck.map((entry) => (Array.isArray(entry) ? entry.map((item) => String(item)) : this.toStringArray(entry)));
  }

  private buildShoppingList(): string[] {
    return this.deckPool.shuffle([...this.setup.courseItems()]).slice(0, 5);
  }

  private buildPlayerView(state: GameStateEntity, playerId: number): PanierExpressPlayerView | null {
    const player = (state.players ?? []).find((p) => p.id === playerId) ?? null;
    if (!player) return null;
    return {
      id: player.id,
      username: typeof player.username === 'string' ? player.username : null,
      isBot: player?.isBot === true,
      shoppingList: this.toStringArray(player.shoppingList),
      basket: Array.isArray(player.basket) ? player.basket.map((card) => String(card)) : [],
      inventory: Array.isArray(player.inventory) ? player.inventory.map((card) => String(card)) : [],
    };
  }
}
