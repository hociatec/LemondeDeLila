import { AFondLesBallonsActionService } from '../../application/services/a-fond-les-ballons-action.service';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';

describe('AFondLesBallonsActionService', () => {
  function createService(): AFondLesBallonsActionService {
    return new AFondLesBallonsActionService(
      new GameCoreService(),
      {} as any,
      {} as any,
      {} as any,
      new SetupFlowService(),
    );
  }

  it('announces the next player when advancing turn with skip logs', () => {
    const service = createService();
    const state: any = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Bucky' },
      ],
      log: [],
      metadata: {
        statuses: { skipTurn: {} },
      },
    };

    const next: any = (service as any).advanceTurnWithSkipLogs(state);
    const messages = (next.log ?? []).map((x: any) => String(x?.message ?? ''));

    expect(next.turn?.currentPlayerId).toBe(2);
    expect(messages).toContain("C'est au tour de Bucky.");
  });

  it('announces the starter after the last pawn is chosen', () => {
    const service = createService();
    const state: any = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'Lilas' }],
      log: [],
      pending: {
        type: 'choose_pawn',
        playerId: 1,
        blocking: true,
        data: {
          pawns: [
            {
              id: 'lutin',
              label: 'Lutin',
              description: 'Petit aventurier.',
            },
          ],
        },
      },
      metadata: {
        setupStarterId: 1,
        pawns: [
          {
            id: 'lutin',
            label: 'Lutin',
            description: 'Petit aventurier.',
          },
        ],
        pawnByPlayerId: {},
        charactersByPlayerId: {},
      },
    };

    const next: any = service.applyActions(state, [
      { type: 'choose_pawn', payload: { pawn: 'lutin' } } as any,
    ]);
    const messages = (next.log ?? []).map((x: any) => String(x?.message ?? ''));

    expect(next.pending).toBeNull();
    expect(next.turn?.currentPlayerId).toBe(1);
    expect(messages).toContain("C'est au tour de Lilas de débuter.");
  });

  it('announces the next pawn chooser immediately after a human choice', () => {
    const service = createService();
    const state: any = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'hacene' },
        { id: -2, username: 'Karaba', isBot: true },
      ],
      log: [{ message: "C'est à hacene de choisir son pion." }],
      pending: {
        type: 'choose_pawn',
        playerId: 1,
        blocking: true,
        data: {
          pawns: [
            { id: 'cap', label: 'Capitaine Cacahuète', description: '' },
            { id: 'ham', label: 'Hamstero Dynamite', description: '' },
          ],
        },
      },
      metadata: {
        setupStarterId: 1,
        pawns: [
          { id: 'cap', label: 'Capitaine Cacahuète', description: '' },
          { id: 'ham', label: 'Hamstero Dynamite', description: '' },
        ],
        pawnByPlayerId: {},
        charactersByPlayerId: {},
      },
    };

    const next: any = service.applyActions(state, [
      { type: 'choose_pawn', payload: { pawn: 'cap' } } as any,
    ]);
    const messages = (next.log ?? []).map((x: any) => String(x?.message ?? ''));

    expect(next.pending?.playerId).toBe(-2);
    expect(messages).toEqual([
      "C'est à hacene de choisir son pion.",
      'hacene a choisi le pion: Capitaine Cacahuète.',
      "C'est à Karaba de choisir son pion.",
    ]);
  });
});
