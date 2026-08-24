import { readFileSync } from 'fs';
import { join } from 'path';
import { PanierExpressService } from './panier-express.service';
import { PanierExpressExchangeService } from './panier-express-exchange.service';
import { createPanierExpressTestingModule } from '../../infrastructure/tests/panier-express-test-harness';

function loadContentArray(filename: string, key: string): string[] {
  const fullPath = join(__dirname, '..', '..', 'model', 'content', filename);
  const raw = readFileSync(fullPath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return Array.isArray(parsed[key]) ? (parsed[key] as string[]) : [];
}

function makeStartedState(
  game: PanierExpressService,
  players: any[],
  currentPlayerId: number,
  seed: number,
) {
  const state: any = game.hydrateInitialState({
    players,
    status: 'running',
  } as any);
  state.status = 'started';
  state.turn = { currentPlayerId, direction: 1 };
  state.turnIndex = Math.max(
    0,
    players.findIndex((p: any) => p.id === currentPlayerId),
  );
  state.pending = null;
  state.metadata = { ...(state.metadata ?? {}), rng: { seed, counter: 0 } };
  return state;
}

function resolveBlockingPending(
  game: PanierExpressService,
  state: any,
  maxSteps = 20,
) {
  let next = state;
  for (let i = 0; i < maxSteps; i += 1) {
    if (!next.pending) return next;
    const pending: any = next.pending;
    if (!pending.blocking) return next;
    const actorId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : (next.turn?.currentPlayerId ?? null);
    if (typeof actorId !== 'number') {
      throw new Error('pending bloquant sans playerId ni currentPlayerId');
    }
    const actor = (next.players ?? []).find((p: any) => p.id === actorId);
    const botActions = actor?.isBot ? game.getBotActions(next, actorId) : [];
    const actions =
      botActions.length > 0
        ? botActions
        : game.getAvailableActions(next, actorId);
    if (!actions.length) {
      throw new Error(
        `Aucune action disponible pour rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©soudre le pending (type=${pending.type}, kind=${pending?.data?.kind ?? ''}).`,
      );
    }
    next = game.applyActions(
      next,
      actions.slice(0, 1).map((a: any) => ({ ...a, meta: { actorId } })),
    );
  }
  throw new Error('pending bloquant non rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©solu (limite atteinte)');
}

describe('PanierExpress - tests fonctionnels (simulation)', () => {
  let game: PanierExpressService;
  let exchange: PanierExpressExchangeService;

  beforeAll(async () => {
    const moduleRef = await createPanierExpressTestingModule();
    game = moduleRef.get(PanierExpressService);
    exchange = moduleRef.get(PanierExpressExchangeService);
  });

  it('rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sout chaque carte ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nement (sans crash + pending bloquants rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©solubles)', () => {
    const events = loadContentArray('events.json', 'events');
    for (const card of events) {
      const base = makeStartedState(
        game,
        [
          {
            id: 1,
            username: 'A',
            inventory: ['pomme'],
            basket: [],
            shoppingList: [],
          },
          {
            id: 2,
            username: 'B',
            inventory: ['poire'],
            basket: [],
            shoppingList: [],
          },
        ],
        1,
        1,
      );
      base.metadata.decks.events = { deck: [card], discards: [] };
      base.metadata.decks['courses-bonus'] = {
        deck: ['amande', 'noix', 'pomme', 'banane', 'fraise', 'melon'],
        discards: [],
      };

      const afterEvent = (game as any).applyEvent(base, 1);
      const afterPending = resolveBlockingPending(game, afterEvent, 25);
      expect(afterPending).toBeTruthy();
    }
  });

  it('rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sout chaque carte ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©change (sans crash + pending bloquants rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©solubles)', () => {
    const exchanges = loadContentArray('exchanges.json', 'exchanges');
    for (const card of exchanges) {
      const base = makeStartedState(
        game,
        [
          {
            id: 1,
            username: 'A',
            inventory: ['pomme', 'banane'],
            basket: [],
            shoppingList: [],
          },
          {
            id: 2,
            username: 'B',
            inventory: ['poire', 'kiwi'],
            basket: [],
            shoppingList: [],
          },
        ],
        1,
        2,
      );
      const meta: any = base.metadata;
      const exchangeIndex = (meta.tiles ?? []).findIndex(
        (t: any) => t?.type === 'exchange',
      );
      meta.positions[1] = exchangeIndex >= 0 ? exchangeIndex : 0;

      meta.decks.exchanges = { deck: [card], discards: [] };

      const after = exchange.applyExchange(base, 1);
      const afterPending = resolveBlockingPending(game, after, 25);
      expect(afterPending).toBeTruthy();
    }
  });

  it('simule une partie jouÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e (actions rulebook) sans deadlock', () => {
    let state: any = makeStartedState(
      game,
      [
        {
          id: 1,
          username: 'Nuggets',
          isBot: true,
          inventory: [],
          basket: [],
          shoppingList: ['pomme'],
        },
        {
          id: 2,
          username: 'Humain',
          inventory: [],
          basket: [],
          shoppingList: ['poire'],
        },
      ],
      1,
      3,
    );

    const maxActions = 800;
    let unchangedStreak = 0;
    for (let i = 0; i < maxActions; i += 1) {
      if ((state.status || '').toLowerCase() === 'finished') break;

      const pending: any = state.pending;
      const actorId =
        typeof pending?.playerId === 'number'
          ? pending.playerId
          : (state.turn?.currentPlayerId ?? null);
      if (typeof actorId !== 'number') {
        throw new Error(
          'Partie sans actorId (ni pending.playerId, ni currentPlayerId)',
        );
      }

      const actor = (state.players ?? []).find((p: any) => p.id === actorId);
      const botActions = actor?.isBot ? game.getBotActions(state, actorId) : [];
      const actions =
        botActions.length > 0
          ? botActions
          : game.getAvailableActions(state, actorId);

      if (!actions.length) {
        throw new Error(
          `Deadlock: aucune action disponible (turn=${state.turn?.currentPlayerId ?? 'null'}, pending=${pending?.type ?? 'null'}).`,
        );
      }

      const before = JSON.stringify({
        status: state.status,
        turn: state.turn,
        pending: state.pending,
        positions: state.metadata?.positions,
        laps: state.metadata?.laps,
        rng: state.metadata?.rng,
      });

      state = game.applyActions(state, [
        { ...actions[0], meta: { actorId } } as any,
      ]);

      const after = JSON.stringify({
        status: state.status,
        turn: state.turn,
        pending: state.pending,
        positions: state.metadata?.positions,
        laps: state.metadata?.laps,
        rng: state.metadata?.rng,
      });

      if (after === before) {
        unchangedStreak += 1;
      } else {
        unchangedStreak = 0;
      }
      expect(unchangedStreak).toBeLessThan(40);
    }

    expect(state).toBeTruthy();
  });
});


