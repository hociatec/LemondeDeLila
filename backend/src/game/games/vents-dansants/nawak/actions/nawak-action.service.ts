import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { NawakChallengeService } from '../data/nawak-challenge.service';
import type {
  NawakMetadata,
  NawakRoundSummary,
} from '../model/nawak-state.entity';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType } from '../../../../actions/action-service.helper';



type NawakActionPayload = {
  answerIndex?: number | null;
  targetPlayerId?: number | null;
};

@Injectable()
export class NawakActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly challengeService: NawakChallengeService,
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
          choose_answer: () => this.handleChooseAnswer(next, action),
          vote_answer: () => this.handleVoteAnswer(next, action),
        },
        () => next,
      );
    });
  }

  private handleChooseAnswer(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) {
      return state;
    }
    let meta = this.getMeta(state);
    if (meta.roundStage !== 'choose' || !meta.currentChallenge) {
      return state;
    }
    const payload = (action.payload ?? {}) as NawakActionPayload;
    const answerIndex = typeof payload.answerIndex === 'number' ? payload.answerIndex : null;
    if (answerIndex == null || answerIndex < 0 || answerIndex >= 3) {
      return state;
    }
    const submissions = { ...(meta.submissions ?? {}) };
    if (submissions[currentId] != null) {
      return state;
    }
    submissions[currentId] = answerIndex;
    meta = { ...meta, submissions };

    let next = this.setMeta(state, meta);
    const answerLabel = meta.currentChallenge.answers?.[answerIndex] ?? 'réponse inconnue';
    next = this.core.appendLog(
      next,
      `${this.playerName(state.players, currentId)} choisit "${answerLabel}".`,
    );

    const playerIds = this.getPlayerIds(state.players);
    const allChosen = playerIds.every((pid) => submissions[pid] != null);
    if (allChosen) {
      meta = this.getMeta(next);
      const updatedMeta: NawakMetadata = {
        ...meta,
        roundStage: 'vote',
        votes: {},
      };
      next = this.setMeta(next, updatedMeta);
      next = this.core.appendLog(next, 'Tous les choix sont faits : votez maintenant pour une réponse étrangère !');
    }

    return this.turns.advanceTurn(next);
  }

  private handleVoteAnswer(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) {
      return state;
    }
    let meta = this.getMeta(state);
    if (meta.roundStage !== 'vote') {
      return state;
    }
    const payload = (action.payload ?? {}) as NawakActionPayload;
    const targetPlayerId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
    if (targetPlayerId == null || targetPlayerId === currentId) {
      return state;
    }
    if (!this.getPlayerIds(state.players).includes(targetPlayerId)) {
      return state;
    }
    const submissions = meta.submissions ?? {};
    if (!Object.prototype.hasOwnProperty.call(submissions, targetPlayerId)) {
      return state;
    }
    const votes = { ...(meta.votes ?? {}) };
    if (votes[currentId] != null) {
      return state;
    }
    votes[currentId] = targetPlayerId;
    meta = { ...meta, votes };

    let next = this.setMeta(state, meta);
    next = this.core.appendLog(
      next,
      `${this.playerName(state.players, currentId)} vote pour ${this.playerName(
        state.players,
        targetPlayerId,
      )}.`,
    );

    const playerIds = this.getPlayerIds(state.players);
    if (Object.keys(votes).length >= playerIds.length) {
      return this.finishVoting(next, playerIds, votes);
    }

    return this.turns.advanceTurn(next);
  }

  private finishVoting(
    state: GameStateEntity,
    playerIds: number[],
    votes: Record<number, number>,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const challenge = meta.currentChallenge;
    const scores = { ...(meta.scores ?? {}) };
    const pointsAwarded: Record<number, number> = {};
    Object.values(votes).forEach((target) => {
      scores[target] = (scores[target] ?? 0) + 1;
      pointsAwarded[target] = (pointsAwarded[target] ?? 0) + 1;
    });

    const targetScore = meta.targetScore ?? 5;
    const qualified = playerIds.filter((pid) => (scores[pid] ?? 0) >= targetScore);
    const tie = qualified.length > 1;
    const winnerId = !tie && qualified.length === 1 ? qualified[0] : null;

    const summary: NawakRoundSummary = {
      challengeId: challenge?.id ?? 'unknown',
      prompt: challenge?.prompt ?? '',
      submissions: { ...(meta.submissions ?? {}) },
      votes: { ...votes },
      pointsAwarded,
      tie,
    };

    let nextMeta: NawakMetadata = {
      ...meta,
      scores,
      votes: {},
      submissions: {},
      roundStage: 'choose',
      lastRound: summary,
      winnerId,
    };

    const { challenge: nextChallenge, meta: withChallenge } =
      this.challengeService.loadChallenge(nextMeta);
    nextMeta = {
      ...withChallenge,
      targetScore,
      scores,
      roundStage: 'choose',
      submissions: {},
      votes: {},
      lastRound: summary,
      currentChallenge: nextChallenge,
      winnerId,
    };

    let next = this.setMeta(state, nextMeta);
    next = this.core.appendLog(next, 'Fin du vote : ouverture des scores !');
    const scoreboard = playerIds
      .map(
        (pid) =>
          `${this.playerName(state.players, pid)} ${(scores[pid] ?? 0)} pts`,
      )
      .join(' / ');
    next = this.core.appendLog(next, `Scores : ${scoreboard}`);

    if (winnerId != null && !tie) {
      next = this.core.appendLog(
        next,
        `${this.playerName(state.players, winnerId)} atteint ${
          scores[winnerId] ?? 0
        } points !`,
      );
      return {
        ...next,
        status: 'finished',
      };
    }

    if (tie) {
      next = this.core.appendLog(next, 'Égalité détectée : un nouveau défi va départager les joueurs.');
    }

    return this.turns.advanceTurn(next);
  }

  private getMeta(state: GameStateEntity): NawakMetadata {
    return (state.metadata ?? {}) as NawakMetadata;
  }

  private setMeta(state: GameStateEntity, metadata: NawakMetadata): GameStateEntity {
    return { ...state, metadata };
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


