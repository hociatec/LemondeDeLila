export function gridPawnMessage(
  key: string,
  params: Record<string, unknown>,
  name: string,
): string {
  if (key !== 'game.grid.pawn.positioned' && key !== 'game.grid.pawn.moved')
    return '';
  const { x, y } = params;
  if (
    !name ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    x < 0 ||
    y < 0
  )
    return '';
  let column = '';
  for (let n = x + 1; n > 0; n = Math.floor((n - 1) / 26))
    column = String.fromCharCode(65 + ((n - 1) % 26)) + column;
  const verb =
    key === 'game.grid.pawn.positioned'
      ? name === 'Vous'
        ? 'vous positionnez'
        : 'se positionne'
      : name === 'Vous'
        ? 'vous déplacez'
        : 'se déplace';
  return `${name} ${verb} en ${column}${y + 1}.`;
}
