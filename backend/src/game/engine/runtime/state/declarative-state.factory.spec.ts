import { createDeclarativeState } from './declarative-state.factory';
import type { GameState } from '../../../core/application/models/game-state.model';

it('isolates nested base state, turn and kit collections between two rooms', () => {
  const base: GameState = {
    status: 'started',
    phase: 'playing',
    log: [],
    players: [{ id: 1, username: 'One' }],
    metadata: { roomRunId: 1 },
  };
  const turn: NonNullable<GameState['turn']> = {
    currentPlayerId: 1,
    skippedPlayerIds: [2],
    direction: 1,
  };
  const create = () =>
    createDeclarativeState(
      base,
      'playing',
      turn,
      { nowMs: () => 10, nowIso: () => new Date(10).toISOString() },
      1,
      'content',
      'rules',
      undefined,
    );
  const first = create();
  const second = create();
  const original = structuredClone(second);
  first.players![0].username = 'Changed';
  first.turn!.skippedPlayerIds!.push(3);
  first.metadata!.roomRunId = 2;
  first.engine.commands.receipts.push({
    commandId: 'first-only',
    actorId: 1,
    actionType: 'pass',
    acceptedAtMs: 10,
    resultVersion: 1,
  });
  expect(first.engine.kits).not.toBe(second.engine.kits);
  expect(second).toEqual(original);
  expect(base.players![0].username).toBe('One');
  expect(turn.skippedPlayerIds).toEqual([2]);
  expect(base.metadata!.roomRunId).toBe(1);
});
