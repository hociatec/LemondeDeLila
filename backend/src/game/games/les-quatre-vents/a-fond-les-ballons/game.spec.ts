import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import { A_FOND_CARD_COUNT } from './rules';
import gameDefinition from './game';

describe('À fond les ballons declarative game', () => {
  it('lets bots resolve the same announced pawn choice as human players', async () => {
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
      playerIds: [1, -2],
      resolvedPlayerIds: [],
    });

    await game.choose(-2, 'professeur-gribouille');
    expect(
      (game.view(1) as unknown as { kits: StableGameKitsView }).kits.pawns
        ?.sets['balloons-pawns'].assignments['-2'],
    ).toEqual(['professeur-gribouille']);
    expect(game.view(1).pending).toMatchObject({
      playerIds: [1, -2],
      resolvedPlayerIds: [-2],
    });
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
      ]),
    );
    expect(initialView.kits.pawns?.sets['balloons-pawns'].owners).toEqual({});
    expect(game.view(2).pending).toMatchObject({
      workflowKind: 'pawn',
      playerIds: [1, 2],
      resolvedPlayerIds: [],
      data: {
        choiceActionsByIndex: expect.arrayContaining([
          {
            type: 'choice.resolve',
            payload: { value: 'professeur-gribouille' },
          },
        ]),
      },
    });

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
      playerIds: [1, 2],
      resolvedPlayerIds: [firstChooser],
    });
    expect(secondPending?.data?.choiceActionsByIndex).not.toContainEqual({
      type: 'choice.resolve',
      payload: { value: 'capitaine-cacahuete' },
    });
    await game.choose(second, 'professeur-gribouille');
    expect(game.inspect.setupComplete()).toBe(true);
    const gameplayStarter = game.state().turn?.currentPlayerId ?? 1;
    await game.as(gameplayStarter).do('roll', {});
    expect(game.inspect.lastRoll()).toBeGreaterThanOrEqual(1);
    expect(game.inspect.deckCount()).toBe(A_FOND_CARD_COUNT - 1);
    expect(await game.replay()).toEqual(game.state());
  });
});
