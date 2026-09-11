import { defineAction, defineChoice } from './action-builders';
import { defineEffect } from '../effects/effects-core';
import { gameInput } from './game-input-schema';

it('captures action callbacks and schema independently of mutable author options', () => {
  const execute = jest.fn();
  const input = {
    ...gameInput.object({ count: gameInput.number({ max: 3 }) }),
  };
  const source = {
    input,
    execute,
    validate: () => true,
    enumerate: () => [{ count: 1 }],
  };
  const action = defineAction(source);
  if (!action.parseInput || !action.executeInput)
    throw new Error('Missing compiled action handlers');
  source.execute = jest.fn();
  source.validate = () => false;
  source.enumerate = () => [{ count: 999 }];
  input.parse = () => ({ count: 999 });
  expect(action.parseInput({ count: '2' })).toEqual({ count: 2 });
  const parseInput = action.parseInput;
  expect(() => parseInput({ count: 4 })).toThrow();
  const execution = {
    state: {},
    actor: { id: 1, username: 'A' },
    ctx: {},
  } as never;
  expect(action.enumerateInputs?.(execution)).toEqual([{ count: 1 }]);
  expect(action.validateInput?.({ input: { count: 2 } } as never)).toBe(true);
  action.executeInput({ input: { count: 2 } } as never);
  expect(execute).toHaveBeenCalledWith({ input: { count: 2 } });
  expect(source.execute).not.toHaveBeenCalled();
});

it('captures choice and effect resolvers and their validation descriptors', () => {
  const resolve = jest.fn();
  const apply = jest.fn();
  const choiceSource = { input: { ...gameInput.number({ max: 3 }) }, resolve };
  const effectSource = {
    input: { ...gameInput.object({ count: gameInput.number({ max: 3 }) }) },
    apply,
  };
  const choice = defineChoice(choiceSource);
  const effect = defineEffect(effectSource);
  choiceSource.resolve = jest.fn();
  effectSource.apply = jest.fn();
  choiceSource.input.parse = () => 999;
  effectSource.input.parse = () => ({ count: 999 });
  choice.resolveRaw({ rawValue: 2 } as never);
  effect.resolveRaw({ data: { count: 2 } } as never);
  expect(resolve).toHaveBeenCalledWith({ value: 2 });
  expect(apply).toHaveBeenCalledWith({ data: { count: 2 } });
  expect(() => effect.input.parse({ count: 4 })).toThrow();
  expect(Object.isFrozen(effect.input)).toBe(true);
});
