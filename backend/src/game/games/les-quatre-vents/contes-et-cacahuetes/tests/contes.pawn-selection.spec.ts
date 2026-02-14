import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { ContesCacahuetesSetupService } from '../setup/contes-et-cacahuetes-setup.service';
import { ContesActionService } from '../actions/contes-action.service';
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

describe('Contes pawn selection', () => {
  it('selects first chooser randomly among all participants and completes setup', async () => {
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
          useFactory: (core: GameCoreService, random: RandomService, turns: any, setupFlow: SetupFlowService, deckPolicies: DeckPoliciesService) =>
            new ContesActionService(core, random, turns, setupFlow, deckPolicies),
          inject: [GameCoreService, RandomService, 'TurnFlowService', SetupFlowService, DeckPoliciesService],
        },
      ],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    expect((state.pending as any)?.type).toBe('choose_pawn');
    const starterId = Number((state.metadata as any)?.setupStarterId ?? 0);
    expect([1, 2, 3]).toContain(starterId);
    expect(Number((state.pending as any)?.playerId)).toBe(starterId);

    let safety = 0;
    while ((state.pending as any)?.type === 'choose_pawn' && safety < 10) {
      const pid = Number((state.pending as any)?.playerId);
      const available = Rulebook.getAvailableActions(state as any, pid);
      expect(available.length).toBeGreaterThan(0);
      expect(available.every((a: any) => a.type === 'choose_pawn')).toBe(true);
      state = actionsService.applyActions(state, [available[0] as any]);
      safety += 1;
    }

    expect((state.pending as any) ?? null).toBeNull();
    expect(safety).toBe(3);
    expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(starterId);
  });
});



