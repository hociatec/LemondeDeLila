import { Test } from '@nestjs/testing';
import { LoupGarouModule } from '../loup-garou.module';
import { LoupGarouService } from '../loup-garou.service';

function act(type: string, payload: any, actorId: number) {
  return { type, payload, meta: { actorId } } as any;
}

describe('LoupGarouService scenario (8 players)', () => {
  let service: LoupGarouService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoupGarouModule],
    }).compile();
    service = moduleRef.get(LoupGarouService);
  });

  it('village can win against 2 wolves over two day cycles', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    let state: any = service.hydrateInitialState({
      players: Array.from({ length: 8 }).map((_, idx) => ({
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
    expect(wolves.length).toBe(2);

    const peekTarget = [1, 2, 3, 4, 5, 6, 7, 8].find((id) => id !== seerId)!;
    state = service.applyActions(state, [
      act('seer_peek', { targetId: peekTarget }, seerId),
    ]);
    state = service.applyActions(state, [
      act('cupid_link', { a: seerId, b: cupidId }, cupidId),
    ]);

    // Night 1: both wolves choose the same victim, witch does nothing.
    const wolvesTarget = [1, 2, 3, 4, 5, 6, 7, 8].find(
      (id) => !wolves.includes(id) && id !== witchId,
    )!;
    for (const wolfId of wolves) {
      state = service.applyActions(state, [
        act('wolves_choose', { targetId: wolvesTarget }, wolfId),
      ]);
    }
    state = service.applyActions(state, [
      act('witch_decide', { save: false, killTargetId: null }, witchId),
    ]);

    // Day 1: execute first wolf
    while (state.metadata.step !== 'day-vote') {
      state = (service as any).phases.advanceState(state);
    }
    const living1: number[] = (state.players ?? [])
      .filter((p: any) => p && p.alive !== false)
      .map((p: any) => p.id);
    for (const voterId of living1) {
      state = service.applyActions(state, [
        act('day_vote', { targetId: wolves[0] }, voterId),
      ]);
    }

    // Progress to next night (seer again), then day 2 execute second wolf.
    for (let i = 0; i < 20 && state.metadata.step !== 'seer'; i++) {
      state = (service as any).phases.advanceState(state);
    }
    expect(state.metadata.step).toBe('seer');
    const livingBeforePeek2: number[] = (state.players ?? [])
      .filter((p: any) => p && p.alive !== false)
      .map((p: any) => p.id);
    const peekTarget2 = livingBeforePeek2.find((id) => id !== seerId)!;
    state = service.applyActions(state, [
      act('seer_peek', { targetId: peekTarget2 }, seerId),
    ]);

    // Night 2: remaining wolf chooses, witch does nothing.
    const remainingWolf = wolves[1];
    // Advance until wolves step
    for (let i = 0; i < 20 && state.metadata.step !== 'wolves'; i++) {
      state = (service as any).phases.advanceState(state);
    }
    const livingBeforeWolf2: number[] = (state.players ?? [])
      .filter((p: any) => p && p.alive !== false)
      .map((p: any) => p.id);
    const wolvesTarget2 = livingBeforeWolf2.find(
      (id) =>
        id !== remainingWolf &&
        (state.metadata.roles?.[id] ?? '') !== 'werewolf',
    )!;
    state = service.applyActions(state, [
      act('wolves_choose', { targetId: wolvesTarget2 }, remainingWolf),
    ]);
    for (let i = 0; i < 20 && state.metadata.step !== 'witch'; i++) {
      state = (service as any).phases.advanceState(state);
    }
    state = service.applyActions(state, [
      act('witch_decide', { save: false, killTargetId: null }, witchId),
    ]);

    // Day 2: execute last wolf -> village victory
    while (state.metadata.step !== 'day-vote') {
      state = (service as any).phases.advanceState(state);
    }
    const living2: number[] = (state.players ?? [])
      .filter((p: any) => p && p.alive !== false)
      .map((p: any) => p.id);
    for (const voterId of living2) {
      state = service.applyActions(state, [
        act('day_vote', { targetId: remainingWolf }, voterId),
      ]);
    }
    for (
      let i = 0;
      i < 20 && String(state.status ?? '').toLowerCase() !== 'finished';
      i++
    ) {
      state = (service as any).phases.advanceState(state);
    }
    expect(String(state.status ?? '').toLowerCase()).toBe('finished');
    expect(state.metadata.winner).toBe('village');

    randomSpy.mockRestore();
  });
});
