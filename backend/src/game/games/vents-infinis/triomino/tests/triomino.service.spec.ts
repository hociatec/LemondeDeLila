import { TriominoService } from '../triomino.service';
import { TriominoPresenter } from '../triomino.presenter';
import { GridCellActionsService } from '../../../../modules/grid/services/grid-cell-actions.service';
import { RandomService } from '../../../../modules/random/services/random.service';

describe('TriominoService', () => {
  it('shows turn choices for current player', async () => {
    const service = new TriominoService(
      { register: () => {} } as any,
      new RandomService(),
      new TriominoPresenter(new GridCellActionsService()),
    );

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    const exposedA: any = service.exposeStateForUser(state, 1);
    const exposedB: any = service.exposeStateForUser(state, 2);
    expect(exposedA.pending?.choices?.length ?? 0).toBeGreaterThan(0);
    expect(exposedB.pending).toBeNull();
  });

  it('suggests a bot move (select + place) on its turn', async () => {
    const service = new TriominoService(
      { register: () => {} } as any,
      new RandomService(),
      new TriominoPresenter(new GridCellActionsService()),
    );

    const state: any = {
      status: 'started',
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Human' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: null,
      metadata: {
        size: 5,
        deck: [],
        handsByPlayerId: {
          '2': [{ id: 2, a: 0, b: 0, c: 0 }],
        },
        scoresByPlayerId: { '1': 0, '2': 0 },
        placedByKey: {
          '2,2': { tile: { id: 1, a: 0, b: 0, c: 0 }, ownerId: 0, rot: 0 },
        },
        selectedTileIdByPlayerId: { '2': null },
        step: 'choose_tile',
        winnerId: null,
        ended: false,
      },
    };

    const actions = service.getBotActions(state, 2);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].type).toBe('triomino_select_tile');
    expect(actions[1]?.type).toBe('triomino_place');
  });

  it('exposes ui panels for info shortcuts', async () => {
    const service = new TriominoService(
      { register: () => {} } as any,
      new RandomService(),
      new TriominoPresenter(new GridCellActionsService()),
    );

    const state: any = {
      status: 'started',
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        size: 5,
        deck: [],
        handsByPlayerId: { '1': [{ id: 1, a: 0, b: 1, c: 2 }] },
        scoresByPlayerId: { '1': 0, '2': 0 },
        placedByKey: { '2,2': { tile: { id: 99, a: 0, b: 0, c: 0 }, ownerId: 0, rot: 0 } },
        selectedTileIdByPlayerId: { '1': null },
        step: 'choose_tile',
        winnerId: null,
        ended: false,
      },
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    expect(exposed?.extras?.ui?.panels?.hand?.message).toContain('Main');
    expect(exposed?.extras?.ui?.panels?.position?.message).toContain('Posées');
    expect(exposed?.extras?.ui?.panels?.score?.message).toContain('Score');
  });
});
