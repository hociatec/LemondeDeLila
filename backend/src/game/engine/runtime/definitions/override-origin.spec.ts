import {
  assertNoImplicitActionOverrides,
  assertNoImplicitComponentOverrides,
  assertNoImplicitInitializationOverrides,
  assertNoImplicitTurnOverride,
} from './game-definition-override-validator';
import { authoringPathOf } from '../contracts/authoring-origin';
import { GameConfigurationError } from '../contracts/game-domain.errors';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import { overrideAction } from '../actions/action-builders';
import { movement } from '../kits/movement-kit';
import { overrideComponent } from './component-kit';
import { jsonCompilationOrigin } from './definition-validation-error';
import { withAuthoringPath } from '../contracts/authoring-origin';
import { clockwise, simultaneous } from '../kits/turn-kit';

const action = defineAction({ input: gameInput.object({}), execute: () => {} });
const component = movement.track({ id: 'road', spaces: 5 });

it.each([
  [
    () =>
      assertNoImplicitActionOverrides(
        {},
        { 'action.one': overrideAction('action.one', action) },
        'test',
      ),
    'actions["action.one"].overrides',
  ],
  [
    () =>
      assertNoImplicitComponentOverrides(
        [],
        [overrideComponent(component)],
        'test',
      ),
    'components[0].overrides',
  ],
  [
    () => assertNoImplicitComponentOverrides([component], [component], 'test'),
    'components[0].id',
  ],
  [
    () =>
      assertNoImplicitInitializationOverrides(
        { tracks: { 'track.one': 0 } },
        { tracks: { 'track.one': 1 } },
      ),
    'initialization.tracks["track.one"]',
  ],
  [
    () => assertNoImplicitInitializationOverrides({ scores: 0 }, { scores: 1 }),
    'initialization.scores',
  ],
  [
    () =>
      assertNoImplicitInitializationOverrides(
        { pawns: [{ setId: 'p' }] },
        { pawns: [{ setId: 'other' }, { setId: 'p' }] },
      ),
    'initialization.pawns[1].setId',
  ],
  [
    () => assertNoImplicitTurnOverride(clockwise(), simultaneous(), 'test'),
    'turn',
  ],
] as const)(
  'preserves SDK error types and precise override origins %#',
  (check, path) => {
    let caught: unknown;
    try {
      check();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GameConfigurationError);
    expect(authoringPathOf(caught)).toBe(path);
  },
);

it('does not fabricate a source for extension-generated definition fields', () => {
  const error = withAuthoringPath(
    new GameConfigurationError(),
    'definition.components[3].id',
  );
  expect(
    jsonCompilationOrigin(error, 'test', { components: [] }),
  ).toBeUndefined();
});
