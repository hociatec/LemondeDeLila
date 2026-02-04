import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GerardPresidentPresenterService } from '../presenter/gerard-president-presenter.service';
import { GERARD_PRESIDENT_TARGET_SCORE } from '../model/gerard-president-state.entity';

describe('GerardPresidentPresenterService', () => {
  it('expose catalog & hand cards', () => {
    const service = new GerardPresidentPresenterService();
    const state: GameStateEntity = {
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Ana' },
        { id: 2, username: 'Bérénice' },
      ],
      metadata: {
        rng: {},
        nameDeck: [],
        themeDeck: [],
        specialDeck: [],
        nameDiscard: [],
        themeDiscard: [],
        specialDiscard: [],
        hands: { 1: ['Annie'], 2: [] },
        specialHands: { 1: ['special-sabotage'], 2: [] },
        scores: { 1: 0, 2: 0 },
        masterId: 1,
        currentTheme: null,
        secondTheme: null,
        lockedName: null,
        peaceTurnsRemaining: 0,
        winnerId: null,
        roundNumber: 1,
        targetScore: GERARD_PRESIDENT_TARGET_SCORE,
        submissions: { 2: ['Xavier'] },
        pendingPlayers: [1],
        roundPhase: 'collecting_names',
        specialsPlayed: {},
        extraNamesAllowed: {},
        defenseActive: {},
        specialAttackers: {},
        themeSecretActive: false,
        juryOverrideId: null,
        dominoRemaining: 0,
        ghostNames: [],
      },
    };

    const result = service.exposeStateForUser(state, 1);

    expect(result.catalog).toBeDefined();
    expect(Array.isArray(result.catalog.names)).toBe(true);
    expect(result.catalog.specials?.length).toBeGreaterThan(0);
    expect(result.catalog.themes?.length).toBeGreaterThan(0);
    expect(result.extras?.handCards?.length).toBeGreaterThan(0);
    expect(result.extras?.playerViews?.length).toBe(2);
    expect(result.actions?.some((a) => a.type === 'play_name')).toBe(true);
    expect(result.extras?.submissions?.[2]?.[0]).toContain('Prénom secret');
  });
});
