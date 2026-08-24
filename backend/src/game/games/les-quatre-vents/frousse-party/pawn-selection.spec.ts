import type { FrousseMetadata } from './model/frousse.types';
import { buildPawnSelectionPending } from './pawn-selection';

function makeMeta(
  pawns: Array<{ id: string; name: string; description?: string }>,
): FrousseMetadata {
  return {
    tiles: [],
    positions: {},
    statuses: {
      skipTurn: {},
      ignoreNextTrap: {},
      ignoreTrapUntilNextDraw: {},
      ignoreNextPrank: {},
      ignoreNextGhost: {},
      nextMoveCap: {},
      nextRollMalus: {},
      nextRollKeepLowest: {},
      nextRollDouble: {},
      nextRollIfThreeBackTwo: {},
      blocked: {},
    },
    decks: { cards: [], discard: [] },
    pawns,
  };
}

describe('buildPawnSelectionPending', () => {
  it('returns null when no valid players are provided', () => {
    const pending = buildPawnSelectionPending(
      [null, undefined, { id: '1' } as any, {} as any],
      makeMeta([{ id: 'wolf', name: 'Loup' }]),
    );

    expect(pending).toBeNull();
  });

  it('returns null when no pawn candidate is available', () => {
    const pending = buildPawnSelectionPending(
      [
        { id: 1, pawn: 'wolf' },
        { id: 2, pawn: 'fox' },
      ],
      makeMeta([
        { id: 'wolf', name: 'Loup' },
        { id: 'fox', name: 'Renard' },
      ]),
    );

    expect(pending).toBeNull();
  });

  it('returns null when all players already have a pawn', () => {
    const pending = buildPawnSelectionPending(
      [
        { id: 1, pawn: 'wolf' },
        { id: 2, pawn: 'fox' },
      ],
      makeMeta([
        { id: 'wolf', name: 'Loup' },
        { id: 'fox', name: 'Renard' },
        { id: 'owl', name: 'Hibou' },
      ]),
    );

    expect(pending).toBeNull();
  });

  it('builds choose_pawn pending for first unassigned player', () => {
    const pending = buildPawnSelectionPending(
      [
        { id: 1, pawn: 'wolf' },
        { id: 2 },
        { id: 3, pawn: null },
        { id: 4, pawn: 'fox' },
      ],
      makeMeta([
        { id: 'wolf', name: 'Loup', description: 'Rapide' },
        { id: 'fox', name: 'Renard' },
        { id: 'bear', name: '', description: 'Très fort' },
        { id: 'owl', name: 'Hibou', description: 'Silencieux' },
      ]),
    );

    expect(pending).toEqual({
      type: 'choose_pawn',
      playerId: 2,
      blocking: true,
      choices: ['Très fort', 'Hibou: Silencieux'],
      data: {
        kind: 'choose_pawn',
        pawns: [
          { id: 'bear', name: '', description: 'Très fort' },
          { id: 'owl', name: 'Hibou', description: 'Silencieux' },
        ],
      },
    });
  });
});
