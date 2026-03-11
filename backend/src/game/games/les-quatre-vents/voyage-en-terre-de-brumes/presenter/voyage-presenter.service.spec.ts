import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { VoyagePresenterService } from './voyage-presenter.service';

describe('VoyagePresenterService', () => {
  it('exposes the position panel for every player on the board', () => {
    const service = new VoyagePresenterService(new BoardPayloadService());
    const exposed = service.exposeStateForUser(
      {
        status: 'started',
        players: [
          { id: 1, username: 'Lila' },
          { id: 2, username: 'Mouche' },
        ],
        metadata: {
          tiles: [{}, {}, {}],
          positions: { 1: 0, 2: 2 },
          collections: {},
        },
      } as any,
      1,
    );

    const message = (exposed.extras as any)?.ui?.panels?.position?.message;
    expect(String(message ?? '')).toContain('Lila :');
    expect(String(message ?? '')).toContain('Mouche :');
  });
});
