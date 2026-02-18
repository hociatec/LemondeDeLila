import { BadRequestException } from '@nestjs/common';
import { SetupFlowService } from '../../modules/setup-flow/services/setup-flow.service';
import { GridCellActionsService } from '../../modules/grid/services/grid-cell-actions.service';
import { MorpionPresenter } from '../../games/vents-sacres/morpion/morpion.presenter';
import { MorpionService } from '../../games/vents-sacres/morpion/morpion.service';
import { GameEngineService } from '../services/game-engine.service';

describe('Critical Cases Matrix', () => {
  const createMorpion = () =>
    new MorpionService(
      { register: () => {} } as any,
      new MorpionPresenter(new GridCellActionsService()),
    );

  it('debut de partie: hydrate un etat started avec un joueur courant', () => {
    const service = createMorpion();
    const state: any = service.hydrateInitialState({
      status: 'setup',
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    expect(state.status).toBe('started');
    expect(state.turn?.currentPlayerId).toBe(1);
  });

  it('choix pion: cree un pending bloquant avec playerId cible', () => {
    const setupFlow = new SetupFlowService();
    const out = setupFlow.createSequentialPawnPending({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      startPlayerId: 1,
      isAssigned: (id) => id === 1,
      pawns: [
        { id: 'chat', label: 'Chat' },
        { id: 'chien', label: 'Chien' },
      ],
      pendingType: 'choose_pawn',
    });

    expect(out).not.toBeNull();
    expect(out?.pending.type).toBe('choose_pawn');
    expect(out?.pending.blocking).toBe(true);
    expect(out?.pending.playerId).toBe(2);
  });

  it('tour suivant: apres une action valide, le tour passe au joueur suivant', () => {
    const service = createMorpion();
    let state: any = service.hydrateInitialState({
      status: 'started',
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    state = service.applyActions(state, [
      { type: 'morpion_play', payload: { x: 0, y: 0 }, meta: { actorId: 1 } } as any,
    ]);
    expect(state.turn?.currentPlayerId).toBe(2);
  });

  it('victoire: une ligne gagnante termine la partie avec winnerId', () => {
    const service = createMorpion();
    let state: any = service.hydrateInitialState({
      status: 'started',
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    const play = (actorId: number, x: number, y: number) =>
      ({ type: 'morpion_play', payload: { x, y }, meta: { actorId } }) as any;

    state = service.applyActions(state, [play(1, 0, 0)]);
    state = service.applyActions(state, [play(2, 0, 1)]);
    state = service.applyActions(state, [play(1, 1, 0)]);
    state = service.applyActions(state, [play(2, 1, 1)]);
    state = service.applyActions(state, [play(1, 2, 0)]);

    expect(state.status).toBe('finished');
    expect((state.metadata as any).winnerId).toBe(1);
  });

  it("erreurs d'action: une action indisponible est rejetee pour le joueur courant", async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { logValidationFailure: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } as any,
      {} as any,
    );

    const state: any = {
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { type: 'draw', playerId: 1, blocking: true },
      metadata: { gameType: 'morpion', roomId: 1 },
    };
    const handler: any = {
      getAvailableActions: jest.fn(() => [{ type: 'draw', payload: {} }]),
    };

    await expect(
      (engine as any).validateActions(
        state,
        handler,
        [{ type: 'play_card', payload: {} }],
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
