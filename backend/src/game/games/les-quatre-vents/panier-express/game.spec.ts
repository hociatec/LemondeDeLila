import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import {
  PANIER_EVENTS,
  PANIER_EXCHANGES,
  PANIER_PAWNS,
  PANIER_QUIZZES,
  PANIER_TILES,
} from './content';
import gameDefinition from './game';

describe('Panier Express declarative game', () => {
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
    expect(game.inspect.setupComplete()).toBe(false);
    expect(game.view(-2).pending).toMatchObject({
      label: 'Choisissez votre pion.',
      playerId: -2,
    });
    expect(game.availableActions(1)).toEqual([]);
    expect(game.availableActions(-2)).toContain('choice.resolve');
    await game.choose(-2, botPawn.id);

    const pawns = (game.view(1) as unknown as { kits: StableGameKitsView }).kits
      .pawns?.sets.panier.assignments;
    expect(pawns?.['1']).toEqual([humanPawn.id]);
    expect(pawns?.['-2']).toEqual([botPawn.id]);
    expect(game.inspect.setupComplete()).toBe(true);
  });
});
