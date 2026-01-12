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

@Injectable()
export class LamaService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'lama';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Ents Sacrés';
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
    const scoresByPlayerId: Record<string, number> = {};
    for (const p of players) {
      if (!p?.id) continue;
      scoresByPlayerId[String(p.id)] = 0;
    }

    const meta: LamaMetadata = {
      rng: typeof baseState.metadata === 'object' && baseState.metadata ? (baseState.metadata as any).rng : undefined,
      roundNumber: 1,
      roundStarterIndex: 0,
      deck: [],
      discard: [],
      handsByPlayerId: {},
      droppedOutByPlayerId: {},
      scoresByPlayerId,
      step: 'turn_choice',
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
    };

    const started = this.startNewRound(
      {
        ...baseState,
        status: 'started',
        phase: 'round',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        pending: null,
        log: Array.isArray(baseState.log) ? baseState.log : [],
        metadata: meta as any,
      },
      meta.roundStarterIndex,
    );

    return started;
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return next;
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : state.turn?.currentPlayerId ?? null;
    if (!actorId) return state;

    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    if (meta.winnerId) return state;

    const players = Array.isArray(state.players) ? state.players : [];

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

    const type = String(action?.type ?? '').trim();
    if (!type) return state;

    if (Boolean((meta.droppedOutByPlayerId ?? {})[String(actorId)])) {
      return state;
    }

    if (type === 'draw') {
      return this.applyDraw(state, meta, actorId);
    }

    if (type === 'lama_quit') {
      return this.applyQuit(state, meta, actorId);
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
    return {
      ...state,
      metadata: nextMeta as any,
      log,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: this.withTurnLabel(state.turn, players, actorId),
    };
  }

  private applyQuit(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    const droppedOutByPlayerId = { ...(meta.droppedOutByPlayerId ?? {}) };
    droppedOutByPlayerId[String(actorId)] = true;
    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} sort du round.` });

    const nextMeta: LamaMetadata = { ...meta, droppedOutByPlayerId };
    const ended = this.isRoundEnded(nextMeta);
    if (ended) {
      const nextState: GameStateEntity = { ...state, metadata: nextMeta as any, log };
      return this.endRound(nextState);
    }

    const nextPlayerId = this.findNextActivePlayerId(players, nextMeta, actorId);
    return {
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
  }

  private applyPlay(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const rawValue = Number((action.payload as any)?.value);
    const rawCount = Number((action.payload as any)?.count);
    const value = (rawValue >= 1 && rawValue <= 7 ? rawValue : 0) as LamaCardValue;
    const count = Math.max(1, Math.floor(rawCount || 1));

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
    log.push({ message: `${name} joue ${lamaCardLabel(value)} ×${count}.` });

    const nextMeta: LamaMetadata = { ...meta, handsByPlayerId, discard };

    // End round if player emptied hand.
    if (nextHand.length === 0) {
      const endedState: GameStateEntity = {
        ...state,
        metadata: nextMeta as any,
        log,
        turnIndex: (state.turnIndex ?? 0) + 1,
      };
      return this.endRound(endedState);
    }

    const nextPlayerId = this.findNextActivePlayerId(players, nextMeta, actorId);
    return {
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
  }

  private endRound(state: GameStateEntity): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const handsByPlayerId = meta.handsByPlayerId ?? {};
    const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };

    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `Fin du round ${meta.roundNumber}.` });

    const emptyHandPlayers: number[] = [];
    for (const p of players) {
      if (!p?.id) continue;
      const pid = p.id;
      const hand = (handsByPlayerId[String(pid)] ?? []) as LamaCardValue[];
      const gained = hand.reduce((sum, v) => sum + lamaCardScore(v), 0);
      scoresByPlayerId[String(pid)] = Number(scoresByPlayerId[String(pid)] ?? 0) + gained;
      if (gained > 0) {
        log.push({ message: `${p.username ?? `#${pid}`} prend ${gained} point${gained > 1 ? 's' : ''}.` });
      }
      if (hand.length === 0) {
        emptyHandPlayers.push(pid);
      }
    }

    // Queue return-token decisions for players who ended with 0 cards and have points.
    const eligible = emptyHandPlayers.filter((pid) => Number(scoresByPlayerId[String(pid)] ?? 0) > 0);
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
    if (highest >= 40) {
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
    const droppedOutByPlayerId: Record<string, boolean> = {};
    for (const p of players) {
      if (!p?.id) continue;
      droppedOutByPlayerId[String(p.id)] = false;
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
      droppedOutByPlayerId,
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

  private isRoundEnded(meta: LamaMetadata): boolean {
    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    if (ids.length === 0) return true;
    const allDropped = ids.every((id) => Boolean(dropped[id]));
    if (allDropped) return true;
    const someoneEmpty = ids.some((id) => (hands[id] ?? []).length === 0);
    return someoneEmpty;
  }

  private findNextActivePlayerId(players: any[], meta: LamaMetadata, afterPlayerId: number): number | null {
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    if (!ids.length) return null;
    const dropped = meta.droppedOutByPlayerId ?? {};
    const start = Math.max(0, ids.indexOf(afterPlayerId));
    for (let step = 1; step <= ids.length; step += 1) {
      const pid = ids[(start + step) % ids.length]!;
      if (!dropped[String(pid)]) return pid;
    }
    return ids[start] ?? null;
  }

  private withTurnLabel(turn: any, players: any[], currentPlayerId: number): any {
    return {
      ...(turn ?? { direction: 1 }),
      currentPlayerId,
      direction: 1,
      label: `Tour de ${players.find((p) => p?.id === currentPlayerId)?.username ?? `#${currentPlayerId}`}`,
    };
  }
}

