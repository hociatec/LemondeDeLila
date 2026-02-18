import { GameCoreService } from '../../../core/services/game-core.service';
import { PromptPoliciesService } from './prompt-policies.service';

describe('PromptPoliciesService', () => {
  let service: PromptPoliciesService;
  let core: { appendLog: jest.Mock };

  beforeEach(() => {
    core = {
      appendLog: jest.fn((state: any, message: string) => ({
        ...state,
        log: [...(state.log ?? []), { message }],
      })),
    };
    service = new PromptPoliciesService(core as unknown as GameCoreService);
  });

  it('appends log once and avoids duplicate consecutive entries', () => {
    const state: any = { log: [{ message: 'A' }] };
    const same = service.appendLogOnce(state, 'A');
    expect(same).toBe(state);

    const next = service.appendLogOnce(state, 'B');
    expect(core.appendLog).toHaveBeenCalledWith(state, 'B');
    expect(next.log.at(-1)?.message).toBe('B');
  });

  it('ensures pending prompt for pending.playerId', () => {
    const state: any = {
      pending: { type: 'choose_pawn', playerId: 7 },
      turn: { currentPlayerId: 1, direction: 1 },
      log: [],
    };
    service.ensurePendingPlayerPrompt(state, 'choose_pawn', (id) => `P${id}`);
    expect(core.appendLog).toHaveBeenCalledWith(state, 'P7');
  });

  it('falls back to turn.currentPlayerId when pending playerId is absent', () => {
    const state: any = {
      pending: { type: 'draw' },
      turn: { currentPlayerId: 3, direction: 1 },
      log: [],
    };
    service.ensurePendingPlayerPrompt(state, 'draw', (id) => `P${id}`);
    expect(core.appendLog).toHaveBeenCalledWith(state, 'P3');
  });
});
