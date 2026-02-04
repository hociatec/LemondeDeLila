import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import {
  CAT_PATTES_CARD_BY_ID,
  CatPattesCardDefinition,
} from '../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import { CAT_PATTES_GOAL } from '../model/cat-pattes-state.entity';
import {
  CAT_PATTES_OBSTACLE_TO_PARADE,
  canPlayPattes,
  playerCanReceiveObstacle,
} from '../rulebook/rulebook';

type CatPattesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
};

@Injectable()
export class CatPattesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
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
        next = this.handlePass(next, action);
        continue;
      }
    }
    return next;
  }

  private handlePass(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.ensurePlayerDrawn(state, currentId);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} passe son tour.`,
    );
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
    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return next;

    const definition = CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) return next;

    const meta = this.getMeta(next);
    const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
    if (!hand.includes(cardId)) return next;

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    next = this.setMeta(next, updatedMeta);

    if (definition.type === 'pattes') {
      next = this.playPattes(next, currentId, definition);
    } else if (definition.type === 'obstacle') {
      const targetId =
        typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
      if (targetId != null) {
        next = this.playObstacle(next, currentId, targetId, definition);
      }
    } else if (definition.type === 'parade') {
      next = this.playParade(next, currentId, definition);
    } else if (definition.type === 'bot') {
      next = this.playBot(next, currentId, definition);
    }

    if (this.getMeta(next).winnerId != null) {
      return next;
    }

    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private playPattes(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const positions = { ...(meta.positions ?? {}) };
    const previous = positions[playerId] ?? 0;
    const delta = card.value ?? 0;
    const nextPosition = previous + delta;
    positions[playerId] = nextPosition;

    let next = this.setMeta(state, {
      ...meta,
      positions,
    });

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} joue ${card.name} et avance de ${delta} pattes (total ${nextPosition}).`,
    );

    if (nextPosition >= CAT_PATTES_GOAL) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} atteint ${CAT_PATTES_GOAL} pattes et remporte la course !`,
      );
      const metaAfter = this.getMeta(next);
      return {
        ...next,
        status: 'finished',
        metadata: {
          ...metaAfter,
          winnerId: playerId,
        },
      };
    }

    return next;
  }

  private playObstacle(
    state: GameStateEntity,
    playerId: number,
    targetId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const obstacle = card.obstacle;
    if (!obstacle) return state;

    const meta = this.getMeta(state);
    if (!playerCanReceiveObstacle(meta, targetId, obstacle)) {
      return state;
    }

    const obstacles = { ...(meta.obstacles ?? {}) };
    obstacles[targetId] = obstacle;
    let next = this.setMeta(state, { ...meta, obstacles });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} inflige ${card.name} à ${this.playerName(next, targetId)}.`,
    );
    return next;
  }

  private playParade(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const obstacles = { ...(meta.obstacles ?? {}) };
    const currentObstacle = obstacles[playerId] ?? null;
    if (
      currentObstacle &&
      card.parade &&
      CAT_PATTES_OBSTACLE_TO_PARADE[currentObstacle] === card.parade
    ) {
      obstacles[playerId] = null;
      meta = { ...meta, obstacles };
      next = this.setMeta(next, meta);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} neutralise ${currentObstacle} avec ${card.name}.`,
      );
      meta = this.getMeta(next);
    }

    if (card.parade === 'rayon') {
      const hasSun = { ...(meta.hasSun ?? {}) };
      hasSun[playerId] = true;
      meta = { ...meta, hasSun };
      next = this.setMeta(next, meta);
    }

    return next;
  }

  private playBot(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const bot = card.bot;
    if (!bot) return state;
    const meta = this.getMeta(state);
    const bots = { ...(meta.bots ?? {}) };
    const playerBots = [...(bots[playerId] ?? [])];
    if (!playerBots.includes(bot)) {
      playerBots.push(bot);
    }
    bots[playerId] = playerBots;
    let next = this.setMeta(state, { ...meta, bots });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} active ${card.name}.`,
    );
    return next;
  }

  private ensurePlayerDrawn(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.drawnPlayerId === playerId) return state;
    const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, playerId);
    const next = this.setMeta(state, { ...updatedMeta, drawnPlayerId: playerId });
    if (cardId) {
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} pioche ${CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
      );
    }
    return next;
  }

  private clearDrawn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, { ...meta, drawnPlayerId: null });
  }

  private drawForPlayer(
    meta: CatPattesMetadata,
    playerId: number,
  ): { meta: CatPattesMetadata; cardId: string | null } {
    const { cardId, meta: withCard } = this.drawOneCard(meta);
    if (!cardId) {
      return { meta: withCard, cardId: null };
    }
    const hands = { ...(withCard.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    playerHand.push(cardId);
    hands[playerId] = playerHand;
    return {
      meta: {
        ...withCard,
        hands,
      },
      cardId,
    };
  }

  private drawOneCard(meta: CatPattesMetadata): {
    meta: CatPattesMetadata;
    cardId: string | null;
  } {
    let { deck, discard, rng } = meta;
    const safeDeck = Array.isArray(deck) ? [...deck] : [];
    const safeDiscard = Array.isArray(discard) ? [...discard] : [];
    let currentMeta = { ...meta, deck: safeDeck, discard: safeDiscard };
    if (safeDeck.length === 0 && safeDiscard.length > 0) {
      const { values, meta: shuffledMeta } = this.random.shuffle(rng ?? {}, safeDiscard);
      currentMeta = {
        ...currentMeta,
        deck: values,
        discard: [],
        rng: shuffledMeta,
      };
      rng = shuffledMeta;
    }
    const nextDeck = currentMeta.deck ?? [];
    if (!nextDeck.length) {
      return { meta: currentMeta, cardId: null };
    }
    const [cardId, ...rest] = nextDeck;
    return {
      cardId,
      meta: { ...currentMeta, deck: rest },
    };
  }

  private removeCardFromHand(
    meta: CatPattesMetadata,
    playerId: number,
    cardId: string,
  ): CatPattesMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
    const index = playerHand.indexOf(cardId);
    if (index >= 0) {
      playerHand.splice(index, 1);
    }
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private addCardToDiscard(
    meta: CatPattesMetadata,
    cardId: string,
  ): CatPattesMetadata {
    const discard = [...(meta.discard ?? []), cardId];
    return { ...meta, discard };
  }

  private getMeta(state: GameStateEntity): CatPattesMetadata {
    return (state.metadata ?? {}) as CatPattesMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: CatPattesMetadata,
  ): GameStateEntity {
    return { ...state, metadata: metadata };
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((player) => player?.id === playerId);
    return p?.username?.trim() || `Joueur ${playerId}`;
  }
}
