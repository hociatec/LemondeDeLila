import type { GameRuntime } from '../ports/game-runtime.port';
import type { GameState } from '../models/game-state.model';
import { GameAutomationPlannerService } from './game-automation-planner.service';

describe('GameAutomationPlannerService', () => {
  const planner = new GameAutomationPlannerService(
    {
      suggestForHandler: jest.fn().mockReturnValue([{ type: 'play', payload: {} }]),
    } as never,
    {
      getBotStartDelayMs: () => 101,
      getBotTurnDelayMs: () => 202,
      getBotDrawDelayMs: () => 303,
    } as never,
  );

  it.each([
    ['the first bot action', undefined, 101],
    ['a bot response after a player action', { type: 'play', actorId: 1 }, 202],
    ['the action following a bot draw', { type: 'draw', actorId: 2 }, 303],
    ['another bot action', { type: 'play', actorId: 2 }, 202],
  ])('uses the configured delay for %s', (_, lastAction, delay) => {
    const before = Date.now();
    const plan = planner.resolve(
      { getAutomaticActions: () => null } as unknown as GameRuntime,
      state(lastAction),
    );

    expect(plan?.dueAtMs).toBeGreaterThanOrEqual(before + delay);
    expect(plan?.dueAtMs).toBeLessThanOrEqual(Date.now() + delay + 10);
  });
});

function state(
  lastAction?: { type: string; actorId: number },
): GameState {
  return {
    status: 'playing',
    phase: 'turn',
    log: [],
    players: [
      { id: 1, username: 'Lila' },
      { id: 2, username: 'Bot', isBot: true },
    ],
    turn: { currentPlayerId: 2, direction: 1, turnNumber: 4 },
    ...(lastAction
      ? { automation: { lastAction } }
      : {}),
  };
}
