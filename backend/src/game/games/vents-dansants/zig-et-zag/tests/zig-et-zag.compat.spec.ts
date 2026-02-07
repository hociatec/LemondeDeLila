import * as Rulebook from '../rulebook/rulebook';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { ZigEtZagActionService } from '../actions/zig-et-zag-action.service';
import { ZigEtZagSetupService } from '../setup/zig-et-zag-setup.service';
import { RandomService } from '../../../../modules/random/services/random.service';

describe('ZigEtZag compat', () => {
  it('exposes draw_card actions even if waitingPlayers ids are serialized as strings', async () => {
    const service = new ZigEtZagActionService(
      new GameCoreService(),
      new TurnFlowService(new TurnService()),
      new RandomService(),
    );

    const state: any = {
      status: 'started',
      phase: 'turn',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        playerDecks: { '1': ['zig-1'], '2': ['zig-2'] },
        // Simule une serialisation JSON "agressive" ou stockage non typé.
        roundState: {
          stage: 'selection',
          plays: [
            { playerId: '1', playedCards: [] },
            { playerId: '2', playedCards: [] },
          ],
          waitingPlayers: ['1', '2'],
          tiedPlayers: [],
          triggerColors: {},
          triggerFamilies: {},
          battleLog: [],
        },
        lastRound: null,
        winnerId: null,
      },
    };

    const actions = Rulebook.getAvailableActions(state, 2);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a: any) => String(a?.type) === 'draw_card')).toBe(true);

    // The service should be able to apply the action even if ids are strings in the roundState.
    const after: any = service.applyActions(state, [
      { type: 'draw_card', payload: {}, meta: { actorId: 2 } },
    ] as any);

    expect((after.metadata?.playerDecks?.['2'] ?? []).length).toBe(0);
  });

  it('prefers a waiting bot as currentPlayerId on hydrateInitialState (for bot scheduling)', async () => {
    const setup = new ZigEtZagSetupService(new RandomService());

    const base: any = {
      status: 'started',
      phase: 'turn',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Human', isBot: false },
        { id: -2, username: 'Bot', isBot: true },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {},
    };

    const hydrated: any = setup.hydrateInitialState(base);
    expect(hydrated.turn?.currentPlayerId).toBe(-2);
  });
});
