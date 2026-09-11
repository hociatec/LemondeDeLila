import type { PendingState } from '../../../core/application/models/game-state.model';
import { GameChoiceController } from './game-choice-controller';
import { MAX_GAME_TIMESTAMP_MS } from '../automation/game-deadline';

function fixture(now = 100) {
  let pending: PendingState | null = null;
  const setPending = jest.fn((value: PendingState | null) => {
    pending = value;
  });
  return {
    setPending,
    controller: new GameChoiceController(
      () => pending,
      setPending,
      () => now,
    ),
  };
}

it.each([
  { min: NaN, max: 3 },
  { min: 0, max: Infinity },
  { min: 0, max: 3, step: NaN },
  { min: 0, max: 3, step: -1 },
  { min: 0, max: 3, step: 0.5 },
  {
    min: -Number.MAX_SAFE_INTEGER,
    max: Number.MAX_SAFE_INTEGER,
    step: Number.MAX_SAFE_INTEGER,
  },
])('rejects invalid numeric ranges before publishing a choice: %j', (range) => {
  const { controller, setPending } = fixture();
  expect(() =>
    controller.number({ id: 'amount', player: 1, ...range }),
  ).toThrow();
  expect(setPending).not.toHaveBeenCalled();
});

it.each([-Infinity, NaN, -1, 0.5])(
  'rejects invalid choice duration: %s',
  (afterMs) => {
    const { controller, setPending } = fixture();
    expect(() =>
      controller.one({
        id: 'pick',
        player: 1,
        options: ['a'],
        timeout: { afterMs },
      }),
    ).toThrow();
    expect(setPending).not.toHaveBeenCalled();
  },
);

it('rejects a deadline overflow before publishing a choice', () => {
  const { controller, setPending } = fixture(MAX_GAME_TIMESTAMP_MS);
  expect(() =>
    controller.confirm({ id: 'ok', player: 1, timeout: { afterMs: 1 } }),
  ).toThrow();
  expect(setPending).not.toHaveBeenCalled();
});

it.each([
  { min: -1, max: 1 },
  { min: 0, max: 2 },
  { min: 0.5, max: 1 },
  { min: 1, max: NaN },
])('rejects invalid selection counts before publishing: %j', (bounds) => {
  const { controller, setPending } = fixture();
  expect(() =>
    controller.many({ id: 'pick', player: 1, options: ['a'], ...bounds }),
  ).toThrow();
  expect(setPending).not.toHaveBeenCalled();
});

it('keeps valid negative numeric choices and exact deadlines', () => {
  const { controller } = fixture();
  controller.number({
    id: 'amount',
    player: 1,
    min: -3,
    max: 3,
    step: 2,
    timeout: { afterMs: 0 },
  });
  expect(controller.current()?.data).toMatchObject({
    options: [-3, -1, 1, 3],
    deadlineMs: 100,
  });
});
