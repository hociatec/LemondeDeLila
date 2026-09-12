import {
  createDiceKitState,
  diceKit,
  GameDiceController,
  type DiceRollPolicy,
} from './dice-kit';
import { assertValidEngineKits } from '../state/game-session-contracts';

function fixture() {
  const definition = diceKit({ count: 2, sides: 6 });
  const state = createDiceKitState();
  const random = {
    next: () => 0.5,
    int: (maximum: number) => Math.floor(maximum / 2),
    pick: <T>(values: readonly T[]) => values[0] ?? null,
    shuffle: <T>(values: readonly T[]) => [...values],
  };
  const controller = new GameDiceController(
    state,
    random,
    undefined,
    [definition],
    () => 1,
  );
  return { definition, state, controller };
}

it.each<DiceRollPolicy>([
  { extraDice: 1 },
  { modifier: 3, multiplier: 2 },
  { keep: 'highest' },
  { extraDice: 2, keep: 'lowest', modifier: -1.5 },
])('accepts a persisted roll produced by the supported policy %j', (policy) => {
  const { definition, state, controller } = fixture();
  controller.rollWith('main', policy);
  expect(() =>
    assertValidEngineKits({ dice: structuredClone(state) }, [definition]),
  ).not.toThrow();
});

it('rejects a corrupted per-player result', () => {
  const { definition, state, controller } = fixture();
  controller.roll();
  state.rollsByPlayer['1'].main.values[0] = 7;
  expect(() => assertValidEngineKits({ dice: state }, [definition])).toThrow();
});

it('refuses a sequence overflow before modifying the dice state', () => {
  const { state, controller } = fixture();
  state.sequence = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(state);
  expect(() => controller.roll()).toThrow();
  expect(state).toEqual(before);
});

it('clears the saved player rolls when resetting dice', () => {
  const { state, controller } = fixture();
  controller.roll();
  controller.reset('main');
  expect(state.rolls.main).toBeUndefined();
  expect(state.rollsByPlayer['1'].main).toBeUndefined();
  expect(state.lastRollId).toBeNull();
});

it('uses the same validation for controller and session reads', () => {
  const { state, controller } = fixture();
  controller.rollWith('main', { modifier: 1, keep: 'highest' });
  expect(() => controller.assertValid()).not.toThrow();
  state.rollsByPlayer['1'].main.total++;
  expect(() => controller.assertValid()).toThrow();
});

it('retains all extra dice when rerolling', () => {
  const { controller } = fixture();
  expect(
    controller.rollWith('main', {
      extraDice: 2,
      reroll: { while: () => true, max: 1 },
    }).values,
  ).toHaveLength(4);
});

it('checks the sum of a legacy roll without policy metadata', () => {
  const { definition, state } = fixture();
  state.rolls.main = { values: [2, 3], total: 5 };
  expect(() =>
    assertValidEngineKits({ dice: state }, [definition]),
  ).not.toThrow();
  state.rolls.main.total = 6;
  expect(() => assertValidEngineKits({ dice: state }, [definition])).toThrow();
});

it('recovers a missing legacy last-roll marker from definition order', () => {
  const first = diceKit({ id: 'z-first', count: 1, sides: 6 });
  const second = diceKit({ id: 'a-second', count: 1, sides: 6 });
  const state = {
    rolls: {
      'a-second': { values: [2], total: 2 },
      'z-first': { values: [1], total: 1 },
    },
    rollsByPlayer: {},
    lastRollId: null,
    sequence: 2,
  };
  const controller = new GameDiceController(
    state,
    {
      next: () => 0,
      int: () => 0,
      pick: <T>(values: readonly T[]) => values[0] ?? null,
      shuffle: <T>(values: readonly T[]) => [...values],
    },
    undefined,
    [first, second],
  );

  expect(state.lastRollId).toBe('a-second');
  controller.reset('a-second');
  expect(state.lastRollId).toBe('z-first');
});
