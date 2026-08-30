import type { RoomPayload } from '../../../application/contracts/room-payload.model';

export function buildRoomInfoMessage(
  state: RoomPayload,
  role: 'participant' | 'spectator',
): string {
  const gameName = state.manifest?.name || state.room.gameType || 'Jeu';
  const visibility = state.room.isPrivate ? 'privée' : 'publique';
  const mode = role === 'spectator' ? 'spectateur' : 'joueur';

  const players = state.room.counts.players || state.room.players?.length || 0;
  const spectators =
    state.room.counts.spectators || state.room.spectators?.length || 0;
  const bots = state.room.bots?.length || 0;
  const total = players + spectators + bots;
  const peopleLabel = total === 1 ? 'personne' : 'personnes';

  return `${gameName}. Table ${visibility}. Mode ${mode}. ${total} ${peopleLabel} sur la table.`;
}
