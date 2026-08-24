import { BoardPayloadService } from '../../../../application/services/board-payload.service';
import { ToutPresDeMamanPresenterService } from '../application/services/tout-pres-de-maman-presenter.service';

describe('ToutPresDeMamanPresenterService', () => {
  it('does not expose a local position panel', () => {
    const service = new ToutPresDeMamanPresenterService(
      new BoardPayloadService(),
    );
    const exposed = service.exposeStateForUser(
      {
        status: 'started',
        players: [
          { id: 1, username: 'Lila' },
          { id: 2, username: 'Mouche' },
        ],
        metadata: {
          tiles: [{}, {}, {}],
          positions: { 1: 0, 2: 1 },
          tokens: { 1: 0, 2: 1 },
          deckCards: [],
          cards: [],
        },
      } as any,
      1,
    );

    expect((exposed.extras as any)?.ui?.panels?.position).toBeUndefined();
  });
});

