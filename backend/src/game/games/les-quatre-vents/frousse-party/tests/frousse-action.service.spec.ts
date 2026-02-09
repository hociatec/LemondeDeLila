import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { FrousseActionService } from '../actions/frousse-action.service';

describe('FrousseActionService movement effects', () => {
  it('applies combined move effects (advance then back) as a net delta', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 1, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(random, turns, core);

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'hacene' } as any],
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: {
        positions: { 1: 11 }, // case 12 (index-based)
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: {},
          nextRollKeepLowest: {},
          nextRollMalus: {},
          nextRollDouble: {},
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [],
        decks: {
          cards: [
            {
              category: 'Fantôme',
              localNumber: 999,
              text: 'Le fantôme surgit en hurlant.\nAvancez de 5 cases puis reculez de 3.',
            },
          ],
          discard: [],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [{ type: 'draw', payload: {} } as any]);
    const meta: any = next.metadata ?? {};

    // 12 -> +5 -> 17 -> -3 -> 14 (index 13)
    expect(meta.positions?.[1]).toBe(13);
  });
});
