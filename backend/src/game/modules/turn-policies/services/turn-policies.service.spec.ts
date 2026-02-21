import { GameCoreService } from '../../../core/services/game-core.service';
import { TurnPoliciesService } from './turn-policies.service';

describe('TurnPoliciesService non-regression', () => {
  let service: TurnPoliciesService;
  let core: { appendLog: jest.Mock };

  beforeEach(() => {
    core = {
      appendLog: jest.fn((state: any, message: string) => ({
        ...state,
        log: [...(state.log ?? []), { message }],
      })),
    };
    service = new TurnPoliciesService(core as unknown as GameCoreService);
  });

  it('resolves player names even when ids are serialized as strings', () => {
    const state: any = {
      players: [{ id: '7', username: 'Olaf (zone de jeu)' }],
      log: [],
    };
    expect(service.playerName(state, 7)).toBe('Olaf');
  });

  it('appends a canonical turn announcement', () => {
    const state: any = {
      players: [{ id: 3, username: 'Lila' }],
      log: [],
    };
    const out = service.appendTurnAnnouncement(state, 3);
    expect(core.appendLog).toHaveBeenCalledWith(
      state,
      "C'est au tour de Lila.",
    );
    expect(out.log.at(-1)?.message).toBe("C'est au tour de Lila.");
  });
});
