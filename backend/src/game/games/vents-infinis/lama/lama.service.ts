import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { RandomService } from '../../../modules/random/services/random.service';
import type { LamaCardValue, LamaMetadata } from './model/lama.model';
import { lamaCardLabel, lamaCardScore, nextLamaValue, LAMA_VALUE } from './model/lama.model';
import { LamaPresenter } from './lama.presenter';
import type { GameShortcutHint, GameShortcutsContext } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

@Injectable()
export class LamaService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'lama';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'LAMA';
  readonly description = 'Défaussez vos cartes ou sortez du round pour minimiser vos points.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly random: RandomService,
    private readonly presenter: LamaPresenter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const ownerPlayerId = players[0]?.id ?? null;
    const scoresByPlayerId: Record<string, number> = {};
    for (const p of players) {
      if (!p?.id) continue;
      scoresByPlayerId[String(p.id)] = 0;
    }

    const meta: LamaMetadata = {
      rng: typeof baseState.metadata === 'object' && baseState.metadata ? (baseState.metadata as any).rng : undefined,
      ownerPlayerId,
      loseAtScore: null,
      roundNumber: 1,
      roundStarterIndex: 0,
      deck: [],
      discard: [],
      handsByPlayerId: {},
      scoresByPlayerId,
      step: 'setup_target',
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
    };

    return {
      ...baseState,
      status: 'setup',
      phase: 'setup',
      round: 0,
      turnIndex: 0,
      lastRoll: null,
      pending: null,
      log: Array.isArray(baseState.log) ? baseState.log : [],
      metadata: meta as any,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: ownerPlayerId,
        direction: 1,
        label: ownerPlayerId
          ? `Réglages LAMA : ${players.find((p) => p?.id === ownerPlayerId)?.username ?? `#${ownerPlayerId}`}`
          : 'Réglages LAMA',
      },
    };
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return next;
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    if (String(state.status ?? '').toLowerCase() !== 'started') return [];

    const meta = (state.metadata ?? {}) as LamaMetadata;
    if (meta.winnerId) return [];

    const step = meta.step ?? 'turn_choice';
    if (step === 'return_token') {
      if (meta.pendingReturnPlayerId !== botPlayerId) return [];
      const score = Number((meta.scoresByPlayerId ?? {})[String(botPlayerId)] ?? 0);
      if (score >= 10) return [{ type: 'lama_return', payload: { value: 10 } }];
      if (score >= 1) return [{ type: 'lama_return', payload: { value: 1 } }];
      return [{ type: 'lama_return', payload: { value: 0 } }];
    }

    const hand = (meta.handsByPlayerId ?? {})[String(botPlayerId)] ?? [];
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
    if (!top) return [];

    const canPlayValues = new Set<LamaCardValue>([top, nextLamaValue(top)]);

    const counts = new Map<LamaCardValue, number>();
    for (const v of hand as LamaCardValue[]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    // Heuristique simple :
    // - si on peut jouer, jouer une carte jouable (priorité à la valeur avec le plus de duplicats)
    // - sinon piocher si possible
    let best: { value: LamaCardValue; count: number } | null = null;
    for (const [value, count] of counts.entries()) {
      if (!canPlayValues.has(value)) continue;
      if (!best || count > best.count) {
        best = { value, count };
      }
    }

    if (best) {
      return [{ type: 'lama_play', payload: { value: best.value, count: 1 } }];
    }

    if ((meta.deck ?? []).length > 0) {
      return [{ type: 'draw', payload: {} }];
    }

    return [];
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    if (!ctx?.started) return [];

    return [
      actionShortcut('C', 'lama_peek_discard'),
      actionShortcut('E', 'lama_peek_deck'),
    ];
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const type = String(action?.type ?? '').trim();
    if (!type) return state;

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : state.turn?.currentPlayerId ?? null;
    if (!actorId) return state;

    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    if (meta.winnerId) return state;

    const players = Array.isArray(state.players) ? state.players : [];

    const status = String(state.status ?? '').toLowerCase();

    // Info actions: allowed for anyone, do not consume a turn.
    if (type === 'lama_peek_discard' || type === 'lama_peek_deck') {
      const discard = Array.isArray(meta.discard) ? meta.discard : [];
      const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
      const deckCount = (meta.deck ?? []).length;
      const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
      const log = Array.isArray(state.log) ? [...state.log] : [];
      if (type === 'lama_peek_discard') {
        log.push({ message: `${name} regarde la défausse : ${top ? lamaCardLabel(top) : '(vide)'}.` });
      } else {
        log.push({ message: `${name} regarde la pioche : ${deckCount} carte${deckCount > 1 ? 's' : ''}.` });
      }
      return { ...state, log };
    }

    // Setup: owner chooses the losing score threshold, then the game starts.
    if (status === 'setup' || (meta.step ?? '') === 'setup_target') {
      if (type !== 'lama_set_target') return state;
      if (meta.ownerPlayerId == null || actorId !== meta.ownerPlayerId) return state;
      const raw = Number((action.payload as any)?.loseAtScore);
      const loseAtScore = Number.isFinite(raw) ? Math.floor(raw) : NaN;
      if (!Number.isFinite(loseAtScore) || loseAtScore < 5 || loseAtScore > 200) return state;

      const updatedMeta: LamaMetadata = {
        ...meta,
        loseAtScore,
        step: 'turn_choice',
        roundNumber: 1,
        roundStarterIndex: 0,
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
      };

      const log = Array.isArray(state.log) ? [...state.log] : [];
      const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
      log.push({ message: `${name} fixe la défaite à ${loseAtScore} points. Début de la partie.` });

      return this.startNewRound(
        {
          ...state,
          status: 'started',
          phase: 'round',
          round: 1,
          turnIndex: state.turnIndex ?? 0,
          lastRoll: null,
          pending: null,
          log,
          metadata: updatedMeta as any,
        },
        updatedMeta.roundStarterIndex,
      );
    }

    if (status !== 'started') {
      return state;
    }

    // Enforce turn order: only the current player can act (for turn-consuming actions).
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (currentPlayerId == null || actorId !== currentPlayerId) {
      return state;
    }

    // Pending: return token decision.
    if ((meta.step ?? 'turn_choice') === 'return_token') {
      if (meta.pendingReturnPlayerId !== actorId) {
        return state;
      }
      if (String(action.type ?? '') !== 'lama_return') {
        return state;
      }
      const value = Number((action.payload as any)?.value ?? 0);
      const currentScore = Number((meta.scoresByPlayerId ?? {})[String(actorId)] ?? 0);
      const delta = value === 10 ? 10 : value === 1 ? 1 : 0;
      const nextScore = Math.max(0, currentScore - delta);
      const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };
      scoresByPlayerId[String(actorId)] = nextScore;

      const log = Array.isArray(state.log) ? [...state.log] : [];
      const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
      if (delta > 0) {
        log.push({ message: `${name} retire ${delta} point${delta > 1 ? 's' : ''}.` });
      }

      const queue = Array.isArray(meta.pendingReturnQueue) ? [...meta.pendingReturnQueue] : [];
      const remaining = queue.filter((id) => id !== actorId);
      const nextPending = remaining.length ? remaining[0] : null;
      const nextMeta: LamaMetadata = {
        ...meta,
        scoresByPlayerId,
        pendingReturnQueue: remaining,
        pendingReturnPlayerId: nextPending,
        step: nextPending ? 'return_token' : 'turn_choice',
      };

      let nextState: GameStateEntity = {
        ...state,
        metadata: nextMeta as any,
        log,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: nextPending ?? state.turn?.currentPlayerId ?? null,
          direction: 1,
          label: nextPending
            ? `Retrait de points : ${players.find((p) => p?.id === nextPending)?.username ?? `#${nextPending}`}`
            : undefined,
        },
      };

      if (nextPending) {
        return nextState;
      }

      // End-of-round: check game over / start next round.
      return this.finishRoundAndMaybeStartNext(nextState);
    }

    if (type === 'draw') {
      return this.applyDraw(state, meta, actorId);
    }

    if (type === 'lama_play') {
      return this.applyPlay(state, meta, actorId, action);
    }

    return state;
  }

  private applyDraw(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    const deck = Array.isArray(meta.deck) ? [...meta.deck] : [];
    if (deck.length <= 0) return state;
    const card = deck.pop() as LamaCardValue;
    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...((handsByPlayerId[String(actorId)] as LamaCardValue[]) ?? [])];
    hand.push(card);
    handsByPlayerId[String(actorId)] = hand;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} pioche.` });

    const nextMeta: LamaMetadata = { ...meta, deck, handsByPlayerId };
    const nextPlayerId = this.findNextActivePlayerId(players, nextMeta, actorId);
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta as any,
      log,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };

    // If the deck is empty and nobody can play anymore, end the round.
    if (this.isRoundEnded(nextMeta, players)) {
      const winnerId = this.findEmptyHandWinnerId(nextMeta, players);
      return this.endRound(nextState, winnerId);
    }

    return nextState;
  }

  private applyPlay(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const rawValue = Number((action.payload as any)?.value);
    const value = (rawValue >= 1 && rawValue <= 7 ? rawValue : 0) as LamaCardValue;
    const count = 1;

    const discard = Array.isArray(meta.discard) ? [...meta.discard] : [];
    const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
    if (!top) return state;

    const allowed = new Set<LamaCardValue>([top, nextLamaValue(top)]);
    if (!allowed.has(value)) return state;

    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...((handsByPlayerId[String(actorId)] as LamaCardValue[]) ?? [])];
    const availableCount = hand.filter((v) => v === value).length;
    if (availableCount < count) return state;

    // Remove `count` cards of that value.
    let removed = 0;
    const nextHand: LamaCardValue[] = [];
    for (const v of hand) {
      if (v === value && removed < count) {
        removed += 1;
        continue;
      }
      nextHand.push(v);
    }
    handsByPlayerId[String(actorId)] = nextHand;

    for (let i = 0; i < count; i += 1) {
      discard.push(value);
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} joue ${lamaCardLabel(value)}.` });

    const nextMeta: LamaMetadata = { ...meta, handsByPlayerId, discard };

    // End round if player emptied hand.
    if (nextHand.length === 0) {
      const endedState: GameStateEntity = {
        ...state,
        metadata: nextMeta as any,
        log,
        turnIndex: (state.turnIndex ?? 0) + 1,
      };
      return this.endRound(endedState, actorId);
    }

    const nextPlayerId = this.findNextActivePlayerId(players, nextMeta, actorId);
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta as any,
      log,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };

    // If the deck is empty and nobody can play anymore, end the round.
    if (this.isRoundEnded(nextMeta, players)) {
      const winnerId = this.findEmptyHandWinnerId(nextMeta, players);
      return this.endRound(nextState, winnerId);
    }

    return nextState;
  }

  private endRound(state: GameStateEntity, winnerPlayerId: number | null): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const handsByPlayerId = meta.handsByPlayerId ?? {};
    const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };

    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `Fin du round ${meta.roundNumber}.` });

    for (const p of players) {
      if (!p?.id) continue;
      const pid = p.id;
      const hand = (handsByPlayerId[String(pid)] ?? []) as LamaCardValue[];
      const unique = [...new Set(hand)];
      const gained = unique.reduce((sum, v) => sum + lamaCardScore(v), 0);
      scoresByPlayerId[String(pid)] = Number(scoresByPlayerId[String(pid)] ?? 0) + gained;
      if (gained > 0) {
        log.push({ message: `${p.username ?? `#${pid}`} prend ${gained} point${gained > 1 ? 's' : ''}.` });
      }
    }

    const winnerName =
      winnerPlayerId != null
        ? players.find((p) => p?.id === winnerPlayerId)?.username ?? `#${winnerPlayerId}`
        : null;
    if (winnerName) {
      log.push({ message: `${winnerName} gagne le round.` });
    }

    // The winner may remove 1 (token) or 10 (diamond) points.
    const eligible = winnerPlayerId != null ? [winnerPlayerId] : [];
    const nextMeta: LamaMetadata = {
      ...meta,
      scoresByPlayerId,
      step: eligible.length ? 'return_token' : 'turn_choice',
      pendingReturnQueue: eligible,
      pendingReturnPlayerId: eligible.length ? eligible[0] : null,
    };

    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta as any,
      log,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: eligible.length ? eligible[0] : state.turn?.currentPlayerId ?? null,
        direction: 1,
        label: eligible.length
          ? `Retrait de points : ${players.find((p) => p?.id === eligible[0])?.username ?? `#${eligible[0]}`}`
          : undefined,
      },
    };

    if (eligible.length) {
      return nextState;
    }

    return this.finishRoundAndMaybeStartNext(nextState);
  }

  private finishRoundAndMaybeStartNext(state: GameStateEntity): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];

    const scores = meta.scoresByPlayerId ?? {};
    const highest = Math.max(
      0,
      ...Object.values(scores).map((v) => Number(v ?? 0)),
    );
    const loseAt = Number(meta.loseAtScore ?? 40);
    if (highest >= loseAt) {
      // Game over: lowest score wins.
      let winnerId: number | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const p of players) {
        const pid = p?.id;
        if (!pid) continue;
        const s = Number(scores[String(pid)] ?? 0);
        if (s < best) {
          best = s;
          winnerId = pid;
        }
      }
      const log = Array.isArray(state.log) ? [...state.log] : [];
      log.push({ message: `Partie terminée.` });
      if (winnerId) {
        log.push({ message: `Gagnant : ${players.find((p) => p?.id === winnerId)?.username ?? `#${winnerId}`}.` });
      }
      return {
        ...state,
        status: 'finished',
        log,
        metadata: {
          ...meta,
          winnerId,
          winnerPlayerId: winnerId,
        } as any,
      };
    }

    const nextRound = Number(meta.roundNumber ?? 1) + 1;
    const starter = (Number(meta.roundStarterIndex ?? 0) + 1) % Math.max(1, players.length);
    const updatedMeta: LamaMetadata = {
      ...meta,
      roundNumber: nextRound,
      roundStarterIndex: starter,
      step: 'turn_choice',
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
    };

    return this.startNewRound(
      { ...state, metadata: updatedMeta as any, round: nextRound },
      starter,
    );
  }

  private startNewRound(state: GameStateEntity, starterIndex: number): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;

    const baseDeck = this.buildDeck();
    const rngMeta = typeof meta.rng === 'object' && meta.rng ? { ...(meta.rng as any) } : {};
    const shuffled = this.random.shuffle(rngMeta, baseDeck);
    meta.rng = shuffled.meta;
    const deck = shuffled.values as LamaCardValue[];

    const handsByPlayerId: Record<string, LamaCardValue[]> = {};
    for (const p of players) {
      if (!p?.id) continue;
      handsByPlayerId[String(p.id)] = [];
    }

    for (let i = 0; i < 6; i += 1) {
      for (const p of players) {
        if (!p?.id) continue;
        const card = deck.pop();
        if (!card) continue;
        handsByPlayerId[String(p.id)].push(card);
      }
    }

    const firstDiscard = deck.pop() ?? 1;
    const discard: LamaCardValue[] = [firstDiscard as LamaCardValue];

    const starterPlayerId = players[starterIndex]?.id ?? players[0]?.id ?? null;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `Début du round ${meta.roundNumber}. Défausse: ${lamaCardLabel(firstDiscard as LamaCardValue)}.` });

    const nextMeta: LamaMetadata = {
      ...meta,
      deck,
      discard,
      handsByPlayerId,
      droppedOutByPlayerId: {},
      step: 'turn_choice',
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
    };

    return {
      ...state,
      metadata: nextMeta as any,
      log,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: starterPlayerId,
        direction: 1,
        label: starterPlayerId
          ? `Tour de ${players.find((p) => p?.id === starterPlayerId)?.username ?? `#${starterPlayerId}`}`
          : undefined,
      },
    };
  }

  private buildDeck(): LamaCardValue[] {
    const deck: LamaCardValue[] = [];
    for (const v of [1, 2, 3, 4, 5, 6, LAMA_VALUE] as LamaCardValue[]) {
      for (let i = 0; i < 8; i += 1) deck.push(v);
    }
    return deck;
  }

  private isRoundEnded(meta: LamaMetadata, players: any[]): boolean {
    const hands = meta.handsByPlayerId ?? {};
    const ids = Object.keys(hands);
    if (ids.length === 0) return true;
    const someoneEmpty = ids.some((id) => (hands[id] ?? []).length === 0);
    if (someoneEmpty) return true;

    const deckCount = (meta.deck ?? []).length;
    if (deckCount > 0) return false;
    return !this.anyPlayerCanPlay(meta, players);
  }

  private findNextActivePlayerId(players: any[], meta: LamaMetadata, afterPlayerId: number): number | null {
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    if (!ids.length) return null;
    const start = Math.max(0, ids.indexOf(afterPlayerId));

    const deckCount = (meta.deck ?? []).length;
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
    const allowed = top ? new Set<LamaCardValue>([top, nextLamaValue(top)]) : null;

    for (let step = 1; step <= ids.length; step += 1) {
      const pid = ids[(start + step) % ids.length]!;
      if (deckCount > 0) return pid; // everyone can draw
      if (!allowed) return pid;
      const hand = (meta.handsByPlayerId ?? {})[String(pid)] ?? [];
      if ((hand as LamaCardValue[]).some((v) => allowed.has(v))) {
        return pid;
      }
    }

    return ids[(start + 1) % ids.length] ?? (ids[0] ?? null);
  }

  private withTurnLabel(turn: any, players: any[], currentPlayerId: number): any {
    return {
      ...(turn ?? { direction: 1 }),
      currentPlayerId,
      direction: 1,
      label: `Tour de ${players.find((p) => p?.id === currentPlayerId)?.username ?? `#${currentPlayerId}`}`,
    };
  }

  private anyPlayerCanPlay(meta: LamaMetadata, players: any[]): boolean {
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
    if (!top) return false;

    const allowed = new Set<LamaCardValue>([top, nextLamaValue(top)]);
    const hands = meta.handsByPlayerId ?? {};
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    for (const pid of ids) {
      const hand = (hands[String(pid)] ?? []) as LamaCardValue[];
      if (hand.some((v) => allowed.has(v))) return true;
    }
    return false;
  }

  private findEmptyHandWinnerId(meta: LamaMetadata, players: any[]): number | null {
    const hands = meta.handsByPlayerId ?? {};
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    for (const pid of ids) {
      const hand = (hands[String(pid)] ?? []) as LamaCardValue[];
      if (hand.length === 0) return pid;
    }
    return null;
  }
}
