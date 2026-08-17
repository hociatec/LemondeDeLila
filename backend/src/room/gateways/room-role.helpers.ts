export function resolveTruthyFlag(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true' ||
    value === 'yes' ||
    value === 'y'
  );
}

export function resolveSpectatorIntent(
  spectatorRaw: unknown,
  hasSpectatorFlag: boolean,
  currentRole: 'participant' | 'spectator',
): boolean {
  if (!hasSpectatorFlag) {
    return currentRole !== 'spectator';
  }

  return resolveTruthyFlag(spectatorRaw);
}

export function buildRoomRoleClientMessage(spectator: boolean): string {
  return spectator
    ? 'Mode spectateur activé.'
    : 'Mode spectateur désactivé.';
}

export function buildRoomRoleAnnouncementMessage(
  spectator: boolean,
): string {
  return spectator ? 'Mode spectateur.' : 'Mode joueur.';
}
