import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { ContesBotService } from '../../application/services/contes-bot.service';

function makeState(overrides: Partial<GameStateEntity> = {}): GameStateEntity {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'P1' } as any,
      { id: 2, username: 'Bot', isBot: true } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      statuses: {
        blockedUntilPassed: {},
      },
    } as any,
    pending: null,
    botThinking: false,
    ...overrides,
  };
}

describe('ContesBotService', () => {
  it('returns no action when bot is neither current nor pending owner', () => {
    const choose = jest.fn();
    const service = new ContesBotService({ choose } as any);

    const actions = service.getBotActions(makeState(), 2);

    expect(actions).toEqual([]);
    expect(choose).not.toHaveBeenCalled();
  });

  it('delegates to bot runner when pending is assigned to bot', () => {
    const choose = jest.fn(() => [{ type: 'draw', payload: {} }]);
    const service = new ContesBotService({ choose } as any);

    const actions = service.getBotActions(
      makeState({
        pending: {
          type: 'draw',
          playerId: 2,
          blocking: true,
        } as any,
      }),
      2,
    );

    expect(choose).toHaveBeenCalledTimes(1);
    expect(actions).toEqual([{ type: 'draw', payload: {} }]);
  });
});





