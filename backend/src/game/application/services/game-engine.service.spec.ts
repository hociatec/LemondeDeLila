import { GameEngineService } from './game-engine.service';
import type { GameStateEntity } from '../models/game-state.model';

describe('GameEngineService room cleanup', () => {
  const state = (label: string) =>
    ({ status: 'started', metadata: { label } }) as GameStateEntity;

  it('clears every game snapshot for one room only', async () => {
    const engine = new GameEngineService();
    await engine.restoreInternalState(4, 'lama', state('lama'));
    await engine.restoreInternalState(4, 'other', state('other'));
    await engine.restoreInternalState(5, 'lama', state('kept'));

    await engine.clearRoom(4);

    expect(await engine.exportInternalState(4, 'lama')).toBeNull();
    expect(await engine.exportInternalState(4, 'other')).toBeNull();
    expect(await engine.exportInternalState(5, 'lama')).not.toBeNull();
  });

  it('does not clear a newer snapshot while cleaning a stale commit', async () => {
    const engine = new GameEngineService();
    const stale = state('stale');
    const current = state('current');
    await engine.restoreInternalState(4, 'lama', current);

    await engine.clearInternalStateIf(4, 'lama', stale);

    expect(await engine.exportInternalState(4, 'lama')).toBe(current);
  });
});
