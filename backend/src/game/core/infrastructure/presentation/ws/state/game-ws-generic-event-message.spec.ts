import { genericGameEventMessage } from './game-ws-generic-event-message';

describe('genericGameEventMessage', () => {
  const players = new Map([
    [1, 'Hacene'],
    [2, 'Baloo'],
    [-2, 'Bot Baloo'],
  ]);

  const message = (
    type: string,
    data: Record<string, unknown>,
    actorId: number | null,
    viewerPlayerId: number,
  ) =>
    genericGameEventMessage({
      type,
      data,
      actorId,
      players,
      viewerPlayerId,
    });

  it('announces a die result with grammar adapted to the viewer', () => {
    expect(message('dice.rolled', { values: [3], total: 3 }, 1, 1)).toBe(
      'Vous lancez le dé et obtenez 3.',
    );
    expect(message('dice.rolled', { values: [6], total: 6 }, 2, 1)).toBe(
      'Baloo lance le dé et obtient 6.',
    );
  });

  it('uses the direct form when the viewer starts the turn', () => {
    expect(message('turn.started', { playerId: 1 }, 1, 1)).toBe(
      "C'est à votre tour.",
    );
    expect(message('turn.started', { playerId: 2 }, 2, 1)).toBe(
      "C'est au tour de Baloo.",
    );
    const vowelPlayers = new Map([
      [1, 'Hacene'],
      [2, 'Abu'],
    ]);
    expect(
      genericGameEventMessage({
        type: 'turn.started',
        data: { playerId: 2 },
        actorId: 2,
        players: vowelPlayers,
        viewerPlayerId: 1,
      }),
    ).toBe("C'est au tour d’Abu.");
  });

  it('conjugates a received card for the viewer', () => {
    expect(message('card.received', { playerId: 1 }, 1, 1)).toBe(
      'Vous recevez une carte.',
    );
    expect(message('card.received', { playerId: 2 }, 2, 1)).toBe(
      'Baloo reçoit une carte.',
    );
  });

  it('announces a grid move with human-readable coordinates', () => {
    expect(
      message('game.grid.mark.placed', { playerId: 1, x: 0, y: 2 }, 1, 1),
    ).toBe('Vous placez votre pion en A3.');
    expect(
      message('game.grid.mark.placed', { playerId: 2, x: 1, y: 0 }, 2, 1),
    ).toBe('Baloo place son pion en B1.');
    expect(
      message('game.grid.mark.placed', { playerId: 2, x: 1, y: 1 }, 2, 1),
    ).toBe('Baloo place son pion en B2.');
  });

  it('announces pawn choices differently for the player and the others', () => {
    const data = {
      playerId: 1,
      pawnId: 'capitaine-cacahuete',
      pawnLabel: 'Capitaine Cacahuète',
    };
    expect(message('pawn.assigned', data, 1, 1)).toBe(
      'Vous avez choisi « Capitaine Cacahuète ».',
    );
    expect(message('pawn.assigned', data, 1, 2)).toBe(
      'Hacene a choisi « Capitaine Cacahuète ».',
    );
    expect(message('pawn.assigned', { ...data, playerId: -2 }, -2, 1)).toBe(
      'Bot Baloo a choisi « Capitaine Cacahuète ».',
    );
  });

  it('conjugates a skipped turn for the viewer', () => {
    expect(message('player.skipped', { playerId: 1 }, 1, 1)).toBe(
      'Vous passez votre tour.',
    );
    expect(message('player.skipped', { playerId: 2 }, 2, 1)).toBe(
      'Baloo passe son tour.',
    );
  });

  it('does not expose internal story challenge resource identifiers', () => {
    expect(
      message(
        'resource.changed',
        {
          playerId: 1,
          resource: 'choice-story-challenge.reroll-token',
          value: 1,
        },
        1,
        1,
      ),
    ).toBe('');
    expect(
      message(
        'resource.transferred',
        {
          from: 1,
          to: 2,
          resource: 'choice-story-challenge.malus-shield',
          amount: 1,
        },
        1,
        1,
      ),
    ).toBe('');
  });

  it('describes the destination without repeating the technical movement', () => {
    expect(message('pawn.moved', { from: 0, to: 3 }, 1, 1)).toBe('');
    expect(message('pawn.landed', { playerId: 2, position: 6 }, 2, 1)).toBe(
      'Baloo arrive sur la case 7.',
    );
    expect(
      message(
        'pawn.landed',
        { playerId: 2, position: 5, displayPosition: 5 },
        2,
        1,
      ),
    ).toBe('Baloo arrive sur la case 5.');
    expect(
      message(
        'pawn.landed',
        {
          playerId: 1,
          position: 3,
          tileLabel: 'Case 4 — Sentier tranquille',
          tileDescription: 'Une étape sans effet particulier.',
        },
        1,
        1,
      ),
    ).toBe(
      'Vous arrivez sur la case 4 : Sentier tranquille. Une étape sans effet particulier.',
    );
    expect(
      message(
        'pawn.landed',
        {
          playerId: 1,
          position: 4,
          tileLabel: 'Case 5 — Piège gluant',
          tileDescription: 'Effet : reculez immédiatement de 2 cases.',
        },
        1,
        1,
      ),
    ).toBe(
      'Vous arrivez sur la case 5 : Piège gluant. Effet : reculez immédiatement de 2 cases.',
    );
  });
});
