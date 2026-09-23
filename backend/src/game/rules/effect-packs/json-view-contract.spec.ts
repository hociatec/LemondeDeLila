import type {
  JsonGameView,
  JsonGameViews,
  compileJsonGame,
} from '../public-api';

type CompiledView = ReturnType<
  NonNullable<ReturnType<typeof compileJsonGame>['viewExtension']>
>;

it('retains concrete fields from the registry through the compiler public contract', () => {
  const view: JsonGameViews['carAssembly'] = {
    progress: { 1: { stageIndex: 2, carParts: ['wheel'], completedCars: [] } },
  };
  const compiled: CompiledView = view;
  const aggregate: JsonGameView = compiled;
  expect(aggregate.progress?.[1].stageIndex).toBe(2);
  const wrongField: JsonGameView = {
    // @ts-expect-error Unknown public fields must not be accepted by an index signature.
    arbitraryField: true,
  };
  const wrongScalar: CompiledView = {
    // @ts-expect-error Concrete pack view values must survive catalogue compilation.
    progress: 'not a player progress map',
  };
  const reserved: JsonGameView = {
    // @ts-expect-error Extensions cannot overwrite engine namespaces.
    system: {},
  };
  expect([wrongField, wrongScalar, reserved]).toHaveLength(3);
});

it('keeps different last-round schemas distinct for consumers selecting an extension', () => {
  const challenge: JsonGameViews['anonymousVote']['currentChallengeId'] =
    'challenge-1';
  const battle: JsonGameViews['battleTies']['lastRound'] = null;
  expect(challenge).toBe('challenge-1');
  expect(battle).toBeNull();
});
