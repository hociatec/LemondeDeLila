import { testGame } from '../../../core/application/public-api';
import { MORPION_PAWNS } from './content';
import gameDefinition from './game';

describe('Morpion declarative game', () => {
  it('handles pawn choices, available cells, victory, logs and replay', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(3);
    await game.start();
    const firstChooser = game.state().pending?.playerId ?? 1;
    const secondChooser = firstChooser === 1 ? 2 : 1;

    await game.as(firstChooser).do(
      'choice.resolve' as never,
      {
        value: MORPION_PAWNS[0].id,
      } as never,
    );
    await game.as(secondChooser).do(
      'choice.resolve' as never,
      {
        value: MORPION_PAWNS[1].id,
      } as never,
    );
    expect(game.state().pending).toBeNull();
    expect(game.availableActions(1)).toHaveLength(9);

    await game.as(1).do('morpion_play', { x: 0, y: 0 });
    await game.as(2).do('morpion_play', { x: 0, y: 1 });
    await game.as(1).do('morpion_play', { x: 1, y: 0 });
    await game.as(2).do('morpion_play', { x: 1, y: 1 });
    await game.as(1).do('morpion_play', { x: 2, y: 0 });

    expect(game.state().status).toBe('finished');
    expect(game.result()?.winnerPlayerIds).toEqual([1]);
    expect(
      game
        .state()
        .log.some(
          (entry) =>
            entry.key === 'morpion.mark.placed' &&
            entry.params.x === 2 &&
            entry.params.y === 0,
        ),
    ).toBe(true);
    expect(await game.replay()).toEqual(game.state());
  });

  it('rejects occupied cells and proposes a strategic legal bot move', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(8);
    await game.start();
    const firstChooser = game.state().pending?.playerId ?? 1;
    const secondChooser = firstChooser === 1 ? 2 : 1;
    await game.as(firstChooser).do(
      'choice.resolve' as never,
      {
        value: MORPION_PAWNS[0].id,
      } as never,
    );
    await game.as(secondChooser).do(
      'choice.resolve' as never,
      {
        value: MORPION_PAWNS[1].id,
      } as never,
    );
    await game.as(1).do('morpion_play', { x: 1, y: 1 });

    await expect(game.as(2).do('morpion_play', { x: 1, y: 1 })).rejects.toThrow(
      'Action indisponible',
    );
  });
});
