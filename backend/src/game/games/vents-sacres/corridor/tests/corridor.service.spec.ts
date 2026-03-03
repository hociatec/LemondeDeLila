import { CorridorService } from '../corridor.service';
import { CorridorSetupService } from '../setup/corridor-setup.service';
import { CorridorActionService } from '../actions/corridor-action.service';
import { CorridorPresenterService } from '../presenter/corridor-presenter.service';
import * as CorridorRulebook from '../rulebook/rulebook';

function createSvc(): CorridorService {
  const presenter = new CorridorPresenterService(
    { buildFromWalls: () => ({}) } as any,
    { buildFromActions: () => ({}) } as any,
  );
  return new CorridorService(
    { register: () => {} } as any,
    new CorridorSetupService(),
    new CorridorActionService(),
    presenter,
    undefined as any,
  );
}

function choosePawnForUser(svc: CorridorService, state: any, userId: number): any {
  const exposed = svc.exposeStateForUser(state, userId);
  const chooseAction = (exposed.actions ?? []).find((a: any) => a.type === 'choose_pawn');
  if (!chooseAction) return state;
  return svc.applyActions(state, [chooseAction]);
}

describe('Corridor', () => {
  it('does not auto-start from setup', async () => {
    const svc = createSvc();

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

    const state = svc.hydrateInitialState(base);
    expect(state.status).toBe('setup');

    const exposed = svc.exposeStateForUser(state as any, 1);
    expect((exposed.extras as any)?.grid).toBeUndefined();
  });

  it('requires pawn selection before exposing move/wall actions', async () => {
    const svc = createSvc();
    const started = svc.hydrateInitialState({
      status: 'started',
      phase: 'setup',
      round: 0,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Hacene' },
        { id: 2, username: 'Lilas' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
      pending: null,
    } as any);

    const exposed = svc.exposeStateForUser(started as any, 1);
    const types = new Set((exposed.actions ?? []).map((a: any) => a.type));
    expect(types.has('choose_pawn')).toBe(true);
    expect(types.has('corridor_move')).toBe(false);
    expect(types.has('corridor_place_wall')).toBe(false);
  });

  it('allows a legal move and switches turn after pawn choices', async () => {
    const svc = createSvc();

    const base: any = {
      status: 'started',
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
    const afterChoose1 = choosePawnForUser(svc, started, 1);
    const ready = choosePawnForUser(svc, afterChoose1, 2);

    const exposed = svc.exposeStateForUser(ready as any, 1);
    expect(exposed.status).toBe('started');
    expect((exposed.extras as any)?.grid?.size).toBeGreaterThan(0);

    const move = (exposed.actions ?? []).find(
      (a: any) => a.type === 'corridor_move',
    );
    expect(move).toBeTruthy();

    const next = svc.applyActions(ready as any, [
      { type: 'corridor_move', payload: move!.payload } as any,
    ]);
    expect(next.turn?.currentPlayerId).toBe(2);
  });

  it('auto-assigns bot pawn then waits for human pawn choice', async () => {
    const svc = createSvc();

    const base: any = {
      status: 'started',
      phase: 'setup',
      round: 0,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: -1, username: 'Bot', isBot: true },
        { id: 1, username: 'Human', isBot: false },
      ],
      turn: { currentPlayerId: -1, direction: 1 },
      metadata: {},
      pending: null,
    };

    const started = svc.hydrateInitialState(base);
    expect(started.pending?.type).toBe('choose_pawn');
    expect(started.pending?.playerId).toBe(1);
    expect((started.metadata as any)?.pawnByPlayerId?.['-1']).toBeTruthy();

    const ready = choosePawnForUser(svc, started, 1);
    expect(ready.pending).toBeNull();
    expect(ready.turn?.currentPlayerId).toBe(-1);
  });

  it('does not finish on a non-winning move when legacy winner metadata exists', async () => {
    const svc = createSvc();

    const base: any = {
      status: 'started',
      phase: 'setup',
      round: 0,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: -1, username: 'Bot', isBot: true },
        { id: 1, username: 'Human', isBot: false },
      ],
      turn: { currentPlayerId: -1, direction: 1 },
      metadata: {
        winnerId: -1,
        winnerPlayerId: -1,
        finishedAt: '2026-03-01T12:00:00.000Z',
        outcomesByPlayerId: { '-1': 'won', '1': 'lost' },
      },
      pending: null,
    };

    const started = svc.hydrateInitialState(base);
    const afterChoose = choosePawnForUser(svc, started, 1);
    const ready = {
      ...afterChoose,
      turn: { ...(afterChoose.turn ?? {}), currentPlayerId: -1 },
    };
    const moveTargets = CorridorRulebook.listLegalPawnMoves(ready as any, -1);
    const nonWinning = moveTargets.find((m) => m.y !== 0) ?? moveTargets[0];
    expect(nonWinning).toBeTruthy();

    const next = svc.applyActions(ready as any, [
      {
        type: 'corridor_move',
        payload: { x: nonWinning!.x, y: nonWinning!.y },
      } as any,
    ]);

    expect(String(next.status)).toBe('started');
    expect((next.metadata as any).winnerId).toBeNull();
    expect((next.metadata as any).winnerPlayerId).toBeNull();
    expect((next.metadata as any).finishedAt).toBeUndefined();
  });

  it('does not declare victory on horizontal move when player goal is opposite row', async () => {
    const svc = createSvc();

    const state: any = {
      status: 'started',
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Hacene' },
        { id: -1, username: 'Milou', isBot: true },
      ],
      turn: { currentPlayerId: -1, direction: 1 },
      metadata: {
        size: 9,
        pawnsByPlayerId: {
          '-1': { x: 4, y: 0 },
          '1': { x: 4, y: 8 },
        },
        goalYByPlayerId: {
          '-1': 8,
          '1': 0,
        },
        walls: { h: [], v: [] },
        wallsRemainingByPlayerId: { '-1': 10, '1': 10 },
        winnerId: null,
        winnerPlayerId: null,
      },
      pending: null,
    };

    const next = svc.applyActions(state, [
      { type: 'corridor_move', payload: { x: 5, y: 0 } } as any,
    ]);

    expect(String(next.status)).toBe('started');
    expect((next.metadata as any).winnerId).toBeNull();
    expect((next.metadata as any).winnerPlayerId).toBeNull();
  });

  it('allows placing a wall and decreases remaining walls after pawn choices', async () => {
    const svc = createSvc();

    const base: any = {
      status: 'started',
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

    const afterChoose1 = choosePawnForUser(svc, svc.hydrateInitialState(base), 1);
    const ready = choosePawnForUser(svc, afterChoose1, 2);
    const exposed = svc.exposeStateForUser(ready as any, 1);
    const wall = (exposed.actions ?? []).find(
      (a: any) => a.type === 'corridor_place_wall',
    );
    expect(wall).toBeTruthy();

    const before = (ready.metadata as any).wallsRemainingByPlayerId['1'];
    const next = svc.applyActions(ready as any, [
      { type: 'corridor_place_wall', payload: wall!.payload } as any,
    ]);
    const after = (next.metadata as any).wallsRemainingByPlayerId['1'];
    expect(after).toBe(before - 1);
  });
});
