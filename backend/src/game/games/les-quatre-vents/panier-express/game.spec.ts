import { testGame } from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { DeclarativeGameRuntime } from '../../../engine/testing/public-api';
import { GameSimulator } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';

import PANIER_TILES from './content/board.json';
import PANIER_PAWNS from './content/pawns.json';
import PANIER_QUIZZES from './content/quizzes.json';
import cards from './content/cards.json';
import products from './content/products.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/board.json': PANIER_TILES,
  'content/pawns.json': PANIER_PAWNS,
  'content/quizzes.json': PANIER_QUIZZES,
  'content/cards.json': cards,
  'content/products.json': products,
});
const PANIER_EVENTS = cards.events;
const PANIER_EXCHANGES = cards.exchanges;

describe('Panier Express declarative game', () => {
  it('declares the private information and manual draw shortcuts', () => {
    expect(gameDefinition.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'S',
          type: 'interface',
          id: 'inventory:shopping-baskets',
        }),
        expect.objectContaining({
          key: 'L',
          type: 'interface',
          id: 'inventory:shopping-lists',
        }),
        expect.objectContaining({
          key: 'I',
          type: 'interface',
          id: 'inventory:market-items',
        }),
        expect.objectContaining({
          key: 'Space',
          type: 'action',
          actionType: 'draw_card',
        }),
      ]),
    );
    expect(
      gameDefinition.shortcuts?.some(
        (shortcut) => shortcut.key.toUpperCase() === 'P',
      ),
    ).toBe(false);
  });

  it('preserves every card and keeps private shopping data private', async () => {
    expect(PANIER_TILES).toHaveLength(40);
    expect(PANIER_EVENTS).toHaveLength(40);
    expect(PANIER_EXCHANGES).toHaveLength(18);
    expect(PANIER_QUIZZES).toHaveLength(30);

    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(131);
    await game.start();
    await game.choose(1, PANIER_PAWNS[0].id);
    await game.choose(2, PANIER_PAWNS[1].id);
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    const landing = (await game.events())
      .filter((event) => event.type === 'pawn.landed')
      .at(-1);
    const position = Number(landing?.data.position ?? -1);
    expect(landing?.data).toMatchObject({
      tileLabel: PANIER_TILES[position]?.label,
      tileDescription: PANIER_TILES[position]?.description,
    });
    expect('shoppingLists' in game.view(actor)).toBe(false);
    expect('inventories' in game.view(actor)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });

  it('waits for and assigns a publicly announced pawn to every participant', async () => {
    const game = testGame(gameDefinition)
      .players(['Hacene', { username: 'Kirikou', isBot: true }])
      .seed(83);
    await game.start();

    expect(game.view(1).pending).toMatchObject({
      label: 'Choisissez votre pion.',
      playerId: 1,
    });
    expect(game.availableActions(-2)).not.toContain('choice.resolve');

    const [humanPawn, botPawn] = PANIER_PAWNS;
    await game.choose(1, humanPawn.id);
    const shoppingListAnnouncement = (await game.events()).find(
      (event) => event.type === 'panier.shopping-list.announced',
    );
    expect(shoppingListAnnouncement).toMatchObject({
      data: {
        playerId: 1,
        items: game.inventory(1, 'shopping-lists'),
      },
      visibility: { kind: 'private', playerIds: [1] },
    });
    expect(game.inspect.setupComplete()).toBe(false);
    expect(game.view(-2).pending).toMatchObject({
      label: 'Choisissez votre pion.',
      playerId: -2,
    });
    expect(game.availableActions(1)).toEqual([]);
    expect(game.availableActions(-2)).toContain('choice.resolve');
    await game.choose(-2, botPawn.id);

    const shoppingListAnnouncements = (await game.events()).filter(
      (event) => event.type === 'panier.shopping-list.announced',
    );
    expect(shoppingListAnnouncements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 1,
            items: game.inventory(1, 'shopping-lists'),
          }),
          visibility: { kind: 'private', playerIds: [1] },
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: -2,
            items: game.inventory(-2, 'shopping-lists'),
          }),
          visibility: { kind: 'private', playerIds: [-2] },
        }),
      ]),
    );

    const pawns = (game.view(1) as unknown as { kits: StableGameKitsView }).kits
      .pawns?.sets.panier.assignments;
    expect(pawns?.['1']).toEqual([humanPawn.id]);
    expect(pawns?.['-2']).toEqual([botPawn.id]);
    expect(game.inspect.setupComplete()).toBe(true);
  });

  it('offers the first pawn choice to a human when a bot is first in the roster', async () => {
    const game = testGame(gameDefinition)
      .players([{ username: 'Wallace', isBot: true }, 'Hacene'])
      .seed(83);

    await game.start();

    expect(game.state().pending?.playerId).toBe(2);
    expect(game.availableActions(2)).toContain('choice.resolve');
    expect(game.availableActions(-1)).not.toContain('choice.resolve');
    await game.choose(2, PANIER_PAWNS[0].id);
    expect(game.state().pending?.playerId).toBe(-1);
  });

  it('waits for the player to draw a landed card manually', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(5);
    await game.start();
    await game.choose(1, PANIER_PAWNS[0].id);
    await game.choose(2, PANIER_PAWNS[1].id);
    const actor = game.state().turn?.currentPlayerId ?? 1;
    const cardsBefore =
      game.inspect.deckCount('events') + game.inspect.deckCount('exchanges');

    await game.as(actor).do('roll', {});

    expect(game.availableActions(actor)).toContain('draw_card');
    expect(game.availableActions(actor)).not.toContain('roll');
    expect(game.state().turn?.currentPlayerId).toBe(actor);
    expect(
      game.inspect.deckCount('events') + game.inspect.deckCount('exchanges'),
    ).toBe(cardsBefore);

    await game.as(actor).do('draw_card', {});

    expect(
      game.inspect.deckCount('events') + game.inspect.deckCount('exchanges'),
    ).toBe(cardsBefore - 1);
    const drawMessage = (await game.events())
      .filter(
        (event) =>
          event.type === 'game.message' && event.data.key === 'game.card.drawn',
      )
      .at(-1);
    expect(drawMessage?.data.params).toMatchObject({
      automatic: false,
      revealed: true,
      cardLabel: expect.any(String),
      effectDescription: expect.any(String),
    });
    // The sole opponent is selected automatically and has no items to swap.
    expect(drawMessage?.data.params).toHaveProperty('cardId', 'echange-masque');
    expect(game.state().pending).toBeNull();
    expect(game.state().turn?.currentPlayerId).toBe(actor === 1 ? 2 : 1);
    expect(game.availableActions(actor)).not.toContain('draw_card');
  });

  it('keeps bots playing through automatic cards and intermediate choices', async () => {
    const initial = await testGame(gameDefinition)
      .players(['Mouche', 'Hacene'])
      .seed(83)
      .start();
    const result = new GameSimulator().run(
      new DeclarativeGameRuntime(gameDefinition),
      initial.state(),
      { maxCommands: 150 },
    );

    expect(result.status).not.toBe('deadlock');
    expect(result.error).toBeUndefined();
    expect(result.eventFrequency['card.drawn']).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(128);
    expect(
      Object.values(result.eventFrequency).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(result.events.length);
    const manualDrawMessages = result.events.filter(
      (event) =>
        event.type === 'game.message' && event.data?.key === 'game.card.drawn',
    );
    expect(manualDrawMessages).not.toHaveLength(0);
    expect(manualDrawMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            params: expect.objectContaining({ automatic: false }),
          }),
        }),
      ]),
    );
  });
});
