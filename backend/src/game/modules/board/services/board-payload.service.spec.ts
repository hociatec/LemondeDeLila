import { BoardPayloadService } from './board-payload.service';

describe('BoardPayloadService', () => {
  it('buildPositionPanelMessage lists every player position with names when available', () => {
    const svc = new BoardPayloadService();
    const msg = svc.buildPositionPanelMessage({
      tilesRaw: [{}, {}, {}],
      positionsRaw: { 3: 0, 5: 2 },
      playerId: 3,
      playersRaw: [
        { id: 3, username: 'Lila' },
        { id: 5, username: 'Mouche' },
      ],
    });

    expect(msg).toContain('Positions.');
    expect(msg).toContain('Lila :');
    expect(msg).toContain('Mouche :');
    expect(msg).toContain('case 1/3');
    expect(msg).toContain('case 3/3');
  });

  it('buildPawnProgressPositionPanelMessage lists every player with grouped pawn progress', () => {
    const svc = new BoardPayloadService();
    const msg = svc.buildPawnProgressPositionPanelMessage({
      playersRaw: [
        { id: 3, username: 'Lila' },
        { id: 5, username: 'Mouche' },
      ],
      pawnsByPlayerRaw: {
        3: [
          { pawnIndex: 0, progress: -1 },
          { pawnIndex: 1, progress: 2 },
          { pawnIndex: 2, progress: 5 },
          { pawnIndex: 3, progress: 8 },
        ],
        5: [
          { pawnIndex: 0, progress: -1 },
          { pawnIndex: 1, progress: -1 },
          { pawnIndex: 2, progress: 1 },
          { pawnIndex: 3, progress: 8 },
        ],
      },
      trackLengthRaw: 6,
      homeLengthRaw: 3,
      offsetsRaw: { 3: 0, 5: 2 },
      pawnNamesByPlayerRaw: {
        3: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      },
      stableLabel: 'Base',
      homeLabel: 'Hangar',
      arrivedLabel: 'Arrivée',
    });

    expect(msg).toContain('Positions.');
    expect(msg).toContain('Lila :');
    expect(msg).toContain('Mouche :');
    expect(msg).toContain('Base 1/4');
    expect(msg).toContain('Hangar 0/4');
    expect(msg).toContain('Arrivée 1/4');
    expect(msg).toContain('Bravo case 3/6');
    expect(msg).toContain('Pion 3 case 4/6');
  });
});
