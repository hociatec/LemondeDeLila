import type {
  JsonGameView,
  JsonGameViews,
  compileJsonGame,
} from '../public-api';

type CompiledView = ReturnType<
  NonNullable<ReturnType<typeof compileJsonGame>['viewExtension']>
>;

it('retains concrete fields from the registry through the compiler public contract', () => {
  const view: JsonGameViews['propertyEconomy'] = { buildings: {} };
  const compiled: CompiledView = view;
  const aggregate: JsonGameView = compiled;
  expect(aggregate.buildings).toEqual({});
  const wrongField: JsonGameView = {
    // @ts-expect-error Unknown public fields must not be accepted by an index signature.
    arbitraryField: true,
  };
  const reserved: JsonGameView = {
    // @ts-expect-error Extensions cannot overwrite engine namespaces.
    system: {},
  };
  expect([wrongField, reserved]).toHaveLength(2);
});

it('keeps concrete view fields for consumers selecting an extension', () => {
  const buildings: JsonGameViews['propertyEconomy']['buildings'] = {};
  expect(buildings).toEqual({});
});
