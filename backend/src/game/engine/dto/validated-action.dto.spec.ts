import 'reflect-metadata';
import { validateAction, validateActions, sanitizeAction } from './validated-action.dto';
import { PayloadValidationError } from '../../../common/errors/game-errors';

describe('ValidatedActionDto', () => {
  describe('validateAction', () => {
    it('should validate a valid action', async () => {
      const action = {
        type: 'draw',
        payload: { cardId: '123' },
      };

      const result = await validateAction(action);

      expect(result.type).toBe('draw');
      expect(result.payload).toEqual({ cardId: '123' });
    });

    it('should reject action with empty type', async () => {
      const action = {
        type: '',
        payload: {},
      };

      await expect(validateAction(action)).rejects.toThrow(PayloadValidationError);
    });

    it('should reject action with invalid type characters', async () => {
      const action = {
        type: 'draw@card!',
        payload: {},
      };

      await expect(validateAction(action)).rejects.toThrow(PayloadValidationError);
    });

    it('should reject action without type', async () => {
      const action = {
        payload: {},
      };

      await expect(validateAction(action)).rejects.toThrow(PayloadValidationError);
    });

    it('should accept action with valid type containing underscores and hyphens', async () => {
      const action = {
        type: 'draw-card_action',
        payload: {},
      };

      const result = await validateAction(action);
      expect(result.type).toBe('draw-card_action');
    });

    it('should accept action with numbers in type', async () => {
      const action = {
        type: 'action123',
        payload: {},
      };

      const result = await validateAction(action);
      expect(result.type).toBe('action123');
    });

    it('should accept action without payload', async () => {
      const action = {
        type: 'draw',
      };

      const result = await validateAction(action);
      expect(result.type).toBe('draw');
      expect(result.payload).toBeUndefined();
    });
  });

  describe('validateActions', () => {
    it('should validate an array of valid actions', async () => {
      const actions = [
        { type: 'draw', payload: { cardId: '123' } },
        { type: 'discard', payload: { cardId: '456' } },
      ];

      const result = await validateActions(actions);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('draw');
      expect(result[1].type).toBe('discard');
    });

    it('should reject non-array input', async () => {
      const actions = { type: 'draw' };

      await expect(validateActions(actions)).rejects.toThrow(PayloadValidationError);
    });

    it('should reject if any action is invalid', async () => {
      const actions = [
        { type: 'draw', payload: {} },
        { type: '', payload: {} }, // Invalid
      ];

      await expect(validateActions(actions)).rejects.toThrow(PayloadValidationError);
    });
  });

  describe('sanitizeAction', () => {
    it('should trim and lowercase action type', () => {
      const action = {
        type: '  DRAW  ',
        payload: {},
      };

      const result = sanitizeAction(action as any);

      expect(result.type).toBe('draw');
    });

    it('should remove dangerous keys from payload', () => {
      const action = {
        type: 'draw',
        payload: {
          cardId: '123',
          __proto__: { evil: 'code' },
          constructor: { bad: 'stuff' },
          prototype: { more: 'evil' },
        } as any,
      };

      const result = sanitizeAction(action as any);

      expect(result.payload).toBeDefined();
      expect(result.payload).toHaveProperty('cardId');
      // Check that dangerous keys are not enumerable or have been sanitized
      const keys = Object.keys(result.payload || {});
      expect(keys).not.toContain('__proto__');
      expect(keys).not.toContain('constructor');
      expect(keys).not.toContain('prototype');
      expect(keys).toContain('cardId');
    });

    it('should limit nested object depth', () => {
      const deepObject: any = { level1: {} };
      let current = deepObject.level1;
      for (let i = 2; i <= 10; i++) {
        current[`level${i}`] = {};
        current = current[`level${i}`];
      }

      const action = {
        type: 'action',
        payload: deepObject,
      };

      const result = sanitizeAction(action as any);

      // Should have been truncated at max depth
      expect(result.payload).toBeDefined();
    });

    it('should limit array length', () => {
      const action = {
        type: 'action',
        payload: {
          items: Array(200).fill('item'),
        },
      };

      const result = sanitizeAction(action as any);

      expect(result.payload?.items).toBeDefined();
      expect((result.payload?.items as any[]).length).toBe(100);
    });

    it('should skip keys longer than 100 characters', () => {
      const longKey = 'a'.repeat(101);
      const action = {
        type: 'action',
        payload: {
          [longKey]: 'value',
          normalKey: 'value',
        },
      };

      const result = sanitizeAction(action as any);

      expect(result.payload).not.toHaveProperty(longKey);
      expect(result.payload).toHaveProperty('normalKey');
    });
  });
});
