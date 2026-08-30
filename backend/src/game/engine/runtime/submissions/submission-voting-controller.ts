import {
  GameRuleViolationError,
  GameStateViolationError,
} from '../../../core/domain/errors/game-domain.errors';
import { sameSerializableValue } from '../state/serializable-value';
import { GameSubmissionController } from './submission-controller';

export class GameVotingController extends GameSubmissionController {
  open(options: {
    id: string;
    players?: readonly number[];
    choices?: readonly unknown[];
    secret?: boolean;
  }): void {
    if (!options.choices || options.choices.length === 0) {
      throw new GameStateViolationError('Un vote requiert des choix', {
        sessionId: options.id,
      });
    }
    this.createSession('vote', options, options.choices);
  }

  vote<TValue>(id: string, playerId: number, value: TValue): void {
    const session = this.requireOpen(id, 'vote', playerId);
    if (
      !session.allowedValues?.some((candidate) =>
        sameSerializableValue(candidate, value),
      )
    ) {
      throw new GameRuleViolationError('VOTE_VALUE_NOT_ALLOWED', {
        id,
        playerId,
      });
    }
    session.valuesByPlayerId[String(playerId)] = structuredClone(value);
    this.emit(
      'vote.received',
      { sessionId: id, playerId },
      session.secret
        ? {
            kind: 'split',
            privateDataByPlayer: {
              [String(playerId)]: { value: structuredClone(value) },
            },
          }
        : { kind: 'public' },
    );
    this.closeWhenComplete(session);
  }

  tally(id: string): Array<{ value: unknown; votes: number }> {
    const session = this.require(id);
    if (session.kind !== 'vote' || !session.closed) {
      throw new GameStateViolationError('Vote encore ouvert', {
        sessionId: id,
      });
    }
    const results: Array<{ value: unknown; votes: number }> = [];
    for (const value of Object.values(session.valuesByPlayerId)) {
      const existing = results.find((candidate) =>
        sameSerializableValue(candidate.value, value),
      );
      if (existing) existing.votes += 1;
      else results.push({ value: structuredClone(value), votes: 1 });
    }
    return results.sort((left, right) => right.votes - left.votes);
  }
}
