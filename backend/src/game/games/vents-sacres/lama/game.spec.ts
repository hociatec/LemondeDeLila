import { testGame } from '../../../engine/sdk/public-api';
import type { LamaCard } from './content';
import { nextLamaValue } from './content';
import gameDefinition from './game';

describe('LAMA declarative game', () => {
  it('publishes P for the available leave-round action', async () => {
    expect(gameDefinition.actions.lama_quit.ui).toMatchObject({
      shortcut: 'P',
      label: 'Sortir de la manche',
    });

    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    await game.as(1).do('game.configure', {});
    const actor = game.state().turn?.currentPlayerId ?? 1;
    expect(game.availableActions(actor)).toContain('lama_quit');
    await game.as(actor).do('lama_quit', {});
    const hiddenHand = (game.view(actor) as any).kits.cards.hands['lama-hands']
      .byPlayer[String(actor)];
    expect(hiddenHand).toEqual({ count: game.inspect.hand(actor).length });
  });

  it('keeps hands private and replays a configured round', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    const view = game.view(1) as {
      actionCatalog: Array<{ type: string }>;
    };
    const configuration = view.actionCatalog.find(
      (action) => action.type === 'game.configure',
    );
    expect(configuration).toMatchObject({
      ui: { label: 'Démarrer la partie', control: 'form' },
      input: {
        properties: {
          loseAtScore: {
            label: "Seuil de jetons d'élimination",
            initialText: '40',
          },
          allowPlayAfterDraw: {
            label: 'Autoriser à jouer après avoir pioché',
            initialText: 'false',
          },
        },
      },
    });
    await game.as(1).do('game.configure', {});
    const scores = (game.view(1) as any).kits?.score?.byPlayer;
    expect(scores).toEqual({ '1': 0, '2': 0 });
    const actor = game.state().turn?.currentPlayerId ?? 1;
    const actions = game.availableActions(actor);
    if (actions.includes('lama_play')) {
      const state = game.state() as ReturnType<typeof game.state> & {
        engine: { kits: { cards: { discards: Record<string, LamaCard[]> } } };
      };
      const top = state.engine.kits.cards.discards.lama.at(-1);
      const value = game.inspect.hand(actor).find((card) => {
        return top != null && (card === top || card === nextLamaValue(top));
      });
      if (value != null) await game.as(actor).do('lama_play', { value });
    } else await game.as(actor).do('draw', {});
    expect(game.inspect.hand(1).length).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('allows exactly one card action per player turn', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    await game.as(1).do('game.configure', {});
    const actor = game.state().turn?.currentPlayerId ?? 1;
    const actions = game.availableActions(actor);
    if (actions.includes('lama_play')) {
      const state = game.state() as ReturnType<typeof game.state> & {
        engine: { kits: { cards: { discards: Record<string, LamaCard[]> } } };
      };
      const top = state.engine.kits.cards.discards.lama.at(-1);
      const value = game.inspect
        .hand(actor)
        .find(
          (card) =>
            top != null && (card === top || card === nextLamaValue(top)),
        );
      expect(value).toBeDefined();
      await game.as(actor).do('lama_play', { value: value! });
    } else {
      await game.as(actor).do('draw', {});
    }
    expect(game.state().turn?.currentPlayerId).not.toBe(actor);
    expect(game.availableActions(actor)).not.toEqual(
      expect.arrayContaining(['lama_play', 'draw', 'lama_pass', 'lama_quit']),
    );
    await expect(game.as(actor).do('draw', {})).rejects.toThrow();
  });

  it('forbids drawing for the rest of the round after a player leaves', async () => {
    const game = testGame(gameDefinition)
      .players(['Lila', 'Mina', 'Nora'])
      .seed(137);
    await game.start();
    await game.as(1).do('game.configure', {});
    const leavingPlayer = game.state().turn?.currentPlayerId ?? 1;

    await game.as(leavingPlayer).do('lama_quit', {});

    const nextPlayer = game.state().turn?.currentPlayerId;
    expect(nextPlayer).toBeDefined();
    expect(game.availableActions(nextPlayer!)).not.toContain('draw');
    await expect(game.as(nextPlayer!).do('draw', {})).rejects.toThrow();
  });

  it('never exposes the drawn card value in the public narrative', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    await game.as(1).do('game.configure', {});
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('draw', {});

    const message = game.state().log.at(-1);
    expect(message?.key).toBe('game.card.drawn');
    const params = message?.params ?? {};
    expect(params).toMatchObject({ playerId: actor, deckId: 'lama' });
    expect(params).not.toHaveProperty('cardId');
    expect(params).not.toHaveProperty('cardLabel');
  });
});
