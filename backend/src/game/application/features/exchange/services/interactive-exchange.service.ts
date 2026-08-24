import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../models/game-state.model';
import { RandomService } from '../../../services/random.service';
import type {
  InteractiveExchangeAdapter,
  InteractiveExchangePending,
} from '../models/interactive-exchange.model';

type PendingState = GameStateEntity['pending'];
type ExchangePlayer = { id: number; username?: string | null };

export type InteractiveExchangeStartResult =
  | {
      kind: 'started';
      state: GameStateEntity;
      pending: InteractiveExchangePending;
    }
  | { kind: 'blocked'; state: GameStateEntity }
  | { kind: 'no_inventory'; state: GameStateEntity }
  | { kind: 'no_targets'; state: GameStateEntity };

export type InteractiveExchangeChooseTargetResult =
  | {
      kind: 'updated';
      state: GameStateEntity;
      pending: InteractiveExchangePending;
    }
  | { kind: 'invalid'; state: GameStateEntity };

export type InteractiveExchangeChooseGiveResult =
  | {
      kind: 'offered';
      state: GameStateEntity;
      offer: Extract<InteractiveExchangePending, { step: 'confirm' }>;
    }
  | { kind: 'invalid'; state: GameStateEntity };

@Injectable()
export class InteractiveExchangeService {
  constructor(private readonly random: RandomService) {}

  start(
    state: GameStateEntity,
    playerId: number,
    card: string,
    adapter: InteractiveExchangeAdapter,
  ): InteractiveExchangeStartResult {
    if (state.pending) {
      return { kind: 'blocked', state };
    }

    const giveChoices = adapter.getInventory(state, playerId);
    if (!Array.isArray(giveChoices) || giveChoices.length === 0) {
      return { kind: 'no_inventory', state };
    }

    const targets = adapter.listTargets(state, playerId);
    if (!Array.isArray(targets) || targets.length === 0) {
      return { kind: 'no_targets', state };
    }

    const pending: InteractiveExchangePending = {
      type: 'exchange',
      playerId,
      card,
      step: 'choose_target',
      blocking: true,
      label: "Choisissez un joueur pour l echange dans la liste, puis Entree.",
      targets,
    };

    return {
      kind: 'started',
      state: { ...state, pending: pending as PendingState },
      pending,
    };
  }

  chooseTarget(
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
    adapter: InteractiveExchangeAdapter,
  ): InteractiveExchangeChooseTargetResult {
    const pending = state.pending as InteractiveExchangePending | null;
    if (!pending || pending.type !== 'exchange') {
      return { kind: 'invalid', state };
    }
    if (pending.playerId !== playerId) return { kind: 'invalid', state };
    if (pending.step !== 'choose_target') return { kind: 'invalid', state };

    const targets = Array.isArray(pending.targets) ? pending.targets : [];
    const chosen =
      targets.find((t) => t.targetPlayerId === targetPlayerId) ?? null;
    if (!chosen) return { kind: 'invalid', state };

    const giveChoices = adapter.getInventory(state, playerId);
    if (!Array.isArray(giveChoices) || giveChoices.length === 0) {
      return { kind: 'invalid', state };
    }

    const nextPending: InteractiveExchangePending = {
      ...pending,
      step: 'choose_give',
      blocking: true,
      targetPlayerId: chosen.targetPlayerId,
      targetUsername: chosen.targetUsername,
      giveChoices,
      label: 'Choisissez la carte a donner dans la liste, puis Entree.',
    };

    return {
      kind: 'updated',
      state: { ...state, pending: nextPending as PendingState },
      pending: nextPending,
    };
  }

  chooseGive(
    state: GameStateEntity,
    playerId: number,
    give: string,
    adapter: InteractiveExchangeAdapter,
  ): InteractiveExchangeChooseGiveResult {
    const pending = state.pending as InteractiveExchangePending | null;
    if (!pending || pending.type !== 'exchange') {
      return { kind: 'invalid', state };
    }
    if (pending.playerId !== playerId) return { kind: 'invalid', state };
    if (pending.step !== 'choose_give') return { kind: 'invalid', state };

    const targetPlayerId =
      typeof pending.targetPlayerId === 'number'
        ? pending.targetPlayerId
        : null;
    if (typeof targetPlayerId !== 'number') return { kind: 'invalid', state };

    const giveCard = (give ?? '').trim();
    if (!giveCard) return { kind: 'invalid', state };

    const currentInv = adapter.getInventory(state, playerId);
    if (!Array.isArray(currentInv) || !currentInv.includes(giveCard)) {
      return { kind: 'invalid', state };
    }

    const targetInv = adapter.getInventory(state, targetPlayerId);
    const targetCards = Array.isArray(targetInv) ? targetInv : [];
    const targetHadCards = targetCards.length > 0;

    const picked = targetHadCards
      ? this.pickRandomFromArray(state, targetCards)
      : { card: null, state };

    const initiator = (state.players ?? []).find(
      (p): p is ExchangePlayer => Number(p?.id) === playerId,
    );
    const target = (state.players ?? []).find(
      (p): p is ExchangePlayer => Number(p?.id) === targetPlayerId,
    );

    const offer: Extract<InteractiveExchangePending, { step: 'confirm' }> = {
      type: 'exchange',
      step: 'confirm',
      blocking: true,
      label: 'Echange propose : A = accepter, R = refuser.',
      playerId: targetPlayerId,
      initiatorPlayerId: playerId,
      initiatorUsername:
        typeof initiator?.username === 'string' && initiator.username.trim()
          ? initiator.username.trim()
          : `Joueur ${playerId}`,
      targetPlayerId,
      targetUsername:
        typeof target?.username === 'string' && target.username.trim()
          ? target.username.trim()
          : `Joueur ${targetPlayerId}`,
      give: giveCard,
      take: targetHadCards ? picked.card : null,
      targetHadCards,
      bonusRequested: !targetHadCards,
    };

    return {
      kind: 'offered',
      state: { ...picked.state, pending: offer as PendingState },
      offer,
    };
  }

  acceptOffer(
    state: GameStateEntity,
    targetPlayerId: number,
    adapter: InteractiveExchangeAdapter,
  ):
    | {
        kind: 'resolved';
        state: GameStateEntity;
        offer: Extract<InteractiveExchangePending, { step: 'confirm' }>;
      }
    | { kind: 'invalid'; state: GameStateEntity } {
    const pending = state.pending as InteractiveExchangePending | null;
    if (!pending || pending.type !== 'exchange' || pending.step !== 'confirm') {
      return { kind: 'invalid', state };
    }
    if (pending.playerId !== targetPlayerId) return { kind: 'invalid', state };

    const offer = pending;
    const initiatorId = offer.initiatorPlayerId;
    const give = (offer.give ?? '').trim();
    const take = offer.take != null ? String(offer.take).trim() : null;

    const initiatorInv = adapter.getInventory(state, initiatorId);
    if (!Array.isArray(initiatorInv) || !initiatorInv.includes(give)) {
      return { kind: 'invalid', state: { ...state, pending: null } };
    }

    let next: GameStateEntity = state;
    next = adapter.removeFromInventory(next, initiatorId, give);
    next = adapter.addCardToPlayer(next, targetPlayerId, give);

    if (take) {
      const targetInv = adapter.getInventory(next, targetPlayerId);
      if (Array.isArray(targetInv) && targetInv.includes(take)) {
        next = adapter.removeFromInventory(next, targetPlayerId, take);
        next = adapter.addCardToPlayer(next, initiatorId, take);
      }
    } else if (adapter.setSkipTurns) {
      next = adapter.setSkipTurns(next, targetPlayerId, 2);
    }

    return { kind: 'resolved', state: { ...next, pending: null }, offer };
  }

  refuseOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity {
    const pending = state.pending as InteractiveExchangePending | null;
    if (!pending || pending.type !== 'exchange' || pending.step !== 'confirm') {
      return state;
    }
    if (pending.playerId !== targetPlayerId) return state;
    return { ...state, pending: null };
  }

  private pickRandomFromArray(
    state: GameStateEntity,
    values: string[],
  ): { card: string; state: GameStateEntity } {
    const meta =
      state.metadata && typeof state.metadata === 'object'
        ? (state.metadata as Record<string, unknown>)
        : {};
    const { index: idx, meta: updated } = this.random.pickIndex(
      meta,
      values.length,
    );
    const index = Math.max(0, Math.min(values.length - 1, idx));
    return {
      card: values[index] ?? '',
      state: { ...state, metadata: updated },
    };
  }
}
