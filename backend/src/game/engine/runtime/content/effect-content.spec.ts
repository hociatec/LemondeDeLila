import { effectContent } from './effect-content';
import { gameEffects } from '../effects/effects-kit';
import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';

it('validates parsed effects and their references before exposing immutable instructions', () => {
  const input = [gameEffects.move('board', 2)];
  const parsed = effectContent(input, { tracks: ['board'] });
  expect(parsed).toEqual(input);
  expect(parsed).not.toBe(input);
  expect(Object.isFrozen(parsed[0])).toBe(true);
  expect(() => effectContent(input)).toThrow('référence inconnue');
});

it.each([
  [{ kind: 'made-up' }],
  [{ kind: 'custom', effectId: 'unknown' }],
  [{ kind: 'complete-turn', target: { kind: 'chosen-player' } }],
  [{ kind: 'move', trackId: 'board', spaces: Infinity }],
  [{ kind: 'complete-turn', hiddenCallback: () => {} }],
  null,
])('rejects malformed or unserializable effect content', (value) => {
  expect(() => effectContent(value, { tracks: ['board'] })).toThrow(
    GameContentValidationError,
  );
});

it('preserves optional TypeScript builder fields without accepting unknown or required undefined fields', () => {
  const source = [{ kind: 'gain-score', amount: 1, target: undefined }];
  const parsed = effectContent(source);
  expect(Object.hasOwn(parsed[0], 'target')).toBe(true);
  expect(() =>
    effectContent([{ kind: 'gain-score', amount: undefined }]),
  ).toThrow();
  expect(() =>
    effectContent([{ kind: 'gain-score', amount: 1, extra: undefined }]),
  ).toThrow();
});
