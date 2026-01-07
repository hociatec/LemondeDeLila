import { DameNatureService } from '../dame-nature.service';
import { createDameNatureTestingModule } from './dame-nature-test-harness';

describe('DameNature shortcuts + score extras', () => {
  let game: DameNatureService;

  beforeAll(async () => {
    const moduleRef = await createDameNatureTestingModule();
    game = moduleRef.get(DameNatureService);
  });

  it('expose score panel + shortcut (P) when started', () => {
    const state: any = game.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.status = 'started';
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const exposed: any = game.exposeStateForUser(state, 1);
    const shortcuts = exposed?.extras?.shortcuts ?? [];
    expect(
      shortcuts.some(
        (s: any) =>
          s?.type === 'interface' &&
          s?.id === 'score' &&
          s?.key === 'pressed P',
      ),
    ).toBe(true);

    expect(Array.isArray(exposed?.extras?.score)).toBe(true);
    expect(exposed.extras.score.join(' ')).toContain('Pollution:');
    expect(exposed.extras.score.join(' ')).toContain('Familles:');
  });

  it('expose pollution shortcut (S) when started', () => {
    const state: any = game.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.status = 'started';
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const exposed: any = game.exposeStateForUser(state, 1);
    const shortcuts = exposed?.extras?.shortcuts ?? [];
    expect(
      shortcuts.some(
        (s: any) =>
          s?.type === 'interface' &&
          s?.id === 'pollution' &&
          s?.key === 'pressed S',
      ),
    ).toBe(true);
  });
});
