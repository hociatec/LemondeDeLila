import {
  testGame,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Gérard président declarative game', () => {
  it('uses numeric player IDs for a bot judge independently of submission insertion order', async () => {
    const game = await testGame(gameDefinition)
      .players([
        { username: 'Judge', isBot: true },
        { username: 'First', isBot: true },
        { username: 'Second', isBot: true },
      ])
      .seed(53)
      .start();
    await game.as(-1).do('set_theme', {});
    await game.as(-2).do('play_name', { names: [game.inspect.hand(-2)[0]] });
    await game.as(-3).do('play_name', { names: [game.inspect.hand(-3)[0]] });
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    expect(runtime.getBotActions(game.state(), -1)?.[0]).toMatchObject({
      type: 'choose_winner',
      payload: { winnerId: -3 },
    });
  });
  it('only offers eligible participants for a forced submission', async () => {
    const game = await testGame(gameDefinition)
      .players(['One', 'Two', 'Three'])
      .seed(19)
      .start();
    await game.as(1).do('set_theme', {});
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    const candidates = runtime
      .getAvailableActions(game.state(), 2)
      .filter((action) => action.payload?.cardId === 'special-main-fantome');
    expect(candidates.map((action) => action.payload?.targetPlayerId)).toEqual([
      3,
    ]);
    const before = game.state();
    const events = await game.events();
    await expect(
      game.as(2).do('play_special', {
        cardId: 'special-main-fantome',
        targetPlayerId: 1,
      }),
    ).rejects.toThrow();
    expect(game.state()).toEqual(before);
    expect(await game.events()).toEqual(events);
    await game.as(2).do('play_special', {
      cardId: 'special-main-fantome',
      targetPlayerId: 3,
    });
    expect(await game.replay()).toEqual(game.state());
  });
  it('keeps submissions secret until the jury vote', async () => {
    const game = testGame(gameDefinition)
      .players(['Gérard', 'Josette', 'Kevin'])
      .seed(53);
    await game.start();
    await game.as(1).do('set_theme', {});
    const name = game.inspect.hand(2)[0];
    await game.as(2).do('play_name', { names: [name] });
    const kits = (game.view(3) as unknown as { kits: StableGameKitsView }).kits;
    const session = kits.submissions.sessions['cards-theme-name.names'];
    expect(session.submittedPlayerIds).toEqual([2]);
    expect(session.valuesByPlayerId).toBeUndefined();
    expect(session.ownValue).toBeUndefined();
  });

  it('replays a deterministic theme draw', async () => {
    const game = testGame(gameDefinition)
      .players(['Gérard', 'Josette', 'Kevin'])
      .seed(54);
    await game.start();
    await game.as(1).do('set_theme', {});
    expect(game.view(1).currentTheme).not.toBeNull();
    expect(await game.replay()).toEqual(game.state());
  });

  it('continues snapshots created before the JSON migration', async () => {
    const game = await testGame(gameDefinition).players(3).seed(55).start();
    const source = game.state();
    source.engine.contentVersion =
      'gerard-president@content:25d38394';
    const restored = new DeclarativeGameRuntime(gameDefinition).applyActions(
      source,
      [],
    );
    expect(restored.engine.contentVersion).toBe('1');
  });
});
