import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { ArcheDeMnemosyneService } from '../arche-de-mnemosyne.service';

describe('ArcheDeMnemosyneService prompt actions', () => {
  it('exposes prompt actionType so engine can accept submissions', () => {
    const service = new ArcheDeMnemosyneService(
      { register: jest.fn() } as any,
      { appendLog: (s: any) => s } as any,
      {} as any,
      { listCategories: () => [], listQuestions: () => [] } as any,
      {} as any,
    );

    const base: GameStateEntity = {
      status: 'open',
      phase: 'lobby',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [{ id: 1, username: 'hacene' }],
      metadata: {},
    };

    const state = service.hydrateInitialState(base);
    const available = service.getAvailableActions(state, 1).map((a: any) => a.type);

    expect(available).toContain('mnemo_set_config');
    expect(available).toContain('mnemo_prompt_cancel');
  });

  it('shows setup config prompt to room owner even if a bot is first in players[]', () => {
    const service = new ArcheDeMnemosyneService(
      { register: jest.fn() } as any,
      { appendLog: (s: any) => s } as any,
      {} as any,
      { listCategories: () => [], listQuestions: () => [] } as any,
      {} as any,
    );

    const base: GameStateEntity = {
      status: 'open',
      phase: 'lobby',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 99, username: 'Bot', isBot: true } as any,
        { id: 1, username: 'Owner' } as any,
      ],
      metadata: { roomOwnerId: 1 } as any,
    };

    const state = service.hydrateInitialState(base);
    const exposed: any = service.exposeStateForUser(state, 1);
    expect(String(exposed?.pending?.type ?? '')).toBe('config_prompt');
    expect(String(exposed?.pending?.data?.actionType ?? '')).toBe('mnemo_set_config');
  });
});
