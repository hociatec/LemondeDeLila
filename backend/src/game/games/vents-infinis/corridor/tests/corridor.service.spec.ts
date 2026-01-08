import { CorridorService } from '../corridor.service';
import { CorridorSetupService } from '../setup/corridor-setup.service';
import { CorridorActionService } from '../actions/corridor-action.service';
import { CorridorPresenterService } from '../presenter/corridor-presenter.service';

describe('Corridor', () => {
  it('allows a legal move and switches turn', async () => {
    const svc = new CorridorService(
      { register: () => {} } as any,
      new CorridorSetupService(),
      new CorridorActionService(),
      new CorridorPresenterService(),
    );

    const base: any = {
      status: 'setup',
      phase: 'setup',
      round: 0,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
      pending: null,
    };

    const started = svc.hydrateInitialState(base);
    const exposed = svc.exposeStateForUser(started as any, 1);
    expect(exposed.status).toBe('started');

    const move = (exposed.actions ?? []).find((a: any) => a.type === 'corridor_move');
    expect(move).toBeTruthy();

    const next = svc.applyActions(started as any, [{ type: 'corridor_move', payload: move!.payload } as any]);
    expect(next.turn?.currentPlayerId).toBe(2);
  });

  it('allows placing a wall and decreases remaining walls', async () => {
    const svc = new CorridorService(
      { register: () => {} } as any,
      new CorridorSetupService(),
      new CorridorActionService(),
      new CorridorPresenterService(),
    );

    const base: any = {
      status: 'setup',
      phase: 'setup',
      round: 0,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
      pending: null,
    };

    const started = svc.hydrateInitialState(base);
    const exposed = svc.exposeStateForUser(started as any, 1);
    const wall = (exposed.actions ?? []).find(
      (a: any) => a.type === 'corridor_place_wall',
    );
    expect(wall).toBeTruthy();

    const before = (started.metadata as any).wallsRemainingByPlayerId['1'];
    const next = svc.applyActions(started as any, [
      { type: 'corridor_place_wall', payload: wall!.payload } as any,
    ]);
    const after = (next.metadata as any).wallsRemainingByPlayerId['1'];
    expect(after).toBe(before - 1);
  });
});
