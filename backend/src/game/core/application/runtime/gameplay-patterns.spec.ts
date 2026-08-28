import { GameConfigurationError } from '../../domain/errors/game-domain.errors';
import { cards } from './cards-kit';
import { definePattern, composePatterns, cardGame } from './gameplay-patterns';
import { clockwise, simultaneous } from './turn-kit';

describe('gameplay pattern composition', () => {
  it('keeps configured pattern instances uniquely identifiable', () => {
    const composed = composePatterns(
      cardGame({ deckId: 'names', handId: 'names', cards: ['a'] }),
      cardGame({ deckId: 'specials', handId: 'specials', cards: ['b'] }),
    );

    expect(composed.ids).toEqual([
      'card-game:names:names',
      'card-game:specials:specials',
    ]);
  });

  it('rejects duplicated pattern ids', () => {
    expect(() =>
      composePatterns(
        definePattern({
          id: 'same',
          mechanics: ['test'],
        }),
        definePattern({
          id: 'same',
          mechanics: ['test'],
        }),
      ),
    ).toThrow(GameConfigurationError);
  });

  it('rejects duplicated component ids produced by patterns', () => {
    expect(() =>
      composePatterns(
        definePattern({
          id: 'first',
          mechanics: ['cards'],
          components: [cards.deck({ id: 'main', cards: ['a'] })],
        }),
        definePattern({
          id: 'second',
          mechanics: ['cards'],
          components: [cards.deck({ id: 'main', cards: ['b'] })],
        }),
      ),
    ).toThrow('composant dupliqué');
  });

  it('rejects incompatible implicit turn policies', () => {
    expect(() =>
      composePatterns(
        definePattern({
          id: 'sequential',
          mechanics: ['turns'],
          turn: clockwise(),
        }),
        definePattern({
          id: 'simultaneous',
          mechanics: ['turns'],
          turn: simultaneous(),
        }),
      ),
    ).toThrow('politiques de tour incompatibles');
  });
});
