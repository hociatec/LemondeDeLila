import { PendingRequirementService } from './pending-requirement.service';

describe('PendingRequirementService', () => {
  it('stores and returns pending requirement by player id', () => {
    const service = new PendingRequirementService<{ choice: string }>();
    service.set({ playerId: 5, type: 'quiz', payload: { choice: 'A' } });
    expect(service.get(5)).toEqual({
      playerId: 5,
      type: 'quiz',
      payload: { choice: 'A' },
    });
  });

  it('clears pending requirement by player id', () => {
    const service = new PendingRequirementService();
    service.set({ playerId: 5, type: 'quiz' });
    service.clear(5);
    expect(service.get(5)).toBeUndefined();
  });
});
