import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import { resolvePlayerName } from '../../../../../application/helpers/player-name.helper';

import { GameCoreService } from '../../../../../application/services/game-core.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { RandomService } from '../../../../../application/services/random.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import {
  LES_MAINS_CARD_BY_ID,
  LES_MAINS_FAMILY_SIZE,
  LES_MAINS_FAMILIES,
  isLesMainsSpecialCard,
} from '../../model/les-mains-de-la-terre-cards';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import type { LesMainsMetadata } from '../../model/les-mains-de-la-terre-state.model';
import {
  addLesMainsCardToHand,
  clearLesMainsFreeRequest,
  drawLesMainsOneCard,
  pickLesMainsIndex,
  shuffleLesMainsWithMeta,
  transferLesMainsCard,
} from './les-mains-de-la-terre-action.utils';

type LesMainsActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
};

export class LesMainsActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly random: RandomService,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          request_card: () => {
            next = this.handleRequestCard(next, action);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private handleRequestCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) {
      return state;
    }
    const payload = (action.payload ?? {}) as LesMainsActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    const targetId =
      typeof payload.targetPlayerId === 'number'
        ? payload.targetPlayerId
        : null;
    if (!cardId || targetId == null || targetId === currentId) {
      return state;
    }
    let next = state;
    let meta = this.getMeta(next);
    meta = clearLesMainsFreeRequest(meta, currentId);
    const targetHand = Array.isArray(meta.hands?.[targetId])
      ? [...meta.hands[targetId]]
      : [];
    const hasCard = targetHand.includes(cardId);
    if (hasCard) {
      meta = transferLesMainsCard(meta, targetId, currentId, cardId);
      next = this.core.appendLog(
        next,
        `${resolvePlayerName(next.players, currentId)} récupère ${LES_MAINS_CARD_BY_ID[cardId]?.name ?? 'une carte'} de ${resolvePlayerName(
          next.players,
          targetId,
        )}.`,
      );
      const completion = this.completeFamilyIfNeeded(meta, currentId, cardId);
      meta = completion.meta;
      if (completion.completedFamily) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerName(next.players, currentId)} complète la famille ${completion.completedFamily} !`,
        );
      }
      next = this.setMeta(next, meta);
      next = this.maybeFinishGame(next);
      return next;
    }
    next = this.setMeta(next, meta);
    next = this.drawCards(next, currentId);
    next = this.turns.advanceTurn(next);
    next = this.maybeFinishGame(next);
    return next;
  }

  private drawCards(state: GameStateEntity, playerId: number): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const extra = meta.extraDraws?.[playerId] ?? 0;
    const drawCount = 1 + extra;
    const normalizedExtra = { ...(meta.extraDraws ?? {}), [playerId]: 0 };
    meta = { ...meta, extraDraws: normalizedExtra };
    for (let i = 0; i < drawCount; i += 1) {
      const result = this.drawOneCard(meta);
      meta = result.meta;
      if (!result.cardId) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerName(next.players, playerId)} ne peut plus piocher de carte.`,
        );
        continue;
      }
      if (isLesMainsSpecialCard(result.cardId)) {
        const special = this.applySpecialCard(
          next,
          meta,
          playerId,
          result.cardId,
        );
        next = special.state;
        meta = special.meta;
        continue;
      }
      meta = addLesMainsCardToHand(meta, playerId, result.cardId);
      next = this.core.appendLog(
        next,
        `${resolvePlayerName(next.players, playerId)} pioche ${LES_MAINS_CARD_BY_ID[result.cardId]?.name ?? 'une carte'}.`,
      );
      const completion = this.completeFamilyIfNeeded(
        meta,
        playerId,
        result.cardId,
      );
      meta = completion.meta;
      if (completion.completedFamily) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerName(next.players, playerId)} complète la famille ${completion.completedFamily} !`,
        );
      }
    }
    next = this.setMeta(next, meta);
    return next;
  }

  private applySpecialCard(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
    cardId: string,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    const nextState = state;
    const nextMeta = {
      ...meta,
      discard: [...(meta.discard ?? []), cardId],
    };
    switch (cardId) {
      case 'special-voyage-autour-du-monde':
        return this.executeVoyage(nextState, nextMeta, playerId);
      case 'special-metier-disparu':
        return this.executeMetierDisparu(nextState, nextMeta, playerId);
      case 'special-formation-express':
        return this.executeFormationExpress(nextState, nextMeta, playerId);
      case 'special-greve-mondiale':
        return this.executeGreveMondiale(nextState, nextMeta, playerId);
      case 'special-boussole-perdue':
        return this.executeBoussolePerdue(nextState, nextMeta, playerId);
      case 'special-passation-de-savoir':
        return this.executePassation(nextState, nextMeta, playerId);
      case 'special-fete-du-metier':
        return this.executeFete(nextState, nextMeta, playerId);
      default:
        return { state: nextState, meta: nextMeta };
    }
  }

  private executeVoyage(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    let nextState = state;
    let nextMeta = meta;
    const playerHand = Array.isArray(nextMeta.hands?.[playerId])
      ? [...nextMeta.hands[playerId]]
      : [];
    const candidates = this.getPlayerIds(nextState.players).filter(
      (pid) => pid !== playerId && (nextMeta.hands?.[pid]?.length ?? 0) > 0,
    );
    if (!playerHand.length || !candidates.length) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} ne peut pas voyager autour du monde.`,
      );
      return { state: nextState, meta: nextMeta };
    }
    const picked = this.pickIndex(nextMeta, candidates.length);
    nextMeta = picked.meta;
    const targetId = candidates[picked.index];
    const targetHand = Array.isArray(nextMeta.hands?.[targetId])
      ? [...nextMeta.hands[targetId]]
      : [];
    if (!targetHand.length) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} ne trouve pas de carte à échanger.`,
      );
      return { state: nextState, meta: nextMeta };
    }
    const playerCardPick = this.pickIndex(nextMeta, playerHand.length);
    nextMeta = playerCardPick.meta;
    const targetCardPick = this.pickIndex(nextMeta, targetHand.length);
    nextMeta = targetCardPick.meta;
    const playerCard = playerHand[playerCardPick.index];
    const targetCard = targetHand[targetCardPick.index];
    nextMeta = transferLesMainsCard(nextMeta, playerId, targetId, playerCard);
    nextMeta = transferLesMainsCard(nextMeta, targetId, playerId, targetCard);
    nextState = this.core.appendLog(
      nextState,
      `${resolvePlayerName(nextState.players, playerId)} échange une carte avec ${resolvePlayerName(
        nextState.players,
        targetId,
      )} grâce au Voyage autour du monde.`,
    );
    return { state: nextState, meta: nextMeta };
  }

  private executeMetierDisparu(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    let nextState = state;
    let nextMeta = meta;
    const used = nextMeta.bonusMetierDisparuUsed ?? {};
    if (used[playerId]) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} a déjà utilisé Métier disparu.`,
      );
      return { state: nextState, meta: nextMeta };
    }
    const hand = Array.isArray(nextMeta.hands?.[playerId])
      ? [...nextMeta.hands[playerId]]
      : [];
    const counts: Record<string, number> = {};
    hand.forEach((cardId) => {
      const family = LES_MAINS_CARD_BY_ID[cardId]?.family;
      if (!family) return;
      counts[family] = (counts[family] ?? 0) + 1;
    });
    const completions = nextMeta.completedFamilies?.[playerId] ?? [];
    const candidate = Object.entries(counts)
      .filter(
        ([family]) =>
          !completions.includes(family as (typeof LES_MAINS_FAMILIES)[number]),
      )
      .sort(([, a], [, b]) => b - a)
      .map(([family]) => family as (typeof LES_MAINS_FAMILIES)[number])
      .shift();
    if (!candidate) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} n'a pas de famille à complèter avec Métier disparu.`,
      );
      return { state: nextState, meta: nextMeta };
    }
    const newHand = hand.filter(
      (cardId) => LES_MAINS_CARD_BY_ID[cardId]?.family !== candidate,
    );
    nextMeta = {
      ...nextMeta,
      hands: { ...nextMeta.hands, [playerId]: newHand },
      discard: [
        ...(nextMeta.discard ?? []),
        ...hand.filter(
          (cardId) => LES_MAINS_CARD_BY_ID[cardId]?.family === candidate,
        ),
      ],
      completedFamilies: {
        ...nextMeta.completedFamilies,
        [playerId]: [
          ...(nextMeta.completedFamilies?.[playerId] ?? []),
          candidate,
        ],
      },
      bonusMetierDisparuUsed: { ...used, [playerId]: true },
    };
    nextState = this.core.appendLog(
      nextState,
      `${resolvePlayerName(nextState.players, playerId)} complète la famille ${candidate} grâce au Métier disparu.`,
    );
    return { state: nextState, meta: nextMeta };
  }

  private executeFormationExpress(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    const nextMeta = {
      ...meta,
      extraDraws: {
        ...(meta.extraDraws ?? {}),
        [playerId]: (meta.extraDraws?.[playerId] ?? 0) + 1,
      },
    };
    const nextState = this.core.appendLog(
      state,
      `${resolvePlayerName(state.players, playerId)} bénéficiera d'une formation express (deux cartes au prochain tirage).`,
    );
    return { state: nextState, meta: nextMeta };
  }

  private executeGreveMondiale(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    const nextMeta = {
      ...meta,
      statuses: {
        ...(meta.statuses ?? {}),
        skipTurn: { ...(meta.statuses?.skipTurn ?? {}) },
      },
    };
    this.getPlayerIds(state.players)
      .filter((pid) => pid !== playerId)
      .forEach((pid) => {
        const currentSkip = nextMeta.statuses?.skipTurn?.[pid] ?? 0;
        if (nextMeta.statuses) {
          nextMeta.statuses.skipTurn = {
            ...nextMeta.statuses.skipTurn,
            [pid]: currentSkip + 1,
          };
        }
      });
    const nextState = this.core.appendLog(
      state,
      `${resolvePlayerName(state.players, playerId)} déclenche une Grève mondiale : les autres joueurs sautent leur prochain tour.`,
    );
    return { state: nextState, meta: nextMeta };
  }

  private executeBoussolePerdue(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    let nextState = state;
    let nextMeta = meta;
    const playerHand = Array.isArray(nextMeta.hands?.[playerId])
      ? [...nextMeta.hands[playerId]]
      : [];
    const candidates = this.getPlayerIds(nextState.players).filter(
      (pid) => pid !== playerId && (nextMeta.hands?.[pid]?.length ?? 0) > 0,
    );
    if (!candidates.length) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} ne trouve personne pour mélanger la boussole.`,
      );
      return { state: nextState, meta: nextMeta };
    }
    const pick = this.pickIndex(nextMeta, candidates.length);
    nextMeta = pick.meta;
    const targetId = candidates[pick.index];
    const targetHand = Array.isArray(nextMeta.hands?.[targetId])
      ? [...nextMeta.hands[targetId]]
      : [];
    const combined = [...playerHand, ...targetHand];
    const shuffled = this.shuffleWithMeta(nextMeta, combined);
    nextMeta = shuffled.meta;
    const split = shuffled.values;
    const firstHand = split.slice(0, playerHand.length);
    const secondHand = split.slice(playerHand.length);
    nextMeta = {
      ...nextMeta,
      hands: {
        ...nextMeta.hands,
        [playerId]: firstHand,
        [targetId]: secondHand,
      },
    };
    nextState = this.core.appendLog(
      nextState,
      `${resolvePlayerName(nextState.players, playerId)} mélange sa main avec celle de ${resolvePlayerName(
        nextState.players,
        targetId,
      )} grâce à la Boussole perdue.`,
    );
    return { state: nextState, meta: nextMeta };
  }

  private executePassation(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    let nextState = state;
    let nextMeta = meta;
    const candidates = this.getPlayerIds(nextState.players).filter(
      (pid) => pid !== playerId && (nextMeta.hands?.[pid]?.length ?? 0) > 0,
    );
    if (!candidates.length) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} n'a personne pour la Passation de savoir.`,
      );
      return { state: nextState, meta: nextMeta };
    }
    const pick = this.pickIndex(nextMeta, candidates.length);
    nextMeta = pick.meta;
    const targetId = candidates[pick.index];
    const targetHand = Array.isArray(nextMeta.hands?.[targetId])
      ? [...nextMeta.hands[targetId]]
      : [];
    const playerHand = Array.isArray(nextMeta.hands?.[playerId])
      ? [...nextMeta.hands[playerId]]
      : [];
    const familiesOwned = new Set(
      playerHand
        .map((cardId) => LES_MAINS_CARD_BY_ID[cardId]?.family)
        .filter(Boolean),
    );
    const desired = targetHand.find((cardId) => {
      const family = LES_MAINS_CARD_BY_ID[cardId]?.family;
      return family && familiesOwned.has(family);
    });
    const chosenCard = desired ?? targetHand[0];
    if (!chosenCard) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} ne trouve pas de carte à transmettre.`,
      );
      return { state: nextState, meta: nextMeta };
    }
    nextMeta = transferLesMainsCard(nextMeta, targetId, playerId, chosenCard);
    nextState = this.core.appendLog(
      nextState,
      `${resolvePlayerName(nextState.players, playerId)} récupère ${LES_MAINS_CARD_BY_ID[chosenCard]?.name ?? 'une carte'} grâce à la Passation de savoir.`,
    );
    const completion = this.completeFamilyIfNeeded(
      nextMeta,
      playerId,
      chosenCard,
    );
    nextMeta = completion.meta;
    if (completion.completedFamily) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(nextState.players, playerId)} complète la famille ${completion.completedFamily} !`,
      );
    }
    return { state: nextState, meta: nextMeta };
  }

  private executeFete(
    state: GameStateEntity,
    meta: LesMainsMetadata,
    playerId: number,
  ): { state: GameStateEntity; meta: LesMainsMetadata } {
    let nextState = state;
    const nextMeta = {
      ...meta,
      freeFamilyRequest: {
        ...(meta.freeFamilyRequest ?? {}),
        [playerId]: true,
      },
    };
    const reveals = this.getPlayerIds(state.players)
      .map((pid) => {
        const hand = nextMeta.hands?.[pid] ?? [];
        return hand.length
          ? `${resolvePlayerName(state.players, pid)} montre ${LES_MAINS_CARD_BY_ID[hand[0]]?.name ?? 'une carte'}`
          : null;
      })
      .filter(Boolean);
    nextState = this.core.appendLog(
      nextState,
      `${resolvePlayerName(state.players, playerId)} organise une Fête du métier. ${reveals.join(' / ')}`,
    );
    return { state: nextState, meta: nextMeta };
  }

  private completeFamilyIfNeeded(
    meta: LesMainsMetadata,
    playerId: number,
    cardId: string,
  ): { meta: LesMainsMetadata; completedFamily?: string } {
    const def = LES_MAINS_CARD_BY_ID[cardId];
    if (!def?.family) {
      return { meta };
    }
    const hand = Array.isArray(meta.hands?.[playerId])
      ? [...meta.hands[playerId]]
      : [];
    const familyCards = hand.filter(
      (id) => LES_MAINS_CARD_BY_ID[id]?.family === def.family,
    );
    const alreadyCompleted = meta.completedFamilies?.[playerId] ?? [];
    if (familyCards.length < LES_MAINS_FAMILY_SIZE) {
      return { meta };
    }
    if (alreadyCompleted.includes(def.family)) {
      return { meta };
    }
    const nextMeta = {
      ...meta,
      hands: {
        ...meta.hands,
        [playerId]: hand.filter(
          (id) => LES_MAINS_CARD_BY_ID[id]?.family !== def.family,
        ),
      },
      discard: [...(meta.discard ?? []), ...familyCards],
      completedFamilies: {
        ...meta.completedFamilies,
        [playerId]: [...alreadyCompleted, def.family],
      },
    };
    return { meta: nextMeta, completedFamily: def.family };
  }

  private transferCard(
    meta: LesMainsMetadata,
    fromId: number,
    toId: number,
    cardId: string,
  ): LesMainsMetadata {
    const fromHand = Array.isArray(meta.hands?.[fromId])
      ? [...meta.hands[fromId]]
      : [];
    const toHand = Array.isArray(meta.hands?.[toId])
      ? [...meta.hands[toId]]
      : [];
    const index = fromHand.indexOf(cardId);
    if (index >= 0) {
      fromHand.splice(index, 1);
    }
    return {
      ...meta,
      hands: {
        ...meta.hands,
        [fromId]: fromHand,
        [toId]: [...toHand, cardId],
      },
    };
  }

  private addCardToHand(
    meta: LesMainsMetadata,
    playerId: number,
    cardId: string,
  ): LesMainsMetadata {
    const hand = Array.isArray(meta.hands?.[playerId])
      ? [...meta.hands[playerId]]
      : [];
    return {
      ...meta,
      hands: {
        ...meta.hands,
        [playerId]: [...hand, cardId],
      },
    };
  }

  private drawOneCard(meta: LesMainsMetadata): {
    cardId: string | null;
    meta: LesMainsMetadata;
  } {
    return drawLesMainsOneCard(this.deckPolicies, meta);
  }

  private pickIndex(
    meta: LesMainsMetadata,
    length: number,
  ): { index: number; meta: LesMainsMetadata } {
    return pickLesMainsIndex(this.random, meta, length);
  }

  private shuffleWithMeta<T>(
    meta: LesMainsMetadata,
    values: T[],
  ): { values: T[]; meta: LesMainsMetadata } {
    return shuffleLesMainsWithMeta(this.random, meta, values);
  }

  private clearFreeRequest(
    meta: LesMainsMetadata,
    playerId: number,
  ): LesMainsMetadata {
    if (!meta.freeFamilyRequest?.[playerId]) {
      return meta;
    }
    return {
      ...meta,
      freeFamilyRequest: {
        ...meta.freeFamilyRequest,
        [playerId]: false,
      },
    };
  }

  private maybeFinishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    if (state.status === 'finished') {
      return state;
    }
    const players = state.players ?? [];
    const totalCompleted = this.getPlayerIds(players).reduce(
      (sum, pid) => sum + (meta.completedFamilies?.[pid]?.length ?? 0),
      0,
    );
    const allFamiliesDone = totalCompleted >= LES_MAINS_FAMILIES.length;
    const deckEmpty = (meta.deck?.length ?? 0) === 0;
    const handless = this.getPlayerIds(players).find(
      (pid) => (meta.hands?.[pid]?.length ?? 0) === 0,
    );
    if (!allFamiliesDone && !(deckEmpty && handless != null)) {
      return state;
    }
    const winnerId = this.determineLeader(meta, players);
    let nextState = state;
    const nextMeta = { ...meta, winnerId: winnerId ?? null };
    if (winnerId != null) {
      nextState = this.core.appendLog(
        nextState,
        `${resolvePlayerName(players, winnerId)} remporte Les Mains de la Terre !`,
      );
    } else {
      nextState = this.core.appendLog(
        nextState,
        'La partie se termine sur une égalité des familles complètes.',
      );
    }
    nextState = { ...nextState, status: 'finished', metadata: nextMeta };
    return nextState;
  }

  private determineLeader(
    meta: LesMainsMetadata,
    players?: GameStateEntity['players'],
  ): number | null {
    const ids = this.getPlayerIds(players);
    const counts = ids.map((pid) => ({
      pid,
      value: meta.completedFamilies?.[pid]?.length ?? 0,
    }));
    const max = Math.max(...counts.map((item) => item.value));
    const leaders = counts.filter((item) => item.value === max);
    if (leaders.length === 1) {
      return leaders[0].pid;
    }
    return null;
  }

  private getMeta(state: GameStateEntity): LesMainsMetadata {
    return (state.metadata ?? {}) as LesMainsMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: LesMainsMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private getPlayerIds(players?: GameStateEntity['players']): number[] {
    return (Array.isArray(players) ? players : [])
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player.id);
  }
}







