import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type {
  RiteCardDefinition,
  RiteFamilyId,
  RiteSpecialCard,
} from '../model/entre-rites-cards';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType } from '../../../../actions/action-service.helper';


import {
  ENTRE_RITES_CARD_BY_ID,
  ENTRE_RITES_CUSTOM_FAMILY_SIZE,
} from '../model/entre-rites-cards';
import type { EntreRitesMetadata } from '../model/entre-rites-state.entity';
import { ENTRE_RITES_TOTAL_FAMILIES } from '../model/entre-rites-state.entity';

type EntreRitesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
};

@Injectable()
export class EntreRitesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          ask_card: () => this.handleAskCard(next, action),
          pass: () => this.handlePass(next, action),
        },
        () => next,
      );
    });
  }

  private handleAskCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const payload = (action.payload ?? {}) as EntreRitesActionPayload;
    const targetId =
      typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId || targetId == null || targetId === currentId) {
      return state;
    }
    const meta = this.getMeta(state);
    const targetHand = Array.isArray(meta.hands?.[targetId])
      ? [...meta.hands[targetId]]
      : [];
    if (!targetHand.includes(cardId)) {
      let next = this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, currentId)} demande ${cardId} à ${resolvePlayerNameFromState(
          state,
          targetId,
        )} sans succès et doit piocher.`,
      );
      next = this.drawCardForPlayer(next, currentId);
      next = this.advanceTurn(next);
      return next;
    }

    let next = this.transferCard(state, targetId, currentId, cardId);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} récupère ${cardId} de ${resolvePlayerNameFromState(
        next,
        targetId,
      )} et continue.`,
    );
    next = this.checkVictory(next, currentId);
    return next;
  }

  private handlePass(
    state: GameStateEntity,
    _action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const next = this.advanceTurn(state);
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} passe son tour.`,
    );
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    let next = this.turns.advanceTurn(state);
    const meta = this.getMeta(next);
    let peace = Math.max((meta.peaceTurnsRemaining ?? 0) - 1, 0);
    let silence = meta.silenceUntilPlayerId ?? null;
    const nextPlayer = next.turn?.currentPlayerId ?? null;
    if (silence && nextPlayer === silence) {
      silence = null;
    }
    next = this.setMeta(next, { ...meta, peaceTurnsRemaining: peace, silenceUntilPlayerId: silence });
    return next;
  }

  private transferCard(
    state: GameStateEntity,
    fromId: number,
    toId: number,
    cardId: string,
  ): GameStateEntity {
    let meta = this.getMeta(state);
    meta = this.removeCardFromHand(meta, fromId, cardId);
    meta = this.addCardToHand(meta, toId, cardId);
    let next = this.setMeta(state, meta);
    next = this.rebuildCollections(next, fromId);
    next = this.rebuildCollections(next, toId);
    next = this.checkVictory(next, toId);
    return next;
  }

  private drawCardForPlayer(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const { cardId, card, state: afterDraw } = this.drawSingleCard(state);
    if (!cardId || !card) {
      return this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, playerId)} ne peut plus piocher, la pioche est vide.`,
      );
    }
    return this.handleDrawnCard(afterDraw, playerId, card);
  }

  private drawSingleCard(
    state: GameStateEntity,
  ): {
    state: GameStateEntity;
    cardId: string | null;
    card?: RiteCardDefinition;
  } {
    const meta = this.getMeta(state);
    const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
    const next = this.setMeta(state, updatedMeta);
    const card = cardId ? ENTRE_RITES_CARD_BY_ID[cardId] : undefined;
    return { state: next, cardId, card };
  }

  private handleDrawnCard(
    state: GameStateEntity,
    playerId: number,
    card: RiteCardDefinition,
    allowSpecial = true,
  ): GameStateEntity {
    if (card.type === 'family') {
      let next = this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, playerId)} pioche ${card.name}.`,
      );
      const meta = this.addCardToHand(this.getMeta(next), playerId, card.id);
      next = this.setMeta(next, meta);
      next = this.rebuildCollections(next, playerId);
      return this.checkVictory(next, playerId);
    }
    if (!allowSpecial) {
      return state;
    }
    return this.handleSpecialEffect(state, playerId, card as RiteSpecialCard);
  }

  private handleSpecialEffect(
    state: GameStateEntity,
    playerId: number,
    card: RiteSpecialCard,
  ): GameStateEntity {
    let next = state;
    if (this.isSilenced(next, playerId)) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} pioche ${card.name} mais ses pouvoirs sont désormais muets.`,
      );
      next = this.discardCard(next, playerId, card.id);
      next = this.recordSpecial(next, playerId, card.id);
      return next;
    }
    switch (card.effect) {
      case 'draw_two_choose_one':
        next = this.effectDrawTwo(next, playerId);
        break;
      case 'draw_and_trigger':
        next = this.effectDrawAndTrigger(next, playerId);
        break;
      case 'collect_from_others':
        next = this.effectCollectFromOthers(next, playerId);
        break;
      case 'take_from_discard':
        next = this.effectTakeFromDiscard(next, playerId);
        break;
      case 'mute_specials':
        next = this.effectMuteSpecials(next, playerId);
        break;
      case 'swap_hands':
        next = this.effectSwapHands(next, playerId);
        break;
      case 'free_family':
        next = this.effectFreeFamily(next, playerId);
        break;
      case 'reshuffle_cycle':
        next = this.effectReshuffleCycle(next, playerId);
        break;
      case 'peace_turns':
        next = this.effectPeaceTurns(next);
        break;
      case 'reveal_and_steal':
        next = this.effectRevealAndSteal(next, playerId);
        break;
      default:
        next = this.discardCard(next, playerId, card.id);
    }
    next = this.recordSpecial(next, playerId, card.id);
    return this.checkVictory(next, playerId);
  }

  private effectDrawTwo(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    for (let i = 0; i < 2; i += 1) {
      const { card, state: drawn } = this.drawSingleCard(next);
      if (!card) break;
      next = this.handleDrawnCard(drawn, playerId, card);
    }
    return next;
  }

  private effectDrawAndTrigger(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const { card, state: drawn } = this.drawSingleCard(state);
    if (!card) return state;
    return this.handleDrawnCard(drawn, playerId, card);
  }

  private effectCollectFromOthers(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = this.core.appendLog(
      state,
      `${resolvePlayerNameFromState(state, playerId)} invoque la Bénédiction et réclame une carte à chaque adversaire.`,
    );
    const players = (Array.isArray(next.players) ? next.players : []).filter(
      (p) => p?.id != null && p.id !== playerId,
    );
    for (const player of players) {
      const opponentId = player!.id;
      const meta = this.getMeta(next);
      const hand = Array.isArray(meta.hands?.[opponentId])
        ? [...meta.hands[opponentId]]
        : [];
      if (!hand.length) {
        continue;
      }
      const cardId = hand.shift()!;
      let updatedMeta = this.removeCardFromHand(meta, opponentId, cardId);
      updatedMeta = this.addCardToHand(updatedMeta, playerId, cardId);
      next = this.setMeta(next, updatedMeta);
      next = this.rebuildCollections(next, opponentId);
      next = this.rebuildCollections(next, playerId);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} prend ${cardId} à ${resolvePlayerNameFromState(
          next,
          opponentId,
        )}.`,
      );
    }
    return next;
  }

  private effectTakeFromDiscard(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const discard = [...(meta.discard ?? [])];
    if (!discard.length) {
      return this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, playerId)} cherche dans la défausse mais rien n’y est.`,
      );
    }
    const cardId = discard.pop()!;
    const card = ENTRE_RITES_CARD_BY_ID[cardId];
    const stateAfterDiscard = this.setMeta(state, {
      ...meta,
      discard,
    });
    if (!card) {
      return stateAfterDiscard;
    }
    const next = this.handleDrawnCard(stateAfterDiscard, playerId, card);
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} reprend ${cardId} depuis la défausse.`,
    );
  }

  private effectMuteSpecials(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta = {
      ...meta,
      silenceUntilPlayerId: playerId,
    };
    return this.core.appendLog(
      this.setMeta(state, nextMeta),
      `${resolvePlayerNameFromState(state, playerId)} impose le Silence Sacré.`,
    );
  }

  private effectSwapHands(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const opponents = (Array.isArray(state.players) ? state.players : []).filter(
      (player) => player?.id != null && player.id !== playerId,
    );
    const target = opponents.find(
      (player) => (meta.hands?.[player!.id ?? 0]?.length ?? 0) > 0,
    );
    if (!target || target.id == null) {
      return this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, playerId)} invoque l’Envol Mystique sans adversaire disponible.`,
      );
    }
    const targetId = target.id;
    const playerHand = [...(meta.hands?.[playerId] ?? [])];
    const targetHand = [...(meta.hands?.[targetId] ?? [])];
    const nextMeta = {
      ...meta,
      hands: {
        ...(meta.hands ?? {}),
        [playerId]: targetHand,
        [targetId]: playerHand,
      },
    };
    let next = this.setMeta(state, nextMeta);
    next = this.rebuildCollections(next, playerId);
    next = this.rebuildCollections(next, targetId);
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} échange sa main avec ${resolvePlayerNameFromState(
        next,
        targetId,
      )}.`,
    );
  }

  private effectFreeFamily(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const metadata = this.getMeta(state);
    const completed = new Set(metadata.completedFamilies?.[playerId] ?? []);
    const familyKeys = Object.keys(ENTRE_RITES_CUSTOM_FAMILY_SIZE) as RiteFamilyId[];
    const pending = familyKeys.find((familyId) => !completed.has(familyId));
    if (!pending) {
      return this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, playerId)} active la Clé du Jardin Caché mais toutes les familles sont déjà complètes.`,
      );
    }
    completed.add(pending);
    const nextMeta = {
      ...metadata,
      completedFamilies: {
        ...(metadata.completedFamilies ?? {}),
        [playerId]: Array.from(completed),
      },
    };
    const next = this.setMeta(state, nextMeta);
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} pose une famille secrète grâce à la Clé du Jardin Caché.`,
    );
  }

  private effectReshuffleCycle(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = this.core.appendLog(
      state,
      `${resolvePlayerNameFromState(state, playerId)} déclenche L’Aube Nouvelle : tout le monde défausse puis pioche.`,
    );
    const players = (Array.isArray(next.players) ? next.players : []).filter(
      (p) => p?.id != null,
    );
    for (const player of players) {
      const targetId = player!.id;
      next = this.discardOneCard(next, targetId);
    }
    for (const player of players) {
      next = this.drawCardForPlayer(next, player!.id);
    }
    return next;
  }

  private effectPeaceTurns(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta = { ...meta, peaceTurnsRemaining: 2 };
    return this.core.appendLog(
      this.setMeta(state, nextMeta),
      `Une paix s’installe grâce à L’Étoile de l’Orient : aucune demande n’est possible pendant deux tours.`,
    );
  }

  private effectRevealAndSteal(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    const players = (Array.isArray(state.players) ? state.players : []).filter(
      (player) => player?.id != null && player.id !== playerId,
    );
    const meta = this.getMeta(state);
    for (const player of players) {
      const hand = meta.hands?.[player!.id ?? 0] ?? [];
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, player!.id!)} révèle sa main : ${hand.join(', ') || 'vide'}.`,
      );
    }
    const theftTarget = players.find(
      (player) => (meta.hands?.[player!.id ?? 0]?.length ?? 0) > 0,
    );
    if (!theftTarget || theftTarget.id == null) {
      return next;
    }
    const targetId = theftTarget.id;
    const targetHand = [...(meta.hands?.[targetId] ?? [])];
    const cardId = targetHand.shift();
    if (!cardId) return next;
    let updatedMeta = this.removeCardFromHand(this.getMeta(next), targetId, cardId);
    updatedMeta = this.addCardToHand(updatedMeta, playerId, cardId);
    next = this.setMeta(next, updatedMeta);
    next = this.rebuildCollections(next, targetId);
    next = this.rebuildCollections(next, playerId);
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} s’empare de ${cardId} grâce au Chant du Coq.`,
    );
  }

  private discardOneCard(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const hand = Array.isArray(meta.hands?.[playerId])
      ? [...meta.hands[playerId]]
      : [];
    if (!hand.length) {
      return state;
    }
    const cardId = hand.shift()!;
    let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} défausse ${cardId}.`,
    );
  }

  private discardCard(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updatedMeta = this.addCardToDiscard(
      this.removeCardFromHand(meta, playerId, cardId),
      cardId,
    );
    const next = this.setMeta(state, updatedMeta);
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} défausse ${cardId}.`,
    );
  }

  private isSilenced(state: GameStateEntity, playerId: number): boolean {
    const meta = this.getMeta(state);
    const silence = meta.silenceUntilPlayerId ?? null;
    return silence != null && silence !== playerId;
  }

  private rebuildCollections(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const hand = Array.isArray(meta.hands?.[playerId])
      ? [...meta.hands[playerId]]
      : [];
    const group: Record<string, string[]> = {};
    hand.forEach((cardId) => {
      const card = ENTRE_RITES_CARD_BY_ID[cardId];
      if (card?.type === 'family') {
        const bucket = [...(group[card.familyId] ?? [])];
        bucket.push(cardId);
        group[card.familyId] = bucket;
      }
    });
    const completed = new Set(meta.completedFamilies?.[playerId] ?? []);
    for (const [familyId, values] of Object.entries(group)) {
      const needed = ENTRE_RITES_CUSTOM_FAMILY_SIZE[familyId as keyof typeof ENTRE_RITES_CUSTOM_FAMILY_SIZE] ?? 7;
      if (needed > 0 && values.length >= needed) {
        if (!completed.has(familyId)) {
          completed.add(familyId);
          values.forEach((id) => {
            const index = hand.indexOf(id);
            if (index >= 0) hand.splice(index, 1);
          });
          group[familyId] = [];
        }
      }
    }
    const families = { ...(meta.familyCollections ?? {}) };
    families[playerId] = group;
    const completedFamilies = { ...(meta.completedFamilies ?? {}) };
    completedFamilies[playerId] = Array.from(completed);
    const hands = { ...(meta.hands ?? {}) };
    hands[playerId] = hand;
    return this.setMeta(state, {
      ...meta,
      familyCollections: families,
      completedFamilies,
      hands,
    });
  }

  private checkVictory(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    if (state.status === 'finished') return state;
    const meta = this.getMeta(state);
    const totalFamilies = Object.values(meta.completedFamilies ?? {}).reduce(
      (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
      0,
    );
    if (totalFamilies >= ENTRE_RITES_TOTAL_FAMILIES) {
      const winnerId = this.findWinner(meta) ?? playerId;
      const next = this.core.appendLog(
        state,
        `Toutes les familles sont complétées. ${resolvePlayerNameFromState(state, winnerId)} remporte la partie !`,
      );
      const metaAfter = this.getMeta(next);
      return {
        ...next,
        status: 'finished',
        metadata: {
          ...metaAfter,
          winnerId,
        },
      };
    }
    return state;
  }

  private findWinner(meta: EntreRitesMetadata): number | null {
    const candidates = Object.keys(meta.completedFamilies ?? []).map((id) =>
      Number(id),
    );
    let bestId: number | null = null;
    let bestFamilies = -1;
    let bestSpecials = -1;
    for (const playerId of candidates) {
      const families = meta.completedFamilies?.[playerId]?.length ?? 0;
      const specials = meta.specialsPlayedCount?.[playerId] ?? 0;
      if (
        families > bestFamilies ||
        (families === bestFamilies && specials > bestSpecials)
      ) {
        bestId = playerId;
        bestFamilies = families;
        bestSpecials = specials;
      }
    }
    return bestId;
  }

  private recordSpecial(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const specials = { ...(meta.specialsPlayed ?? {}) };
    const count = { ...(meta.specialsPlayedCount ?? {}) };
    specials[playerId] = [...(specials[playerId] ?? []), cardId];
    count[playerId] = (count[playerId] ?? 0) + 1;
    return this.setMeta(state, {
      ...meta,
      specialsPlayed: specials,
      specialsPlayedCount: count,
    });
  }

  private drawOneCard(
    meta: EntreRitesMetadata,
  ): { cardId: string | null; meta: EntreRitesMetadata } {
    const draw = this.deckPolicies.drawOne<string, EntreRitesMetadata>({
      meta,
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });
    return { cardId: draw.card, meta: draw.meta };
  }

  private addCardToHand(
    meta: EntreRitesMetadata,
    playerId: number,
    cardId: string,
  ): EntreRitesMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const hand = [...(hands[playerId] ?? []), cardId];
    hands[playerId] = hand;
    return { ...meta, hands };
  }

  private removeCardFromHand(
    meta: EntreRitesMetadata,
    playerId: number,
    cardId: string,
  ): EntreRitesMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const hand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
    const index = hand.indexOf(cardId);
    if (index >= 0) {
      hand.splice(index, 1);
    }
    hands[playerId] = hand;
    return { ...meta, hands };
  }

  private addCardToDiscard(
    meta: EntreRitesMetadata,
    cardId: string,
  ): EntreRitesMetadata {
    const discard = [...(meta.discard ?? []), cardId];
    return { ...meta, discard };
  }

  private setMeta(
    state: GameStateEntity,
    metadata: EntreRitesMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private getMeta(state: GameStateEntity): EntreRitesMetadata {
    return (state.metadata ?? {}) as EntreRitesMetadata;
  }
}



