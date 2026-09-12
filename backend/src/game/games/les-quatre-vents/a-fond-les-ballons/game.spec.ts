import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import catalogue from './catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});
const A_FOND_CARD_COUNT = catalogue.cards.length;

describe('À fond les ballons declarative game', () => {
  it('requires every participant to choose a pawn in roster order', async () => {
    const game = testGame(gameDefinition)
      .players(['Hacene', { username: 'Baloo', isBot: true }])
      .seed(83);
    await game.start();

    const view = game.view(1) as unknown as {
      pending: object | null;
      kits: StableGameKitsView;
    };
    expect(view.kits.pawns?.sets['balloons-pawns'].assignments['-2']).toEqual(
      [],
    );
    expect(view.pending).toMatchObject({
      label: 'Choisissez votre pion.',
      playerId: 1,
    });
    expect(game.availableActions(-2)).not.toContain('choice.resolve');
    const selectionRequests = (
      game.state() as unknown as {
        engine?: {
          pendingEvents?: Array<{
            type: string;
            data: { key?: string; params?: { playerId?: number } };
          }>;
        };
      }
    ).engine?.pendingEvents?.filter(
      (event) =>
        event.type === 'game.message' &&
        event.data.key === 'game.pawn.selection-requested',
    );
    expect(selectionRequests?.at(-1)?.data.params?.playerId).toBe(1);

    await game.choose(1, 'capitaine-cacahuete');
    expect(game.inspect.setupComplete()).toBe(false);
    expect(game.view(-2).pending).toMatchObject({
      label: 'Choisissez votre pion.',
      playerId: -2,
    });
    expect(game.availableActions(1)).toEqual([]);
    expect(game.availableActions(-2)).toContain('choice.resolve');

    await game.choose(-2, 'professeur-gribouille');
    expect(
      (game.view(1) as unknown as { kits: StableGameKitsView }).kits.pawns
        ?.sets['balloons-pawns'].assignments['-2'],
    ).toEqual(['professeur-gribouille']);
    expect(game.inspect.setupComplete()).toBe(true);
  });

  it('offers the first pawn choice to a human even when a bot is first in the roster', async () => {
    const game = testGame(gameDefinition)
      .players([{ username: 'Baloo', isBot: true }, 'Hacene'])
      .seed(83);

    await game.start();

    expect(game.state().pending?.playerId).toBe(2);
    expect(game.availableActions(2)).toContain('choice.resolve');
    expect(game.availableActions(-1)).not.toContain('choice.resolve');
    const setupTurn = (
      game.state() as unknown as {
        engine?: {
          pendingEvents?: Array<{
            type: string;
            data: { playerId?: number; announce?: boolean };
          }>;
        };
      }
    ).engine?.pendingEvents
      ?.filter(
        (event) => event.type === 'turn.started' && event.data.playerId === 2,
      )
      .at(-1);
    expect(setupTurn?.data.announce).toBe(false);
  });

  it('selects unique pawns then resolves a deterministic roll', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(83);
    await game.start();
    const firstChooser = game.state().pending?.playerId ?? 1;
    expect(firstChooser).toBe(1);
    const initialView = game.view(firstChooser) as unknown as {
      pending: {
        workflowKind?: string;
        playerId?: number;
        data?: { choiceActionsByIndex?: unknown[] };
      } | null;
      kits: StableGameKitsView;
    };
    expect(initialView.pending).toMatchObject({
      workflowKind: 'pawn',
      playerId: firstChooser,
    });
    expect(initialView.pending?.data?.choiceActionsByIndex).toEqual(
      expect.arrayContaining([
        {
          type: 'choice.resolve',
          payload: { value: 'capitaine-cacahuete' },
        },
        {
          type: 'choice.resolve',
          payload: { value: 'professeur-gribouille' },
        },
      ]),
    );
    expect(initialView.kits.pawns?.sets['balloons-pawns'].owners).toEqual({});
    expect(game.view(2).pending).toMatchObject({
      workflowKind: 'pawn',
      playerId: firstChooser,
    });
    expect(game.availableActions(2)).not.toContain('choice.resolve');

    await game.choose(firstChooser, 'capitaine-cacahuete');
    const second = firstChooser === 1 ? 2 : 1;
    const firstChooserView = game.view(firstChooser) as unknown as {
      kits: StableGameKitsView;
    };
    expect(
      firstChooserView.kits.pawns?.sets['balloons-pawns'].assignments[
        String(firstChooser)
      ],
    ).toEqual(['capitaine-cacahuete']);
    const secondPending = (
      game.view(second) as unknown as {
        pending: {
          data?: { choiceActionsByIndex?: unknown[] };
        } | null;
      }
    ).pending;
    expect(secondPending).toMatchObject({
      workflowKind: 'pawn',
      playerId: second,
    });
    expect(secondPending?.data?.choiceActionsByIndex).not.toContainEqual({
      type: 'choice.resolve',
      payload: { value: 'capitaine-cacahuete' },
    });
    await game.choose(second, 'professeur-gribouille');
    expect(game.inspect.setupComplete()).toBe(true);
    const gameplayStarter = game.state().turn?.currentPlayerId ?? 1;
    const deckBeforeRoll = game.inspect.deckCount();
    await game.as(gameplayStarter).do('roll', {});
    expect(game.inspect.lastRoll()).toBeGreaterThanOrEqual(1);
    expect(game.inspect.deckCount()).toBe(deckBeforeRoll);
    expect(game.availableActions(gameplayStarter)).toContain('draw_card');
    await game.as(gameplayStarter).do('draw_card', {});
    expect(game.inspect.deckCount()).toBe(A_FOND_CARD_COUNT - 1);
    const drawAnnouncement = (await game.events()).find(
      (event) =>
        event.type === 'game.message' && event.data.key === 'game.card.drawn',
    );
    expect(drawAnnouncement?.data.params).toEqual(
      expect.objectContaining({
        playerId: gameplayStarter,
        revealed: true,
        cardLabel: expect.any(String),
        effectDescription: expect.any(String),
      }),
    );
    expect(await game.replay()).toEqual(game.state());
  });

  it('continues a legacy snapshot waiting for a card draw', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(83);
    await game.start();
    await game.choose(1, 'capitaine-cacahuete');
    await game.choose(2, 'professeur-gribouille');
    const legacy = game.state();
    Reflect.set(legacy.game, 'awaitingCardDraw', true);
    legacy.engine!.contentVersion = 'a-fond-les-ballons@content:c5adb978';
    const actorId = legacy.turn!.currentPlayerId!;

    const restored = new DeclarativeGameRuntime(gameDefinition).applyActions(
      legacy,
      [{ type: 'draw_card', payload: {}, meta: { actorId } }],
    );

    expect(Reflect.get(restored.game, 'awaitingCardDraw')).toBe(false);
    expect(restored.engine?.contentVersion).toBe('1');
  });
});
