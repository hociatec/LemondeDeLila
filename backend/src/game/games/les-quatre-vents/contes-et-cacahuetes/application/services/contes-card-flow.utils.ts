import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  ContesCard,
  ContesCardType,
  ContesCacahuetesMetadata,
  ContesPending,
} from '../../model/contes-et-cacahuetes-state.model';
import { toContesCardArray } from './contes-action.utils';
import type { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import type { RandomService } from '../../../../../application/services/random.service';

export type ContesCardFlowDeps = {
  random: RandomService;
  deckPolicies: DeckPoliciesService;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setPending: (
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ) => GameStateEntity;
  setStatusBool: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ) => GameStateEntity;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  queueDraws: (
    state: GameStateEntity,
    playerId: number,
    queue: Array<'bonus' | 'malus' | 'surprise' | 'conte'>,
    depth: number,
    label?: string,
  ) => GameStateEntity;
  endTurn: (state: GameStateEntity, playerId: number) => GameStateEntity;
  attachQueuedDrawContinuationFromPending: (
    state: GameStateEntity,
    pending: ContesPending | null,
  ) => GameStateEntity;
  resumeQueuedDrawContinuation: (
    state: GameStateEntity,
    pending: ContesPending | null,
  ) => GameStateEntity;
  canUseBonusCards: (state: GameStateEntity, playerId: number) => boolean;
};

export function applyContesAbondance(
  deps: ContesCardFlowDeps,
  state: GameStateEntity,
  playerId: number,
): GameStateEntity {
  return deps.setPending(state, {
    type: 'draw',
    label:
      'Corne d’abondance : piocher une carte Bonus (Espace).',
    playerId,
    blocking: true,
    data: {
      context: 'abondance',
      remaining: 2,
      drawn: [],
    },
  });
}

export function applyContesCoffreMerveilles(
  deps: ContesCardFlowDeps,
  state: GameStateEntity,
  playerId: number,
  depth: number,
): GameStateEntity {
  let next = state;
  const out1 = deps.random.nextInt(deps.getMeta(next), 3);
  next = { ...next, metadata: { ...(next.metadata ?? {}), ...out1.meta } };
  const out2 = deps.random.nextInt(deps.getMeta(next), 3);
  next = { ...next, metadata: { ...(next.metadata ?? {}), ...out2.meta } };
  const t = (value: number): ContesCardType =>
    value === 0 ? 'bonus' : value === 1 ? 'malus' : 'surprise';
  const t1 = t(out1.value);
  const t2 = t(out2.value);
  next = deps.appendLog(
    next,
    `Coffre aux merveilles : 2 cartes (${t1}, ${t2}).`,
  );
  return deps.queueDraws(next, playerId, [t1, t2], depth);
}

export function drawContesCard(
  deps: ContesCardFlowDeps,
  state: GameStateEntity,
  type: 'bonus' | 'malus' | 'surprise' | 'conte',
): { state: GameStateEntity; card: ContesCard | null } {
  const meta = deps.getMeta(state);
  const decks = meta.decks;
  const pileKey: keyof ContesCacahuetesMetadata['decks'] =
    type === 'conte' ? 'contes' : type;
  const discardKey: keyof ContesCacahuetesMetadata['decks'] =
    type === 'bonus'
      ? 'discardBonus'
      : type === 'malus'
        ? 'discardMalus'
        : type === 'surprise'
          ? 'discardSurprise'
          : 'discardContes';
  const pile = toContesCardArray(decks[pileKey]);
  const discard = toContesCardArray(decks[discardKey]);

  const draw = deps.deckPolicies.drawFromPile<
    ContesCard,
    ContesCacahuetesMetadata
  >({
    meta,
    pile: [...pile],
    discard: [...discard],
    useWholeMetaRng: true,
    discardDrawnCard: true,
  });

  const nextMeta = {
    ...draw.meta,
    decks: {
      ...decks,
      [pileKey]: draw.pile,
      [discardKey]: draw.discard,
    },
  } as ContesCacahuetesMetadata;

  return {
    state: { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } },
    card: draw.card,
  };
}

export function protectContesPlayerFromMalus(
  deps: ContesCardFlowDeps,
  state: GameStateEntity,
  playerId: number,
): { protected: boolean; state: GameStateEntity } {
  let next = state;
  const meta = deps.getMeta(next);

  const dragon = Boolean(meta.statuses.protectNextMalus?.[playerId]);
  if (dragon) {
    next = deps.setStatusBool(next, 'protectNextMalus', playerId, false);
    return { protected: true, state: next };
  }

  const charges = Number(meta.statuses.shieldMalus?.[playerId] ?? 0);
  if (charges > 0) {
    next = deps.setStatusCount(next, 'shieldMalus', playerId, charges - 1);
    return { protected: true, state: next };
  }

  return { protected: false, state: next };
}

export function finalizeContesPendingResolution(
  deps: ContesCardFlowDeps,
  previous: GameStateEntity,
  next: GameStateEntity,
): GameStateEntity {
  if (!previous?.pending) return next;
  const previousPending = previous.pending as ContesPending | null;
  if (next?.pending) {
    return deps.attachQueuedDrawContinuationFromPending(next, previousPending);
  }
  if (String(next?.status ?? '').toLowerCase() === 'finished') return next;

  const currentTurnPlayerId =
    typeof previous?.turn?.currentPlayerId === 'number' &&
    Number.isFinite(previous.turn.currentPlayerId)
      ? previous.turn.currentPlayerId
      : null;
  const pendingPlayerId =
    typeof previousPending?.playerId === 'number' &&
    Number.isFinite(previousPending.playerId)
      ? previousPending.playerId
      : null;
  const playerId = currentTurnPlayerId ?? pendingPlayerId;
  if (playerId == null) return next;

  next = deps.resumeQueuedDrawContinuation(next, previousPending);
  if (next?.pending) return next;

  return deps.endTurn(next, playerId);
}
