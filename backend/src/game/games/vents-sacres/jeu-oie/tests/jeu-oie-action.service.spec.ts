import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
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
        SetupFlowService,
        { provide: 'TurnFlowService', useValue: { advanceTurn: (s: any) => s } },
        JeuOieSetupService,
        {
          provide: JeuOieActionService,
          useFactory: (
            random: RandomService,
            core: GameCoreService,
            turns: { advanceTurn: (s: any) => any },
            setupFlow: SetupFlowService,
          ) => new JeuOieActionService(random, turns as any, core, setupFlow),
          inject: [RandomService, GameCoreService, 'TurnFlowService', SetupFlowService],
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
      metadata: {
        ...(state.metadata ?? {}),
        pawnByPlayerId: {
          1: 'coq-rockeur',
          2: 'vache-artistique',
          3: 'cochon-gourmand',
        },
      } as any,
    };
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

  it('demande de choisir son pion via le pending label au demarrage', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        GameContentLoaderService,
        SetupFlowService,
        JeuOieSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(JeuOieSetupService);
    const state = setup.hydrateInitialState(baseState());
    const meta: any = state.metadata ?? {};

    expect(meta.pawnByPlayerId?.[1]).toBeUndefined();
    expect(meta.pawnByPlayerId?.[2]).toBeUndefined();
    expect(meta.pawnByPlayerId?.[3]).toBeUndefined();
    expect(state.pending?.type).toBe('choose_pawn');
    const starterId = Number(meta.setupStarterId);
    expect((state.pending as any)?.playerId).toBe(starterId);
    const starterName =
      state.players?.find((p: any) => p?.id === starterId)?.username ?? `Joueur ${starterId}`;
    expect(String((state.pending as any)?.label ?? '')).toContain(
      `C'est à ${starterName} de choisir son pion.`,
    );
  });

  it('demarre la partie apres le choix de pion de tous les joueurs', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        GameContentLoaderService,
        RandomService,
        SetupFlowService,
        { provide: 'TurnFlowService', useValue: { advanceTurn: (s: any) => s } },
        JeuOieSetupService,
        {
          provide: JeuOieActionService,
          useFactory: (
            random: RandomService,
            core: GameCoreService,
            turns: { advanceTurn: (s: any) => any },
            setupFlow: SetupFlowService,
          ) => new JeuOieActionService(random, turns as any, core, setupFlow),
          inject: [RandomService, GameCoreService, 'TurnFlowService', SetupFlowService],
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
    const assigned = Object.values(meta.pawnByPlayerId ?? {});
    expect(assigned).toHaveLength(3);
    expect(new Set(assigned).size).toBe(3);
    const messages = (next.log ?? []).map((e: any) => String(e?.message ?? ''));
    const starterId = Number(meta.setupStarterId);
    const starterName =
      next.players?.find((p: any) => p?.id === starterId)?.username ?? `Joueur ${starterId}`;
    expect(messages.some((m) => m === `Début de partie : ${starterName} commence.`)).toBe(true);
  });
});
