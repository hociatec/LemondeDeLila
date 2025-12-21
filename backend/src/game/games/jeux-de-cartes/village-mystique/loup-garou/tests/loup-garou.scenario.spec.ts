import { Test } from '@nestjs/testing';
import { LoupGarouModule } from '../loup-garou.module';
import { LoupGarouService } from '../loup-garou.service';

function action(type: string, payload: any, actorId: number) {
  return { type, payload, meta: { actorId } } as any;
}

describe('LoupGarouService scenario', () => {
  let service: LoupGarouService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoupGarouModule],
    }).compile();
    service = moduleRef.get(LoupGarouService);
  });

  it('plays through one full night/day and reaches a winner deterministically', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    let state: any = service.hydrateInitialState({
      players: Array.from({ length: 6 }).map((_, idx) => ({
        id: idx + 1,
        username: `P${idx + 1}`,
      })),
      status: 'started',
    } as any);

    const roles: Record<string, string> = state.metadata.roles;
    const idsByRole = (role: string) =>
      Object.entries(roles)
        .filter(([, r]) => r === role)
        .map(([id]) => Number(id));

    const seerId = idsByRole('seer')[0];
    const cupidId = idsByRole('cupid')[0];
    const witchId = idsByRole('witch')[0];
    const wolves = idsByRole('werewolf');
    expect(seerId).toBeTruthy();
    expect(cupidId).toBeTruthy();
    expect(witchId).toBeTruthy();
    expect(wolves.length).toBeGreaterThan(0);

    // Night: seer
    expect(state.metadata.step).toBe('seer');
    const peekTarget = [1, 2, 3, 4, 5, 6].find((id) => id !== seerId)!;
    state = service.applyActions(state, [
      action('seer_peek', { targetId: peekTarget }, seerId),
    ]);
    expect(state.metadata.step).toBe('cupid');

    // Night: cupid links two lovers
    const lovers = [seerId, cupidId] as const;
    state = service.applyActions(state, [
      action('cupid_link', { a: lovers[0], b: lovers[1] }, cupidId),
    ]);
    expect(state.metadata.step).toBe('wolves');

    // Night: wolves vote to kill a target (all wolves can act out-of-turn)
    const wolvesTarget = [1, 2, 3, 4, 5, 6].find(
      (id) => !wolves.includes(id) && id !== witchId,
    )!;
    for (const wolfId of wolves) {
      state = service.applyActions(state, [
        action('wolves_choose', { targetId: wolvesTarget }, wolfId),
      ]);
    }
    expect(state.metadata.step).toBe('witch');

    // Night: witch does nothing (consume the phase)
    state = service.applyActions(state, [
      action('witch_decide', { save: false, killTargetId: null }, witchId),
    ]);
    // After night resolution, move to day vote or victory check depending on deaths.
    expect(['day-vote', 'check-victory', 'seer']).toContain(
      state.metadata.step,
    );

    // Day: everyone votes to execute the first werewolf (fast win for village).
    const wolfToExecute = wolves[0];
    const living: number[] = (state.players ?? [])
      .filter((p: any) => p && p.alive !== false)
      .map((p: any) => p.id);
    // Ensure we're in voting step.
    while (
      state.metadata.step !== 'day-vote' &&
      (state.status || '').toLowerCase() === 'started'
    ) {
      state = (service as any).phases.advanceState(state);
    }
    expect(state.metadata.step).toBe('day-vote');

    for (const voterId of living) {
      state = service.applyActions(state, [
        action('day_vote', { targetId: wolfToExecute }, voterId),
      ]);
    }

    // Endgame: engine should eventually mark finished with village victory.
    const status = String(state.status ?? '').toLowerCase();
    expect(['finished', 'started']).toContain(status);
    if (status === 'started') {
      // advance until finished (safety loop)
      for (
        let i = 0;
        i < 10 && String(state.status ?? '').toLowerCase() !== 'finished';
        i++
      ) {
        state = (service as any).phases.advanceState(state);
      }
    }
    expect(String(state.status ?? '').toLowerCase()).toBe('finished');
    expect(state.metadata.winner).toBe('village');

    randomSpy.mockRestore();
  });
});
