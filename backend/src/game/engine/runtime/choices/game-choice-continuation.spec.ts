import type { PendingState } from '../../../core/application/models/game-state.model';
import { GameChoiceController } from './game-choice-controller';

function fixture() {
  let pending: PendingState | null = null;
  return new GameChoiceController(
    () => pending,
    (value) => {
      pending = value;
    },
    () => 100,
  );
}

it('preserves author data without overwriting engine choice metadata', () => {
  const choice = fixture();
  const data = {
    kind: 'next-delta',
    options: ['private'],
    deadlineMs: -1,
    actorId: 2,
  };
  choice.one({
    id: 'delta',
    player: 2,
    options: [1, -1],
    data,
    timeout: { afterMs: 20 },
  });
  data.kind = 'mutated';
  expect(choice.current()?.data).toMatchObject({
    kind: 'one',
    options: [1, -1],
    deadlineMs: 120,
  });
  choice.resolvePlayer(2);
  expect(choice.consumeContinuation()).toEqual({
    kind: 'next-delta',
    options: ['private'],
    deadlineMs: -1,
    actorId: 2,
  });
  expect(choice.consumeContinuation()).toBeNull();
});

it('returns the resolved continuation when the next queued choice is already active', () => {
  const choice = fixture();
  choice.sequence({
    id: 'sequence',
    players: [1, 2],
    options: ['a'],
    data: { source: 'resolved' },
  });
  const next = choice.current()?.queue?.[0];
  expect(next).toBeDefined();
  next!.data = { ...next!.data, continuationData: { source: 'next' } };
  choice.resolvePlayer(1);
  expect(choice.current()?.playerId).toBe(2);
  expect(choice.consumeContinuation()).toEqual({ source: 'resolved' });
  expect(choice.continuation()).toEqual({ source: 'next' });
});

it('still reads non-conflicting continuation fields from an older flat snapshot', () => {
  let pending: PendingState | null = {
    type: 'engine.choice.one',
    playerId: 1,
    data: {
      kind: 'one',
      choiceId: 'legacy',
      options: ['a'],
      actorId: 1,
      source: 'legacy-source',
    },
  };
  const choice = new GameChoiceController(
    () => pending,
    (value) => {
      pending = value;
    },
    () => 100,
  );
  choice.resolvePlayer(1);
  expect(choice.consumeContinuation()).toMatchObject({
    source: 'legacy-source',
    actorId: 1,
  });
});
