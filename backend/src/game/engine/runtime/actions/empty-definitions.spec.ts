import { defineAction, defineEmptyAction } from './action-builders';
import {
  defineEffect,
  defineEmptyEffect,
  defineActorEffect,
} from '../effects/effects-core';
import { gameInput } from './game-input-schema';

it.each([null, 0, -2, 1])(
  'runs actor effects only for a non-null actor: %s',
  (actorPlayerId) => {
    const apply = jest.fn();
    const effect = defineActorEffect<Record<string, never>>(apply);
    const execution = {
      state: {},
      actorPlayerId,
      targetPlayerIds: [2],
      source: null,
      ctx: {} as never,
    };
    expect(() => effect.resolveRaw({ ...execution, data: null })).toThrow();
    expect(apply).not.toHaveBeenCalled();
    effect.resolveRaw({ ...execution, data: { ignored: true } });
    if (actorPlayerId === null) expect(apply).not.toHaveBeenCalled();
    else {
      expect(apply).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledWith({ ...execution, data: {} });
      expect(apply.mock.calls[0][0].ctx).toBe(execution.ctx);
    }
    expect(Object.isFrozen(effect)).toBe(true);
  },
);

it.each([{}, { ignored: true }])(
  'preserves the empty action parser contract for %j',
  (payload) => {
    const execute = jest.fn();
    const old = defineAction<Record<string, never>, Record<string, never>>({
      input: gameInput.object({}),
      execute,
    });
    const current = defineEmptyAction<Record<string, never>>({ execute });
    expect(current.input.describe()).toEqual(old.input.describe());
    expect(current.parseInput?.(payload)).toEqual(old.parseInput?.(payload));
    current.executeInput?.({
      state: {},
      actor: { id: 1 } as never,
      ctx: {} as never,
      input: payload,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ input: {} }),
    );
    expect(Object.isFrozen(current)).toBe(true);
  },
);

it('preserves effect validation, parsed data and immutable definitions', () => {
  const apply = jest.fn();
  const current = defineEmptyEffect<Record<string, never>>(apply);
  const old = defineEffect<Record<string, never>, Record<string, never>>({
    input: gameInput.object({}),
    apply,
  });
  expect(current.input.describe()).toEqual(old.input.describe());
  const execution = {
    state: {},
    actorPlayerId: 1,
    targetPlayerIds: [2],
    source: null,
    ctx: {} as never,
  };
  for (const data of [null, [], 3, 'invalid']) {
    expect(() => current.resolveRaw({ ...execution, data })).toThrow();
    expect(() => old.resolveRaw({ ...execution, data })).toThrow();
  }
  expect(apply).not.toHaveBeenCalled();
  current.resolveRaw({ ...execution, data: { ignored: true } });
  expect(apply).toHaveBeenCalledWith({ ...execution, data: {} });
  expect(Object.isFrozen(current)).toBe(true);
});
