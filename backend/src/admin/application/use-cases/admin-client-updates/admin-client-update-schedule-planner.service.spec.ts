import { AdminClientUpdateSchedulePlannerService } from './admin-client-update-schedule-planner.service';

describe('AdminClientUpdateSchedulePlannerService', () => {
  it('computes the default five-minute warning plan', () => {
    const planner = new AdminClientUpdateSchedulePlannerService();

    expect(
      planner.createPlan(
        { actor: { id: 1, username: 'admin' }, delayMinutes: 10 },
        1_000,
      ),
    ).toEqual({
      effectiveDelaySeconds: 600,
      delayMs: 600_000,
      scheduledAtMs: 601_000,
      warningDelayMs: 300_000,
      imminentMessage: 'Mise à jour imminente dans cinq minutes.',
    });
  });

  it('clamps short delays and keeps custom message', () => {
    const planner = new AdminClientUpdateSchedulePlannerService();
    const plan = planner.createPlan({
      actor: { id: 1, username: 'admin' },
      delaySeconds: 5,
      message: 'custom',
    });

    expect(plan.effectiveDelaySeconds).toBe(60);
    expect(plan.imminentMessage).toBe('custom');
  });
});
