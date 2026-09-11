import { Logger } from '@nestjs/common';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { GameCardsController } from '../../../engine/runtime/cards/cards-kit';
import { runGameReplayCampaign } from './game-replay-campaign';

afterEach(() => jest.restoreAllMocks());

it.each(['la-bande-a-banane', 'la-grande-mine-de-barbak'])(
  '%s finishes its hand-limit operations when hand reads return copies',
  (gameId) => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const original = GameCardsController.prototype.play;
    let discards = 0;
    jest
      .spyOn(GameCardsController.prototype, 'play')
      .mockImplementation(function (this: GameCardsController, ...args) {
        if (++discards > 5000)
          throw new Error(
            'Hand-limit operation exceeded the campaign discard budget',
          );
        return original.apply(this, args);
      });
    const discardRandom = GameCardsController.prototype.discardRandom;
    let attempts = 0;
    jest
      .spyOn(GameCardsController.prototype, 'discardRandom')
      .mockImplementation(function (this: GameCardsController, ...args) {
        if (++attempts > 5000)
          throw new Error('Hand-limit operation kept discarding an empty hand');
        return discardRandom.apply(this, args);
      });
    const definition = discoverGameDefinitions().find(
      (item) => item.id === gameId,
    );
    if (!definition) throw new Error(`Missing game ${gameId}`);
    const result = runGameReplayCampaign(definition, 0, 64);
    expect(result.steps).toBeGreaterThan(0);
    expect(attempts + discards).toBeLessThan(5000);
  },
  120_000,
);
