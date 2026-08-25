import {
  diceRoll,
  pawnPlacement,
  turnAnnouncement,
  victoryAnnouncement,
} from './game-log-text';

describe('game-log-text', () => {
  it('formats turn announcement', () => {
    expect(turnAnnouncement('Lila')).toBe("C'est au tour de Lila.");
  });

  it('formats pawn placement', () => {
    expect(
      pawnPlacement({
        playerLabel: 'Lila',
        pawnLabel: 'sa montgolfiere',
        position: 2,
        tileLabel: 'Case 3 - Foret',
      }),
    ).toBe('Lila place sa montgolfiere en case 3 (Case 3 - Foret).');
  });

  it('formats dice roll', () => {
    expect(diceRoll({ playerLabel: 'Lila', value: 4 })).toBe(
      'Lila lance un dé (4/6).',
    );
    expect(diceRoll({ playerLabel: 'Lila', value: 2, sides: 8 })).toBe(
      'Lila lance un dé (2/8).',
    );
  });

  it('formats victory announcement', () => {
    expect(victoryAnnouncement('Lila')).toBe('Victoire de Lila.');
  });
});
