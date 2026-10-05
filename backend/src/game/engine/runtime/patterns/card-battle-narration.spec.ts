import type { GameContext } from '../definitions/game-author-context';
import { battleWonNarration } from './card-battle-narration';

const context = {
  players: {
    all: () => [
      { id: 1, username: 'Lilas' },
      { id: 2, username: 'Mina' },
    ],
  },
} as unknown as GameContext<Record<string, never>>;

describe('card battle result narration', () => {
  it('calls a normal two-card win a trick', () => {
    const narration = battleWonNarration(context, 1, 2, [
      { playerId: 1, cardNames: ['Chat'] },
      { playerId: 2, cardNames: ['Souris'] },
    ]);

    expect(narration.default).toBe(
      'Lilas a posé : Chat. Mina a posé : Souris. Lilas remporte le pli et gagne 2 cartes.',
    );
    expect(narration.byPlayerId[1]).toBe(
      'Vous avez posé : Chat. Mina a posé : Souris. Vous remportez le pli et gagnez 2 cartes.',
    );
  });

  it('reserves battle vocabulary for a win after a tie', () => {
    const narration = battleWonNarration(context, 1, 6, [
      { playerId: 1, cardNames: ['Souris', 'Chat', 'Lion'] },
      { playerId: 2, cardNames: ['Souris', 'Chien', 'Éléphant'] },
    ]);

    expect(
      narration.default.endsWith(
        'Lilas gagne la bataille et remporte 6 cartes.',
      ),
    ).toBe(true);
    expect(
      narration.byPlayerId[1].endsWith(
        'Vous gagnez la bataille et remportez 6 cartes.',
      ),
    ).toBe(true);
  });
});
