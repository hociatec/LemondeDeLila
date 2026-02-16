import { TurnLabelService } from './turn-label.service';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';

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
      players: [{ id: 7, username: 'Garfield (zone de jeu)' }],
      turn: { currentPlayerId: 7, direction: 1 },
    });

    expect(service.compute(state, 'lama')).toBe("C'est à Garfield de jouer.");
  });

  it('sanitizes zone suffix when using turnIndex fallback', () => {
    const state = createState({
      turn: { currentPlayerId: null, direction: 1 },
      turnIndex: 0,
      players: [{ id: 3, username: 'Olaf (game zone)' }],
    });

    expect(service.compute(state, 'jeu-oie')).toBe("C'est à Olaf de jouer.");
  });

  it('keeps numeric fallback when sanitized username is empty', () => {
    const state = createState({
      turn: { currentPlayerId: 2, direction: 1 },
      players: [{ id: 2, username: '   ' }],
    });

    expect(service.compute(state, 'lama')).toBe("C'est à Joueur 2 de jouer.");
  });
});
