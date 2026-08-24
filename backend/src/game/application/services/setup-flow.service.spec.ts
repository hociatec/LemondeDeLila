import { SetupFlowService } from './setup-flow.service';

describe('SetupFlowService', () => {
  it('creates a sequential pending choice for the first unassigned player', () => {
    const service = new SetupFlowService();
    const result = service.createSequentialChoicePending({
      players: [
        { id: 1, username: 'Lila' },
        { id: 2, username: 'Nina' },
      ],
      isAssigned: (playerId) => playerId === 1,
      pendingType: 'pick_role',
      choices: [{ id: 'a', label: 'Alpha' }],
    });

    expect(result?.playerId).toBe(2);
    expect(result?.turnIndex).toBe(1);
    expect(result?.pending.type).toBe('pick_role');
  });
});
