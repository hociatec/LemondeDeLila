export type TrackDefinition = {
  readonly component: 'movement.track';
  id: string;
  spaces: number;
  wrap?: boolean;
};

export type MovementKitState = {
  tracks: Record<string, TrackDefinition>;
  positions: Record<string, Record<string, number>>;
};

export const movement = {
  track(definition: Omit<TrackDefinition, 'component'>): TrackDefinition {
    if (!Number.isInteger(definition.spaces) || definition.spaces < 1) {
      throw new Error('Une piste doit contenir au moins une case');
    }
    return Object.freeze({ ...definition, component: 'movement.track' });
  },
};

export class GameMovementController {
  constructor(private readonly state: MovementKitState) {}

  createTrack(definition: TrackDefinition): void {
    this.state.tracks[definition.id] = definition;
    this.state.positions[definition.id] ??= {};
  }

  position(trackId: string, playerId: number): number {
    return this.state.positions[trackId]?.[String(playerId)] ?? 0;
  }

  move(trackId: string, playerId: number, distance: number): number {
    const track = this.state.tracks[trackId];
    if (!track) throw new Error(`Piste inconnue: ${trackId}`);
    const current = this.position(trackId, playerId);
    const raw = current + Math.trunc(distance);
    const next = track.wrap
      ? ((raw % track.spaces) + track.spaces) % track.spaces
      : Math.min(track.spaces - 1, Math.max(0, raw));
    (this.state.positions[trackId] ??= {})[String(playerId)] = next;
    return next;
  }
}

export function createMovementKitState(): MovementKitState {
  return { tracks: {}, positions: {} };
}
