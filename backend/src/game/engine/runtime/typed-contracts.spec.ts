import { cards } from './cards/cards-contracts';
import { GameCardsController } from './cards/cards-hands-controller';
import { createCardsKitState } from './cards/cards-view';
import type {
  GamePlayerViewFor,
  GameSetupPlayerViewFor,
} from './projection/game-system-view';
import type { PlayerValuesKitState } from './kits/player-values-kit';
import { defineCardsSchema, type CardOfDeck } from './cards/typed-cards';
import { defineAction } from './definitions/game-definition-builders';
import { defineGame } from './definitions/game-definition-compiler';
import { gameInput } from './actions/game-input-schema';
import { defineEvent } from './events/game-event-definition';

const ROUND_REVEALED = defineEvent({
  type: 'sample.round.revealed',
  data: gameInput.object({ round: gameInput.number({ integer: true }) }),
});
const typedDefinition = defineGame<{ ready: boolean }>()({
  id: 'typed-contract-fixture',
  displayName: 'Typed contract fixture',
  category: 'test',
  players: { min: 1, max: 2 },
  initialization: {
    resources: { energy: 2, water: 1 },
    counters: { round: 0 },
  },
  patterns: [
    {
      id: 'typed-values',
      mechanics: ['values'],
      initialization: {
        resources: { coins: 3 },
        counters: { turns: 0 },
      },
    },
  ],
  events: [ROUND_REVEALED],
  setup: () => ({ ready: true }),
  actions: {
    wait: defineAction({
      input: gameInput.object({}),
      execute: () => undefined,
    }),
  },
});

describe('typed game contracts', () => {
  const schema = defineCardsSchema({
    decks: {
      main: cards.deck({
        id: 'main',
        cards: [{ id: 'sun', power: 3 }] as const,
      }),
    },
    hands: {
      player: cards.hands({
        id: 'player',
        deck: 'main',
        initial: 1,
        visibility: 'owner',
      }) as ReturnType<typeof cards.hands> & { readonly deck: 'main' },
    },
    zones: {
      table: { deck: 'main', visibility: 'public' },
    },
  });

  it('keeps exact deck, hand, resource, counter and setup value types', () => {
    type Card = CardOfDeck<typeof schema.decks, 'main'>;
    const card: Card = { id: 'sun', power: 3 };
    type Values = PlayerValuesKitState<'energy' | 'water', 'round'>;
    const values: Values = {
      scores: {},
      resources: { energy: {}, water: {} },
      counters: { round: 1 },
      statuses: {},
      turnFlags: {},
      scheduledSkips: {},
      scheduledExtraTurns: {},
    };
    type Setup = GameSetupPlayerViewFor<{
      config: { defaults: { timerSeconds: number; teams: boolean } };
    }>;
    const setup: Setup = {
      complete: false,
      phase: 'setup',
      ownerPlayerId: 1,
      values: { timerSeconds: 30, teams: true },
    };
    type View = GamePlayerViewFor<{
      initialization: {
        resources: { energy: number; water: number };
        counters: { round: number };
      };
    }>;
    const resources: View['kits']['resources']['1'] = { energy: 2 };
    const counters: View['kits']['counters'] = { round: 1 };

    expect(schema.components).toHaveLength(3);
    expect(schema.components[2]).toMatchObject({
      component: 'cards.zone',
      id: 'table',
      deck: 'main',
    });
    expect(card.power).toBe(3);
    expect(values.resources.energy).toEqual({});
    expect(setup.values.timerSeconds).toBe(30);
    expect(resources.energy).toBe(2);
    expect(counters.round).toBe(1);
  });

  it('derives player-view resources, counters and custom events from the compiled definition', () => {
    type View = GamePlayerViewFor<typeof typedDefinition>;
    const resources: View['kits']['resources']['1'] = {
      energy: 2,
      coins: 3,
    };
    const counters: View['kits']['counters'] = { round: 1, turns: 0 };
    // @ts-expect-error an undeclared resource must not widen back to string
    const invalidResources: View['kits']['resources']['1'] = { unknown: 1 };
    const event: NonNullable<
      View['system']['events']['latestByType']['sample.round.revealed']
    > = {
      type: 'sample.round.revealed',
      data: { round: 2 },
      actorId: 1,
      occurredAtMs: 10,
    };

    expect(resources.energy).toBe(2);
    expect(resources.coins).toBe(3);
    expect(counters.round).toBe(1);
    expect(counters.turns).toBe(0);
    expect(invalidResources).toBeDefined();
    expect(event.data.round).toBe(2);
    expect(typedDefinition.compiled.eventIds).toEqual([
      'sample.round.revealed',
    ]);
  });

  it('persists typed zones and restores their catalog card type', () => {
    const state = createCardsKitState();
    const controller = new GameCardsController(
      state,
      {
        pick: <T>(values: readonly T[]) => values[0] ?? null,
        shuffle: <T>(values: readonly T[]) => [...values],
      },
      undefined,
      schema.components,
    );
    controller.createDeck(schema.decks.main);
    const zoneDefinition = schema.components.find(
      (component) => component.component === 'cards.zone',
    );
    if (!zoneDefinition) throw new Error('Zone typée absente');
    controller.createZone(zoneDefinition);
    const runtime = schema.bind(controller);

    runtime.putInZone('table', { id: 'sun', power: 3 });

    expect(state.zones.table).toEqual(['sun']);
    expect(runtime.zone('table')).toEqual([{ id: 'sun', power: 3 }]);
  });
});
