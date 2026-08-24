import { TurnLabelService } from './turn-label.service';
import type { GameStateEntity } from '../models/game-state.model';

describe('TurnLabelService', () => {
  let service: TurnLabelService;

  beforeEach(() => {
    service = new TurnLabelService();
  });

  function createState(partial?: Partial<GameStateEntity>): GameStateEntity {
    return {
      status: 'started',
      phase: 'main',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [],
      turn: { currentPlayerId: null, direction: 1 },
      ...partial,
    };
  }

  it('sanitizes zone suffix in current player label', () => {
    const state = createState({
      players: [{ id: 7, username: 'Garfield (zone de jeu)' } as any],
      turn: { currentPlayerId: 7, direction: 1 },
    });

    expect(service.compute(state, 'lama')).toBe("C'est a Garfield de jouer.");
  });
});
