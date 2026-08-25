import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { createLamaServiceForTest } from '../../tests/lama-test-harness';

describe('LamaService automation', () => {
  it('declares the end of round pause as an automatic transition', () => {
    const { service } = createLamaServiceForTest();
    const plan = service.getAutomaticActions({
      turnIndex: 8,
      round: 3,
      metadata: {
        step: 'round_pause',
        roundNumber: 3,
        roundPauseUntilMs: 12345,
      },
    } as unknown as GameStateEntity);

    expect(plan).toEqual({
      key: 'round-pause:3',
      executeAtMs: 12345,
      actions: [{ type: 'lama_resume_round', payload: {} }],
    });
  });
});
