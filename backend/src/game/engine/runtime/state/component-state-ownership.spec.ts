import {
  componentStateOwnership,
  type KitStateOwnershipId,
} from './component-state-ownership';
import {
  auditGameStateOwnership,
  gameSpecificState,
} from '../../../testing/architecture-tests/game/backend-debt-auditor';

type Declared =
  (typeof componentStateOwnership)[keyof typeof componentStateOwnership][number]['id'];
// Any added or renamed persisted field requires an explicit owner.
const complete: Exclude<KitStateOwnershipId, Declared> extends never
  ? true
  : never = true;

it('declares every persisted kit field exactly once', () => {
  expect(complete).toBe(true);
  const ids = Object.values(componentStateOwnership).flatMap((fields) =>
    fields.map((field) => field.id),
  );
  expect(new Set(ids).size).toBe(ids.length);
});

it('inspects actual quoted and nested properties without matching comments or longer names', () => {
  const components = [
    { component: 'movement.track' as const, id: 'path', spaces: 4 },
  ];
  const audit = (stateSource: string) =>
    auditGameStateOwnership({ gameId: 'sample', stateSource, components });
  expect(audit('type SampleState = { "positions": object }')).toHaveLength(1);
  expect(
    audit('type SampleState = { nested: { currentPosition: number } }'),
  ).toHaveLength(1);
  expect(
    audit('type SampleState = { positionLabel: string /* positions */ }'),
  ).toHaveLength(0);
  expect(
    auditGameStateOwnership({
      gameId: 'sample',
      stateSource: 'type SampleState = { positions: object; scores: object }',
      components,
      exceptions: gameSpecificState('kits.movement.positions'),
    }),
  ).toEqual([
    expect.objectContaining({
      message: expect.stringContaining('playerValues.scores'),
    }),
  ]);
});
