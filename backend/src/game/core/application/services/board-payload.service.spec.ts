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
});
