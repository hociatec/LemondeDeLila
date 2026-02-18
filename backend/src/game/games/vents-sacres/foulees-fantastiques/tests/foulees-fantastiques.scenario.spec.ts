import * as Rulebook from '../rulebook/rulebook';
import { FouleesFantastiquesActionService } from '../actions/foulees-fantastiques-action.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';

describe('FouleesFantastiques scenario', () => {
  it('offers roll when nothing pending', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'A' }],
    };

    const actions = Rulebook.getAvailableActions(state, 1);
    expect(actions.map((a: any) => a.type)).toContain('roll');
  });

  it('canonicalizes legacy ROLL_DICE action', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'A' }],
    };

    const validated = Rulebook.validateAction(
      state,
      { type: 'ROLL_DICE', payload: { anything: true } } as any,
      1,
    );
    expect(validated).toEqual({ type: 'roll', payload: {} });
  });

  it('logs family-choice prompt during setup when selection is pending', () => {
    const service = new FouleesFantastiquesActionService(
      { rollDice: () => ({ roll: 1, meta: {} }) } as any,
      new TurnFlowService(
        new TurnService(),
        new TurnPoliciesService(new GameCoreService()),
      ),
      new GameCoreService(),
      { recomputeBoardView: (s: any) => s } as any,
      new SetupFlowService(),
    );

    const state: any = {
      status: 'started',
      phase: 'setup',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Bucky' },
      ],
      log: [],
      pending: null,
      metadata: {
        familyIdByPlayer: {},
      },
    };

    const next: any = service.applyActions(state, [{ type: 'roll', payload: {} } as any]);
    expect(next.pending?.type).toBe('choose_family');
    const messages = (next.log ?? []).map((x: any) => String(x?.message ?? ''));
    expect(messages).toContain("Lilas doit choisir une famille d'animaux.");
  });

  it('announces next player after ending a turn without moves', () => {
    const service = new FouleesFantastiquesActionService(
      { rollDice: () => ({ roll: 1, meta: {} }) } as any,
      new TurnFlowService(
        new TurnService(),
        new TurnPoliciesService(new GameCoreService()),
      ),
      new GameCoreService(),
      { recomputeBoardView: (s: any) => s } as any,
      new SetupFlowService(),
    );

    const state: any = {
      status: 'started',
      phase: 'turn',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Bucky' },
      ],
      log: [],
      pending: null,
      metadata: {
        trackLength: 40,
        homeLength: 4,
        offsets: { 1: 0, 2: 20 },
        safeTiles: [0, 20],
        pawnsByPlayer: {
          1: [
            { pawnIndex: 0, progress: -1 },
            { pawnIndex: 1, progress: -1 },
            { pawnIndex: 2, progress: -1 },
            { pawnIndex: 3, progress: -1 },
          ],
          2: [
            { pawnIndex: 0, progress: -1 },
            { pawnIndex: 1, progress: -1 },
            { pawnIndex: 2, progress: -1 },
            { pawnIndex: 3, progress: -1 },
          ],
        },
        statuses: { skipTurn: {} },
      },
    };

    const next: any = service.applyActions(state, [{ type: 'roll', payload: {} } as any]);
    expect(next.turn?.currentPlayerId).toBe(2);
    const messages = (next.log ?? []).map((x: any) => String(x?.message ?? ''));
    expect(messages).toContain("C'est au tour de Bucky.");
  });
});
