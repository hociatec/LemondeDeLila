import { Logger } from '@nestjs/common';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import { runGameReplayCampaign } from './game-replay-campaign';

afterEach(() => jest.restoreAllMocks());

it('rejects a replay that gets stuck after a successful first command', () => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const definition = discoverGameDefinitions().find(
    (item) => item.id === 'morpion',
  );
  if (!definition) throw new Error('Missing grid game fixture');
  const original = DeclarativeGameRuntime.prototype.getAvailableActions;
  let calls = 0;
  jest
    .spyOn(DeclarativeGameRuntime.prototype, 'getAvailableActions')
    .mockImplementation(function (
      this: InstanceType<typeof DeclarativeGameRuntime>,
      ...args
    ) {
      // Two players are queried at each step. Allow the first command, then stall.
      return ++calls <= 2 ? original.apply(this, args) : [];
    });
  jest
    .spyOn(DeclarativeGameRuntime.prototype, 'getAutomaticActions')
    .mockReturnValue(null);
  expect(() => runGameReplayCampaign(definition, 0, 4)).toThrow(
    /step=1: active game has no playable or automatic command/,
  );
});
