import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GameStateWithActions } from '../../../../../engine/dto/game-action.dto';
import { GameRulesAdapter } from '../../../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../../../engine/services/game-registry.service';
import { DeckManagerService } from '../../../../../modules/cards/services/deck-manager.service';
import { DeckPoolService } from '../../../../../modules/cards/services/deck-pool.service';
import { TurnService } from '../../../../../modules/turn/services/turn.service';
import { BoardMovementService } from '../../../../../modules/board/services/board-movement.service';
import { TileEffectRegistryService } from '../../../../../modules/effects/services/tile-effect-registry.service';
import { TurnActionsService } from '../../../../../modules/turn/services/turn-actions.service';
import { StandEffectRegistryService } from '../../../../../modules/effects/services/stand-effect-registry.service';
import { ActionResolverService } from '../../../../../modules/action-resolver/services/action-resolver.service';
import { QuizRunnerService } from '../../../../../modules/quiz/services/quiz-runner.service';
import { GenericExchangeService } from '../../../../../modules/exchange/services/generic-exchange.service';
import { TurnStatusService } from '../../../../../modules/turn/services/turn-status.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import { BotRunnerService } from '../../../../../modules/bot/services/bot-runner.service';
import { ActionLogService } from '../../../../../modules/actionlog/services/action-log.service';
import { PanierExpressMetadata, PanierExpressTile } from '../entities/panier-express-state.entity';
import { PANIER_EXPRESS_PHASES } from '../definitions/rules.definition';
import { PANIER_EXPRESS_VICTORY } from '../definitions/victory.definition';
import { playingLog } from '../../../../../../common/utils/playing-logger';

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
    private readonly decks: DeckManagerService,
    private readonly deckPool: DeckPoolService,
    private readonly turns: TurnService,
    private readonly movement: BoardMovementService,
    private readonly tileRegistry: TileEffectRegistryService<GameStateEntity, { playerId: number; tile: PanierExpressTile }>,
    private readonly turnActions: TurnActionsService,
    private readonly standEffects: StandEffectRegistryService<GameStateEntity>,
    private readonly resolver: ActionResolverService,
    private readonly quizRunner: QuizRunnerService,
    private readonly exchangeHelper: GenericExchangeService,
    private readonly turnStatus: TurnStatusService,
    private readonly victory: VictoryService,
    private readonly botRunner: BotRunnerService,
    private readonly actionLogSvc: ActionLogService,
    private readonly registry: GameRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.registerTileHandlers();
    this.registerStandHandlers();
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const currentId = state.turn?.currentPlayerId ?? null;
    const actions = typeof currentId === 'number' ? this.getAvailableActions(state, currentId) : [];
    const meta = state.metadata as PanierExpressMetadata;
    const pendingQuiz = typeof currentId === 'number' ? meta.quiz?.pending?.[currentId] : null;
    const quizChoices =
      pendingQuiz && Array.isArray(pendingQuiz.choices) && pendingQuiz.choices.length
        ? pendingQuiz.choices
        : pendingQuiz?.answer
        ? [pendingQuiz.answer]
        : [];
    const pending =
      (state.pending as any) ??
      (pendingQuiz && pendingQuiz.question
        ? {
            type: 'quiz',
            question: pendingQuiz.question,
            choices: quizChoices,
            playerId: currentId,
            blocking: true,
          }
        : null);
    return {
      ...(state as any),
      catalog: {
        phases: PANIER_EXPRESS_PHASES.map((p) => p.id),
        victory: PANIER_EXPRESS_VICTORY,
      },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending,
    };
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const metadata = this.buildMetadata(baseState);
    const shoppingDeck = metadata.decks.shoppingLists?.deck ?? [];
    const players = (baseState.players ?? []).map((p, idx) => {
      const username = (p.username ?? '').toLowerCase();
      const isBot = (p as any).isBot === true || username.includes('bot');
      const list = shoppingDeck[idx] ?? this.buildShoppingList();
      return {
        ...p,
        isBot,
        basket: [],
        inventory: [],
        shoppingList: list,
      };
    });
    const positions: Record<number, number> = {};
    players.forEach((p) => {
      positions[p.id] = 0;
    });
    return {
      ...baseState,
      players,
      status: baseState.status ?? 'open',
      metadata: {
        ...baseState.metadata,
        category: this.category,
        subcategory: this.subcategory,
        ...metadata,
      },
    };
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
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
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const meta = state.metadata as PanierExpressMetadata;
    const profile = meta.botProfile ?? 'greedy';
    const skip = this.turnStatus.getStatus(state, botPlayerId, 'skipTurn');
    if (skip > 0) {
      // Bot passe son tour : aucune action proposée.
      playingLog('panier.bot.skip', { botPlayerId, skip });
      return [];
    }

    const available = this.injectQuizAnswer(this.getAvailableActions(state, botPlayerId), meta, botPlayerId);
    const rawPlayer = (state.players ?? []).find((p) => p.id === botPlayerId) as any;
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
    const meta = state.metadata as PanierExpressMetadata;
    const pos = meta.positions[playerId] ?? 0;
    const tile = meta.tiles[pos];
    const hasPendingQuiz = Boolean(meta.quiz?.pending?.[playerId]);

    const base: GameSingleActionDto[] = (() => {
      switch (tile?.type) {
        case 'quiz':
          if (hasPendingQuiz) {
            return [
              { type: 'answer_quiz', payload: { playerId, correct: true } },
              { type: 'answer_quiz', payload: { playerId, correct: false } },
            ];
          }
          return [
            { type: 'answer_quiz', payload: { playerId, correct: true } },
            { type: 'answer_quiz', payload: { playerId, correct: false } },
          ];
        case 'exchange':
          return this.buildExchangeActions(state, playerId);
        default:
          return [{ type: 'roll' }];
      }
    })();

    return this.turnActions.buildAvailableActions({
      state,
      playerId,
      pending: hasPendingQuiz ? { playerId, type: 'quiz' } : null,
      base,
    });
  }

  private buildExchangeActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    const actions = this.exchangeHelper.buildActions(state as any, playerId, 'inventory');
    if (!actions.length) return [{ type: 'roll' }];
    return actions.flatMap((offer) =>
      (state.players ?? [])
        .filter((p) => p.id !== playerId)
        .map((target) => ({
          type: 'exchange_with',
          payload: { playerId, targetPlayerId: target.id, give: offer.give, take: offer.take },
        })),
    );
  }

  private buildMetadata(baseState: GameStateEntity): PanierExpressMetadata {
    return {
      stands: ['fruitier', 'maraicher', 'bio', 'producteur-local', 'primeur', 'jus-et-conserves'],
      tiles: this.buildTiles(),
      decks: this.buildDeckPool(),
      positions: {},
      winnerId: null,
      quiz: { pending: {} },
      botProfile: 'greedy',
      statuses: {
        skipTurn: {},
      },
    };
  }

  private buildTiles(): PanierExpressTile[] {
    return [
      { id: 'start', type: 'start' },
      { id: 'stand-fruitier', type: 'stand', standId: 'fruitier' },
      { id: 'event-1', type: 'event' },
      { id: 'stand-maraicher', type: 'stand', standId: 'maraicher' },
      { id: 'quiz-1', type: 'quiz' },
      { id: 'stand-bio', type: 'stand', standId: 'bio' },
      { id: 'exchange-1', type: 'exchange' },
      { id: 'stand-producteur-local', type: 'stand', standId: 'producteur-local' },
      { id: 'event-2', type: 'event' },
      { id: 'stand-primeur', type: 'stand', standId: 'primeur' },
      { id: 'quiz-2', type: 'quiz' },
      { id: 'stand-jus', type: 'stand', standId: 'jus-et-conserves' },
      { id: 'exchange-2', type: 'exchange' },
      { id: 'event-3', type: 'event' },
    ];
  }

  private buildDeckPool(): PanierExpressMetadata['decks'] {
    let pool = this.deckPool.set<any>({}, 'courses', this.deckPool.shuffle([
      'pomme',
      'poire',
      'carotte',
      'courgette',
      'fraise',
      'avocat',
      'banane',
      'tomate',
      'kiwi',
      'melon',
      'citron',
      'ananas',
      'peche',
      'mangue',
      'raisin',
    ]));
    pool = this.deckPool.set<any>(pool, 'events', ['rupture-de-stock', 'stand-ferme', 'promo-surprise', 'orage-au-marche']);
    pool = this.deckPool.set<any>(pool, 'exchanges', ['echange-fruit-legume', 'donne-une-carte', 'prend-au-hasard']);
    pool = this.deckPool.set<any>(pool, 'quizzes', [
      { question: 'Quel fruit contient le plus de vitamine C ?', answer: 'kiwi' },
      { question: 'Quel légume est en réalité un fruit ?', answer: 'tomate' },
      { question: 'Quel fruit a ses graines à l’extérieur ?', answer: 'fraise' },
    ]);
    pool = this.deckPool.set<any>(pool, 'shoppingLists', this.buildShoppingListDeck().flat());
    return pool as PanierExpressMetadata['decks'];
  }

  private buildShoppingList(): string[] {
    const pool = [
      'pomme',
      'poire',
      'carotte',
      'courgette',
      'fraise',
      'avocat',
      'banane',
      'tomate',
      'kiwi',
      'melon',
      'citron',
      'ananas',
      'peche',
      'mangue',
      'raisin',
    ];
    return this.decks.shuffle([...pool]).slice(0, 5);
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    const base: PanierExpressMetadata = this.buildMetadata(state);
    const metadata: PanierExpressMetadata = {
      ...base,
      ...(state.metadata as PanierExpressMetadata | undefined),
      quiz: { pending: {}, ...(state.metadata as PanierExpressMetadata | undefined)?.quiz },
      statuses: {
        skipTurn: { ...base.statuses.skipTurn, ...(state.metadata as PanierExpressMetadata | undefined)?.statuses?.skipTurn },
      },
      positions: { ...base.positions, ...(state.metadata as PanierExpressMetadata | undefined)?.positions },
    };
    return { ...state, metadata, players: this.normalizePlayers(state.players) };
  }

  private ensureStarted(state: GameStateEntity): GameStateEntity {
    const status = (state.status || '').toLowerCase();
    if (status === 'started') return state;
    if (status !== 'starting') return state; // ne démarre que quand la table l’a explicitement demandé
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
    next = this.core.appendLog(next, `${this.playerName(state, currentId)} lance le dé : "${roll}"`);
    next = this.appendActionLog(next, currentId, 'roll', { roll });
    next = this.movePlayer(next, currentId, roll);
    next = this.resolveTile(next, currentId);
    const metaAfter = next.metadata as PanierExpressMetadata;
    const postActions = this.getAvailableActions(next, currentId);
    const hasBlockingQuiz = Boolean(metaAfter.quiz?.pending?.[currentId]);
    const hasBlockingExchange = postActions.some((a) => (a.type || '').toLowerCase() === 'exchange_with');
    if (!hasBlockingQuiz && !hasBlockingExchange) {
      next = this.applyVictory(next);
      next = this.advanceTurn(next);
    }
    return next;
  }

  private movePlayer(state: GameStateEntity, playerId: number, roll: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const currentPos = meta.positions[playerId] ?? 0;
    const nextPos = this.movement.moveCircular(meta.tiles.length, currentPos, roll);
    const tile = this.movement.tileAt(meta.tiles, nextPos);
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      positions: { ...meta.positions, [playerId]: nextPos },
    };
    const nextState: GameStateEntity = { ...state, metadata: nextMeta };
    const plural = Math.abs(roll) > 1 ? 'cases' : 'case';
    return this.core.appendLog(
      nextState,
      `${this.playerName(state, playerId)} avance de ${roll} ${plural} sur ${this.tileLabel(tile)}`,
    );
  }

  private tileLabel(tile: PanierExpressTile | undefined): string {
    if (!tile) return 'inconnu';
    switch (tile.type) {
      case 'start':
        return 'depart';
      case 'stand':
        return `stand ${tile.standId ?? tile.id ?? 'inconnu'}`;
      case 'event':
        return 'evenement';
      case 'exchange':
        return 'echange';
      case 'quiz':
        return 'quiz';
    }
    return (tile as any)?.id ?? 'inconnu';
  }

  private resolveTile(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const position = meta.positions[playerId] ?? 0;
    const tile = meta.tiles[position];
    if (!tile) return state;
    return this.tileRegistry.apply(tile.type, state, { playerId, tile });
  }

  private registerTileHandlers(): void {
    this.tileRegistry.register('stand', (s, ctx) =>
      this.standEffects.applyStand('stand', s, { playerId: ctx.playerId, standId: (ctx.tile as any).standId, state: s }),
    );
    this.tileRegistry.register('event', (s, ctx) => this.applyEvent(s, ctx.playerId));
    this.tileRegistry.register('exchange', (s, ctx) => this.applyExchange(s, ctx.playerId));
    this.tileRegistry.register('quiz', (s, ctx) => this.applyQuiz(s, ctx.playerId));
  }

  private registerStandHandlers(): void {
    // Stands paramétrables : tous les stands routent vers l’effet générique drawCourse
    this.standEffects.registerStand('stand', (s, ctx) => this.drawCourse(s, ctx.playerId, ctx.standId));
    this.buildMetadata({} as any).stands.forEach((id) => {
      this.standEffects.registerStand(id, (s, ctx) => this.drawCourse(s, ctx.playerId, ctx.standId));
    });
  }

  private drawCourse(state: GameStateEntity, playerId: number, standId: string): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const draw = this.drawFromPool(meta, 'courses');
    if (!draw.card) {
      return this.core.appendLog(state, `[Panier Express] Plus de cartes Courses à piocher.`);
    }
    const { card, metadata } = draw;

    const players = (state.players ?? []).map((p) => {
      if (p.id !== playerId) return p;
      const shoppingList = this.toStringArray((p as any).shoppingList);
      const basket = Array.isArray((p as any).basket) ? [...(p as any).basket] : [];
      const inventory = Array.isArray((p as any).inventory) ? [...(p as any).inventory] : [];
      if (shoppingList.includes(card) && !basket.includes(card)) {
        basket.push(card);
      } else {
        inventory.push(card);
      }
      return { ...p, basket, inventory };
    });

    const nextState: GameStateEntity = { ...state, players, metadata };
    const playerPos = (meta.positions ?? {})[playerId] ?? 0;
    const tile = meta.tiles[playerPos];
    const standLabel = standId || (tile?.type === 'stand' ? (tile as any).standId : tile?.id ?? 'inconnu');
    const logged = this.core.appendLog(
      nextState,
      `[Panier Express] ${this.playerName(state, playerId)} pioche "${card}" au stand ${standLabel}`,
    );
    return this.appendActionLog(logged, playerId, 'draw_course', { standId: standLabel, card });
  }

  private applyEvent(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const drawn = this.drawFromPool(meta, 'events');
    if (!drawn.card) {
      return this.core.appendLog(state, `[Panier Express] Aucun événement disponible.`);
    }
    const { card: event, metadata } = drawn;
    let next: GameStateEntity = { ...state, metadata };
    switch (event) {
      case 'stand-ferme':
        next = this.turnStatus.setStatus(next, playerId, 'skipTurn', 1);
        next = this.core.appendLog(next, `[Panier Express] Stand fermé : ${this.playerName(state, playerId)} saute un tour.`);
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'skipTurn' });
        break;
      case 'promo-surprise':
        next = this.core.appendLog(next, `[Panier Express] Promo surprise : ${this.playerName(state, playerId)} pioche 2 courses.`);
        next = this.drawCourse(next, playerId, 'bonus');
        next = this.drawCourse(next, playerId, 'bonus');
        next = this.appendActionLog(next, playerId, 'event', { event, effect: 'draw2' });
        break;
      case 'orage-au-marche':
        next = this.core.appendLog(next, `[Panier Express] Orage : ${this.playerName(state, playerId)} recule de 2 cases.`);
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
    const meta = state.metadata as PanierExpressMetadata;
    const drawn = this.drawFromPool(meta, 'exchanges');
    const metadata = drawn.metadata as PanierExpressMetadata;
    const card = drawn.card ?? 'exchange';
    let next: GameStateEntity = { ...state, metadata };

    const players = state.players ?? [];
    const current = players.find((p) => p.id === playerId);
    if (!current || (current.inventory?.length ?? 0) === 0) {
      return this.core.appendLog(next, `[Panier Express] Pas d’échange possible (${card}).`);
    }

    const offers = this.exchangeHelper.buildActions<string>({ players }, playerId, 'inventory');
    if (!offers.length) {
      return this.core.appendLog(next, `[Panier Express] Pas d’échange compatible (${card}).`);
    }

    // Choix automatique du premier échange valide (peut être enrichi par type de carte)
    const chosen = offers.find((offer) =>
      players.some((p) => p.id !== playerId && (p.inventory ?? []).includes(offer.take)),
    );
    if (!chosen) {
      return this.core.appendLog(next, `[Panier Express] Aucun échange applicable (${card}).`);
    }

    const target = players.find(
      (p) => p.id !== playerId && (p.inventory ?? []).includes(chosen.take) && (p.inventory?.length ?? 0) > 0,
    );
    if (!target) {
      return this.core.appendLog(next, `[Panier Express] Cible introuvable pour l’échange (${card}).`);
    }

    const updatedPlayers = players.map((p) => {
      if (p.id === current.id) {
        return {
          ...p,
          inventory: [chosen.take, ...(p.inventory ?? []).filter((c) => c !== chosen.give)],
        };
      }
      if (p.id === target.id) {
        return {
          ...p,
          inventory: [chosen.give, ...(p.inventory ?? []).filter((c) => c !== chosen.take)],
        };
      }
      return p;
    });

    next = { ...next, players: updatedPlayers };
    const logged = this.core.appendLog(
      next,
      `[Panier Express] Échange (${card}) entre ${current.username} et ${target.username}: ${chosen.give} ↔ ${chosen.take}`,
    );
    return this.appendActionLog(logged, playerId, 'auto_exchange', { targetPlayerId: target.id, give: chosen.give, take: chosen.take, card });
  }

  private handleExchangeWith(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const playerId = action.payload?.playerId;
    const targetPlayerId = action.payload?.targetPlayerId;
    const give = action.payload?.give;
    const take = action.payload?.take;
    if (typeof playerId !== 'number' || typeof targetPlayerId !== 'number') {
      return this.core.appendLog(state, `[Panier Express] Échange invalide: identifiants manquants.`);
    }
    const players = state.players ?? [];
    const current = players.find((p) => p.id === playerId);
    const target = players.find((p) => p.id === targetPlayerId);
    if (!current || !target) {
      return this.core.appendLog(state, `[Panier Express] Échange invalide: joueur introuvable.`);
    }
    const currentInv = new Set(current.inventory ?? []);
    const targetInv = new Set(target.inventory ?? []);
    if (!currentInv.has(give as any) || !targetInv.has(take as any)) {
      return this.core.appendLog(state, `[Panier Express] Échange refusé: carte absente.`);
    }

    const updatedPlayers = players.map((p) => {
      if (p.id === current.id) {
        return {
          ...p,
          inventory: [take, ...(p.inventory ?? []).filter((c) => c !== give)],
        };
      }
      if (p.id === target.id) {
        return {
          ...p,
          inventory: [give, ...(p.inventory ?? []).filter((c) => c !== take)],
        };
      }
      return p;
    });

    const next: GameStateEntity = { ...state, players: updatedPlayers };
    return this.core.appendLog(
      next,
      `[Panier Express] Échange validé: ${current.username} donne ${give} et reçoit ${take} de ${target.username}`,
    );
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
    const meta = state.metadata as PanierExpressMetadata;
    const drawn = this.drawFromPool(meta, 'quizzes');
    if (!drawn.card) {
      return this.core.appendLog(state, `[Panier Express] Pas de question disponible.`);
    }
    const { card: quiz, metadata } = drawn;
    const choices = Array.isArray((quiz as any).choices) && (quiz as any).choices.length
      ? (quiz as any).choices
      : [(quiz as any).answer ?? ''];
    const quizState = this.quizRunner.setPending(metadata.quiz ?? { pending: {} }, playerId, {
      id: `quiz-${Date.now()}`,
      ...quiz,
      choices,
    });
    const nextMeta: PanierExpressMetadata = { ...metadata, quiz: quizState };
    const next: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      pending: {
        type: 'quiz',
        playerId,
        blocking: true,
        data: { question: quiz.question, choices },
      },
    };
    return this.core.appendLog(
      next,
      `[Panier Express] Question pour ${this.playerName(state, playerId)}: "${quiz.question}"`,
    );
  }

  private handleAnswerQuiz(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const playerId = action.payload?.playerId;
    if (typeof playerId !== 'number') return state;
    const meta = state.metadata as PanierExpressMetadata;
    const quizState = meta.quiz ?? { pending: {} };
    const pending = quizState.pending?.[playerId];
    if (!pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Pas de question en attente pour ${this.playerName(state, playerId)}.`,
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
      `[Panier Express] ${this.playerName(state, playerId)} répond au quiz (${correct ? 'réussite' : 'échec'})`,
    );
    next = this.appendActionLog(next, playerId, 'answer_quiz', { correct });
    if (correct) {
      next = this.drawBonusCourse(next, playerId);
    }
    next = this.applyVictory(next);
    return this.advanceTurn(next);
  }

  private drawBonusCourse(state: GameStateEntity, playerId: number): GameStateEntity {
    return this.drawCourse(state, playerId, 'bonus');
  }

  private applyVictory(state: GameStateEntity): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    const meta = state.metadata as PanierExpressMetadata;
    const result = this.victory.evaluate(state, PANIER_EXPRESS_VICTORY);
    if (!result || !result.finished) return state;
    const winnerId = typeof result.winnerId === 'number' ? result.winnerId : meta.winnerId;
    const nextMeta: PanierExpressMetadata = { ...meta, winnerId: winnerId ?? null };
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      status: 'finished',
    };
    const winnerName = winnerId != null ? this.playerName(state, winnerId) : 'Partie terminée';
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
    const meta = state.metadata as PanierExpressMetadata;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex = currentId != null ? players.findIndex((p) => p.id === currentId) : state.turnIndex;
    const next = this.turns.nextTurn(players as any, currentIndex >= 0 ? currentIndex : state.turnIndex, meta.statuses.skipTurn);
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

  private drawFromPool<T = any>(
    meta: PanierExpressMetadata,
    key: string,
  ): { card: T | null; metadata: PanierExpressMetadata } {
    const { card, pool } = this.deckPool.draw<T>(meta.decks as any, key);
    return {
      card: card as T | null,
      metadata: { ...meta, decks: pool as any },
    };
  }

  private appendActionLog(state: GameStateEntity, actorId: number | null, type: string, payload?: any): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const actionLog = this.actionLogSvc.append(meta.actionLog, { actorId, type, payload });
    return { ...state, metadata: { ...meta, actionLog } };
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const player = state.players?.find((p) => p.id === playerId);
    return player?.username ?? `Joueur ${playerId}`;
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

  private normalizePlayers(players: any[] | undefined): any[] {
    if (!Array.isArray(players)) return [];
    return players.map((p) => ({
      ...p,
      shoppingList: this.toStringArray((p as any).shoppingList),
      basket: Array.isArray((p as any).basket) ? (p as any).basket : [],
      inventory: Array.isArray((p as any).inventory) ? (p as any).inventory : [],
    }));
  }

  private toStringArray(value: any): string[] {
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

  private buildShoppingListDeck(): string[][] {
    const pool = [
      'pomme',
      'poire',
      'carotte',
      'courgette',
      'fraise',
      'avocat',
      'banane',
      'tomate',
      'kiwi',
      'melon',
      'citron',
      'ananas',
      'peche',
      'mangue',
      'raisin',
    ];
    // Créer plusieurs listes de 5 items
    const lists: string[][] = [];
    for (let i = 0; i < 10; i += 1) {
      lists.push(this.decks.shuffle([...pool]).slice(0, 5));
    }
    return this.decks.shuffle(lists);
  }
}
