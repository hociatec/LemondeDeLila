import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import { A_FOND_CARD_COUNT } from './rules';
import gameDefinition from './game';

describe('À fond les ballons declarative game', () => {
  it('selects unique pawns then resolves a deterministic roll', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(83);
    await game.start();
    const starter = game.state().pending?.playerId ?? 1;
    const initialView = game.view(starter) as unknown as {
      pending: {
        workflowKind?: string;
        playerId?: number;
        data?: { choiceActionsByIndex?: unknown[] };
      } | null;
      kits: StableGameKitsView;
    };
    expect(initialView.pending).toMatchObject({
      workflowKind: 'pawn',
      playerId: starter,
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

    await game.choose(starter, 'capitaine-cacahuete');
    const second = starter === 1 ? 2 : 1;
    const starterView = game.view(starter) as unknown as {
      kits: StableGameKitsView;
    };
    expect(
      starterView.kits.pawns?.sets['balloons-pawns'].assignments[
        String(starter)
      ],
    ).toEqual(['capitaine-cacahuete']);
    expect(game.view(second).pending).toMatchObject({
      workflowKind: 'pawn',
      playerId: second,
    });
    await game.choose(second, 'professeur-gribouille');
    expect(game.inspect.setupComplete()).toBe(true);
    await game.as(starter).do('roll', {});
    expect(game.inspect.lastRoll()).toBeGreaterThanOrEqual(1);
    expect(game.inspect.deckCount()).toBe(A_FOND_CARD_COUNT - 1);
    expect(await game.replay()).toEqual(game.state());
  });
});
