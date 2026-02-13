import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { JeuOieActionService } from '../actions/jeu-oie-action.service';
import { JeuOieSetupService } from '../setup/jeu-oie-setup.service';

function baseState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Otis', isBot: true } as any,
      { id: 2, username: 'Wallace', isBot: true } as any,
      { id: 3, username: 'Lilas', isBot: false } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      gameType: 'jeu-oie',
      roomStartedAt: '2026-02-13T00:00:00.000Z',
      roomRunId: 1,
      rng: { seed: 123, counter: 0 },
    } as any,
  } as any;
}

describe('JeuOieActionService', () => {
  it('utilise un pion immersif et evite le doublon du label de case', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        GameContentLoaderService,
        RandomService,
        { provide: 'TurnFlowService', useValue: { advanceTurn: (s: any) => s } },
        JeuOieSetupService,
        {
          provide: JeuOieActionService,
          useFactory: (
            random: RandomService,
            core: GameCoreService,
            turns: { advanceTurn: (s: any) => any },
          ) => new JeuOieActionService(random, turns as any, core),
          inject: [RandomService, GameCoreService, 'TurnFlowService'],
        },
      ],
    }).compile();

    const setup = moduleRef.get(JeuOieSetupService);
    const actions = moduleRef.get(JeuOieActionService);
    const random = moduleRef.get(RandomService);

    let state = setup.hydrateInitialState(baseState());
    state = actions.applyActions(state, [
      { type: 'choose_pawn', payload: { pawnId: 'coq-rockeur' } } as any,
      { type: 'choose_pawn', payload: { pawnId: 'vache-artistique' } } as any,
      { type: 'choose_pawn', payload: { pawnId: 'cochon-gourmand' } } as any,
    ]);
    state = {
      ...state,
      pending: null,
      turn: { currentPlayerId: 1, direction: 1 },
      turnIndex: 0,
      log: [],
    };

    jest.spyOn(random, 'rollDice').mockReturnValue({
      roll: 3,
      dice: [3],
      meta: (state.metadata ?? {}) as any,
    } as any);

    const next = actions.applyActions(state, [{ type: 'roll', payload: {} } as any]);
    const messages = (next.log ?? []).map((e: any) => String(e?.message ?? ''));

    expect(messages.some((m) => m.includes('Otis place "son coq rockeur" en case 4 (Case neutre).'))).toBe(true);
    expect(messages.some((m) => m.includes('case 4 (Case 4 - Case neutre)'))).toBe(false);
  });

  it('demande de choisir un pion au demarrage', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [GameCoreService, GameContentLoaderService, JeuOieSetupService],
    }).compile();

    const setup = moduleRef.get(JeuOieSetupService);
    const state = setup.hydrateInitialState(baseState());
    const meta: any = state.metadata ?? {};

    expect(meta.pawnByPlayerId?.[1]).toBeUndefined();
    expect(meta.pawnByPlayerId?.[2]).toBeUndefined();
    expect(meta.pawnByPlayerId?.[3]).toBeUndefined();
    expect(state.pending?.type).toBe('choose_pawn');
    expect((state.pending as any)?.playerId).toBe(1);
    const messages = (state.log ?? []).map((e: any) => String(e?.message ?? ''));
    expect(messages.some((m) => /Otis doit choisir un pion\./.test(m))).toBe(true);
  });

  it('demarre la partie apres le choix de pion de tous les joueurs', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        GameContentLoaderService,
        RandomService,
        { provide: 'TurnFlowService', useValue: { advanceTurn: (s: any) => s } },
        JeuOieSetupService,
        {
          provide: JeuOieActionService,
          useFactory: (
            random: RandomService,
            core: GameCoreService,
            turns: { advanceTurn: (s: any) => any },
          ) => new JeuOieActionService(random, turns as any, core),
          inject: [RandomService, GameCoreService, 'TurnFlowService'],
        },
      ],
    }).compile();

    const setup = moduleRef.get(JeuOieSetupService);
    const actions = moduleRef.get(JeuOieActionService);
    const state = setup.hydrateInitialState(baseState());

    const next = actions.applyActions(state, [
      { type: 'choose_pawn', payload: { pawnId: 'coq-rockeur' } } as any,
      { type: 'choose_pawn', payload: { pawnId: 'vache-artistique' } } as any,
      { type: 'choose_pawn', payload: { pawnId: 'cochon-gourmand' } } as any,
    ]);

    const meta: any = next.metadata ?? {};
    expect(next.pending).toBeNull();
    expect(meta.pawnByPlayerId?.[1]).toBe('coq-rockeur');
    expect(meta.pawnByPlayerId?.[2]).toBe('vache-artistique');
    expect(meta.pawnByPlayerId?.[3]).toBe('cochon-gourmand');
    const messages = (next.log ?? []).map((e: any) => String(e?.message ?? ''));
    expect(messages.some((m) => /Debut de partie : Otis commence\./.test(m))).toBe(true);
  });
});
