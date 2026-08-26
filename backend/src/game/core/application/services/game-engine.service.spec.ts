import { GameEngineService } from './game-engine.service';
import type { GameStateEntity } from '../models/game-state.model';
import { appendPendingGameEvent } from './game-event-log.helper';
import { InMemoryGameSessionStore } from '../../infrastructure/persistence/memory/in-memory-game-session.store';

function createEngine(): GameEngineService {
  const store = new InMemoryGameSessionStore();
  return new GameEngineService(store, store);
}

describe('GameEngineService room cleanup', () => {
  const state = (label: string) =>
    ({
      status: 'started',
      phase: 'playing',
      log: [],
      game: { label },
    }) satisfies GameStateEntity;

  it('clears every game snapshot for one room only', async () => {
    const engine = createEngine();
    await engine.restoreInternalState(4, 'lama', state('lama'));
    await engine.restoreInternalState(4, 'other', state('other'));
    await engine.restoreInternalState(5, 'lama', state('kept'));

    await engine.clearRoom(4);

    expect(await engine.exportInternalState(4, 'lama')).toBeNull();
    expect(await engine.exportInternalState(4, 'other')).toBeNull();
    expect(await engine.exportInternalState(5, 'lama')).not.toBeNull();
  });

  it('does not clear a newer snapshot while cleaning a stale commit', async () => {
    const engine = createEngine();
    const stale = { ...state('stale'), version: 1 };
    const current = { ...state('current'), version: 2 };
    await engine.restoreInternalState(4, 'lama', current);

    await engine.clearInternalStateIf(4, 'lama', stale);

    expect(await engine.exportInternalState(4, 'lama')).toEqual({
      ...current,
      version: 2,
    });
  });

  it('commits only when the expected version still matches', async () => {
    const engine = createEngine();
    await engine.restoreInternalState(4, 'lama', state('initial'));

    const first = await engine.compareAndSetInternalState(
      4,
      'lama',
      1,
      state('first'),
    );
    const stale = await engine.compareAndSetInternalState(
      4,
      'lama',
      1,
      state('stale'),
    );

    expect(first).toMatchObject({ committed: true, version: 2 });
    expect(stale).toMatchObject({ committed: false, version: 2 });
    expect(await engine.exportInternalState(4, 'lama')).toMatchObject({
      game: { label: 'first' },
      version: 2,
    });
  });

  it('records commands atomically and replays snapshots plus events', async () => {
    const engine = createEngine();
    let current: GameStateEntity = { ...state('initial'), version: 1 };
    await engine.restoreInternalState(9, 'replayable', current);

    for (let index = 1; index <= 13; index += 1) {
      const next = { ...state(`state-${index}`), version: current.version };
      appendPendingGameEvent(next, {
        actorId: 42,
        type: 'game.command.accepted',
        data: { action: { type: 'advance', payload: { index } } },
        visibility: { kind: 'public' },
        occurredAtMs: 1_000 + index,
      });
      const result = await engine.compareAndSetInternalState(
        9,
        'replayable',
        Number(current.version),
        next,
      );
      expect(result.committed).toBe(true);
      current = result.state;
    }

    const events = engine.listEvents(9, 'replayable');
    const snapshot = engine.exportLatestSnapshot(9, 'replayable');
    expect(events).toHaveLength(26);
    expect(events[0]).toMatchObject({
      seq: 1,
      version: 2,
      actorId: 42,
      type: 'game.command.accepted',
    });
    expect(snapshot?.seq).toBe(26);
    expect(engine.replay(9, 'replayable')).toEqual(current);
    expect(current).not.toHaveProperty('engine.pendingEvents');
  });

  it('does not publish events for a rejected stale commit', async () => {
    const engine = createEngine();
    await engine.restoreInternalState(10, 'cas-log', state('initial'));
    await engine.compareAndSetInternalState(10, 'cas-log', 1, state('first'));
    const eventCount = engine.listEvents(10, 'cas-log').length;

    const stale = await engine.compareAndSetInternalState(
      10,
      'cas-log',
      1,
      state('stale'),
    );

    expect(stale.committed).toBe(false);
    expect(engine.listEvents(10, 'cas-log')).toHaveLength(eventCount);
  });
});
