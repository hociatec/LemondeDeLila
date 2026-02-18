export function turnAnnouncement(playerLabel: string): string {
  const name = String(playerLabel ?? '').trim() || 'Joueur';
  return `C'est au tour de ${name}.`;
}

export function pawnPlacement(params: {
  playerLabel: string;
  pawnLabel: string;
  position: number;
  tileLabel: string;
}): string {
  return `${params.playerLabel} place ${params.pawnLabel} en case ${params.position + 1} (${params.tileLabel}).`;
}

export function diceRoll(params: {
  playerLabel: string;
  value: number;
  sides?: number;
}): string {
  const sides = Number.isFinite(params.sides) ? Number(params.sides) : 6;
  return `${params.playerLabel} lance un dé (${params.value}/${sides}).`;
}

export function victoryAnnouncement(playerLabel: string): string {
  const name = String(playerLabel ?? '').trim() || 'Joueur';
  return `Victoire de ${name}.`;
}
