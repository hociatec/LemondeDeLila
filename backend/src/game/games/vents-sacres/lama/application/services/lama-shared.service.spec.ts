import { LamaSharedService } from '../../application/services/lama-shared.service';

describe('LamaSharedService', () => {
  it('strips game-zone suffix from player labels', () => {
    const shared = new LamaSharedService();

    expect(shared.sanitizePlayerName('Garfield (zone de jeu)')).toBe(
      'Garfield',
    );
    expect(shared.sanitizePlayerName('Garfield (zone de jeux)')).toBe(
      'Garfield',
    );
    expect(shared.sanitizePlayerName('Garfield (game zone)')).toBe('Garfield');
  });

  it('uses sanitized names in playerLabel', () => {
    const shared = new LamaSharedService();
    const players = [{ id: 2, username: 'Garfield (zone de jeu)' }];

    expect(shared.playerLabel(players as any[], 2)).toBe('Garfield');
  });
});


