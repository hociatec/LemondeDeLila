import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import {
  LA_GRANDE_MINE_CARD_BY_ID,
  type LaGrandeMineCard,
} from '../model/la-grande-mine-cards';
import type { LaGrandeMineMetadata } from '../model/la-grande-mine-state.entity';

type LaGrandeMineActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
};

@Injectable()
export class LaGrandeMineDeBarbakActionService {
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
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'play_card') {
        next = this.handlePlayCard(next, action);
        continue;
      }
      if (type === 'pass') {
        next = this.handlePass(next);
        continue;
      }
    }
    return next;
  }

  private handlePass(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.ensurePlayerDrawn(state, currentId);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} passe son tour.`,
    );
    next = this.trimHand(next, currentId);
    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.ensurePlayerDrawn(state, currentId);
    const payload = (action.payload ?? {}) as LaGrandeMineActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return next;

    const meta = this.getMeta(next);
    const hand = Array.isArray(meta.hands?.[currentId])
      ? [...meta.hands[currentId]]
      : [];
    if (!hand.includes(cardId)) return next;

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    next = this.setMeta(next, updatedMeta);
    next = this.addCardToDiscard(next, cardId);

    const definition = LA_GRANDE_MINE_CARD_BY_ID[cardId];
    if (!definition) return next;

    if (definition.category === 'tresor') {
      next = this.playTreasure(next, currentId, cardId, definition);
    } else if (definition.category === 'objet') {
      next = this.playObject(next, currentId, cardId, definition);
    } else if (definition.category === 'event') {
      next = this.applyEventEffect(next, currentId, definition, true);
    } else if (definition.category === 'monster') {
      const targetId =
        typeof payload.targetPlayerId === 'number'
          ? payload.targetPlayerId
          : null;
      next = this.applyMonsterEffect(next, currentId, targetId, definition);
    } else if (definition.category === 'collapse') {
      next = this.applyCollapseEffect(next, definition.id, currentId, true);
    }

    if (this.getMeta(next).winnerId != null) {
      return next;
    }

    next = this.trimHand(next, currentId);
    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private ensurePlayerDrawn(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.drawnPlayerId === playerId) return state;
    const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
    let next = this.setMeta(state, {
      ...updatedMeta,
      drawnPlayerId: playerId,
    });
    if (!cardId) {
      return next;
    }
    const definition = LA_GRANDE_MINE_CARD_BY_ID[cardId];
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} pioche ${definition?.name ?? 'une carte'}.`,
    );
    if (!definition) {
      return next;
    }
    if (definition.category === 'event') {
      next = this.addCardToDiscard(next, cardId);
      next = this.applyEventEffect(next, playerId, definition, false);
    } else if (definition.category === 'monster') {
      next = this.addCardToDiscard(next, cardId);
      next = this.applyMonsterEffect(next, playerId, null, definition);
    } else if (definition.category === 'collapse') {
      next = this.addCardToDiscard(next, cardId);
      next = this.applyCollapseEffect(next, definition.id, playerId, false);
    } else {
      next = this.addCardToHand(next, playerId, cardId);
    }
    return next;
  }

  private playTreasure(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
    card: LaGrandeMineCard,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const domains = { ...(meta.domains ?? {}) };
    const domain = domains[playerId] ?? { treasures: [], objects: [] };
    const treasures = [...(domain.treasures ?? []), cardId];
    domains[playerId] = { ...domain, treasures };
    let next = this.setMeta(state, { ...meta, domains });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} pose le trésor ${card.name} (+${card.points ?? 0} pts).`,
    );
    return next;
  }

  private playObject(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
    card: LaGrandeMineCard,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const domains = { ...(meta.domains ?? {}) };
    const domain = domains[playerId] ?? { treasures: [], objects: [] };
    const objects = [...(domain.objects ?? []), cardId];
    domains[playerId] = { ...domain, objects };
    let next = this.setMeta(state, { ...meta, domains });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} installe l'objet ${card.name}.`,
    );
    return next;
  }

  private applyEventEffect(
    state: GameStateEntity,
    playerId: number,
    card: LaGrandeMineCard,
    played: boolean,
  ): GameStateEntity {
    const message = played
      ? `${this.playerName(state, playerId)} utilise ${card.name} (${card.description}).`
      : `${this.playerName(state, playerId)} déclenche ${card.name} (${card.description}).`;
    return this.core.appendLog(state, message);
  }

  private applyMonsterEffect(
    state: GameStateEntity,
    playerId: number,
    targetId: number | null,
    card: LaGrandeMineCard,
  ): GameStateEntity {
    let meta = this.getMeta(state);
    const opponents = this.availableOpponents(state, playerId);
    let chosenId: number | null = null;
    if (targetId != null && opponents.includes(targetId)) {
      chosenId = targetId;
    } else if (opponents.length) {
      const { value, meta: updatedRng } = this.random.pickOne(
        meta.rng ?? {},
        opponents,
      );
      meta = { ...meta, rng: updatedRng };
      chosenId = value ?? null;
    }
    let next = this.setMeta(state, meta);
    if (chosenId == null) {
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} tente de lancer ${card.name}, mais il n'y a personne.`,
      );
    }
    next = this.removeRandomDomainCard(next, chosenId);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} attaque ${this.playerName(
        next,
        chosenId,
      )} avec ${card.name}.`,
    );
    return next;
  }

  private applyCollapseEffect(
    state: GameStateEntity,
    cardId: string,
    playerId: number,
    played: boolean,
  ): GameStateEntity {
    let next = state;
    if (cardId === 'barbak-collapse-1') {
      next = this.applyMinorCollapse(next);
    } else if (cardId === 'barbak-collapse-2') {
      next = this.applyMajorCollapse(next);
    } else if (
      cardId === 'barbak-collapse-3' ||
      cardId === 'barbak-collapse-4'
    ) {
      next = this.finishGame(next);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} déclenche un effondrement final !`,
      );
    }
    if (played) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} joue l'effondrement ${cardId}.`,
      );
    }
    return next;
  }

  private applyMinorCollapse(state: GameStateEntity): GameStateEntity {
    let next = state;
    const players = Array.isArray(state.players) ? state.players : [];
    for (const player of players) {
      if (player?.id == null) continue;
      next = this.discardRandomFromHand(next, player.id, 1);
    }
    return this.core.appendLog(next, 'Un éboulement mineur secoue la mine !');
  }

  private applyMajorCollapse(state: GameStateEntity): GameStateEntity {
    let next = state;
    const players = Array.isArray(state.players) ? state.players : [];
    for (const player of players) {
      if (player?.id == null) continue;
      next = this.removeRandomTreasure(next, player.id, 2);
    }
    return this.core.appendLog(next, 'Un éboulement majeur fait voler les trésors !');
  }

  private discardRandomFromHand(
    state: GameStateEntity,
    playerId: number,
    count: number,
  ): GameStateEntity {
    let next = state;
    for (let i = 0; i < count; i += 1) {
      const meta = this.getMeta(next);
      const hand = Array.isArray(meta.hands?.[playerId])
        ? [...meta.hands[playerId]]
        : [];
      if (!hand.length) break;
      const { index, meta: updatedRng } = this.random.pickIndex(
        meta.rng ?? {},
        hand.length,
      );
      const cardId = hand.splice(index, 1)[0];
      next = this.setMeta(next, {
        ...meta,
        rng: updatedRng,
        hands: {
          ...(meta.hands ?? {}),
          [playerId]: hand,
        },
      });
      if (cardId) {
        next = this.addCardToDiscard(next, cardId);
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} défausse ${cardId}.`,
        );
      }
    }
    return next;
  }

  private removeRandomTreasure(
    state: GameStateEntity,
    playerId: number,
    count: number,
  ): GameStateEntity {
    let next = state;
    for (let i = 0; i < count; i += 1) {
      const meta = this.getMeta(next);
      const domain = (meta.domains ?? {})[playerId];
      const treasures = Array.isArray(domain?.treasures)
        ? [...domain!.treasures]
        : [];
      if (!treasures.length) break;
      const { index, meta: updatedRng } = this.random.pickIndex(
        meta.rng ?? {},
        treasures.length,
      );
      const [cardId] = treasures.splice(index, 1);
      next = this.setMeta(next, {
        ...meta,
        rng: updatedRng,
        domains: {
          ...(meta.domains ?? {}),
          [playerId]: {
            ...(meta.domains?.[playerId] ?? { treasures: [], objects: [] }),
            treasures,
          },
        },
      });
      if (cardId) {
        next = this.addCardToDiscard(next, cardId);
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} perd le trésor ${cardId}.`,
        );
      }
    }
    return next;
  }

  private removeRandomDomainCard(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const domain = (meta.domains ?? {})[playerId];
    const treasures = Array.isArray(domain?.treasures)
      ? [...domain!.treasures]
      : [];
    const objects = Array.isArray(domain?.objects)
      ? [...domain!.objects]
      : [];
    if (!treasures.length && !objects.length) {
      return this.discardRandomFromHand(state, playerId, 1);
    }
    const pool = [...treasures, ...objects];
    const { index, meta: updatedRng } = this.random.pickIndex(
      meta.rng ?? {},
      pool.length,
    );
    const cardId = pool[index];
    const newTreasures = treasures.filter((c) => c !== cardId);
    const newObjects = objects.filter((c) => c !== cardId);
    const next = this.setMeta(state, {
      ...meta,
      rng: updatedRng,
      domains: {
        ...(meta.domains ?? {}),
        [playerId]: {
          treasures: newTreasures,
          objects: newObjects,
        },
      },
    });
    if (cardId) {
      return this.addCardToDiscard(
        this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} perd ${cardId} face à une attaque.`,
        ),
        cardId,
      );
    }
    return next;
  }

  private trimHand(state: GameStateEntity, playerId: number): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const hand = Array.isArray(meta.hands?.[playerId])
      ? [...meta.hands[playerId]]
      : [];
    while (hand.length > 5) {
      const removed = hand.pop();
      if (!removed) break;
      next = this.addCardToDiscard(next, removed);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} réduit sa main et défausse ${removed}.`,
      );
      meta = this.getMeta(next);
    }
    next = this.setMeta(next, {
      ...meta,
      hands: {
        ...(meta.hands ?? {}),
        [playerId]: hand,
      },
    });
    return next;
  }

  private addCardToHand(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const hand = Array.isArray(meta.hands?.[playerId])
      ? [...meta.hands[playerId]]
      : [];
    hand.push(cardId);
    return this.setMeta(state, {
      ...meta,
      hands: {
        ...(meta.hands ?? {}),
        [playerId]: hand,
      },
    });
  }

  private removeCardFromHand(
    metadata: LaGrandeMineMetadata,
    playerId: number,
    cardId: string,
  ): LaGrandeMineMetadata {
    const hands = { ...(metadata.hands ?? {}) };
    const hand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
    const index = hand.indexOf(cardId);
    if (index >= 0) {
      hand.splice(index, 1);
    }
    hands[playerId] = hand;
    return { ...metadata, hands };
  }

  private addCardToDiscard(
    state: GameStateEntity,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const discard = [...(meta.discard ?? []), cardId];
    return this.setMeta(state, {
      ...meta,
      discard,
    });
  }

  private drawOneCard(
    meta: LaGrandeMineMetadata,
  ): { cardId: string | null; meta: LaGrandeMineMetadata } {
    const draw = this.deckPolicies.drawOne<string, LaGrandeMineMetadata>({
      meta,
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });
    return { cardId: draw.card, meta: draw.meta };
  }

  private finishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const winnerId = this.determineWinner(meta);
    const next = {
      ...state,
      status: 'finished',
      metadata: { ...meta, winnerId },
    };
    return this.core.appendLog(
      next,
      winnerId
        ? `${this.playerName(next, winnerId)} devient le Nain suprême !`
        : 'La mine s\'effondre et personne ne l\'emporte.',
    );
  }

  private determineWinner(meta: LaGrandeMineMetadata): number | null {
    let bestId: number | null = null;
    let bestScore = -Infinity;
    let tie = false;
    for (const [playerIdStr, domain] of Object.entries(meta.domains ?? {})) {
      const playerId = Number(playerIdStr);
      const value = this.scoreDomain(domain);
      if (value > bestScore) {
        bestScore = value;
        bestId = playerId;
        tie = false;
        continue;
      }
      if (value === bestScore) {
        tie = true;
      }
    }
    return tie ? null : bestId;
  }

  private scoreDomain(domain?: { treasures?: string[]; objects?: string[] }): number {
    if (!domain) return 0;
    let total = 0;
    for (const cardId of [...(domain.treasures ?? []), ...(domain.objects ?? [])]) {
      const definition = LA_GRANDE_MINE_CARD_BY_ID[cardId];
      total += definition?.points ?? 0;
    }
    return total;
  }

  private clearDrawn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, { ...meta, drawnPlayerId: null });
  }

  private getMeta(state: GameStateEntity): LaGrandeMineMetadata {
    return (state.metadata ?? {}) as LaGrandeMineMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: LaGrandeMineMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === playerId);
    return player?.username?.trim() || `Joueur ${playerId}`;
  }

  private availableOpponents(
    state: GameStateEntity,
    playerId: number,
  ): number[] {
    const players = Array.isArray(state.players) ? state.players : [];
    return players
      .filter((player) => player?.id != null && player.id !== playerId)
      .map((player) => player!.id!);
  }
}
