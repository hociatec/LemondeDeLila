import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type TrackZoneCollectionProgram = TrackRaceProgram & {
  eventNamespace: string;
  collectedEvent: string;
  tiles: readonly {
    n: number;
    title: string;
    description?: string;
    type: 'card' | 'finish';
  }[];
  zones: readonly {
    id: number;
    minimumTile: number;
    maximumTile: number;
    deckId: string;
    resourceId: string;
  }[];
};
