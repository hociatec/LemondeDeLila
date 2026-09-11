import {
  createSubmissionKitState,
  GameSubmissionController,
} from './submission-controller';
import { GameJudgeController } from './submission-judge-controller';
import { GameTurnController } from '../lifecycle/game-turn-controller';
import { simultaneous } from '../kits/turn-kit';
import { createPlayerValuesKitState } from '../kits/player-values-kit';
import type { TurnRuntimeState } from '../contracts/turn-runtime-state';

const players = [
  { id: 1, username: 'one' },
  { id: -2, username: 'bot', isBot: true },
  { id: 3, username: 'three' },
];

it('rejects a duplicate pending player instead of dropping an unanswered participant', () => {
  const state = createSubmissionKitState<number>();
  const emit = jest.fn();
  const submissions = new GameSubmissionController(state, players, emit);
  submissions.open({ id: 'answers' });
  submissions.submit('answers', 1, 10);
  const before = structuredClone(state);
  emit.mockClear();
  expect(() => submissions.reorderPending('answers', [-2, -2])).toThrow();
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
  submissions.reorderPending('answers', [3, -2]);
  expect(submissions.pendingPlayers('answers')).toEqual([3, -2]);
  submissions.submit('answers', 3, 30);
  expect(submissions.isComplete('answers')).toBe(false);
  submissions.submit('answers', -2, 20);
  expect(submissions.isComplete('answers')).toBe(true);
  submissions.replace('answers', -2, 21);
  expect(submissions.values('answers')['-2']).toBe(21);
  expect(
    emit.mock.calls.filter(([type]) => type === 'submission.closed'),
  ).toHaveLength(1);
});

it('rejects an unknown starting judge without replacing an existing rotation', () => {
  const state = createSubmissionKitState();
  const emit = jest.fn();
  const judge = new GameJudgeController(state, players, emit);
  judge.start('jury', { starterPlayerId: -2 });
  const before = structuredClone(state);
  emit.mockClear();
  expect(() => judge.start('jury', { starterPlayerId: 99 })).toThrow();
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
  expect(judge.current('jury')).toBe(-2);
  expect(judge.next('jury')).toBe(3);
  expect(judge.next('jury')).toBe(1);
});

it('completes a simultaneous wait once and rejects a different session', () => {
  const state = createSubmissionKitState();
  const submissions = new GameSubmissionController(state, players, jest.fn());
  submissions.open({ id: 'answers' });
  submissions.open({ id: 'other' });
  const runtime: TurnRuntimeState<object> = {
    players,
    game: {},
    turn: simultaneous().initialize(players),
    engine: {
      playerValues: createPlayerValuesKitState(),
      match: { status: 'playing' },
    },
  };
  const engine = jest.fn();
  const turn = new GameTurnController(
    runtime,
    simultaneous(),
    {},
    () =>
      ({
        submissions,
        events: { engine },
        reject: (code: string) => {
          throw new Error(code);
        },
      }) as never,
  );
  turn.api.waitForAll('answers');
  expect(turn.api.completeWaiting('answers')).toBe(false);
  expect(() => turn.api.completeWaiting('other')).toThrow(
    'SIMULTANEOUS_SESSION_MISMATCH',
  );
  for (const player of players)
    submissions.submit('answers', player.id, player.id);
  const number = turn.api.number();
  expect(turn.api.completeWaiting('answers')).toBe(true);
  expect(turn.api.number()).toBe(number + 1);
  expect(turn.api.completeWaiting('answers')).toBe(false);
  expect(turn.api.number()).toBe(number + 1);
  expect(
    engine.mock.calls.filter(
      ([type]) => type === 'turn.simultaneous.completed',
    ),
  ).toHaveLength(1);
});
