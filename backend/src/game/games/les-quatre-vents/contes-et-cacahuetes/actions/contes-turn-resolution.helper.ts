import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { TurnFlowService } from '../../../../application/services/turn-flow.service';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type { ContesCacahuetesMetadata } from '../model/contes-et-cacahuetes-state.model';

export function applyContesTurnSwapIfNeeded(input: {
  state: GameStateEntity;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const current = input.state.turn?.currentPlayerId ?? null;
  if (current == null) return input.state;
  const swapWith = Number(meta.statuses.turnSwapWith?.[current] ?? 0);
  const remaining = Number(meta.statuses.turnSwapRemaining?.[current] ?? 0);
  if (!swapWith || remaining <= 0) return input.state;

  let next = input.setStatusCount(
    input.state,
    'turnSwapRemaining',
    current,
    remaining - 1,
  );
  next = input.setStatusCount(next, 'turnSwapPlayingSlot', swapWith, current);
  next = {
    ...next,
    turn: { ...(next.turn ?? { direction: 1 }), currentPlayerId: swapWith },
  };

  const remA = Number(
    input.getMeta(next).statuses.turnSwapRemaining?.[current] ?? 0,
  );
  const remB = Number(
    input.getMeta(next).statuses.turnSwapRemaining?.[swapWith] ?? 0,
  );
  if (remA <= 0 && remB <= 0) {
    next = input.setStatusCount(next, 'turnSwapWith', current, 0);
    next = input.setStatusCount(next, 'turnSwapWith', swapWith, 0);
  }
  return next;
}

export function restoreContesTurnSwapSlotBeforeAdvance(input: {
  state: GameStateEntity;
  playerId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const slotOwner = Number(
    input.getMeta(input.state).statuses.turnSwapPlayingSlot?.[input.playerId] ?? 0,
  );
  if (!Number.isFinite(slotOwner) || slotOwner <= 0) return input.state;
  const next = input.setStatusCount(
    input.state,
    'turnSwapPlayingSlot',
    input.playerId,
    0,
  );
  return {
    ...next,
    turn: {
      ...(next.turn ?? { direction: 1 }),
      currentPlayerId: slotOwner,
    },
  };
}

export function endContesTurn(input: {
  state: GameStateEntity;
  playerId: number;
  decrementPerTurn: (
    state: GameStateEntity,
    playerId: number,
    key: keyof ContesCacahuetesMetadata['statuses'],
  ) => GameStateEntity;
  restoreTurnSwapSlotBeforeAdvance: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  turns: TurnFlowService;
  applyTurnSwapIfNeeded: (state: GameStateEntity) => GameStateEntity;
  appendTurnAnnouncement: (
    state: GameStateEntity,
    playerId: number | null | undefined,
  ) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  next = input.decrementPerTurn(next, input.playerId, 'noBonusCardsTurns');
  next = input.restoreTurnSwapSlotBeforeAdvance(next, input.playerId);
  const advanced = input.turns.advanceTurn(next);
  const swapped = input.applyTurnSwapIfNeeded(advanced);
  return input.appendTurnAnnouncement(swapped, swapped.turn?.currentPlayerId);
}

export function autoSkipContesBlockedPlayer(input: {
  state: GameStateEntity;
  currentId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  turns: TurnFlowService;
  applyTurnSwapIfNeeded: (state: GameStateEntity) => GameStateEntity;
  appendTurnAnnouncement: (
    state: GameStateEntity,
    playerId: number | null | undefined,
  ) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const blocked = meta.statuses.blockedUntilPassed?.[input.currentId];
  if (typeof blocked !== 'number') return input.state;
  const msg = `${resolvePlayerNameFromState(input.state, input.currentId)} est bloqué(e) (Loup dans la forêt) : tour passé.`;
  const logged = input.appendLog(input.state, msg);
  const advanced = input.turns.advanceTurn(logged);
  const swapped = input.applyTurnSwapIfNeeded(advanced);
  return input.appendTurnAnnouncement(swapped, swapped.turn?.currentPlayerId);
}





