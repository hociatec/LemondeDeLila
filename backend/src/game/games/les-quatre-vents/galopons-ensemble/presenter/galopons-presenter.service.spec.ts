import { GaloponsPresenterService } from '../application/services/galopons-presenter.service';
import { BoardPayloadService } from '../../../../application/services/board-payload.service';

describe('GaloponsPresenterService', () => {
  it('hides targeted pending from other players', () => {
    const service = new GaloponsPresenterService(new BoardPayloadService());
    const state: any = {
      status: 'started',
      players: [
        { id: 1, username: 'P1' },
        { id: 2, username: 'P2' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: {
        type: 'choose_target',
        playerId: 1,
        blocking: true,
        label: 'Choisissez une cible.',
      },
      metadata: {
        tiles: [{ n: 1, title: 'Start', type: 'start', region: 'prairie' }],
        positions: { 1: 0, 2: 0 },
        apples: { 1: 0, 2: 0 },
      },
      extras: {},
    };

    const owner = service.exposeStateForUser(state, 1);
    const other = service.exposeStateForUser(state, 2);

    expect(owner.pending).not.toBeNull();
    expect(other.pending).toBeNull();
  });

  it('keeps currentPlayerView aligned with the real current player for each viewer', () => {
    const service = new GaloponsPresenterService(new BoardPayloadService());
    const state: any = {
      status: 'started',
      players: [
        { id: 1, username: 'hacene' },
        { id: -2, username: 'Ratatouille', isBot: true },
      ],
      turn: { currentPlayerId: -2, direction: 1 },
      pending: null,
      metadata: {
        tiles: [{ n: 1, title: 'Start', type: 'start', region: 'prairie' }],
        positions: { 1: 0, [-2]: 0 },
        apples: { 1: 0, [-2]: 0 },
      },
      extras: {},
    };

    const exposed = service.exposeStateForUser(state, 1);

    expect(exposed.extras?.currentPlayerView).toEqual({
      id: -2,
      username: 'Ratatouille',
    });
  });
});

