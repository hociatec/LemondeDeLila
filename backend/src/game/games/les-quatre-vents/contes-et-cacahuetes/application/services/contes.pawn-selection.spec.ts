import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import type { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import { ContesCacahuetesSetupService } from './contes-et-cacahuetes-setup.service';
import { ContesActionService } from './contes-action.service';
import { ContesTargetingService } from './contes-targeting.service';
import * as Rulebook from '../../rulebook/rulebook';

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

describe('Contes pawn selection', () => {
  it('selects first chooser randomly among all participants and completes setup', async () => {
    const core = new GameCoreService();
    const random = new RandomService();
    const setupFlow = new SetupFlowService();
    const deckPolicies = new DeckPoliciesService();
    const turns: TurnFlowService = {
      advanceTurn: (state: GameStateEntity): GameStateEntity => state,
    } as TurnFlowService;
    const setup = new ContesCacahuetesSetupService(core, random, setupFlow);
    const targeting = new ContesTargetingService(core);
    const actionsService = new ContesActionService(
      core,
      random,
      turns,
      setupFlow,
      deckPolicies,
      targeting,
    );

    let state = setup.hydrateInitialState(baseState());
    const pending0 = asRecord(state.pending);
    const pendingData = asRecord(pending0.data);
    const firstPawns = Array.isArray(pendingData.pawns)
      ? pendingData.pawns
      : [];
    expect(toText(pending0.type)).toBe('choose_pawn');
    expect(firstPawns.length).toBeGreaterThan(0);
    const firstPawn = asRecord(firstPawns[0]);
    expect(typeof firstPawn.description).toBe('string');
    expect(toText(firstPawn.description).trim().length).toBeGreaterThan(0);
    const metadata = asRecord(state.metadata);
    const starterId = Number(metadata.setupStarterId ?? 0);
    expect([1, 2, 3]).toContain(starterId);
    expect(Number(pending0.playerId)).toBe(starterId);

    let safety = 0;
    while (
      toText(asRecord(state.pending).type) === 'choose_pawn' &&
      safety < 10
    ) {
      const pending = asRecord(state.pending);
      const pid = Number(pending.playerId ?? 0);
      const available = Rulebook.getAvailableActions(state, pid);
      expect(available.length).toBeGreaterThan(0);
      expect(available.every((action) => action.type === 'choose_pawn')).toBe(
        true,
      );
      const firstAction = available[0];
      const toApply: GameSingleActionDto[] = [firstAction];
      state = actionsService.applyActions(state, toApply);
      if (toText(asRecord(state.pending).type) === 'choose_pawn') {
        const nextPawns = Array.isArray(
          asRecord(asRecord(state.pending).data).pawns,
        )
          ? ((asRecord(state.pending).data as Record<string, unknown>)
              .pawns as unknown[])
          : [];
        expect(nextPawns.length).toBeGreaterThan(0);
        expect(
          toText(asRecord(nextPawns[0]).description).trim().length,
        ).toBeGreaterThan(0);
      }
      safety += 1;
    }

    expect(state.pending ?? null).toBeNull();
    expect(safety).toBe(3);
    expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(starterId);
  });
});









