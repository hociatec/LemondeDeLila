import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type { AbsurdissimesMetadata } from '../model/les-absurdissimes-state.entity';

import { applyActionsSequentially, dispatchByActionType, normalizeActionType } from '../../../../actions/action-service.helper';
type AbsurdissimesActionPayload = {
  cardId?: string | null;
  winnerId?: number | null;
};

@Injectable()
export class AbsurdissimesActionService {
  constructor(
    private readonly core: GameCoreService,
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
          play_card: () => this.handlePlayCard(next, action),
          judge_pick: () => this.handleJudgePick(next, action),
        },
        () => next,
      );
    });
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (currentPlayerId == null) return state;
    let meta = this.getMeta(state);
    if (meta.roundStage !== 'play') return state;
    const payload = (action.payload ?? {}) as AbsurdissimesActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return state;
    const judgeId = this.getJudgeId(state, meta);
    if (judgeId === currentPlayerId) return state;
    const hand = Array.isArray(meta.blackHands?.[currentPlayerId])
      ? [...meta.blackHands[currentPlayerId]]
      : [];
    const cardIndex = hand.indexOf(cardId);
    if (cardIndex < 0) return state;
    hand.splice(cardIndex, 1);
    const submissions = {
      ...meta.submissions,
      [currentPlayerId]: cardId,
    };
    meta = {
      ...meta,
      blackHands: { ...meta.blackHands, [currentPlayerId]: hand },
      submissions,
      discardBlack: [...(meta.discardBlack ?? []), cardId],
    };

    const drawResult = this.drawBlackCard(meta, currentPlayerId);
    meta = drawResult.meta;

    const remainingPlayers = (meta.remainingPlayers ?? []).filter(
      (pid) => pid !== currentPlayerId,
    );
    meta = { ...meta, remainingPlayers };

    let next = this.setMeta(state, meta);
    next = this.core.appendLog(
      next,
      `${this.playerName(next.players, currentPlayerId)} propose ${cardId}.`,
    );

    if (!remainingPlayers.length) {
      meta = { ...meta, roundStage: 'judge' };
      next = this.setMeta(next, meta);
      const judgeTurn = this.getJudgeId(next, meta);
      next = { ...next, turn: { currentPlayerId: judgeTurn, direction: 1 } };
      next = this.core.appendLog(next, 'Les cartes sont prêtes : le juge choisit la proposition gagnante.');
      return next;
    }

    next = { ...next, turn: { currentPlayerId: remainingPlayers[0], direction: 1 } };
    return next;
  }

  private handleJudgePick(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (currentPlayerId == null) return state;
    let meta = this.getMeta(state);
    if (meta.roundStage !== 'judge') return state;
    const judgeId = this.getJudgeId(state, meta);
    if (judgeId !== currentPlayerId) return state;
    const payload = (action.payload ?? {}) as AbsurdissimesActionPayload;
    const winnerId = typeof payload.winnerId === 'number' ? payload.winnerId : null;
    if (winnerId == null) return state;
    if (!Object.prototype.hasOwnProperty.call(meta.submissions, winnerId)) return state;

    const scores = { ...meta.scores };
    scores[winnerId] = (scores[winnerId] ?? 0) + 1;
    meta = { ...meta, scores };
    let next = this.core.appendLog(
      state,
      `${this.playerName(state.players, winnerId)} remporte la manche avec la réponse ${meta.submissions[winnerId] ?? ''}.`,
    );

    const target = meta.targetScore;
    const hasWinner = scores[winnerId] >= target;
    meta = {
      ...meta,
      discardWhite: [...(meta.discardWhite ?? []), meta.currentWhite ?? ''],
      submissions: {},
      winnerId: hasWinner ? winnerId : null,
    };

    if (hasWinner) {
      next = this.setMeta({ ...next, status: 'finished' }, meta);
      next = this.core.appendLog(next, `${this.playerName(next.players, winnerId)} atteint ${target} points !`);
      return next;
    }

    const prepared = this.prepareNextRound(next, meta);
    return prepared;
  }

  private prepareNextRound(
    state: GameStateEntity,
    meta: AbsurdissimesMetadata,
  ): GameStateEntity {
    const players = this.getPlayerIds(state.players);
    if (!players.length) return state;
    const nextJudgeIndex = (meta.judgeIndex + 1) % players.length;
    const judgeId = players[nextJudgeIndex];
    const whiteResult = this.drawWhiteCard(meta);
    meta = {
      ...whiteResult.meta,
      judgeIndex: nextJudgeIndex,
      roundStage: 'play',
      submissions: {},
      currentWhite: whiteResult.card,
      remainingPlayers: players.filter((pid) => pid !== judgeId),
    };
    const nextPlayer = meta.remainingPlayers[0] ?? judgeId;
    const nextState = this.setMeta({ ...state, turn: { currentPlayerId: nextPlayer, direction: 1 } }, meta);
    nextState.log = [...nextState.log];
    return this.core.appendLog(
      nextState,
      `Nouvelle manche : ${this.playerName(nextState.players, judgeId)} est juge.`,
    );
  }

  private drawBlackCard(
    meta: AbsurdissimesMetadata,
    playerId: number,
  ): { cardId: string | null; meta: AbsurdissimesMetadata } {
    const draw = this.deckPolicies.drawOne<string, AbsurdissimesMetadata>({
      meta,
      deckKey: 'blackDeck',
      discardKey: 'discardBlack',
      rngKey: 'rng',
    });
    const cardId = draw.card;
    const hands = { ...draw.meta.blackHands };
    if (cardId) {
      const hand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
      hand.push(cardId);
      hands[playerId] = hand;
    }
    return {
      cardId,
      meta: {
        ...draw.meta,
        blackHands: hands,
      },
    };
  }

  private drawWhiteCard(meta: AbsurdissimesMetadata): { card: string | null; meta: AbsurdissimesMetadata } {
    const draw = this.deckPolicies.drawOne<string, AbsurdissimesMetadata>({
      meta,
      deckKey: 'whiteDeck',
      discardKey: 'discardWhite',
      rngKey: 'rng',
    });
    return {
      card: draw.card,
      meta: {
        ...draw.meta,
      },
    };
  }

  private getJudgeId(state: GameStateEntity, meta: AbsurdissimesMetadata): number | null {
    const players = this.getPlayerIds(state.players);
    if (!players.length) return null;
    const index = meta.judgeIndex % players.length;
    return players[index] ?? players[0] ?? null;
  }

  private setMeta(state: GameStateEntity, metadata: AbsurdissimesMetadata): GameStateEntity {
    return { ...state, metadata };
  }

  private getMeta(state: GameStateEntity): AbsurdissimesMetadata {
    return (state.metadata ?? {}) as AbsurdissimesMetadata;
  }

  private getPlayerIds(players?: GameStateEntity['players']): number[] {
    return (Array.isArray(players) ? players : [])
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player!.id);
  }

  private playerName(players: GameStateEntity['players'], playerId: number): string {
    const list = Array.isArray(players) ? players : [];
    const player = list.find((p) => p?.id === playerId);
    return player?.username?.trim() || `Joueur ${playerId}`;
  }
}
