import { Test } from '@nestjs/testing';
import { LoupGarouModule } from '../loup-garou.module';
import { LoupGarouService } from '../loup-garou.service';

describe('LoupGarouService', () => {
  let service: LoupGarouService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoupGarouModule],
    }).compile();
    service = moduleRef.get(LoupGarouService);
  });

  it('does not assign roles before the room is started', () => {
    const hydrated: any = service.hydrateInitialState({
      players: Array.from({ length: 6 }).map((_, idx) => ({
        id: idx + 1,
        username: `P${idx + 1}`,
      })),
      status: 'setup',
    } as any);

    expect(hydrated.status).toBe('setup');
    expect(Object.keys(hydrated.metadata?.roles ?? {})).toHaveLength(0);
  });

  it('starts from the seer when the room is started', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const hydrated: any = service.hydrateInitialState({
      players: Array.from({ length: 6 }).map((_, idx) => ({
        id: idx + 1,
        username: `P${idx + 1}`,
      })),
      status: 'started',
    } as any);

    const roles: Record<string, string> = hydrated.metadata.roles;
    const seerId = Number(
      Object.entries(roles).find(([, r]) => r === 'seer')?.[0],
    );
    expect(Number.isFinite(seerId)).toBe(true);
    expect(hydrated.turn?.currentPlayerId).toBe(seerId);

    const actions = service.getAvailableActions(hydrated, seerId) as any[];
    expect(actions.some((a) => a.type === 'seer_peek')).toBe(true);

    randomSpy.mockRestore();
  });

  it('exposeStateForUser hides full role mapping but includes myRole', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const hydrated: any = service.hydrateInitialState({
      players: Array.from({ length: 6 }).map((_, idx) => ({
        id: idx + 1,
        username: `P${idx + 1}`,
      })),
      status: 'started',
    } as any);

    const roles: Record<string, string> = hydrated.metadata.roles;
    const seerId = Number(
      Object.entries(roles).find(([, r]) => r === 'seer')?.[0],
    );

    const exposed: any = service.exposeStateForUser(hydrated, seerId);
    expect(exposed.metadata?.roles).toBeUndefined();
    expect(exposed.metadata?.myRole).toBe('seer');

    randomSpy.mockRestore();
  });

  it('does not leak lastPeek to non-seer users', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const hydrated: any = service.hydrateInitialState({
      players: Array.from({ length: 6 }).map((_, idx) => ({
        id: idx + 1,
        username: `P${idx + 1}`,
      })),
      status: 'started',
    } as any);

    const roles: Record<string, string> = hydrated.metadata.roles;
    const seerId = Number(
      Object.entries(roles).find(([, r]) => r === 'seer')?.[0],
    );
    const otherId = [1, 2, 3, 4, 5, 6].find((id) => id !== seerId) as number;

    const after: any = service.applyActions(hydrated, [
      { type: 'seer_peek', payload: { targetId: otherId } },
    ] as any);

    const exposedOther: any = service.exposeStateForUser(after, otherId);
    expect(exposedOther.metadata?.lastPeek).toBeUndefined();

    const exposedSeer: any = service.exposeStateForUser(after, seerId);
    expect(exposedSeer.metadata?.lastPeek).toBeTruthy();

    randomSpy.mockRestore();
  });
});
