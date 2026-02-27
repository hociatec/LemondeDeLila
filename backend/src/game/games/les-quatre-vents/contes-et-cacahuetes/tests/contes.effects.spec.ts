import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { ContesCacahuetesSetupService } from '../setup/contes-et-cacahuetes-setup.service';
import { ContesActionService } from '../actions/contes-action.service';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function baseState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Lilas', isBot: false },
      { id: 2, username: 'Bucky', isBot: true },
      { id: 3, username: 'Otis', isBot: false },
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      gameType: 'contes-et-cacahuetes',
      rng: { seed: 1234, counter: 0 },
    },
    botThinking: false,
  };
}

describe('Contes effects', () => {
  it('keeps Cape d’Invisibilite aligned with malus tile behavior', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        ContesCacahuetesSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const bonusDeck: unknown[] = Array.isArray(decks.bonus)
      ? (decks.bonus as unknown[])
      : [];
    const cape = bonusDeck.find((card) => {
      const row = asRecord(card);
      return Number(row.id ?? 0) === 4;
    });
    const capeRow = asRecord(cape);

    expect(toText(capeRow.text)).toContain('case Malus');
    expect(toText(capeRow.text)).not.toContain('case Conte');
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
            advanceTurn: (state: GameStateEntity): GameStateEntity => state,
          },
        },
        {
          provide: ContesActionService,
          useFactory: (
            core: GameCoreService,
            random: RandomService,
            turns: TurnFlowService,
            setupFlow: SetupFlowService,
            deckPolicies: DeckPoliciesService,
          ) =>
            new ContesActionService(
              core,
              random,
              turns,
              setupFlow,
              deckPolicies,
            ),
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
    };

    const chooseTwo: GameSingleActionDto[] = [
      { type: 'choose_number', payload: { value: 2 } },
    ];
    state = actionsService.applyActions(state, chooseTwo);
    const pending1 = asRecord(state.pending);
    const data1 = asRecord(pending1.data);
    const picks1 = asRecord(data1.picks);
    expect(Number(pending1.playerId)).toBe(2);
    expect(Number(picks1['1'] ?? 0)).toBe(2);

    const chooseThree: GameSingleActionDto[] = [
      { type: 'choose_number', payload: { value: 3 } },
    ];
    state = actionsService.applyActions(state, chooseThree);
    const pending2 = asRecord(state.pending);
    const data2 = asRecord(pending2.data);
    const picks2 = asRecord(data2.picks);
    expect(Number(pending2.playerId)).toBe(3);
    expect(Number(picks2['2'] ?? 0)).toBe(3);

    const chooseOne: GameSingleActionDto[] = [
      { type: 'choose_number', payload: { value: 1 } },
    ];
    state = actionsService.applyActions(state, chooseOne);
    expect(state.pending ?? null).toBeNull();
    expect(String(state.status ?? '').toLowerCase()).toBe('finished');
    const finalMeta = asRecord(state.metadata);
    expect(Number(finalMeta.winnerId ?? 0)).toBe(2);
  });

  it('ends the turn after resolving a draw pending with no follow-up pending', async () => {
    const advanceTurn = jest.fn((state: GameStateEntity): GameStateEntity => ({
      ...state,
      turnIndex: 1,
      turn: { ...(state.turn ?? { direction: 1 }), currentPlayerId: 2 },
    }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        DeckPoliciesService,
        ContesCacahuetesSetupService,
        {
          provide: 'TurnFlowService',
          useValue: { advanceTurn },
        },
        {
          provide: ContesActionService,
          useFactory: (
            core: GameCoreService,
            random: RandomService,
            turns: TurnFlowService,
            setupFlow: SetupFlowService,
            deckPolicies: DeckPoliciesService,
          ) =>
            new ContesActionService(
              core,
              random,
              turns,
              setupFlow,
              deckPolicies,
            ),
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
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const bonusDeck = Array.isArray(decks.bonus) ? decks.bonus : [];
    const parch = bonusDeck.find(
      (card) => Number(asRecord(card).id ?? 0) === 2,
    ) as unknown;
    expect(parch).toBeTruthy();

    state = {
      ...state,
      turn: { ...(state.turn ?? { direction: 1 }), currentPlayerId: 1 },
      pending: {
        type: 'draw',
        label: 'Piocher une carte BONUS (Espace).',
        playerId: 1,
        blocking: true,
        data: { context: 'draw_and_apply', cardType: 'bonus', depth: 0 },
      },
      metadata: {
        ...(state.metadata ?? {}),
        decks: {
          ...decks,
          bonus: [parch],
          discardBonus: [],
        },
      },
    };

    state = actionsService.applyActions(state, [{ type: 'draw', payload: {} }]);

    expect(advanceTurn).toHaveBeenCalledTimes(1);
    expect(state.pending ?? null).toBeNull();
    expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(2);
  });
});
