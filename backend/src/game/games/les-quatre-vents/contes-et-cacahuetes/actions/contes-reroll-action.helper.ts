import type { GameStateEntity } from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type {
  ContesCacahuetesMetadata,
  ContesPending,
} from '../model/contes-et-cacahuetes-state.model';

export function applyContesRerollDecision(input: {
  state: GameStateEntity;
  reroll: boolean;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  rollDice: (
    meta: ContesCacahuetesMetadata,
    sides: number,
  ) => { roll: number; meta: ContesCacahuetesMetadata };
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  applyMoveFromRoll: (
    state: GameStateEntity,
    playerId: number,
    roll: number,
    bonus: number,
  ) => GameStateEntity;
  endTurn: (state: GameStateEntity, playerId: number) => GameStateEntity;
}): GameStateEntity {
  const pending = input.state.pending as ContesPending;
  if (!pending || pending.type !== 'reroll') return input.state;

  const playerId = pending.playerId;
  let next: GameStateEntity = { ...input.state, pending: null };

  if (input.reroll) {
    const out = input.rollDice(input.getMeta(next), 6);
    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...out.meta },
      lastRoll: out.roll,
    };
    next = input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} relance le dé : "${out.roll}".`,
    );
    next = input.applyMoveFromRoll(next, playerId, out.roll, 0);
  } else {
    const roll = Number(pending.data.baseRoll);
    next = { ...next, lastRoll: roll };
    next = input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} garde le résultat "${roll}".`,
    );
    next = input.applyMoveFromRoll(next, playerId, roll, 0);
  }

  if (String(next.status ?? '').toLowerCase() === 'finished') return next;
  if (next.pending) return next;
  return input.endTurn(next, playerId);
}




