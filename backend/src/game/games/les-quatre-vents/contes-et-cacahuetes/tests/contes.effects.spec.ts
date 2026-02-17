import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { ContesCacahuetesSetupService } from '../setup/contes-et-cacahuetes-setup.service';
import { ContesActionService } from '../actions/contes-action.service';

function baseState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Lilas', isBot: false } as any,
      { id: 2, username: 'Bucky', isBot: true } as any,
      { id: 3, username: 'Otis', isBot: false } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      gameType: 'contes-et-cacahuetes',
      rng: { seed: 1234, counter: 0 },
    } as any,
    botThinking: false,
  } as any;
}

describe('Contes effects', () => {
  it('keeps Cape d’Invisibilite aligned with conte tile behavior', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [GameCoreService, RandomService, SetupFlowService, ContesCacahuetesSetupService],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const bonusDeck = ((state.metadata as any)?.decks?.bonus ?? []) as Array<{
      id: number;
      text: string;
    }>;
    const cape = bonusDeck.find((c) => Number(c?.id) === 4);

    expect(cape?.text ?? '').toContain('case Conte');
    expect(cape?.text ?? '').not.toContain('case Malus');
  });

  it('requires a number choice from each player for Poussiere de rire', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        DeckPoliciesService,
        ContesCacahuetesSetupService,
        {
          provide: 'TurnFlowService',
          useValue: {
            advanceTurn: (state: any) => state,
          },
        },
        {
          provide: ContesActionService,
          useFactory: (
            core: GameCoreService,
            random: RandomService,
            turns: any,
            setupFlow: SetupFlowService,
            deckPolicies: DeckPoliciesService,
          ) =>
            new ContesActionService(core, random, turns, setupFlow, deckPolicies),
          inject: [
            GameCoreService,
            RandomService,
            'TurnFlowService',
            SetupFlowService,
            DeckPoliciesService,
          ],
        },
      ],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      pending: {
        type: 'choose_number',
        label: 'Poussiere de rire',
        playerId: 1,
        blocking: true,
        choices: ['1', '2', '3'],
        data: {
          context: 'laughter_dust',
          min: 1,
          max: 3,
          order: [1, 2, 3],
          picks: {},
        },
      },
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 58, 2: 58, 3: 58 },
      },
    } as any;

    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 2 } } as any,
    ]);
    expect((state.pending as any)?.playerId).toBe(2);
    expect((state.pending as any)?.data?.picks?.[1]).toBe(2);

    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 3 } } as any,
    ]);
    expect((state.pending as any)?.playerId).toBe(3);
    expect((state.pending as any)?.data?.picks?.[2]).toBe(3);

    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 1 } } as any,
    ]);
    expect(state.pending ?? null).toBeNull();
    expect(String(state.status ?? '').toLowerCase()).toBe('finished');
    expect(Number((state.metadata as any)?.winnerId ?? 0)).toBe(2);
  });
});

