export function turnAnnouncement(playerLabel: string): string {
  const name = String(playerLabel ?? '').trim() || 'Joueur';
  return `C'est au tour de ${name}.`;
}

export function starterTurnAnnouncement(playerLabel: string): string {
  const name = String(playerLabel ?? '').trim() || 'Joueur';
  return `C'est au tour de ${name} de débuter.`;
}

export function hasRecentPawnSelectionLogs(
  log: Array<{ message?: unknown }> | null | undefined,
): boolean {
  const recentMessages = Array.isArray(log)
    ? log
        .slice(-6)
        .map((entry) => {
          const raw = entry?.message;
          if (typeof raw === 'string') return raw.trim();
          if (typeof raw === 'number' && Number.isFinite(raw))
            return String(raw);
          if (typeof raw === 'boolean') return raw ? 'true' : 'false';
          return '';
        })
        .filter((message) => message.length > 0)
    : [];

  return recentMessages.some(
    (message) =>
      message.includes('a choisi le pion:') ||
      message.includes('de choisir son pion.'),
  );
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
