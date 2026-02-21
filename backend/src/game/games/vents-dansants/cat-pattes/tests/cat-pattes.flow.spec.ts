import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { CatPattesActionService } from '../actions/cat-pattes-action.service';
import { CatPattesSetupService } from '../setup/cat-pattes-setup.service';
import { CatPattesPresenterService } from '../presenter/cat-pattes-presenter.service';
import * as Rulebook from '../rulebook/rulebook';

function baseState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Hacene', isBot: false } as any,
      { id: 2, username: 'Lilas', isBot: false } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      gameType: 'cat-pattes',
      roomStartedAt: '2026-02-13T00:00:00.000Z',
      roomRunId: 1,
      rng: { seed: 123, counter: 0 },
    } as any,
    botThinking: false,
  } as any;
}

describe('CatPattes flow', () => {
  it('lets human choose pawn before bot auto-assignment', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        DeckPoliciesService,
        CatPattesSetupService,
        {
          provide: 'TurnFlowService',
          useValue: {
            advanceTurn: (state: any) => state,
          },
        },
        {
          provide: CatPattesActionService,
          useFactory: (
            core: GameCoreService,
            turns: any,
            setupFlow: SetupFlowService,
            deckPolicies: DeckPoliciesService,
            random: RandomService,
          ) =>
            new CatPattesActionService(
              core,
              turns,
              setupFlow,
              deckPolicies,
              random,
            ),
          inject: [
            GameCoreService,
            'TurnFlowService',
            SetupFlowService,
            DeckPoliciesService,
            RandomService,
          ],
        },
      ],
    }).compile();

    const setup = moduleRef.get(CatPattesSetupService);
    const actionSvc = moduleRef.get(CatPattesActionService);
    const seeded = baseState();
    seeded.players = [
      { id: 1, username: 'Lilas', isBot: false } as any,
      { id: 2, username: 'Botou', isBot: true } as any,
    ];
    seeded.turn = { currentPlayerId: 2, direction: 1 };

    let state = setup.hydrateInitialState(seeded);
    expect((state.pending as any)?.type).toBe('choose_pawn');
    expect((state.pending as any)?.playerId).toBe(1);

    state = actionSvc.applyActions(state, [
      { type: 'choose_pawn', payload: { pawnId: 'Maine Coon' } } as any,
    ]);

    const meta: any = state.metadata ?? {};
    expect(String(meta.pawnByPlayerId?.[1] ?? '')).toBe('Maine Coon');
    expect(String(meta.pawnByPlayerId?.[2] ?? '').length).toBeGreaterThan(0);
  });

  it('requires pawn selection before draw/play', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        DeckPoliciesService,
        CatPattesSetupService,
        {
          provide: 'TurnFlowService',
          useValue: {
            advanceTurn: (state: any) => {
              const players = Array.isArray(state.players) ? state.players : [];
              const currentId = state.turn?.currentPlayerId ?? null;
              const idx = players.findIndex((p: any) => p?.id === currentId);
              const nextIdx = idx >= 0 ? (idx + 1) % players.length : 0;
              return {
                ...state,
                turnIndex: nextIdx,
                turn: {
                  ...(state.turn ?? { direction: 1 }),
                  currentPlayerId: players[nextIdx]?.id ?? currentId,
                  direction: 1,
                },
              };
            },
          },
        },
        {
          provide: CatPattesActionService,
          useFactory: (
            core: GameCoreService,
            turns: any,
            setupFlow: SetupFlowService,
            deckPolicies: DeckPoliciesService,
            random: RandomService,
          ) =>
            new CatPattesActionService(
              core,
              turns,
              setupFlow,
              deckPolicies,
              random,
            ),
          inject: [
            GameCoreService,
            'TurnFlowService',
            SetupFlowService,
            DeckPoliciesService,
            RandomService,
          ],
        },
      ],
    }).compile();

    const setup = moduleRef.get(CatPattesSetupService);
    const actionsService = moduleRef.get(CatPattesActionService);

    let state = setup.hydrateInitialState(baseState());
    expect((state.pending as any)?.type).toBe('choose_pawn');

    const actionsP1 = Rulebook.getAvailableActions(state as any, 1);
    expect(actionsP1.every((a: any) => a.type === 'choose_pawn')).toBe(true);

    state = actionsService.applyActions(state, [
      { type: 'choose_pawn', payload: { pawnId: 'Maine Coon' } } as any,
      { type: 'choose_pawn', payload: { pawnId: 'Siamois' } } as any,
    ]);

    expect(state.pending).toBeNull();
    const messages = (state.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    expect(
      messages.some((m) => /D.+but de partie: .* commence\./i.test(m)),
    ).toBe(true);
    expect(messages.some((m) => /C'est au tour de .+\./.test(m))).toBe(true);

    const afterSelectionActions = Rulebook.getAvailableActions(state as any, 1);
    expect(afterSelectionActions).toEqual([{ type: 'draw', payload: {} }]);
  });

  it('draws to seven then returns to six after playing one card', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        DeckPoliciesService,
        CatPattesSetupService,
        {
          provide: 'TurnFlowService',
          useValue: {
            advanceTurn: (state: any) => {
              const players = Array.isArray(state.players) ? state.players : [];
              const currentId = state.turn?.currentPlayerId ?? null;
              const idx = players.findIndex((p: any) => p?.id === currentId);
              const nextIdx = idx >= 0 ? (idx + 1) % players.length : 0;
              return {
                ...state,
                turnIndex: nextIdx,
                turn: {
                  ...(state.turn ?? { direction: 1 }),
                  currentPlayerId: players[nextIdx]?.id ?? currentId,
                  direction: 1,
                },
              };
            },
          },
        },
        {
          provide: CatPattesActionService,
          useFactory: (
            core: GameCoreService,
            turns: any,
            setupFlow: SetupFlowService,
            deckPolicies: DeckPoliciesService,
            random: RandomService,
          ) =>
            new CatPattesActionService(
              core,
              turns,
              setupFlow,
              deckPolicies,
              random,
            ),
          inject: [
            GameCoreService,
            'TurnFlowService',
            SetupFlowService,
            DeckPoliciesService,
            RandomService,
          ],
        },
      ],
    }).compile();

    const setup = moduleRef.get(CatPattesSetupService);
    const actionsService = moduleRef.get(CatPattesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = actionsService.applyActions(state, [
      { type: 'choose_pawn', payload: { pawnId: 'Maine Coon' } } as any,
      { type: 'choose_pawn', payload: { pawnId: 'Siamois' } } as any,
    ]);

    const meta0: any = state.metadata ?? {};
    const beforeCount = Array.isArray(meta0.hands?.[1])
      ? meta0.hands[1].length
      : 0;
    expect(beforeCount).toBe(6);

    state = actionsService.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const meta1: any = state.metadata ?? {};
    const drawnCount = Array.isArray(meta1.hands?.[1])
      ? meta1.hands[1].length
      : 0;
    expect(drawnCount).toBe(7);

    const available = Rulebook.getAvailableActions(state as any, 1);
    const play = available.find((a: any) => a.type === 'play_card');
    expect(play).toBeDefined();

    state = actionsService.applyActions(state, [play as any]);
    const meta2: any = state.metadata ?? {};
    const afterPlayCount = Array.isArray(meta2.hands?.[1])
      ? meta2.hands[1].length
      : 0;
    expect(afterPlayCount).toBe(6);
    expect(state.turn?.currentPlayerId).toBe(2);
  });

  it('does not block the game when a player draws with an empty deck and empty hand', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        DeckPoliciesService,
        CatPattesSetupService,
        {
          provide: 'TurnFlowService',
          useValue: {
            advanceTurn: (state: any) => {
              const players = Array.isArray(state.players) ? state.players : [];
              const currentId = state.turn?.currentPlayerId ?? null;
              const idx = players.findIndex((p: any) => p?.id === currentId);
              const nextIdx = idx >= 0 ? (idx + 1) % players.length : 0;
              return {
                ...state,
                turnIndex: nextIdx,
                turn: {
                  ...(state.turn ?? { direction: 1 }),
                  currentPlayerId: players[nextIdx]?.id ?? currentId,
                  direction: 1,
                },
              };
            },
          },
        },
        {
          provide: CatPattesActionService,
          useFactory: (
            core: GameCoreService,
            turns: any,
            setupFlow: SetupFlowService,
            deckPolicies: DeckPoliciesService,
            random: RandomService,
          ) =>
            new CatPattesActionService(
              core,
              turns,
              setupFlow,
              deckPolicies,
              random,
            ),
          inject: [
            GameCoreService,
            'TurnFlowService',
            SetupFlowService,
            DeckPoliciesService,
            RandomService,
          ],
        },
      ],
    }).compile();

    const setup = moduleRef.get(CatPattesSetupService);
    const actionsService = moduleRef.get(CatPattesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = actionsService.applyActions(state, [
      { type: 'choose_pawn', payload: { pawnId: 'Maine Coon' } } as any,
      { type: 'choose_pawn', payload: { pawnId: 'Siamois' } } as any,
    ]);

    const meta: any = { ...(state.metadata ?? {}) };
    meta.deck = [];
    meta.discard = [];
    meta.hands = { ...(meta.hands ?? {}), 1: [] };
    meta.drawnPlayerId = null;
    state = {
      ...state,
      metadata: meta,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: 1,
        direction: 1,
      },
      turnIndex: 0,
    };

    const actionsBefore = Rulebook.getAvailableActions(state as any, 1);
    expect(actionsBefore).toEqual([{ type: 'draw', payload: {} }]);
    const actionsWhenDrawn = Rulebook.getAvailableActions(
      {
        ...state,
        metadata: { ...(state.metadata as any), drawnPlayerId: 1 },
      } as any,
      1,
    );
    expect(actionsWhenDrawn).toEqual([{ type: 'pass', payload: {} }]);

    state = actionsService.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    expect((state.metadata as any)?.drawnPlayerId ?? null).toBeNull();
    expect(state.turn?.currentPlayerId).toBe(2);

    const messages = (state.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    expect(messages.some((m) => /ne peut plus piocher/i.test(m))).toBe(true);
    expect(messages.some((m) => /passe son tour/i.test(m))).toBe(true);
  });

  it('exposes choose_pawn pending choices to the current user', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        DeckPoliciesService,
        CatPattesSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(CatPattesSetupService);
    const presenter = new CatPattesPresenterService();

    const state = setup.hydrateInitialState(baseState());
    const exposed: any = presenter.exposeStateForUser(state, 1);

    expect(exposed.pending?.type).toBe('choose_pawn');
    expect(Array.isArray(exposed.pending?.choices)).toBe(true);
    expect((exposed.pending?.choices ?? []).length).toBeGreaterThan(0);

    const actions = Array.isArray(exposed.actions) ? exposed.actions : [];
    expect(actions.length).toBeGreaterThan(0);
    expect(
      actions.every((a: any) => String(a?.type ?? '') === 'choose_pawn'),
    ).toBe(true);
  });
});
