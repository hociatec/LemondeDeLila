import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { VoyagePresenterService } from './voyage-presenter.service';

describe('VoyagePresenterService', () => {
  it('does not expose a local position panel', () => {
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

    expect((exposed.extras as any)?.ui?.panels?.position).toBeUndefined();
  });
});
