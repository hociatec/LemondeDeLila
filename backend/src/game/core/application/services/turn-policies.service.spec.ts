import { TurnPoliciesService } from './turn-policies.service';

describe('TurnPoliciesService', () => {
  it('falls back to Joueur {id} when username is missing', () => {
    const core = { appendLog: jest.fn((state) => state) } as any;
    const service = new TurnPoliciesService(core);
    const state: any = { players: [{ id: 3 }] };
    expect(service.playerName(state, 3)).toBe('Joueur 3');
  });
});
