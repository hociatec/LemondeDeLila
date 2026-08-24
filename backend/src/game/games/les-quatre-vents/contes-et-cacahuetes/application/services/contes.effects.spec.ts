import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { BoardPayloadService } from '../../../../../application/services/board-payload.service';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import type { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { ContesActionService } from './contes-action.service';
import { ContesPresenterService } from './contes-presenter.service';
import { ContesTargetingService } from './contes-targeting.service';
import { ContesCacahuetesSetupService } from './contes-et-cacahuetes-setup.service';

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

async function createActionsModule(
  advanceTurn: (state: GameStateEntity) => GameStateEntity = (state) => state,
) {
  const core = new GameCoreService();
  const random = new RandomService();
  const setupFlow = new SetupFlowService();
  const deckPolicies = new DeckPoliciesService();
  const turns: TurnFlowService = { advanceTurn } as TurnFlowService;
  const setup = new ContesCacahuetesSetupService(core, random, setupFlow);
  const targeting = new ContesTargetingService(core);
  const actions = new ContesActionService(
    core,
    random,
    turns,
    setupFlow,
    deckPolicies,
    targeting,
  );
  const presenter = new ContesPresenterService(new BoardPayloadService());
  const services = new Map<unknown, unknown>([
    [ContesCacahuetesSetupService, setup],
    [ContesActionService, actions],
    [ContesPresenterService, presenter],
  ]);
  return {
    get<T>(token: new (...args: never[]) => T): T {
      return services.get(token) as T;
    },
  };
}

describe('Contes effects', () => {
  it('hydrates board, decks and pawn choices needed by the game flow', async () => {
    const moduleRef = await createActionsModule();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const tiles = Array.isArray(metadata.tiles) ? metadata.tiles : [];
    const decks = asRecord(metadata.decks);
    const bonusDeck = Array.isArray(decks.bonus) ? decks.bonus : [];
    const malusDeck = Array.isArray(decks.malus) ? decks.malus : [];
    const surpriseDeck = Array.isArray(decks.surprise) ? decks.surprise : [];
    const conteDeck = Array.isArray(decks.contes) ? decks.contes : [];
    const pending = asRecord(state.pending);
    const pendingData = asRecord(pending.data);
    const pawns = Array.isArray(pendingData.pawns) ? pendingData.pawns : [];

    expect(tiles).toHaveLength(60);
    expect(toText(asRecord(tiles[0]).label)).toContain('Case D');
    expect(toText(asRecord(tiles[59]).label)).toContain('Case Arriv');

    expect(bonusDeck).toHaveLength(15);
    expect(malusDeck).toHaveLength(15);
    expect(surpriseDeck).toHaveLength(15);
    expect(conteDeck).toHaveLength(29);

    expect(
      bonusDeck.some(
        (card) => toText(asRecord(card).title) === 'Bottes de sept lieues',
      ),
    ).toBe(true);
    expect(
      surpriseDeck.some(
        (card) => toText(asRecord(card).title) === 'Baguette Malicieuse',
      ),
    ).toBe(true);
    expect(
      conteDeck.some((card) =>
        toText(asRecord(card).title).includes('Conte - Japon : Momotar'),
      ),
    ).toBe(true);

    expect(pawns).toHaveLength(6);
    expect(toText(asRecord(pawns[0]).id)).toBe('Aika - Mongolie');
    expect(toText(asRecord(pawns[0]).description)).not.toHaveLength(0);
  });

  it("keeps Cape d'Invisibilite aligned with malus tile behavior", async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const bonusDeck = Array.isArray(decks.bonus) ? decks.bonus : [];
    const cape = bonusDeck.find((card) => Number(asRecord(card).id ?? 0) === 4);
    const capeRow = asRecord(cape);

    expect(toText(capeRow.title)).toContain('Cape');
    expect(toText(capeRow.text)).toContain('case Malus');
    expect(toText(capeRow.text)).not.toContain('case Conte');
  });

  it('shows conte narration only to the landing player through the presenter', async () => {
    const moduleRef = await createActionsModule();
    const presenter = moduleRef.get(ContesPresenterService);

    const state: GameStateEntity = {
      ...baseState(),
      log: [{ message: 'log public', timestamp: new Date().toISOString() }],
      metadata: {
        gameType: 'contes-et-cacahuetes',
        rng: { seed: 1234, counter: 0 },
        tiles: [],
        positions: { 1: 1, 2: 2, 3: 3 },
        statuses: {},
        lastConte: {
          playerId: 1,
          title: 'Conte prive',
          text: 'Texte secret du conte',
          timestamp: '2026-08-23T00:00:00.000Z',
        },
      },
    };

    const seenByOwner = presenter.exposeStateForUser(state, 1);
    const seenByOther = presenter.exposeStateForUser(state, 2);

    expect(
      seenByOwner.log.some((entry) => entry.message === 'Texte secret du conte'),
    ).toBe(true);
    expect(
      seenByOther.log.some((entry) => entry.message === 'Texte secret du conte'),
    ).toBe(false);
  });

  it('does not announce unavailable cards when a queued bonus draw has no cards', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actions = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        decks: {
          ...decks,
          bonus: [],
          discardBonus: [],
        },
      },
    };

    state = (
      actions as unknown as {
        resolveQueuedDraw: (
          current: GameStateEntity,
          playerId: number,
          data: { queue: string[]; depth: number },
        ) => GameStateEntity;
      }
    ).resolveQueuedDraw(state, 1, {
      queue: ['bonus'],
      depth: 0,
    });

    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(logText).not.toContain('Aucune carte disponible');
  });
});
