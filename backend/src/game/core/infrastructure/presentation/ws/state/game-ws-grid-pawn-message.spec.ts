import { gridPawnMessage } from './game-ws-grid-pawn-message';

describe('gridPawnMessage', () => {
  it('announces starting positions and moves using chess-style coordinates', () => {
    expect(
      gridPawnMessage('game.grid.pawn.positioned', { x: 1, y: 1 }, 'Hacene'),
    ).toBe('Hacene se positionne en B2.');
    expect(
      gridPawnMessage('game.grid.pawn.moved', { x: 26, y: 2 }, 'Vous'),
    ).toBe('Vous vous déplacez en AA3.');
  });
  it('ignores unrelated events and invalid coordinates', () => {
    expect(gridPawnMessage('game.other', { x: 0, y: 0 }, 'Hacene')).toBe('');
    for (const x of [-1, 0.5, NaN, Infinity, '1', undefined])
      expect(
        gridPawnMessage('game.grid.pawn.moved', { x, y: 0 }, 'Hacene'),
      ).toBe('');
  });
});
