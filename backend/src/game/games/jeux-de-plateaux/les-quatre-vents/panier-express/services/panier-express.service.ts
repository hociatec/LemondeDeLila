import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GameRulesAdapter } from '../../../../../engine/interfaces/game-rules-adapter.interface';
import { DeckManagerService } from '../../../../../modules/cards/services/deck-manager.service';
import { TurnService } from '../../../../../modules/turn/services/turn.service';
import { BoardMovementService } from '../../../../../modules/board/services/board-movement.service';
import { TileEffectRegistryService } from '../../../../../modules/effects/services/tile-effect-registry.service';
import { PendingRequirementService } from '../../../../../modules/effects/services/pending-requirement.service';
import { TurnActionsService } from '../../../../../modules/turn/services/turn-actions.service';
import { PanierExpressMetadata, PanierExpressTile } from '../entities/panier-express-state.entity';
import { playingLog } from '../../../../../../common/utils/playing-logger';

@Injectable()
export class PanierExpressService implements GameRulesAdapter {
  readonly gameType = 'panier-express';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = 'Panier Express';
  readonly description = 'Course au marché : compléter sa liste puis revenir pile sur la case départ.';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;

  constructor(
    private readonly core: GameCoreService,
    private readonly decks: DeckManagerService,
    private readonly turns: TurnService,
    private readonly movement: BoardMovementService,
    private readonly tileRegistry: TileEffectRegistryService<GameStateEntity, { playerId: number; tile: PanierExpressTile }>,
    private readonly pendingQuiz: PendingRequirementService<{ question: string; answer: string }>,
    private readonly turnActions: TurnActionsService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const metadata = this.buildMetadata(baseState);
    this.registerTileHandlers();
    const shoppingDeck = metadata.decks.shoppingLists;
    const shoppingDiscards = metadata.discards.shoppingLists;
    const players = (baseState.players ?? []).map((p, idx) => {
      const list = shoppingDeck[idx] ?? this.buildShoppingList();
      return {
        ...p,
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
    if (Array.isArray(actions)) {
      actions.forEach((action) => {
        if (!action?.type) return;
        switch (action.type) {
          case 'roll':
            next = this.handleRoll(next, action);
            break;
          case 'answer_quiz':
            next = this.handleAnswerQuiz(next, action);
            break;
          case 'exchange_with':
            next = this.handleExchangeWith(next, action);
            break;
          // Compat actions depuis le client Java
          case 'ROLL_DICE':
            next = this.handleRoll(next, { ...action, type: 'roll' });
            break;
          case 'apply_exchange':
            next = this.handleLegacyExchange(next, action);
            break;
          default:
            next = this.core.appendLog(next, `[Panier Express] Action non gérée: ${action.type}`);
        }
      });
    }
    return next;
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const meta = state.metadata as PanierExpressMetadata;
    const skip = meta?.statuses?.skipTurn?.[botPlayerId] ?? 0;
    if (skip > 0) {
      // Bot passe son tour : aucune action proposée.
      playingLog('panier.bot.skip', { botPlayerId, skip });
      return [];
    }

    // Si un quiz est en attente pour ce bot, il répond (par défaut "correct: true").
    const pendingQuiz = this.pendingQuiz.get(botPlayerId);
    if (pendingQuiz) {
      playingLog('panier.bot.quiz', { botPlayerId });
      return [
        {
          type: 'answer_quiz',
          payload: { playerId: botPlayerId, correct: true },
        },
      ];
    }

    const position = meta.positions[botPlayerId] ?? 0;
    const tile = meta.tiles[position];

    if (tile?.type === 'exchange') {
      const options = this.buildExchangeActions(state, botPlayerId);
      if (options.length > 0) {
        const pick = options[Math.floor(Math.random() * options.length)];
        playingLog('panier.bot.exchange', { botPlayerId, position, tile: tile.id, action: pick.type });
        return [pick];
      }
    }

    // Par défaut : lancer le dé.
    playingLog('panier.bot.roll', { botPlayerId, position, tile: tile?.id });
    return [{ type: 'roll' }];
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    const meta = state.metadata as PanierExpressMetadata;
    const pos = meta.positions[playerId] ?? 0;
    const tile = meta.tiles[pos];
    const hasPendingQuiz = Boolean(this.pendingQuiz.get(playerId));

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
    const players = state.players ?? [];
    const current = players.find((p) => p.id === playerId);
    if (!current || (current.inventory?.length ?? 0) === 0) return [{ type: 'roll' }];

    const actions: GameSingleActionDto[] = [];
    players.forEach((p) => {
      if (p.id === playerId) return;
      const targetInv = p.inventory ?? [];
      if (targetInv.length === 0) return;
      current.inventory?.forEach((give) => {
        targetInv.forEach((take) => {
          actions.push({
            type: 'exchange_with',
            payload: {
              playerId,
              targetPlayerId: p.id,
              give,
              take,
            },
          });
        });
      });
    });
    return actions.length > 0 ? actions : [{ type: 'roll' }];
  }

  private buildMetadata(baseState: GameStateEntity): PanierExpressMetadata {
    return {
      stands: ['fruitier', 'maraicher', 'bio', 'producteur-local', 'primeur', 'jus-et-conserves'],
      tiles: this.buildTiles(),
      decks: this.buildDecks(),
      discards: {
        courses: [],
        shoppingLists: [],
        events: [],
        exchanges: [],
        quizzes: [],
      },
      positions: {},
      winnerId: null,
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

  private buildDecks(): PanierExpressMetadata['decks'] {
    const courses = this.decks.shuffle([
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
    ]);

    const events = ['rupture-de-stock', 'stand-ferme', 'promo-surprise', 'orage-au-marche'];
    const exchanges = ['echange-fruit-legume', 'donne-une-carte', 'prend-au-hasard'];
    const quizzes = [
      { question: 'Quel fruit contient le plus de vitamine C ?', answer: 'kiwi' },
      { question: 'Quel légume est en réalité un fruit ?', answer: 'tomate' },
      { question: 'Quel fruit a ses graines à l’extérieur ?', answer: 'fraise' },
    ];

    return {
      courses,
      shoppingLists: this.buildShoppingListDeck(),
      events,
      exchanges,
      quizzes,
    };
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
    const metadata: PanierExpressMetadata =
      (state.metadata as PanierExpressMetadata | undefined) ?? this.buildMetadata(state);
    return { ...state, metadata };
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
    next = this.movePlayer(next, currentId, roll);
    next = this.resolveTile(next, currentId);
    next = this.checkVictory(next, currentId);
    next = this.advanceTurn(next);
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
      `${this.playerName(state, playerId)} avance de ${roll} ${plural} sur ${tile?.id ?? 'inconnu'}`,
    );
  }

  private resolveTile(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const position = meta.positions[playerId] ?? 0;
    const tile = meta.tiles[position];
    if (!tile) return state;
    return this.tileRegistry.apply(tile.type, state, { playerId, tile });
  }

  private registerTileHandlers(): void {
    this.tileRegistry.register('stand', (s, ctx) => this.drawCourse(s, ctx.playerId, (ctx.tile as any).standId));
    this.tileRegistry.register('event', (s, ctx) => this.applyEvent(s, ctx.playerId));
    this.tileRegistry.register('exchange', (s, ctx) => this.applyExchange(s, ctx.playerId));
    this.tileRegistry.register('quiz', (s, ctx) => this.applyQuiz(s, ctx.playerId));
  }

  private drawCourse(state: GameStateEntity, playerId: number, standId: string): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const draw = this.drawCard(meta, 'courses');
    if (!draw) {
      return this.core.appendLog(state, `[Panier Express] Plus de cartes Courses à piocher.`);
    }
    const { card, metadata } = draw;

    const players = (state.players ?? []).map((p) => {
      if (p.id !== playerId) return p;
      const shoppingList = Array.isArray(p.shoppingList) ? p.shoppingList : [];
      const basket = Array.isArray(p.basket) ? [...p.basket] : [];
      const inventory = Array.isArray(p.inventory) ? [...p.inventory] : [];
      if (shoppingList.includes(card) && !basket.includes(card)) {
        basket.push(card);
      } else {
        inventory.push(card);
      }
      return { ...p, basket, inventory };
    });

    const nextState: GameStateEntity = { ...state, players, metadata };
    return this.core.appendLog(
      nextState,
      `[Panier Express] ${this.playerName(state, playerId)} pioche "${card}" au stand ${standId}`,
    );
  }

  private applyEvent(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const drawn = this.drawCard(meta, 'events');
    if (!drawn) {
      return this.core.appendLog(state, `[Panier Express] Aucun événement disponible.`);
    }
    const { card: event, metadata } = drawn;
    let next: GameStateEntity = { ...state, metadata };
    switch (event) {
      case 'stand-ferme':
        next = this.setSkipTurn(next, playerId, 1);
        next = this.core.appendLog(next, `[Panier Express] Stand fermé : ${this.playerName(state, playerId)} saute un tour.`);
        break;
      case 'promo-surprise':
        next = this.core.appendLog(next, `[Panier Express] Promo surprise : ${this.playerName(state, playerId)} pioche 2 courses.`);
        next = this.drawCourse(next, playerId, 'bonus');
        next = this.drawCourse(next, playerId, 'bonus');
        break;
      case 'orage-au-marche':
        next = this.core.appendLog(next, `[Panier Express] Orage : ${this.playerName(state, playerId)} recule de 2 cases.`);
        next = this.movePlayer(next, playerId, -2);
        break;
      case 'rupture-de-stock':
      default:
        next = this.core.appendLog(next, `[Panier Express] Rupture de stock : aucun achat ce tour.`);
        break;
    }
    return next;
  }

  private applyExchange(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const drawn = this.drawCard(meta, 'exchanges');
    const metadata = drawn?.metadata ?? meta;
    const card = drawn?.card ?? 'exchange';
    let next: GameStateEntity = { ...state, metadata };

    const players = state.players ?? [];
    const current = players.find((p) => p.id === playerId);

    const targets = players.filter(
      (p) => p.id !== playerId && (p.inventory?.length ?? 0) > 0 && (current?.inventory?.length ?? 0) > 0,
    );
    if (!current || targets.length === 0 || (current.inventory?.length ?? 0) === 0) {
      return this.core.appendLog(next, `[Panier Express] Pas d’échange possible (${card}).`);
    }

    const target = targets[0];
    const currentItem = current.inventory[0];
    const targetItem = target.inventory[0];
    const updatedPlayers = players.map((p) => {
      if (p.id === current.id) {
        return {
          ...p,
          inventory: [targetItem, ...p.inventory.slice(1)],
        };
      }
      if (p.id === target.id) {
        return {
          ...p,
          inventory: [currentItem, ...p.inventory.slice(1)],
        };
      }
      return p;
    });

    next = { ...next, players: updatedPlayers };
    return this.core.appendLog(
      next,
      `[Panier Express] Échange (${card}) entre ${current.username} et ${target.username}: ${currentItem} ↔ ${targetItem}`,
    );
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
    return this.core.appendLog(
      next,
      `[Panier Express] Échange legacy: ${current.username} donne ${give} et reçoit ${take} de ${target.username}`,
    );
  }

  private applyQuiz(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const drawn = this.drawCard(meta, 'quizzes');
    if (!drawn) {
      return this.core.appendLog(state, `[Panier Express] Pas de question disponible.`);
    }
    const { card: quiz, metadata } = drawn;
    let next: GameStateEntity = { ...state, metadata };
    this.pendingQuiz.set({ playerId, type: 'quiz', payload: quiz });
    next = this.core.appendLog(
      next,
      `[Panier Express] Question pour ${this.playerName(state, playerId)}: "${quiz.question}"`,
    );
    return next;
  }

  private handleAnswerQuiz(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const playerId = action.payload?.playerId;
    if (typeof playerId !== 'number') return state;
    const pending = this.pendingQuiz.get(playerId)?.payload;
    if (!pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Pas de question en attente pour ${this.playerName(state, playerId)}.`,
      );
    }
    const correct = Boolean(action.payload?.correct);
    this.pendingQuiz.clear(playerId);
    let next = { ...state };
    next = this.core.appendLog(
      next,
      `[Panier Express] ${this.playerName(state, playerId)} répond au quiz (${correct ? 'réussite' : 'échec'})`,
    );
    if (correct) {
      next = this.drawBonusCourse(next, playerId);
    }
    return next;
  }

  private drawBonusCourse(state: GameStateEntity, playerId: number): GameStateEntity {
    return this.drawCourse(state, playerId, 'bonus');
  }

  private checkVictory(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const position = meta.positions[playerId] ?? 0;
    const tile = meta.tiles[position];
    const player = (state.players ?? []).find((p) => p.id === playerId);
    if (!player || !tile || tile.type !== 'start') return state;

    const shoppingList = Array.isArray(player.shoppingList) ? player.shoppingList : [];
    const basket = Array.isArray(player.basket) ? player.basket : [];
    const completed = shoppingList.every((item) => basket.includes(item));
    if (!completed) return state;

    const nextMeta: PanierExpressMetadata = { ...meta, winnerId: playerId };
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      status: 'finished',
    };
    return this.core.appendLog(nextState, `[Panier Express] ${player.username ?? playerId} remporte la partie !`);
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

  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private drawCard<T extends keyof PanierExpressMetadata['decks']>(
    meta: PanierExpressMetadata,
    deck: T,
  ): { card: PanierExpressMetadata['decks'][T][number]; metadata: PanierExpressMetadata } | null {
    const result = this.decks.draw(
      meta.decks[deck] as any[],
      meta.discards[deck] as any[],
    );
    if (!result) return null;
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      decks: { ...meta.decks, [deck]: result.deck } as PanierExpressMetadata['decks'],
      discards: { ...meta.discards, [deck]: result.discards } as PanierExpressMetadata['discards'],
    };
    return { card: result.card as any, metadata: nextMeta };
  }

  private setSkipTurn(state: GameStateEntity, playerId: number, turns: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: { ...meta.statuses.skipTurn, [playerId]: turns },
      },
    };
    return { ...state, metadata: nextMeta };
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const player = state.players?.find((p) => p.id === playerId);
    return player?.username ?? `Joueur ${playerId}`;
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
