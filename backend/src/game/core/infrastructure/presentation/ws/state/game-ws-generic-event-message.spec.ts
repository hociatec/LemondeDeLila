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

  it('describes the destination without repeating the technical movement', () => {
    expect(message('pawn.moved', { from: 0, to: 3 }, 1, 1)).toBe('');
    expect(message('pawn.landed', { playerId: 2, position: 6 }, 2, 1)).toBe(
      'Baloo arrive sur la case 6.',
    );
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
      'Vous arrivez sur la case 3 : Sentier tranquille. Description : Une étape sans effet particulier.',
    );
  });
});
