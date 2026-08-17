function formatPlayerName(name: string): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Un joueur';
}

function formatBotName(name: string): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Un bot';
}

export function buildPlayerJoinedMessage(
  name: string,
  spectator: boolean,
): string {
  return `${formatPlayerName(name)}${spectator ? ' (spectateur)' : ''} a rejoint la table.`;
}

export function buildPlayerBecamePlayerMessage(name: string): string {
  return `${formatPlayerName(name)} est passé en mode joueur.`;
}

export function buildPlayerBecameSpectatorMessage(name: string): string {
  return `${formatPlayerName(name)} est passé en mode spectateur.`;
}

export function buildPlayerLeftMessage(
  name: string,
  spectator: boolean,
): string {
  return `${formatPlayerName(name)}${spectator ? ' (spectateur)' : ''} a quitté la table.`;
}

export function buildBotJoinedMessage(name: string): string {
  return `${formatBotName(name)} a rejoint la table.`;
}

export function buildBotLeftMessage(name: string): string {
  return `${formatBotName(name)} a quitté la table.`;
}
