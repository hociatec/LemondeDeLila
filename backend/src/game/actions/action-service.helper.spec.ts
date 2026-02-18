import {
  applyActionPipeline,
  dispatchByActionType,
  harmonizeActionStateReturn,
  isRollAlias,
  isRollActionType,
  normalizeLegacyRollAliasToUpper,
  normalizeRollActionType,
} from './action-service.helper';

describe('action-service.helper non-regression', () => {
  it('normalizes legacy roll aliases', () => {
    expect(isRollAlias('ROLL_DICE')).toBe(true);
    expect(isRollAlias('roll_dice')).toBe(true);
    expect(normalizeRollActionType('ROLL_DICE')).toBe('roll');
    expect(normalizeRollActionType('roll_dice')).toBe('roll');
    expect(normalizeLegacyRollAliasToUpper('roll_dice')).toBe('ROLL_DICE');
    expect(isRollActionType('ROLL_DICE')).toBe(true);
  });

  it('dispatches legacy roll alias to canonical roll handler', () => {
    const out = dispatchByActionType(
      'ROLL_DICE',
      {
        roll: () => 'roll-ok',
      },
      () => 'fallback',
    );
    expect(out).toBe('roll-ok');
  });

  it('runs action pipeline in guard -> validation -> transition -> effects -> logs order', () => {
    const calls: string[] = [];
    const out = applyActionPipeline({ value: 1 }, { type: 'x' }, {
      guard: () => {
        calls.push('guard');
        return true;
      },
      validate: () => {
        calls.push('validate');
        return 2;
      },
      transition: (_state, _action, payload) => {
        calls.push('transition');
        return { value: payload + 1 };
      },
      effects: (_state, _action, _payload, transitioned) => {
        calls.push('effects');
        return { value: transitioned.value * 3 };
      },
      logs: (_state, _action, _payload, _transitioned, effected) => {
        calls.push('logs');
        return { value: effected.value + 1 };
      },
    });

    expect(calls).toEqual([
      'guard',
      'validate',
      'transition',
      'effects',
      'logs',
    ]);
    expect(out).toEqual({ value: 10 });
  });

  it('returns original state when pipeline guard rejects action', () => {
    const state = { value: 42 };
    const out = applyActionPipeline(state, { type: 'x' }, {
      guard: () => false,
      transition: () => ({ value: 0 }),
    });
    expect(out).toBe(state);
  });

  it('harmonizes action return shape with pending and metadata defaults', () => {
    const out = harmonizeActionStateReturn({
      status: 'started',
      pending: undefined,
      metadata: undefined,
      turnIndex: 2,
    });

    expect(out.pending).toBeNull();
    expect(out.metadata).toEqual({});
    expect(out.status).toBe('started');
    expect(out.turnIndex).toBe(2);
  });
});
